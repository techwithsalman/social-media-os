import prisma from '../prisma';
import * as r2Storage from './r2';
import { deleteR2Object, verifyR2ObjectWorkspaceOwnership } from './r2';

export interface CleanupResult {
  mediaAssetId: string;
  success: boolean;
  action: 'DELETED' | 'SKIPPED' | 'FAILED';
  reason?: string;
}

const TERMINAL_PLATFORM_STATUSES = ['PUBLISHED', 'INBOX_DRAFT', 'CANCELLED'];
const ACTIVE_POST_STATUSES = ['SCHEDULED', 'QUEUED', 'PROCESSING', 'UPLOADING', 'RETRYING', 'DRAFT', 'MANUAL_READY', 'AWAITING_MANUAL_PUBLISH'];
const ACTIVE_JOB_STATUSES = ['QUEUED', 'PROCESSING', 'UPLOADING', 'RETRYING'];

export const DEFAULT_FAILED_RETENTION_HOURS = 48; // Give creators 48h to retry failed posts before cleanup
export const DEFAULT_ABANDONED_RETENTION_HOURS = 24; // Clean unattached uploads after 24h

/**
 * Extract R2 object key from media URL or key string
 */
export function extractObjectKey(mediaUrl: string): string {
  if (!mediaUrl) return '';
  if (
    mediaUrl.startsWith('archived://') ||
    mediaUrl.startsWith('archived_pending://') ||
    mediaUrl.startsWith('archived_retry://')
  ) {
    return mediaUrl.replace(/^archived(_pending|_retry)?:\/\//, '');
  }
  if (mediaUrl.startsWith('/uploads/') || mediaUrl.startsWith('http://localhost') || mediaUrl.startsWith('http://127.0.0.1')) {
    return ''; // Local file - skip R2 deletion
  }

  let objectKey = mediaUrl;
  if (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')) {
    try {
      objectKey = new URL(mediaUrl).pathname.replace(/^\//, '');
    } catch {
      // ignore
    }
  }
  return objectKey;
}

/**
 * Evaluate whether a MediaAsset is safe to delete without breaking active, scheduled, or retryable posts.
 * Strictly respects shared media references across multiple posts, platforms, and publishing jobs.
 */
export async function canDeleteMediaAsset(
  mediaAssetId: string,
  options?: { failedRetentionHours?: number; ignoreRetentionGrace?: boolean }
): Promise<{ canDelete: boolean; reason: string }> {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
    include: {
      posts: {
        include: {
          platformPosts: {
            include: {
              publishingJobs: {
                orderBy: { createdAt: 'desc' },
              },
            },
          },
        },
      },
    },
  });

  if (!mediaAsset) {
    return { canDelete: false, reason: 'MediaAsset record not found in database.' };
  }

  if (!mediaAsset.url || mediaAsset.url.startsWith('archived://')) {
    return { canDelete: false, reason: 'MediaAsset is already cleaned up and archived.' };
  }

  const failedRetentionMs = (options?.failedRetentionHours ?? DEFAULT_FAILED_RETENTION_HOURS) * 3600 * 1000;
  const now = Date.now();

  // If media asset has no associated ContentPosts (unattached upload)
  if (!mediaAsset.posts || mediaAsset.posts.length === 0) {
    if (
      options?.ignoreRetentionGrace ||
      mediaAsset.url.startsWith('archived_retry://') ||
      mediaAsset.url.startsWith('archived_pending://')
    ) {
      return { canDelete: true, reason: 'Exclusively owned, explicitly deleted, or retry-queued media asset eligible for cleanup.' };
    }
    const assetAgeMs = now - new Date(mediaAsset.createdAt).getTime();
    const abandonedRetentionMs = DEFAULT_ABANDONED_RETENTION_HOURS * 3600 * 1000;
    if (assetAgeMs >= abandonedRetentionMs) {
      return { canDelete: true, reason: 'Abandoned unattached media asset past retention window.' };
    }
    return { canDelete: false, reason: 'Unattached upload within 24h retention grace period.' };
  }

  // Iterate over ALL associated content posts (supporting shared media across multiple posts)
  for (const post of mediaAsset.posts) {
    // 1. Active Post Guard: Block deletion if post is active/scheduled/processing
    if (ACTIVE_POST_STATUSES.includes(post.status)) {
      return { canDelete: false, reason: `Shared media asset is still needed by active ContentPost ${post.id} (status: ${post.status}).` };
    }

    if (!post.platformPosts || post.platformPosts.length === 0) {
      return { canDelete: false, reason: `Associated ContentPost ${post.id} has no platform posts configured.` };
    }

    // 2. Active Platform Post & Publishing Job Guards across all platform targets
    for (const pPost of post.platformPosts) {
      if (ACTIVE_POST_STATUSES.includes(pPost.status)) {
        return {
          canDelete: false,
          reason: `Shared media asset is actively needed by PlatformPost ${pPost.id} (${pPost.platform}) in status: ${pPost.status}.`,
        };
      }

      // Resumable upload check: if metadata contains active chunked upload session URLs, do not delete media
      if (
        pPost.metadata &&
        (pPost.metadata.includes('youtubeUploadUrl') || pPost.metadata.includes('uploadUrl')) &&
        pPost.status !== 'PUBLISHED'
      ) {
        return {
          canDelete: false,
          reason: `Associated PlatformPost ${pPost.id} (${pPost.platform}) has an active resumable upload session in progress.`,
        };
      }

      // Check all publishing jobs for this platform post
      if (pPost.publishingJobs && pPost.publishingJobs.length > 0) {
        for (const job of pPost.publishingJobs) {
          if (ACTIVE_JOB_STATUSES.includes(job.status)) {
            return {
              canDelete: false,
              reason: `Active publishing job ${job.id} on platform ${pPost.platform} is currently ${job.status}.`,
            };
          }
        }
      }

      // If a platform post failed, check retention window to allow creator retries
      if (pPost.status === 'FAILED') {
        const postAgeMs = now - new Date(pPost.updatedAt || post.updatedAt).getTime();
        if (postAgeMs < failedRetentionMs && !options?.ignoreRetentionGrace) {
          const remainingHours = Math.ceil((failedRetentionMs - postAgeMs) / (3600 * 1000));
          return {
            canDelete: false,
            reason: `PlatformPost ${pPost.id} (${pPost.platform}) failed. Within ${remainingHours}h remaining retry retention window.`,
          };
        }
      }
    }
  }

  return { canDelete: true, reason: 'All associated platform target posts and publishing jobs have confirmed terminal completion and passed retention.' };
}

