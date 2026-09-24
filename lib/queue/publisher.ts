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
  overallStatus: 'PUBLISHED' | 'INBOX_DRAFT' | 'PROCESSING' | 'PARTIALLY_FAILED' | 'FAILED';
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

        // Auto-refresh TikTok token if near or past expiration before publishing
        if (platformType === 'TIKTOK' && pPost.socialAccount.token) {
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
                  `[Queue Publisher] Successfully refreshed expired TikTok token for @${pPost.socialAccount.username}`
                );
              }
            } catch (refreshErr: any) {
              console.error(
                `[Queue Publisher] TikTok token refresh failed for @${pPost.socialAccount.username}:`,
                refreshErr
              );

              await prisma.socialAccount.update({
                where: { id: pPost.socialAccountId },
                data: { status: 'EXPIRED' },
              });

              throw new Error(
                `TikTok session for @${pPost.socialAccount.username} has expired and could not be refreshed. Please reconnect account in Social Accounts.`
              );
            }
          }
        }

        let metadataObj = {};
        try {
          if (pPost.metadata) metadataObj = JSON.parse(pPost.metadata);
        } catch {
          // ignore
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

        if (result.success) {
          const postStatus = result.status || 'PUBLISHED';
          if (postStatus === 'PUBLISHED') {
            successCount++;
          } else if (postStatus === 'INBOX_DRAFT') {
            inboxDraftCount++;
          } else {
            processingCount++;
          }

          await prisma.platformPost.update({
            where: { id: pPost.id },
            data: {
              status: postStatus,
              externalPostId: result.externalPostId,
              externalPostUrl: result.externalPostUrl,
              errorMessage: result.statusMessage || null,
            },
          });

          await prisma.publishingJob.update({
            where: { id: job.id },
            data: {
              status: postStatus === 'PUBLISHED' || postStatus === 'INBOX_DRAFT' ? 'PUBLISHED' : 'PROCESSING',
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
    let finalStatus: 'PUBLISHED' | 'INBOX_DRAFT' | 'PROCESSING' | 'PARTIALLY_FAILED' | 'FAILED' = 'PUBLISHED';
    if (successCount === 0 && failCount > 0 && processingCount === 0 && inboxDraftCount === 0) {
      finalStatus = 'FAILED';
    } else if (inboxDraftCount > 0 && successCount === 0 && processingCount === 0 && failCount === 0) {
      finalStatus = 'INBOX_DRAFT';
    } else if (successCount === 0 && processingCount > 0 && failCount === 0) {
      finalStatus = 'PROCESSING';
    } else if (failCount > 0) {
      finalStatus = 'PARTIALLY_FAILED';
    } else if (successCount > 0) {
      finalStatus = 'PUBLISHED';
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
        action: 'POST_PUBLISHED',
        details: `Published post across ${successCount + inboxDraftCount + processingCount}/${post.platformPosts.length} platforms (${finalStatus})`,
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
            : finalStatus === 'PROCESSING'
            ? `Your content was uploaded to ${processingCount} channel(s) and is currently processing / in draft.`
            : `${successCount} published, ${failCount} failed across connected accounts.`,
        type: finalStatus === 'PUBLISHED' ? 'SUCCESS' : finalStatus === 'INBOX_DRAFT' ? 'INFO' : finalStatus === 'PROCESSING' ? 'INFO' : finalStatus === 'PARTIALLY_FAILED' ? 'WARNING' : 'ERROR',
        link: `/published`,
      },
    });

    // Safe automatic R2 media asset cleanup check
    if (post.mediaAssetId) {
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
