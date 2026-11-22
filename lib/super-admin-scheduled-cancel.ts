import prisma from './prisma';
import { formatBytes } from './storage/r2-storage-monitor';
import { safeCleanupMediaAsset, extractObjectKey } from './storage/r2-cleanup';

export * from './super-admin-scheduled-cancel-types';
import {
  APPROVED_YOUTUBE_CHANNELS,
  matchProtectedYouTubeChannel,
  ProtectedChannelDef,
  ScheduledTargetAudit,
  MediaCleanupAuditItem,
  ScheduledPostAuditItem,
  ScheduledAuditReport,
  BulkCancelResult,
} from './super-admin-scheduled-cancel-types';

/**
 * Complete read-only audit of all scheduled posts and their associated R2 media assets
 */
export async function auditScheduledPosts(): Promise<ScheduledAuditReport> {
  const posts = await prisma.contentPost.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED' },
        { platformPosts: { some: { status: { in: ['SCHEDULED', 'QUEUED'] } } } },
      ],
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          members: {
            take: 1,
            select: {
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
      platformPosts: {
        include: {
          socialAccount: {
            select: {
              id: true,
              platform: true,
              name: true,
              username: true,
              platformAccountId: true,
            },
          },
        },
      },
      mediaAsset: {
        select: {
          id: true,
          size: true,
          mimeType: true,
          filename: true,
          originalName: true,
          url: true,
          posts: {
            select: {
              id: true,
              status: true,
              platformPosts: {
                select: {
                  id: true,
                  platform: true,
                  status: true,
                  socialAccount: {
                    select: {
                      platform: true,
                      name: true,
                      username: true,
                      platformAccountId: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  const platformBreakdown: Record<string, { total: number; protected: number; toCancel: number }> = {};
  const workspaceMap = new Map<
    string,
    {
      workspaceId: string;
      workspaceName: string;
      userEmail: string;
      totalScheduled: number;
      protected: number;
      toCancel: number;
    }
  >();

  let protectedExclusivePosts = 0;
  let protectedPartialPosts = 0;
  let cancelCandidatePosts = 0;
  let inFlightPosts = 0;
  let manualReviewPosts = 0;
  let totalCancelledTargets = 0;
  let totalPreservedTargets = 0;
  let totalPlatformTargets = 0;

  // Track unique media assets across posts to prevent double counting in summary
  const auditedMediaMap = new Map<string, MediaCleanupAuditItem>();

  const items: ScheduledPostAuditItem[] = [];

  for (const post of posts) {
    const owner = post.workspace.members[0]?.user;
    const userEmail = owner?.email || 'N/A';
    const userName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || 'N/A';

    // In-flight safety check
    const isInFlight = post.status === 'PROCESSING' || post.status === 'UPLOADING';

    const targets: ScheduledTargetAudit[] = [];
    let postProtectedTargets = 0;
    let postCancelTargets = 0;
    let hasAmbiguous = false;

    if (!post.platformPosts || post.platformPosts.length === 0) {
      hasAmbiguous = true;
    }

    for (const pp of post.platformPosts) {
      totalPlatformTargets++;
      const platKey = pp.platform?.toUpperCase() || 'OTHER';
      if (!platformBreakdown[platKey]) {
        platformBreakdown[platKey] = { total: 0, protected: 0, toCancel: 0 };
      }
      platformBreakdown[platKey].total++;

      const match = matchProtectedYouTubeChannel(pp.socialAccount);

      if (match.isProtected) {
        postProtectedTargets++;
        totalPreservedTargets++;
        platformBreakdown[platKey].protected++;
      } else {
        postCancelTargets++;
        totalCancelledTargets++;
        platformBreakdown[platKey].toCancel++;
      }

      targets.push({
        platformPostId: pp.id,
        platform: pp.platform,
        status: pp.status,
        socialAccountId: pp.socialAccountId,
        accountName: pp.socialAccount?.name || 'Unknown',
        accountUsername: pp.socialAccount?.username || 'Unknown',
        channelId: pp.socialAccount?.platformAccountId || '',
        isProtected: match.isProtected,
        matchedChannelName: match.channel?.displayName,
        matchReason: match.matchReason,
      });
    }

    // Determine post classification
    let classification: ScheduledPostAuditItem['classification'] = 'CANCEL_CANDIDATE';
    if (isInFlight) {
      classification = 'IN_FLIGHT';
      inFlightPosts++;
    } else if (hasAmbiguous) {
      classification = 'MANUAL_REVIEW';
      manualReviewPosts++;
    } else if (postProtectedTargets > 0 && postCancelTargets === 0) {
      classification = 'PROTECTED_EXCLUSIVE';
      protectedExclusivePosts++;
    } else if (postProtectedTargets > 0 && postCancelTargets > 0) {
      classification = 'PROTECTED_PARTIAL';
      protectedPartialPosts++;
    } else {
      classification = 'CANCEL_CANDIDATE';
      cancelCandidatePosts++;
    }

    // Evaluate Media Asset Usage & Safety
    let mediaAudit: MediaCleanupAuditItem | null = null;
    if (post.mediaAsset) {
      const ma = post.mediaAsset;
      const mediaUrl = ma.url || (ma as any).storageKey || '';
      const objectKey = extractObjectKey(mediaUrl);
      const isAlreadyArchived = mediaUrl ? mediaUrl.startsWith('archived://') : false;

      // Check all posts referencing this media asset
      const referencingPosts = ma.posts || [];
      const otherPosts = referencingPosts.filter((p) => p.id !== post.id);

      let isUsedByProtectedYouTube = false;
      let isUsedByPublished = false;
      let isUsedByOtherScheduled = false;
      let isUsedByDraft = false;
      let isUsedByInFlight = false;

      // Check if ANY target in ANY referencing post is a protected YouTube channel
      for (const refPost of referencingPosts) {
        for (const pPost of refPost.platformPosts || []) {
          if (matchProtectedYouTubeChannel(pPost.socialAccount).isProtected) {
            isUsedByProtectedYouTube = true;
            break;
          }
        }
        if (isUsedByProtectedYouTube) break;
      }

      // Check statuses of OTHER referencing posts
      for (const op of otherPosts) {
        if (op.status === 'PUBLISHED' || op.status === 'PARTIALLY_FAILED') {
          isUsedByPublished = true;
        } else if (op.status === 'SCHEDULED') {
          isUsedByOtherScheduled = true;
        } else if (op.status === 'DRAFT') {
          isUsedByDraft = true;
        } else if (op.status === 'PROCESSING' || op.status === 'UPLOADING') {
          isUsedByInFlight = true;
        }
      }

      // Also check if current post itself retains an active protected YouTube schedule
      const currentPostKept = postProtectedTargets > 0;

      let mediaStatus: MediaCleanupAuditItem['status'] = 'ELIGIBLE_FOR_R2_DELETE';
      let mediaReason = 'Exclusively associated with cancelled post; safe to clean up from R2';

      if (isUsedByProtectedYouTube || currentPostKept) {
        mediaStatus = 'RETAINED_PROTECTED_CHANNEL';
        mediaReason = 'Attached to approved YouTube channel schedule; permanently preserved';
      } else if (classification === 'IN_FLIGHT' || isUsedByInFlight) {
        mediaStatus = 'RETAINED_IN_FLIGHT';
        mediaReason = 'Referenced by an active in-flight publishing job; preserved';
      } else if (isUsedByPublished) {
        mediaStatus = 'RETAINED_PUBLISHED';
        mediaReason = 'Media is also used by an existing published post; preserved';
      } else if (isUsedByOtherScheduled) {
        mediaStatus = 'RETAINED_SHARED_SCHEDULED';
        mediaReason = 'Shared with another active scheduled post; preserved';
      } else if (isUsedByDraft) {
        mediaStatus = 'RETAINED_DRAFT';
        mediaReason = 'Referenced by a saved draft post; preserved';
      } else if (isAlreadyArchived) {
        mediaStatus = 'ALREADY_CLEANED';
        mediaReason = 'R2 media asset already cleaned up previously';
      } else if (!objectKey) {
        mediaStatus = 'SKIPPED_UNCERTAIN';
        mediaReason = 'Local upload or non-R2 media path; skipped';
      } else if (classification !== 'CANCEL_CANDIDATE') {
        mediaStatus = 'SKIPPED_UNCERTAIN';
        mediaReason = 'Parent post is not a full cancel candidate; skipped';
      }

      const rawSize = ma.size ?? (ma as any).sizeBytes ?? 0;
      mediaAudit = {
        mediaAssetId: ma.id,
        filename: ma.filename || ma.originalName || 'media',
        originalName: ma.originalName || ma.filename || 'media',
        mimeType: ma.mimeType || 'application/octet-stream',
        sizeBytes: rawSize,
        sizeFormatted: formatBytes(rawSize),
        objectKey,
        status: mediaStatus,
        reason: mediaReason,
        isShared: referencingPosts.length > 1,
        sharedWithPostsCount: referencingPosts.length,
      };

      if (!auditedMediaMap.has(ma.id)) {
        auditedMediaMap.set(ma.id, mediaAudit);
      }
    }

    // Workspace aggregator
    if (!workspaceMap.has(post.workspaceId)) {
      workspaceMap.set(post.workspaceId, {
        workspaceId: post.workspaceId,
        workspaceName: post.workspace.name,
        userEmail,
        totalScheduled: 0,
        protected: 0,
        toCancel: 0,
      });
    }
    const wsStats = workspaceMap.get(post.workspaceId)!;
    wsStats.totalScheduled++;
    if (postProtectedTargets > 0) {
      wsStats.protected += postProtectedTargets;
    }
    wsStats.toCancel += postCancelTargets;

    items.push({
      id: post.id,
      workspaceId: post.workspaceId,
      workspaceName: post.workspace.name,
      workspaceSlug: post.workspace.slug,
      userEmail,
      userName,
      title: post.title,
      masterCaption: post.masterCaption,
      scheduledFor: post.scheduledFor ? post.scheduledFor.toISOString() : null,
      status: post.status,
      hasMedia: !!post.mediaAsset,
      classification,
      targets,
      protectedTargetsCount: postProtectedTargets,
      cancelTargetsCount: postCancelTargets,
      mediaAudit,
    });
  }

  // Aggregate Media Summary across all unique assets
  let expectedDeletedMediaCount = 0;
  let expectedFreedStorageBytes = 0;
  let sharedMediaRetainedCount = 0;
  let protectedChannelMediaRetainedCount = 0;
  let skippedMediaCount = 0;

  for (const media of auditedMediaMap.values()) {
    if (media.status === 'ELIGIBLE_FOR_R2_DELETE') {
      expectedDeletedMediaCount++;
      expectedFreedStorageBytes += media.sizeBytes;
    } else if (media.status === 'RETAINED_PROTECTED_CHANNEL') {
      protectedChannelMediaRetainedCount++;
    } else if (
      media.status === 'RETAINED_PUBLISHED' ||
      media.status === 'RETAINED_SHARED_SCHEDULED' ||
      media.status === 'RETAINED_DRAFT' ||
      media.status === 'RETAINED_IN_FLIGHT'
    ) {
      sharedMediaRetainedCount++;
    } else {
      skippedMediaCount++;
    }
  }

  const expectedFreedStorageMB = Number((expectedFreedStorageBytes / (1024 * 1024)).toFixed(2));
  const expectedFreedStorageGB = Number((expectedFreedStorageBytes / (1024 * 1024 * 1024)).toFixed(3));

  return {
    timestamp: new Date().toISOString(),
    totalScheduledPosts: posts.length,
    totalPlatformTargets,
    counts: {
      protectedExclusivePosts,
      protectedPartialPosts,
      cancelCandidatePosts,
      inFlightPosts,
      manualReviewPosts,
      totalCancelledTargets,
      totalPreservedTargets,
    },
    mediaSummary: {
      totalAttachedMedia: auditedMediaMap.size,
      expectedDeletedMediaCount,
      expectedFreedStorageBytes,
      expectedFreedStorageMB,
      expectedFreedStorageGB,
      sharedMediaRetainedCount,
      protectedChannelMediaRetainedCount,
      skippedMediaCount,
    },
    platformBreakdown,
    workspaceBreakdown: Array.from(workspaceMap.values()).sort((a, b) => b.totalScheduled - a.totalScheduled),
    approvedChannels: APPROVED_YOUTUBE_CHANNELS,
    items,
  };
}

/**
 * Execute safe bulk cancellation of non-whitelisted scheduled posts with automatic R2 media cleanup
 */
export async function executeBulkCancelScheduledPosts(options: {
  confirmToken: string;
  actorUserId?: string;
  selectedPostIds?: string[];
  dryRun?: boolean;
  cleanupMedia?: boolean;
  deleteR2Fn?: (objectKey: string, workspaceId: string) => Promise<{ success: boolean; error?: string }>;
}): Promise<BulkCancelResult> {
  if (options.confirmToken !== 'CONFIRM_CANCEL') {
    throw new Error("Invalid confirmation token. You must pass confirmToken: 'CONFIRM_CANCEL' to execute.");
  }

  const audit = await auditScheduledPosts();

  const selectedSet = options.selectedPostIds && options.selectedPostIds.length > 0
    ? new Set(options.selectedPostIds)
    : null;

  const eligibleItems = audit.items.filter((item) => {
    if (selectedSet && !selectedSet.has(item.id)) return false;
    // Never cancel purely protected posts or in-flight posts
    if (item.classification === 'PROTECTED_EXCLUSIVE' || item.classification === 'IN_FLIGHT') return false;
    return true;
  });

  const cancelledPosts: BulkCancelResult['cancelledPosts'] = [];
  const recoverySnapshot: BulkCancelResult['recoveryLog']['snapshot'] = [];

  let cancelledPostsCount = 0;
  let cancelledTargetsCount = 0;
  let preservedProtectedPostsCount = audit.counts.protectedExclusivePosts + audit.counts.protectedPartialPosts;
  let skippedInFlightCount = audit.counts.inFlightPosts;
  let skippedManualReviewCount = 0;

  // Media cleanup trackers
  const mediaAttempted: BulkCancelResult['mediaCleanupResult']['deletedMediaAssets'] = [];
  let deletedR2Count = 0;
  let failedRetryCount = 0;
  let freedBytes = 0;

  if (options.dryRun) {
    for (const item of eligibleItems) {
      const cancelledTargetIds = item.targets.filter((t) => !t.isProtected).map((t) => t.platformPostId);
      const preservedTargetIds = item.targets.filter((t) => t.isProtected).map((t) => t.platformPostId);

      cancelledTargetsCount += cancelledTargetIds.length;
      if (item.classification === 'CANCEL_CANDIDATE') {
        cancelledPostsCount++;
      }

      cancelledPosts.push({
        postId: item.id,
        workspaceId: item.workspaceId,
        caption: (item.masterCaption || '').slice(0, 60),
        action: item.classification === 'CANCEL_CANDIDATE' ? 'POST_CANCELLED' : 'TARGETS_CANCELLED',
        cancelledTargets: cancelledTargetIds,
        preservedTargets: preservedTargetIds,
      });

      recoverySnapshot.push({
        postId: item.id,
        originalStatus: item.status,
        scheduledFor: item.scheduledFor,
        cancelledPlatformPostIds: cancelledTargetIds,
      });

      // Dry-run media preview
      if (item.mediaAudit && item.mediaAudit.status === 'ELIGIBLE_FOR_R2_DELETE') {
        deletedR2Count++;
        freedBytes += item.mediaAudit.sizeBytes;
        mediaAttempted.push({
          mediaAssetId: item.mediaAudit.mediaAssetId,
          objectKey: item.mediaAudit.objectKey,
          workspaceId: item.workspaceId,
          postId: item.id,
          sizeFormatted: item.mediaAudit.sizeFormatted,
          status: 'DELETED',
          reason: 'Dry-run: verified safe and exclusive for R2 deletion',
        });
      }
    }

    return {
      success: true,
      dryRun: true,
      cancelledPostsCount,
      cancelledTargetsCount,
      preservedProtectedPostsCount,
      skippedInFlightCount,
      skippedManualReviewCount,
      cancelledPosts,
      mediaCleanupResult: {
        attemptedCount: mediaAttempted.length,
        deletedR2Count,
        retainedSharedCount: audit.mediaSummary.sharedMediaRetainedCount,
        retainedProtectedChannelCount: audit.mediaSummary.protectedChannelMediaRetainedCount,
        failedRetryCount: 0,
        freedBytes,
        freedMB: Number((freedBytes / (1024 * 1024)).toFixed(2)),
        freedGB: Number((freedBytes / (1024 * 1024 * 1024)).toFixed(3)),
        deletedMediaAssets: mediaAttempted,
      },
      recoveryLog: {
        timestamp: new Date().toISOString(),
        snapshot: recoverySnapshot,
      },
    };
  }

  // 1. Live Transactional Post & Target Cancellations (Batch Aggregated)
  const candidateMediaToClean: Array<{
    mediaAssetId: string;
    workspaceId: string;
    postId: string;
    sizeBytes: number;
    sizeFormatted: string;
  }> = [];
  const queuedMediaIds = new Set<string>();

  const allNonProtectedPlatformPostIds: string[] = [];
  const allContentPostIdsToCancel: string[] = [];

  for (const item of eligibleItems) {
    if (item.classification === 'MANUAL_REVIEW') {
      skippedManualReviewCount++;
      continue;
    }

    const nonProtectedPlatformPosts = item.targets.filter((t) => !t.isProtected);
    const protectedPlatformPosts = item.targets.filter((t) => t.isProtected);

    const nonProtectedIds = nonProtectedPlatformPosts.map((t) => t.platformPostId);
    const protectedIds = protectedPlatformPosts.map((t) => t.platformPostId);

    if (nonProtectedIds.length === 0) continue;

    allNonProtectedPlatformPostIds.push(...nonProtectedIds);
    cancelledTargetsCount += nonProtectedIds.length;

    // Handle Parent ContentPost
    if (protectedIds.length > 0) {
      // Post still has active whitelisted YouTube targets! Keep ContentPost as SCHEDULED
      cancelledPosts.push({
        postId: item.id,
        workspaceId: item.workspaceId,
        caption: (item.masterCaption || '').slice(0, 60),
        action: 'TARGETS_CANCELLED',
        cancelledTargets: nonProtectedIds,
        preservedTargets: protectedIds,
      });
    } else {
      // Entire post has only non-whitelisted targets: Queue parent ContentPost for cancellation
      allContentPostIdsToCancel.push(item.id);
      cancelledPostsCount++;

      cancelledPosts.push({
        postId: item.id,
        workspaceId: item.workspaceId,
        caption: (item.masterCaption || '').slice(0, 60),
        action: 'POST_CANCELLED',
        cancelledTargets: nonProtectedIds,
        preservedTargets: [],
      });

      // If post had media and was marked eligible, queue it for verified R2 cleanup (deduplicated)
      if (item.mediaAudit && item.mediaAudit.status === 'ELIGIBLE_FOR_R2_DELETE') {
        if (!queuedMediaIds.has(item.mediaAudit.mediaAssetId)) {
          queuedMediaIds.add(item.mediaAudit.mediaAssetId);
          candidateMediaToClean.push({
            mediaAssetId: item.mediaAudit.mediaAssetId,
            workspaceId: item.workspaceId,
            postId: item.id,
            sizeBytes: item.mediaAudit.sizeBytes,
            sizeFormatted: item.mediaAudit.sizeFormatted,
          });
        }
      }
    }

    recoverySnapshot.push({
      postId: item.id,
      originalStatus: item.status,
      scheduledFor: item.scheduledFor,
      cancelledPlatformPostIds: nonProtectedIds,
    });
  }

  // Execute database updates in high-performance batches (slashes DB roundtrips from 60+ down to 3)
  if (allNonProtectedPlatformPostIds.length > 0) {
    // A. Cancel non-whitelisted PlatformPosts in one query
    await prisma.platformPost.updateMany({
      where: { id: { in: allNonProtectedPlatformPostIds } },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Bulk-cancelled by Super Admin (non-whitelisted schedule)',
      },
    });

    // B. Cancel associated PublishingJobs in one query
    await prisma.publishingJob.updateMany({
      where: {
        platformPostId: { in: allNonProtectedPlatformPostIds },
        status: { in: ['QUEUED', 'SCHEDULED', 'RETRYING'] },
      },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Bulk-cancelled by Super Admin',
      },
    });
  }

  if (allContentPostIdsToCancel.length > 0) {
    // C. Cancel all pure non-whitelisted parent ContentPosts in one batch query
    if (typeof (prisma.contentPost as any).updateMany === 'function') {
      await prisma.contentPost.updateMany({
        where: { id: { in: allContentPostIdsToCancel } },
        data: { status: 'CANCELLED' },
      });
    } else {
      await Promise.all(
        allContentPostIdsToCancel.map((id) =>
          prisma.contentPost.update({
            where: { id },
            data: { status: 'CANCELLED' },
          })
        )
      );
    }
  }

  // 2. Automated Safe R2 Media Cleanup (Bounded Parallel Operations)
  const shouldCleanupMedia = options.cleanupMedia !== false;

  if (shouldCleanupMedia && candidateMediaToClean.length > 0) {
    const CONCURRENCY_LIMIT = 5;
    let nextIndex = 0;
    const cleanupResults: Array<BulkCancelResult['mediaCleanupResult']['deletedMediaAssets'][0]> = new Array(
      candidateMediaToClean.length
    );

    async function cleanupWorker() {
      while (nextIndex < candidateMediaToClean.length) {
        const itemIdx = nextIndex++;
        const mediaItem = candidateMediaToClean[itemIdx];

        try {
          const cleanupResult = await safeCleanupMediaAsset(
            mediaItem.mediaAssetId,
            mediaItem.workspaceId,
            {
              auditAction: 'SUPER_ADMIN_SCHEDULE_CANCEL_R2_CLEANUP',
              auditDetails: `Automatically deleted exclusive R2 media for cancelled post ${mediaItem.postId}`,
              deleteR2Fn: options.deleteR2Fn,
            }
          );

          if (cleanupResult.action === 'DELETED') {
            cleanupResults[itemIdx] = {
              mediaAssetId: mediaItem.mediaAssetId,
              objectKey: cleanupResult.reason || '',
              workspaceId: mediaItem.workspaceId,
              postId: mediaItem.postId,
              sizeFormatted: mediaItem.sizeFormatted,
              status: 'DELETED',
              reason: 'R2 object successfully deleted and archived',
            };
          } else if (cleanupResult.action === 'FAILED') {
            cleanupResults[itemIdx] = {
              mediaAssetId: mediaItem.mediaAssetId,
              objectKey: cleanupResult.reason || '',
              workspaceId: mediaItem.workspaceId,
              postId: mediaItem.postId,
              sizeFormatted: mediaItem.sizeFormatted,
              status: 'FAILED_RETRY',
              reason: cleanupResult.reason || 'R2 deletion failed; queued for background retry',
            };
          } else {
            cleanupResults[itemIdx] = {
              mediaAssetId: mediaItem.mediaAssetId,
              objectKey: cleanupResult.reason || '',
              workspaceId: mediaItem.workspaceId,
              postId: mediaItem.postId,
              sizeFormatted: mediaItem.sizeFormatted,
              status: 'SKIPPED',
              reason: cleanupResult.reason || 'Media skipped because it was shared or protected',
            };
          }
        } catch (mediaErr: any) {
          console.error(`[R2 Cancel Cleanup Error] Asset ${mediaItem.mediaAssetId}:`, mediaErr);
          cleanupResults[itemIdx] = {
            mediaAssetId: mediaItem.mediaAssetId,
            objectKey: '',
            workspaceId: mediaItem.workspaceId,
            postId: mediaItem.postId,
            sizeFormatted: mediaItem.sizeFormatted,
            status: 'FAILED_RETRY',
            reason: mediaErr.message || 'Unexpected cleanup error',
          };
        }
      }
    }

    const workers = Array.from(
      { length: Math.min(CONCURRENCY_LIMIT, candidateMediaToClean.length) },
      () => cleanupWorker()
    );
    await Promise.all(workers);

    // Collate results in deterministic order
    for (let i = 0; i < cleanupResults.length; i++) {
      const resItem = cleanupResults[i];
      if (resItem) {
        mediaAttempted.push(resItem);
        if (resItem.status === 'DELETED') {
          deletedR2Count++;
          freedBytes += candidateMediaToClean[i].sizeBytes;
        } else if (resItem.status === 'FAILED_RETRY') {
          failedRetryCount++;
        }
      }
    }
  }

  // 3. Create Audit Log Entry in ActivityLog
  const auditLog = await prisma.activityLog.create({
    data: {
      action: 'SUPER_ADMIN_BULK_CANCEL_SCHEDULED',
      actorUserId: options.actorUserId || 'super_admin_owner',
      details: `Bulk cancelled ${cancelledPostsCount} post(s) and ${cancelledTargetsCount} platform target(s). Preserved ${preservedProtectedPostsCount} protected YouTube schedule(s). Deleted ${deletedR2Count} exclusive R2 media asset(s) (${formatBytes(freedBytes)} freed).`,
      metadata: JSON.stringify({
        timestamp: new Date().toISOString(),
        actor: options.actorUserId || 'owner',
        cancelledPostsCount,
        cancelledTargetsCount,
        preservedProtectedPostsCount,
        deletedR2Count,
        failedRetryCount,
        freedBytes,
        recoverySnapshot,
        mediaCleaned: mediaAttempted,
      }),
    },
  });

  return {
    success: true,
    dryRun: false,
    cancelledPostsCount,
    cancelledTargetsCount,
    preservedProtectedPostsCount,
    skippedInFlightCount,
    skippedManualReviewCount,
    cancelledPosts,
    mediaCleanupResult: {
      attemptedCount: mediaAttempted.length,
      deletedR2Count,
      retainedSharedCount: audit.mediaSummary.sharedMediaRetainedCount,
      retainedProtectedChannelCount: audit.mediaSummary.protectedChannelMediaRetainedCount,
      failedRetryCount,
      freedBytes,
      freedMB: Number((freedBytes / (1024 * 1024)).toFixed(2)),
      freedGB: Number((freedBytes / (1024 * 1024 * 1024)).toFixed(3)),
      deletedMediaAssets: mediaAttempted,
    },
    recoveryLog: {
      auditLogId: auditLog.id,
      timestamp: auditLog.createdAt ? new Date(auditLog.createdAt).toISOString() : new Date().toISOString(),
      snapshot: recoverySnapshot,
    },
  };
}
