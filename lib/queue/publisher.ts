import prisma from '../prisma';
import { platformRegistry, SocialPlatformType } from '../../integrations';
import { decryptToken, encryptToken } from '../crypto';
import { assertWorkspaceActive } from '../billing';
import { resolveMediaAccessUrl } from '../storage/r2';
import { safeCleanupMediaAsset } from '../storage/r2-cleanup';
import {
  assertMetaAccountTokenUsable,
  isLikelyMetaTokenError,
  isMetaPlatform,
  markMetaAccountNeedsReconnection,
} from '../meta-token-service';

export interface PublishExecutionResult {
  contentPostId: string;
  overallStatus: 'PUBLISHED' | 'INBOX_DRAFT' | 'MANUAL_READY' | 'PROCESSING' | 'PARTIALLY_FAILED' | 'FAILED';
  platformResults: Array<{
    platformPostId: string;
    platform: string;
    status: string;
    statusMessage?: string;
    externalPostUrl?: string;
    errorMessage?: string;
  }>;
}

export class PublishingEngine {
  /**
   * Execute publishing for all platform targets in a ContentPost
   */
  static async reconcileProcessingPosts(): Promise<void> {
    try {
      const oneMinuteAgo = new Date(Date.now() - 60000);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60000);

      const stuckPlatforms = await prisma.platformPost.findMany({
        where: {
          OR: [
            // Posts with externalPostId waiting for status resolution
            {
              status: 'PROCESSING',
              updatedAt: { lte: oneMinuteAgo },
              externalPostId: { not: null },
            },
            // Posts stuck in UPLOADING with no progress for >5 mins
            {
              status: 'UPLOADING',
              updatedAt: { lte: fiveMinutesAgo },
            },
            // Posts stuck in PROCESSING without externalPostId for >5 mins
            {
              status: 'PROCESSING',
              updatedAt: { lte: fiveMinutesAgo },
              externalPostId: null,
            },
          ],
        },
        include: {
          socialAccount: { include: { token: true } },
          contentPost: {
            include: {
              platformPosts: true,
            },
          },
        },
      });

      for (const pPost of stuckPlatforms) {
        if (pPost.socialAccount.isMock) continue;

        let newChildStatus = pPost.status;

        // If post has no external ID and has stalled in UPLOADING or PROCESSING for >5 mins, mark FAILED
        if (!pPost.externalPostId && (pPost.status === 'UPLOADING' || pPost.status === 'PROCESSING')) {
          console.log(`[RECONCILE] PlatformPost ${pPost.id} (${pPost.platform}) stalled in ${pPost.status} without external ID. Transitioning to FAILED.`);
          newChildStatus = 'FAILED';
          const errMsg = `${pPost.platform} upload was interrupted before completion. Ready for retry.`;
          await prisma.platformPost.update({
            where: { id: pPost.id },
            data: {
              status: 'FAILED',
              errorMessage: errMsg,
            },
          });
          await prisma.publishingJob.updateMany({
            where: { platformPostId: pPost.id, status: { in: ['PROCESSING', 'QUEUED'] } },
            data: {
              status: 'FAILED',
              errorMessage: errMsg,
              completedAt: new Date(),
            },
          });
        } else if (!pPost.externalPostId) {
          continue;
        } else if (pPost.platform === 'INSTAGRAM') {
          console.log(`[RECONCILE] Checking existing container: ${pPost.externalPostId}`);
          try {
            const rawToken = pPost.socialAccount.token?.accessToken || '';
            const accessToken = decryptToken(rawToken);

            const statusUrl = `https://graph.instagram.com/v23.0/${pPost.externalPostId}?fields=status_code,status&access_token=${accessToken}`;
            const statusRes = await fetch(statusUrl);
            const statusData = await statusRes.json().catch(() => ({}));

            console.log(`[RECONCILE] Status: ${statusData.status_code || 'UNKNOWN'}`);

            if (statusData.status_code === 'FINISHED' || statusData.status_code === 'PUBLISHED') {
              const publishUrl = `https://graph.instagram.com/v23.0/${pPost.socialAccount.platformAccountId}/media_publish`;
              const pubRes = await fetch(publishUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ creation_id: pPost.externalPostId, access_token: accessToken }),
              });
              const pubData = await pubRes.json().catch(() => ({}));

              if (pubRes.ok && pubData.id) {
                newChildStatus = 'PUBLISHED';
                let permalink = '';
                try {
                  const metaRes = await fetch(`https://graph.instagram.com/v21.0/${pubData.id}?fields=permalink&access_token=${accessToken}`);
                  const metaData = await metaRes.json();
                  if (metaData && metaData.permalink) {
                    permalink = metaData.permalink;
                  }
                } catch (err) {
                  console.error('[RECONCILE] Failed to fetch permalink:', err);
                }

                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    externalPostId: pubData.id,
                    externalPostUrl: permalink || undefined,
                    errorMessage: null,
                  },
                });
                console.log(`[RECONCILE] Final status: PUBLISHED`);
              } else if (pubData.error) {
                newChildStatus = 'FAILED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'FAILED',
                    errorMessage: pubData.error.message || 'Instagram publishing failed on finalize',
                  },
                });
                console.log(`[RECONCILE] Final status: FAILED (${pubData.error.message})`);
              }
            } else if (statusData.status_code === 'ERROR') {
              newChildStatus = 'FAILED';
              await prisma.platformPost.update({
                where: { id: pPost.id },
                data: {
                  status: 'FAILED',
                  errorMessage: 'Instagram processing error: Media container could not be published',
                },
              });
              console.log(`[RECONCILE] Final status: FAILED`);
            }
          } catch (err) {
            console.error('[RECONCILE] Error querying Instagram status API:', err);
          }
        } else if (pPost.platform === 'TIKTOK') {
          try {
            console.log(`[RECONCILE] Checking TikTok publish_id: ${pPost.externalPostId}`);
            const rawToken = pPost.socialAccount.token?.accessToken || '';
            const accessToken = decryptToken(rawToken);

            const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ publish_id: pPost.externalPostId }),
            });

            const statusData = await statusRes.json().catch(() => ({}));
            if (statusRes.ok && statusData.data) {
              const rawStatus = statusData.data.status || '';
              console.log(`[RECONCILE] TikTok status: ${rawStatus}`);

              if (rawStatus === 'PUBLISH_COMPLETE' || rawStatus === 'SUCCESS') {
                newChildStatus = 'PUBLISHED';
                const publicPostId = statusData.data.public_post_id;
                const username = pPost.socialAccount?.username || '';
                const postUrl = publicPostId
                  ? `https://www.tiktok.com/@${username || 'creator'}/video/${publicPostId}`
                  : pPost.externalPostUrl;

                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    externalPostUrl: postUrl,
                    errorMessage: null,
                  },
                });
                console.log(`[RECONCILE] TikTok post marked PUBLISHED`);
              } else if (rawStatus === 'SEND_TO_USER_INBOX') {
                newChildStatus = 'INBOX_DRAFT';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'INBOX_DRAFT',
                    errorMessage: 'Sent to TikTok Creator Inbox (Draft upload)',
                  },
                });
                console.log(`[RECONCILE] TikTok post marked INBOX_DRAFT`);
              } else if (rawStatus === 'FAILED') {
                newChildStatus = 'FAILED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'FAILED',
                    errorMessage: statusData.data.fail_reason || 'TikTok publishing failed',
                  },
                });
                console.log(`[RECONCILE] TikTok post marked FAILED`);
              }
            }
          } catch (err: any) {
            console.error(`[RECONCILE] Error querying TikTok status API:`, err);
          }
        } else if (pPost.platform === 'YOUTUBE') {
          try {
            console.log(`[RECONCILE] Checking YouTube Video ${pPost.externalPostId}...`);
            const rawToken = pPost.socialAccount.token?.accessToken || '';
            const accessToken = decryptToken(rawToken);
            
            const ytUrl = `https://youtube.googleapis.com/youtube/v3/videos?part=status,player&id=${pPost.externalPostId}`;
            const ytRes = await fetch(ytUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
            const ytData = await ytRes.json().catch(() => ({}));

            if (ytRes.ok && ytData.items && ytData.items.length > 0) {
              const video = ytData.items[0];
              const uploadStatus = video.status?.uploadStatus;
              
              console.log(`[RECONCILE] YouTube uploadStatus: ${uploadStatus}`);
              
              if (uploadStatus === 'processed' || uploadStatus === 'uploaded') {
                newChildStatus = 'PUBLISHED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'PUBLISHED',
                    errorMessage: null,
                    externalPostUrl: `https://www.youtube.com/watch?v=${pPost.externalPostId}`
                  }
                });
                console.log(`[RECONCILE] Final status: PUBLISHED`);
              } else if (uploadStatus === 'rejected' || uploadStatus === 'failed') {
                newChildStatus = 'FAILED';
                await prisma.platformPost.update({
                  where: { id: pPost.id },
                  data: {
                    status: 'FAILED',
                    errorMessage: `YouTube processing failed: ${video.status?.failureReason || uploadStatus}`
                  }
                });
                console.log(`[RECONCILE] Final status: FAILED`);
              }
            } else if (!ytRes.ok) {
               console.error('[RECONCILE] YouTube API error:', ytData);
            }
          } catch(err) {
            console.error(`[RECONCILE] Error querying YouTube API:`, err);
          }
        }

        // If the child status changed, re-evaluate the parent ContentPost status
        if (newChildStatus !== pPost.status) {
          const updatedPlatformPosts = await prisma.platformPost.findMany({
            where: { contentPostId: pPost.contentPostId },
          });

          let publishedCount = 0;
          let inboxDraftCount = 0;
          let processingCount = 0;
          let uploadingCount = 0;
          let failCount = 0;

          for (const p of updatedPlatformPosts) {
            if (p.status === 'PUBLISHED') publishedCount++;
            else if (p.status === 'INBOX_DRAFT') inboxDraftCount++;
            else if (p.status === 'PROCESSING') processingCount++;
            else if (p.status === 'UPLOADING') uploadingCount++;
            else if (p.status === 'FAILED') failCount++;
          }

          let finalStatus = pPost.contentPost.status;
          if (publishedCount === updatedPlatformPosts.length && publishedCount > 0) {
            finalStatus = 'PUBLISHED';
          } else if (inboxDraftCount === updatedPlatformPosts.length && inboxDraftCount > 0) {
            finalStatus = 'INBOX_DRAFT';
          } else if (
            publishedCount + inboxDraftCount === updatedPlatformPosts.length &&
            (publishedCount > 0 || inboxDraftCount > 0)
          ) {
            finalStatus = publishedCount > 0 ? 'PUBLISHED' : 'INBOX_DRAFT';
          } else if (failCount === updatedPlatformPosts.length && failCount > 0) {
            finalStatus = 'FAILED';
          } else if (publishedCount > 0 && failCount > 0) {
            finalStatus = 'PARTIALLY_FAILED';
          } else if (processingCount > 0 || uploadingCount > 0) {
            finalStatus = failCount > 0 ? 'PARTIALLY_FAILED' : 'PROCESSING';
          } else if (failCount > 0) {
            finalStatus = 'PARTIALLY_FAILED';
          }

          if (finalStatus !== pPost.contentPost.status) {
            await prisma.contentPost.update({
              where: { id: pPost.contentPostId },
              data: {
                status: finalStatus,
                publishedAt: finalStatus === 'PUBLISHED' ? new Date() : pPost.contentPost.publishedAt,
              },
            });
            console.log(`[RECONCILE] Parent ContentPost ${pPost.contentPostId} updated to ${finalStatus}`);
          }
        }
      }
    } catch (error) {
      console.error('[RECONCILE] Error during reconciliation:', error);
    }
  }

  static async publishContentPost(contentPostId: string): Promise<PublishExecutionResult> {
    const post = await prisma.contentPost.findUnique({
      where: { id: contentPostId },
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: {
              include: {
                token: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      throw new Error(`ContentPost not found: ${contentPostId}`);
    }

    await assertWorkspaceActive(post.workspaceId);

    // Mark ContentPost as PROCESSING
    await prisma.contentPost.update({
      where: { id: contentPostId },
      data: { status: 'PROCESSING' },
    });

    const platformResults: PublishExecutionResult['platformResults'] = [];
    let successCount = 0;
    let inboxDraftCount = 0;
    let manualReadyCount = 0;
    let processingCount = 0;
    let failCount = 0;

    for (const pPost of post.platformPosts) {
      // Create a PublishingJob record
      const job = await prisma.publishingJob.create({
        data: {
          platformPostId: pPost.id,
          status: 'PROCESSING',
          startedAt: new Date(),
        },
      });

      // Update PlatformPost status to PROCESSING
      await prisma.platformPost.update({
        where: { id: pPost.id },
        data: { status: 'PROCESSING', errorMessage: null },
      });

      try {
        const platformType = pPost.platform as SocialPlatformType;
        const adapter = platformRegistry.get(platformType);

        await assertMetaAccountTokenUsable(pPost.socialAccount);

        const rawToken = pPost.socialAccount.token?.accessToken || '';
        const decryptedToken = decryptToken(rawToken);

        let finalAccessToken = decryptedToken;

        // Auto-refresh TikTok / YouTube token if near or past expiration before publishing
        if ((platformType === 'TIKTOK' || platformType === 'YOUTUBE') && pPost.socialAccount.token) {
          const tokenRecord = pPost.socialAccount.token;
          const isNearOrPastExpiry =
            tokenRecord.expiresAt &&
            new Date(tokenRecord.expiresAt).getTime() <= Date.now() + 5 * 60 * 1000;

          if (isNearOrPastExpiry && tokenRecord.refreshToken) {
            try {
              const decryptedRefreshToken = decryptToken(tokenRecord.refreshToken);
              const refreshRes = await adapter.refreshToken(decryptedRefreshToken);

              if (refreshRes && refreshRes.accessToken) {
                finalAccessToken = refreshRes.accessToken;
                const newEncryptedAccess = encryptToken(refreshRes.accessToken);
                const newEncryptedRefresh = refreshRes.refreshToken
                  ? encryptToken(refreshRes.refreshToken)
                  : tokenRecord.refreshToken;
                const newExpiresAt = refreshRes.expiresIn
                  ? new Date(Date.now() + refreshRes.expiresIn * 1000)
                  : tokenRecord.expiresAt;

                await prisma.oAuthToken.update({
                  where: { socialAccountId: pPost.socialAccountId },
                  data: {
                    accessToken: newEncryptedAccess,
                    refreshToken: newEncryptedRefresh,
                    expiresAt: newExpiresAt,
                  },
                });

                console.log(
                  `[Queue Publisher] Successfully refreshed expired ${platformType} token for @${pPost.socialAccount.username}`
                );
              }
            } catch (refreshErr: any) {
              console.error(
                `[Queue Publisher] ${platformType} token refresh failed for @${pPost.socialAccount.username}:`,
                refreshErr
              );

              await prisma.socialAccount.update({
                where: { id: pPost.socialAccountId },
                data: { status: 'EXPIRED' },
              });

              throw new Error(
                `${platformType} session for @${pPost.socialAccount.username} has expired and could not be refreshed. Please reconnect account in Social Accounts.`
              );
            }
          }
        }

        let metadataObj: Record<string, any> = {};
        try {
          if (pPost.metadata) metadataObj = JSON.parse(pPost.metadata);
        } catch {
          // ignore
        }
        
        // Inject exact media size and filename from database to assist resilient uploading
        if (post.mediaAsset) {
          metadataObj.mediaSize = post.mediaAsset.size;
          metadataObj.mediaMimeType = post.mediaAsset.mimeType;
          metadataObj.mediaFilename = post.mediaAsset.originalName || post.mediaAsset.filename;
        }

        // Determine media type & resolve private R2 access URL
        let mediaType: 'IMAGE' | 'VIDEO' | 'TEXT' = 'TEXT';
        let resolvedMediaUrl = post.mediaAsset?.url;

        if (post.mediaAsset) {
          mediaType = post.mediaAsset.mimeType.startsWith('video/') ? 'VIDEO' : 'IMAGE';
          if (resolvedMediaUrl) {
            resolvedMediaUrl = await resolveMediaAccessUrl(resolvedMediaUrl, post.workspaceId);
          }
        }

        const isScheduled = !!post.scheduledFor;
        const isMulti = post.platformPosts.length > 1;
        const flowSource = isMulti ? 'MULTI_PLATFORM' : isScheduled ? 'SCHEDULED' : 'POST_NOW';
        if (pPost.platform === 'INSTAGRAM') {
          console.log(`[INSTAGRAM] Flow source: ${flowSource}`);
        } else {
          console.log(`[QUEUE] Platform publish started for ${pPost.platform}`);
        }
        const result = await adapter.publishPost({
          caption: pPost.customCaption || post.masterCaption,
          hashtags: pPost.hashtags || undefined,
          mediaUrl: resolvedMediaUrl,
          mediaType,
          contentType: pPost.contentType || 'POST',
          visibility: pPost.visibility || 'PUBLIC',
          metadata: metadataObj,
          accessToken: finalAccessToken,
          platformAccountId: pPost.socialAccount.platformAccountId,
          isMock: pPost.socialAccount.isMock,
        });

        console.log(`[QUEUE] Platform result: ${result.success ? 'SUCCESS' : 'FAILED'} ${result.statusMessage || result.errorMessage || ''}`);

        if (result.success) {
          const postStatus = result.status || 'PUBLISHED';
          if (postStatus === 'PUBLISHED') {
            successCount++;
          } else if (postStatus === 'INBOX_DRAFT') {
            inboxDraftCount++;
          } else if (postStatus === 'MANUAL_READY') {
            manualReadyCount++;
          } else {
            processingCount++;
          }

          let updatedMetaStr = pPost.metadata;
          if (result.updatedMetadata) {
            try {
              const currentMeta = pPost.metadata ? JSON.parse(pPost.metadata) : {};
              updatedMetaStr = JSON.stringify({ ...currentMeta, ...result.updatedMetadata });
            } catch {
              // ignore
            }
          }

          console.log(`[QUEUE] Updating platform status... (${postStatus})`);
          await prisma.platformPost.update({
            where: { id: pPost.id },
            data: {
              status: postStatus,
              externalPostId: result.externalPostId,
              externalPostUrl: result.externalPostUrl,
              errorMessage: result.statusMessage || null,
              metadata: updatedMetaStr,
            },
          });

          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: postStatus === 'PUBLISHED' || postStatus === 'INBOX_DRAFT' || postStatus === 'MANUAL_READY' ? 'PUBLISHED' : 'PROCESSING',
              completedAt: new Date(),
            },
          });

          await prisma.publishingAttempt.create({
            data: {
              publishingJobId: job.id,
              status: postStatus,
              responseCode: 200,
              responseBody: JSON.stringify({
                externalPostId: result.externalPostId,
                status: postStatus,
                statusMessage: result.statusMessage,
              }),
            },
          });

          platformResults.push({
            platformPostId: pPost.id,
            platform: pPost.platform,
            status: postStatus,
            statusMessage: result.statusMessage,
            externalPostUrl: result.externalPostUrl,
          });
        } else {
          failCount++;
          const errMsg = result.errorMessage || 'Publishing failed on platform API';
          if (isMetaPlatform(pPost.platform) && isLikelyMetaTokenError(result.errorCode, errMsg)) {
            await markMetaAccountNeedsReconnection(pPost.socialAccount.id);
          }

          await prisma.platformPost.update({
            where: { id: pPost.id },
            data: {
              status: 'FAILED',
              errorMessage: errMsg,
            },
          });

          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: 'FAILED',
              errorMessage: errMsg,
              completedAt: new Date(),
            },
          });

          await prisma.publishingAttempt.create({
            data: {
              publishingJobId: job.id,
              status: 'FAILED',
              responseCode: result.errorCode ? 400 : 500,
              responseBody: JSON.stringify({
                errorCode: result.errorCode || 'PLATFORM_ERROR',
                errorMessage: errMsg,
              }),
              errorMessage: errMsg,
            },
          });

          platformResults.push({
            platformPostId: pPost.id,
            platform: pPost.platform,
            status: 'FAILED',
            errorMessage: errMsg,
          });
        }
      } catch (err: any) {
        failCount++;
        const errMsg = err?.message || 'Unexpected error during publishing';
        await prisma.platformPost.update({
          where: { id: pPost.id },
          data: { status: 'FAILED', errorMessage: errMsg },
        });

        await prisma.publishingJob.update({
          where: { id: job.id },
          data: { status: 'FAILED', errorMessage: errMsg, completedAt: new Date() },
        });

        platformResults.push({
          platformPostId: pPost.id,
          platform: pPost.platform,
          status: 'FAILED',
          errorMessage: errMsg,
        });
      }
    }

    // Determine final master status
    let finalStatus: 'PUBLISHED' | 'INBOX_DRAFT' | 'MANUAL_READY' | 'PROCESSING' | 'PARTIALLY_FAILED' | 'FAILED' = 'PUBLISHED';
    const totalCount = successCount + failCount + processingCount + inboxDraftCount + manualReadyCount;
    if (successCount === totalCount && successCount > 0) {
      finalStatus = 'PUBLISHED';
    } else if (inboxDraftCount === totalCount && inboxDraftCount > 0) {
      finalStatus = 'INBOX_DRAFT';
    } else if (manualReadyCount === totalCount && manualReadyCount > 0) {
      finalStatus = 'MANUAL_READY';
    } else if (successCount + inboxDraftCount === totalCount && (successCount > 0 || inboxDraftCount > 0)) {
      finalStatus = successCount > 0 ? 'PUBLISHED' : 'INBOX_DRAFT';
    } else if (manualReadyCount > 0 && failCount === 0 && processingCount === 0) {
      finalStatus = successCount > 0 ? 'PUBLISHED' : 'MANUAL_READY';
    } else if (failCount === totalCount && failCount > 0) {
      finalStatus = 'FAILED';
    } else if (successCount > 0 && failCount > 0) {
      finalStatus = 'PARTIALLY_FAILED';
    } else if (processingCount > 0 && failCount === 0) {
      finalStatus = 'PROCESSING';
    } else if (failCount > 0) {
      finalStatus = 'PARTIALLY_FAILED';
    }

    await prisma.contentPost.update({
      where: { id: contentPostId },
      data: {
        status: finalStatus,
        publishedAt: finalStatus === 'PUBLISHED' ? new Date() : null,
      },
    });

    // Create Activity Log
    await prisma.activityLog.create({
      data: {
        workspaceId: post.workspaceId,
        userId: post.userId,
        action: finalStatus === 'MANUAL_READY' ? 'POST_PREPARED_MANUAL' : 'POST_PUBLISHED',
        details: finalStatus === 'MANUAL_READY'
          ? 'Prepared content for manual publishing on Facebook Personal Profile'
          : `Published post across ${successCount + inboxDraftCount + processingCount + manualReadyCount}/${post.platformPosts.length} platforms (${finalStatus})`,
      },
    });

    // Create in-app Notification
    await prisma.notification.create({
      data: {
        workspaceId: post.workspaceId,
        userId: post.userId,
        title: finalStatus === 'PUBLISHED'
          ? 'Post Published'
          : finalStatus === 'INBOX_DRAFT'
          ? 'Post Sent to Creator Inbox'
          : finalStatus === 'MANUAL_READY'
          ? 'Manual Publishing Reminder: Facebook Profile'
          : finalStatus === 'PROCESSING'
          ? 'Post Processing / Draft Uploaded'
          : finalStatus === 'PARTIALLY_FAILED'
          ? 'Post Partially Published'
          : 'Post Publishing Failed',
        message:
          finalStatus === 'PUBLISHED'
            ? `Your content was successfully published to ${successCount} platform(s).`
            : finalStatus === 'INBOX_DRAFT'
            ? `Your content was sent to TikTok Creator Inbox draft.`
            : finalStatus === 'MANUAL_READY'
            ? `Your content and media are prepared. Download media and copy caption to publish to your Facebook Personal Profile.`
            : finalStatus === 'PROCESSING'
            ? `Your content was uploaded to ${processingCount} channel(s) and is currently processing / in draft.`
            : `${successCount} published, ${failCount} failed across connected accounts.`,
        type: finalStatus === 'PUBLISHED' ? 'SUCCESS' : finalStatus === 'INBOX_DRAFT' || finalStatus === 'MANUAL_READY' || finalStatus === 'PROCESSING' ? 'INFO' : finalStatus === 'PARTIALLY_FAILED' ? 'WARNING' : 'ERROR',
        link: `/published`,
      },
    });

    // Safe automatic R2 media asset cleanup check
    // Preserve media if manual posting is pending so user can download assets!
    if (post.mediaAssetId && manualReadyCount === 0) {
      try {
        const cleanupResult = await safeCleanupMediaAsset(post.mediaAssetId, post.workspaceId);
        if (cleanupResult.action === 'DELETED') {
          console.log(
            `[Queue Publisher] Post ${contentPostId} triggered automatic R2 video cleanup for asset ${post.mediaAssetId}`
          );
        }
      } catch (cleanupErr) {
        console.error(`[Queue Publisher] Non-critical error during post-publish R2 cleanup:`, cleanupErr);
      }
    }

    return {
      contentPostId,
      overallStatus: finalStatus,
      platformResults,
    };
  }
}
