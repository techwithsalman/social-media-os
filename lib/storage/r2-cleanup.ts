import prisma from '../prisma';
import { deleteR2Object } from './r2';

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
  options?: { failedRetentionHours?: number }
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

  const failedRetentionMs = (options?.failedRetentionHours ?? DEFAULT_FAILED_RETENTION_HOURS) * 3600 * 1000;
  const now = Date.now();

  // If media asset has no associated ContentPosts (unattached upload)
  if (!mediaAsset.posts || mediaAsset.posts.length === 0) {
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
        if (postAgeMs < failedRetentionMs) {
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
  options?: { failedRetentionHours?: number }
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

  const deleteResult = await deleteR2Object(objectKey, workspaceId);

  if (deleteResult.success) {
    // Record activity audit log in database
    try {
      await prisma.activityLog.create({
        data: {
          workspaceId,
          action: 'R2_MEDIA_AUTO_CLEANUP',
          details: `Automatically cleaned up private R2 video object key: ${objectKey}`,
          metadata: JSON.stringify({ mediaAssetId, objectKey }),
        },
      });
    } catch {
      // ignore log error
    }

    return { mediaAssetId, success: true, action: 'DELETED', reason: check.reason };
  } else {
    return { mediaAssetId, success: false, action: 'FAILED', reason: deleteResult.error || 'R2 delete operation failed' };
  }
}

/**
 * Scheduled maintenance worker that processes media asset cleanup for completed, abandoned, or expired posts
 */
export async function processScheduledMediaCleanup(options?: {
  failedRetentionHours?: number;
}) {
  const assets = await prisma.mediaAsset.findMany({
    take: 50,
    orderBy: { createdAt: 'asc' },
  });

  const results: CleanupResult[] = [];
  let deletedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const asset of assets) {
    const result = await safeCleanupMediaAsset(asset.id, asset.workspaceId, options);
    results.push(result);
    if (result.action === 'DELETED') deletedCount++;
    else if (result.action === 'SKIPPED') skippedCount++;
    else if (result.action === 'FAILED') failedCount++;
  }

  return {
    scannedCount: assets.length,
    deletedCount,
    skippedCount,
    failedCount,
    results,
  };
}