/**
 * Safely clean up an R2 media asset file after verifying eligibility and workspace tenant boundary
 */
export async function safeCleanupMediaAsset(
  mediaAssetId: string,
  workspaceId: string,
  options?: {
    failedRetentionHours?: number;
    ignoreRetentionGrace?: boolean;
    auditAction?: string;
    auditDetails?: string;
    deleteR2Fn?: (objectKey: string, workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  }
): Promise<CleanupResult> {
  const mediaAsset = await prisma.mediaAsset.findUnique({
    where: { id: mediaAssetId },
  });

  if (!mediaAsset) {
    return { mediaAssetId, success: false, action: 'SKIPPED', reason: 'MediaAsset not found' };
  }

  // Enforce tenant workspace ownership on database record
  if (mediaAsset.workspaceId !== workspaceId) {
    const err = `Security Error: Workspace mismatch. Asset belongs to ${mediaAsset.workspaceId}, requested by ${workspaceId}`;
    console.error(`[R2 Cleanup Guard] ${err}`);
    return { mediaAssetId, success: false, action: 'SKIPPED', reason: err };
  }

  const check = await canDeleteMediaAsset(mediaAssetId, options);
  if (!check.canDelete) {
    return { mediaAssetId, success: true, action: 'SKIPPED', reason: check.reason };
  }

  const objectKey = extractObjectKey(mediaAsset.url);
  if (!objectKey) {
    return { mediaAssetId, success: true, action: 'SKIPPED', reason: 'Local file or non-R2 URL' };
  }

  // Enforce tenant workspace prefix matching on R2 object key
  const isKeyOwned = verifyR2ObjectWorkspaceOwnership(objectKey, workspaceId);
  if (!isKeyOwned) {
    const err = `Security Error: Object key ${objectKey} does not belong to workspace prefix workspaces/${workspaceId}/`;
    console.error(`[R2 Cleanup Guard] ${err}`);
    return { mediaAssetId, success: false, action: 'SKIPPED', reason: err };
  }

  // Idempotent atomic claim to prevent concurrent worker duplicate execution:
  // Transition URL to archived_pending://${objectKey} in the database
  const claimResult = await prisma.mediaAsset.updateMany({
    where: {
      id: mediaAssetId,
      workspaceId,
      NOT: [
        { url: { startsWith: 'archived://' } },
        { url: { startsWith: 'archived_pending://' } },
      ],
    },
    data: {
      url: `archived_pending://${objectKey}`,
    },
  });

  if (claimResult.count === 0) {
    return { mediaAssetId, success: true, action: 'SKIPPED', reason: 'MediaAsset already cleaned up or claimed by concurrent worker' };
  }

  // Anti-Race Verification: Re-verify that NO active post was committed right before or during claim
  const postClaimCheck = await canDeleteMediaAsset(mediaAssetId, options);
  if (!postClaimCheck.canDelete) {
    // A new post was committed! Rollback URL to original active objectKey
    await prisma.mediaAsset
      .update({
        where: { id: mediaAssetId },
        data: { url: objectKey },
      })
      .catch(() => {});

    return {
      mediaAssetId,
      success: true,
      action: 'SKIPPED',
      reason: `Race prevented: Active post committed during claim (${postClaimCheck.reason})`,
    };
  }

  const deleteFn = options?.deleteR2Fn || r2Storage.deleteR2Object;
  const deleteResult = await deleteFn(objectKey, workspaceId);

  if (deleteResult.success) {
    // Permanently mark as archived://${objectKey}
    try {
      await prisma.mediaAsset.update({
        where: { id: mediaAssetId },
        data: { url: `archived://${objectKey}` },
      });

      // Record activity audit log in database
      await prisma.activityLog.create({
        data: {
          workspaceId,
          action: options?.auditAction || 'R2_MEDIA_AUTO_CLEANUP',
          details: options?.auditDetails || `Automatically cleaned up private R2 video object key: ${objectKey}`,
          metadata: JSON.stringify({ mediaAssetId, objectKey }),
        },
      });
    } catch (dbErr) {
      console.error(
        `[R2 Cleanup Guard] Failed to record archived status or activity log for asset ${mediaAssetId}:`,
        dbErr
      );
    }

    return { mediaAssetId, success: true, action: 'DELETED', reason: check.reason };
  } else {
    // R2 deletion failed: mark as archived_retry://${objectKey}
    // This blocks user reuse while allowing scheduled cleanup worker to retry deletion
    await prisma.mediaAsset
      .update({
        where: { id: mediaAssetId },
        data: { url: `archived_retry://${objectKey}` },
      })
      .catch(() => {});

    console.error(`[R2 Cleanup Guard] R2 deletion failed for asset ${mediaAssetId} (key: ${objectKey}):`, deleteResult.error);
    return { mediaAssetId, success: false, action: 'FAILED', reason: deleteResult.error || 'R2 delete operation failed' };
  }
}

/**
 * Scheduled maintenance worker that processes media asset cleanup for completed, abandoned, or expired posts.
 * Employs targeted candidate pre-filtering and a bounded scanning window to guarantee progress
 * even if some assets are permanently blocked (e.g. drafts or active posts).
 */
export async function processScheduledMediaCleanup(options?: {
  failedRetentionHours?: number;
  abandonedRetentionHours?: number;
  batchSize?: number;
  scanLimit?: number;
  deleteR2Fn?: (objectKey: string, workspaceId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const batchLimit = Math.min(options?.batchSize ?? 3, 5); // Target deletions per batch (capped to 5)
  const scanLimit = Math.min(options?.scanLimit ?? Math.max(batchLimit * 4, 15), 25); // Max candidate records to inspect
  const abandonedRetentionHours = options?.abandonedRetentionHours ?? DEFAULT_ABANDONED_RETENTION_HOURS;
  const unattachedCutoff = new Date(Date.now() - abandonedRetentionHours * 3600 * 1000);

  // High-precision candidate query: pre-filter for assets that are either:
  // 1. In archived_retry state
  // 2. Unattached uploads older than the retention cutoff (24h)
  // 3. Assets where all associated posts have non-active statuses AND configured non-active platform posts
  const candidateWhere = {
    NOT: [
      { url: { startsWith: 'archived://' } },
      { url: { startsWith: 'archived_pending://' } },
    ],
    OR: [
      {
        url: { startsWith: 'archived_retry://' },
      },
      {
        posts: { none: {} },
        createdAt: { lte: unattachedCutoff },
      },
      {
        posts: {
          some: {},
          every: {
            status: { notIn: ACTIVE_POST_STATUSES },
            platformPosts: {
              some: {},
              every: {
                status: { notIn: ACTIVE_POST_STATUSES },
              },
            },
          },
        },
      },
    ],
  };

  let assets = await prisma.mediaAsset.findMany({
    where: candidateWhere,
    take: scanLimit,
    orderBy: { createdAt: 'asc' },
  });

  // Resilient fallback: if the targeted filter returns 0 candidates, scan a bounded window
  // of general unarchived assets to ensure no edge-case candidate is ever left behind
  if (assets.length === 0) {
    assets = await prisma.mediaAsset.findMany({
      where: {
        NOT: [
          { url: { startsWith: 'archived://' } },
          { url: { startsWith: 'archived_pending://' } },
        ],
      },
      take: scanLimit,
      orderBy: { createdAt: 'asc' },
    });
  }

  const results: CleanupResult[] = [];
  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const asset of assets) {
    // Break early once target deletion quota is reached to conserve subrequests
    if (deletedCount >= batchLimit) {
      break;
    }

    const result = await safeCleanupMediaAsset(asset.id, asset.workspaceId, options);
    results.push(result);

    if (result.action === 'DELETED') {
      deletedCount++;
    } else if (result.action === 'SKIPPED') {
      skippedCount++;
    } else if (result.action === 'FAILED') {
      failedCount++;
    }
  }

  return {
    scannedCount: assets.length,
    deletedCount,
    skippedCount,
    failedCount,
    results,
  };
}

export interface DeletePostResult {
  success: boolean;
  postDeleted: boolean;
  mediaCleanup: {
    action: 'DELETED' | 'SKIPPED' | 'FAILED' | 'NONE';
    reason: string;
    mediaAssetId?: string;
    objectKey?: string;
  };
  error?: string;
}

/**
 * Permanently deletes a scheduled or draft ContentPost and safely deletes its exclusive
 * media object from Cloudflare R2. If the media asset is shared with any other post,
 * the media asset and R2 object are safely preserved.
 */
export async function deletePostAndAssociatedMedia(
  postId: string,
  workspaceId: string,
  options?: {
    deleteR2Fn?: (objectKey: string, workspaceId: string) => Promise<{ success: boolean; error?: string }>;
  }
): Promise<DeletePostResult> {
  const post = await prisma.contentPost.findUnique({
    where: { id: postId },
    include: {
      platformPosts: true,
      mediaAsset: true,
    },
  });

  if (!post || post.workspaceId !== workspaceId) {
    return {
      success: false,
      postDeleted: false,
      mediaCleanup: { action: 'NONE', reason: 'Post not found or unauthorized' },
      error: 'Post not found',
    };
  }

  // Active publishing guard: Never delete posts that are actively uploading or processing
  const isPostProcessing = post.status === 'PROCESSING' || post.status === 'UPLOADING';
  const hasActivePlatformPost = post.platformPosts.some(
    (p) => p.status === 'PROCESSING' || p.status === 'UPLOADING'
  );
  const hasResumableUpload = post.platformPosts.some(
    (p) =>
      p.metadata &&
      (p.metadata.includes('youtubeUploadUrl') || p.metadata.includes('uploadUrl')) &&
      p.status !== 'PUBLISHED'
  );

  if (isPostProcessing || hasActivePlatformPost || hasResumableUpload) {
    return {
      success: false,
      postDeleted: false,
      mediaCleanup: { action: 'SKIPPED', reason: 'Post is currently being processed or uploaded.' },
      error: 'Cannot delete post while it is actively publishing or uploading. Please wait for publishing to finish.',
    };
  }

  const mediaAsset = post.mediaAsset;

  // If no media asset, or local file, or already archived:
  if (!mediaAsset || !mediaAsset.url || mediaAsset.url.startsWith('archived://')) {
    await prisma.contentPost.delete({
      where: { id: postId },
    });
    return {
      success: true,
      postDeleted: true,
      mediaCleanup: { action: 'NONE', reason: 'Post had no active R2 media asset attached.' },
    };
  }

  const objectKey = extractObjectKey(mediaAsset.url);
  if (!objectKey) {
    await prisma.contentPost.delete({
      where: { id: postId },
    });
    return {
      success: true,
      postDeleted: true,
      mediaCleanup: { action: 'NONE', reason: 'Media is a local file or non-R2 asset.' },
    };
  }

  // Check whether media is shared by any other post
  const otherPostsCount = await prisma.contentPost.count({
    where: {
      mediaAssetId: mediaAsset.id,
      id: { not: postId },
    },
  });

  if (otherPostsCount > 0) {
    // Shared media protection: delete post only, preserve R2 object and MediaAsset
    await prisma.contentPost.delete({
      where: { id: postId },
    });

    await prisma.activityLog.create({
      data: {
        workspaceId,
        action: 'POST_DELETED',
        details: `Deleted scheduled post ${postId}. Shared media asset ${mediaAsset.id} was preserved (${otherPostsCount} other post(s)).`,
        metadata: JSON.stringify({ postId, mediaAssetId: mediaAsset.id, objectKey, otherPostsCount }),
      },
    }).catch(() => {});

    return {
      success: true,
      postDeleted: true,
      mediaCleanup: {
        action: 'SKIPPED',
        reason: `Media is shared with other posts (${otherPostsCount}) and was preserved.`,
        mediaAssetId: mediaAsset.id,
        objectKey,
      },
    };
  }

  // Exclusive media: delete post first to detach, then safely delete R2 object and archive MediaAsset
  await prisma.contentPost.delete({
    where: { id: postId },
  });

  const cleanupResult = await safeCleanupMediaAsset(mediaAsset.id, workspaceId, {
    ignoreRetentionGrace: true,
    auditAction: 'R2_MEDIA_POST_DELETED_CLEANUP',
    auditDetails: `Permanently deleted private R2 video object key: ${objectKey} upon deletion of scheduled post ${postId}`,
    deleteR2Fn: options?.deleteR2Fn,
  });

  return {
    success: true,
    postDeleted: true,
    mediaCleanup: {
      action: cleanupResult.action,
      reason: cleanupResult.reason || '',
      mediaAssetId: mediaAsset.id,
      objectKey,
    },
  };
}
