import { ListObjectsV2Command, DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import prisma from '../prisma';
import { isR2Configured, getR2Client } from './r2';
import { formatBytes } from './r2-storage-monitor';
import { extractObjectKey } from './r2-cleanup';
import {
  APPROVED_YOUTUBE_CHANNELS,
  matchProtectedYouTubeChannel,
} from '../super-admin-scheduled-cancel-types';
import {
  R2AuditItem,
  R2AuditReport,
  R2CleanupExecutionResult,
  R2CleanupLogItem,
  R2ObjectClassification,
  R2CategorySummary,
  R2WorkspaceSummary,
} from './r2-audit-types';

export * from './r2-audit-types';

export const ORPHAN_GRACE_PERIOD_MS = 24 * 3600 * 1000; // 24 hours grace for unattached uploads
const ACTIVE_POST_STATUSES = [
  'SCHEDULED',
  'QUEUED',
  'PROCESSING',
  'UPLOADING',
  'RETRYING',
  'DRAFT',
  'MANUAL_READY',
  'AWAITING_MANUAL_PUBLISH',
];
const ACTIVE_JOB_STATUSES = ['QUEUED', 'PROCESSING', 'UPLOADING', 'RETRYING'];

let isCleanupInProgress = false;

const CATEGORY_META: Record<
  R2ObjectClassification,
  { label: string; isProtected: boolean; description: string }
> = {
  PUBLISHED: {
    label: 'Published Content Media',
    isProtected: true,
    description: 'Attached to published or partially delivered posts. Permanently preserved.',
  },
  PROTECTED_YOUTUBE: {
    label: 'Protected YouTube Channel Media',
    isProtected: true,
    description: 'Attached to any schedule for the 4 verified YouTube channels. Strictly immutable.',
  },
  SCHEDULED: {
    label: 'Active Scheduled Media',
    isProtected: true,
    description: 'Attached to scheduled posts waiting for publishing. Preserved.',
  },
  DRAFT: {
    label: 'Saved Draft Media',
    isProtected: true,
    description: 'Referenced by creator draft posts. Preserved.',
  },
  IN_FLIGHT: {
    label: 'In-Flight Publishing / Uploading',
    isProtected: true,
    description: 'Actively being uploaded or processed by worker queues. Preserved.',
  },
  SHARED: {
    label: 'Shared Cross-Post Media',
    isProtected: true,
    description: 'Referenced by more than one content post. Preserved.',
  },
  UNATTACHED_GRACE: {
    label: 'Recent Upload (Within 24h Grace)',
    isProtected: true,
    description: 'Uploaded within the last 24 hours without post attachment yet. Preserved.',
  },
  UNVERIFIED_UNKNOWN: {
    label: 'Unverified / Unknown Ownership',
    isProtected: true,
    description: 'Object key structure does not match standard pattern. Preserved by safety guard.',
  },
  CANCELLED_POST_ONLY: {
    label: 'Cancelled-Post-Only Media',
    isProtected: false,
    description: 'Exclusively attached to cancelled post(s) with zero active targets. Eligible for cleanup.',
  },
  CONFIRMED_ORPHAN: {
    label: 'Confirmed Orphaned Upload',
    isProtected: false,
    description: 'No database record exists and upload is older than 24h grace period. Eligible for cleanup.',
  },
};

/**
 * Normalize any media URL, S3 pathname, or key string to the canonical R2 object key
 */
export function normalizeR2Key(raw?: string | null): string {
  if (!raw) return '';
  let k = extractObjectKey(raw) || raw;
  const wsIdx = k.indexOf('workspaces/');
  if (wsIdx !== -1) {
    return k.slice(wsIdx);
  }
  return k.replace(/^\//, '').trim();
}

/**
 * Perform a comprehensive, read-only audit of Cloudflare R2 objects reconciled against the production database
 */
export async function auditR2Storage(options?: {
  customClient?: S3Client;
  customBucketName?: string;
  mockObjects?: Array<{ key: string; size: number; lastModified?: Date }>;
}): Promise<R2AuditReport> {
  const r2Configured = isR2Configured();
  const bucketName = options?.customBucketName || process.env.R2_BUCKET_NAME || 'social-media-os-videos';

  let rawR2Objects: Array<{ key: string; size: number; lastModified?: Date }> = [];
  let configurationNotice: string | undefined;

  // 1. Fetch live objects from Cloudflare R2 bucket via S3 API
  if (options?.mockObjects) {
    rawR2Objects = options.mockObjects;
  } else if (r2Configured) {
    try {
      const client = options?.customClient || getR2Client();
      let continuationToken: string | undefined;

      do {
        const cmd: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        });

        const res = await client.send(cmd);
        if (res.Contents) {
          for (const item of res.Contents) {
            if (item.Key) {
              rawR2Objects.push({
                key: item.Key,
                size: item.Size || 0,
                lastModified: item.LastModified,
              });
            }
          }
        }
        continuationToken = res.NextContinuationToken;
      } while (continuationToken);
    } catch (err: any) {
      console.error('[R2 Audit Service] Failed to list R2 bucket objects:', err);
      configurationNotice = `R2 S3 API error: ${err.message || 'Failed to list bucket objects'}`;
    }
  } else {
    configurationNotice =
      'Cloudflare R2 credentials (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME) are not configured in this environment.';
  }

  // 2. Query all database MediaAssets with referencing posts, platform posts, and publishing jobs
  const dbMediaAssets = await prisma.mediaAsset.findMany({
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      posts: {
        select: {
          id: true,
          title: true,
          status: true,
          scheduledFor: true,
          platformPosts: {
            select: {
              id: true,
              platform: true,
              status: true,
              metadata: true,
              socialAccount: {
                select: {
                  id: true,
                  platform: true,
                  name: true,
                  username: true,
                  platformAccountId: true,
                },
              },
              publishingJobs: {
                select: {
                  id: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // Index DB media assets by normalized object key and ID
  const mediaByKey = new Map<string, (typeof dbMediaAssets)[0]>();
  for (const ma of dbMediaAssets) {
    const rawKey = (ma as any).storageKey || extractObjectKey(ma.url) || ma.url || '';
    const normKey = normalizeR2Key(rawKey);
    if (normKey) {
      mediaByKey.set(normKey, ma);
    }
    const cleanKey = rawKey.replace(/^\//, '');
    if (cleanKey && cleanKey !== normKey) {
      mediaByKey.set(cleanKey, ma);
    }
  }

  // Build Workspace ID -> Name map
  const workspaceNameMap = new Map<string, string>();
  for (const ma of dbMediaAssets) {
    if (ma.workspace) {
      workspaceNameMap.set(ma.workspace.id, ma.workspace.name);
    }
  }

  // 3. Reconcile R2 objects against Database records and classify
  const now = Date.now();
  const eligibleItems: R2AuditItem[] = [];
  const retainedSample: R2AuditItem[] = [];

  const categoryTotals: Record<R2ObjectClassification, { count: number; bytes: number }> = {
    PUBLISHED: { count: 0, bytes: 0 },
    PROTECTED_YOUTUBE: { count: 0, bytes: 0 },
    SCHEDULED: { count: 0, bytes: 0 },
    DRAFT: { count: 0, bytes: 0 },
    IN_FLIGHT: { count: 0, bytes: 0 },
    SHARED: { count: 0, bytes: 0 },
    UNATTACHED_GRACE: { count: 0, bytes: 0 },
    UNVERIFIED_UNKNOWN: { count: 0, bytes: 0 },
    CANCELLED_POST_ONLY: { count: 0, bytes: 0 },
    CONFIRMED_ORPHAN: { count: 0, bytes: 0 },
  };

  const workspaceMap = new Map<
    string,
    {
      workspaceId: string;
      workspaceName: string;
      totalObjects: number;
      totalBytes: number;
      eligibleObjects: number;
      eligibleBytes: number;
      retainedObjects: number;
      retainedBytes: number;
    }
  >();

  let totalBucketBytes = 0;
  let eligibleCount = 0;
  let eligibleBytes = 0;
  let retainedCount = 0;
  let retainedBytes = 0;

  for (const r2Obj of rawR2Objects) {
    const key = r2Obj.key;
    const size = r2Obj.size;
    totalBucketBytes += size;

    const lastModDate = r2Obj.lastModified ? new Date(r2Obj.lastModified) : null;
    const ageMs = lastModDate ? now - lastModDate.getTime() : ORPHAN_GRACE_PERIOD_MS + 1000;

    // Check key format: e.g. workspaces/{workspaceId}/videos/...
    const wsMatch = key.match(/^workspaces\/([a-zA-Z0-9_-]+)\//);
    const parsedWsId = wsMatch ? wsMatch[1] : null;

    const cleanR2Key = normalizeR2Key(key);
    const dbRecord = mediaByKey.get(cleanR2Key) || mediaByKey.get(key) || mediaByKey.get(key.replace(/^\//, ''));
    const finalWsId = dbRecord?.workspaceId || parsedWsId;
    const finalWsName =
      dbRecord?.workspace?.name || (finalWsId ? workspaceNameMap.get(finalWsId) || 'Workspace ' + finalWsId.slice(0, 8) : 'Unknown Workspace');

    let classification: R2ObjectClassification = 'UNVERIFIED_UNKNOWN';
    let isEligible = false;
    let reason = 'Retained by default security guard';
    let protectedChannelName: string | null = null;
    const associatedPostIds: string[] = [];
    const associatedPostTitles: string[] = [];

    if (!dbRecord) {
      // Object has NO record in database
      if (!parsedWsId) {
        classification = 'UNVERIFIED_UNKNOWN';
        isEligible = false;
        reason = 'Object key is outside standard workspace tenant boundary; preserved for safety';
      } else if (ageMs < ORPHAN_GRACE_PERIOD_MS) {
        classification = 'UNATTACHED_GRACE';
        isEligible = false;
        reason = `Recent upload (${Math.round(ageMs / (3600 * 1000))}h old) within 24h retention grace period; preserved`;
      } else {
        classification = 'CONFIRMED_ORPHAN';
        isEligible = true;
        reason = `No database record exists and upload is older than 24h grace period (${Math.round(ageMs / (3600 * 1000))}h old); safe to delete`;
      }
    } else {
      // Object HAS matching DB record
      const posts = dbRecord.posts || [];
      for (const p of posts) {
        associatedPostIds.push(p.id);
        if (p.title) associatedPostTitles.push(p.title);
      }

      // Check if attached to any of the 4 protected YouTube channels
      let usedByProtectedYT = false;
      for (const p of posts) {
        for (const pp of p.platformPosts || []) {
          const match = matchProtectedYouTubeChannel(pp.socialAccount);
          if (match.isProtected) {
            usedByProtectedYT = true;
            protectedChannelName = match.channel?.displayName || 'Approved YouTube Channel';
            break;
          }
        }
        if (usedByProtectedYT) break;
      }

      // Check post statuses
      const hasPublished = posts.some((p) => p.status === 'PUBLISHED' || p.status === 'PARTIALLY_FAILED');
      const hasScheduled = posts.some((p) => p.status === 'SCHEDULED' || p.status === 'QUEUED');
      const hasDraft = posts.some((p) => p.status === 'DRAFT');
      const hasInFlight = posts.some((p) => {
        if (p.status === 'PROCESSING' || p.status === 'UPLOADING') return true;
        for (const pp of p.platformPosts || []) {
          if (pp.status === 'PROCESSING' || pp.status === 'UPLOADING') return true;
          if (
            pp.metadata &&
            (pp.metadata.includes('youtubeUploadUrl') || pp.metadata.includes('uploadUrl')) &&
            pp.status !== 'PUBLISHED'
          ) {
            return true;
          }
          if (pp.publishingJobs?.some((j) => ACTIVE_JOB_STATUSES.includes(j.status))) return true;
        }
        return false;
      });

      const isShared = posts.length > 1;
      const isAlreadyArchived = dbRecord.url.startsWith('archived://') || dbRecord.url.startsWith('archived_retry://');

      if (usedByProtectedYT) {
        classification = 'PROTECTED_YOUTUBE';
        isEligible = false;
        reason = `Attached to approved YouTube channel (${protectedChannelName}); permanently preserved`;
      } else if (hasInFlight) {
        classification = 'IN_FLIGHT';
        isEligible = false;
        reason = 'Referenced by an active in-flight publishing job or upload session; preserved';
      } else if (hasPublished) {
        classification = 'PUBLISHED';
        isEligible = false;
        reason = 'Referenced by a published content post; permanently preserved';
      } else if (isShared) {
        classification = 'SHARED';
        isEligible = false;
        reason = `Shared across ${posts.length} content posts; preserved`;
      } else if (hasScheduled) {
        classification = 'SCHEDULED';
        isEligible = false;
        reason = 'Referenced by an active scheduled post; preserved';
      } else if (hasDraft) {
        classification = 'DRAFT';
        isEligible = false;
        reason = 'Referenced by a saved draft post; preserved';
      } else if (posts.length === 0) {
        if (ageMs < ORPHAN_GRACE_PERIOD_MS) {
          classification = 'UNATTACHED_GRACE';
          isEligible = false;
          reason = 'Unattached upload within 24h retention grace period; preserved';
        } else {
          classification = 'CONFIRMED_ORPHAN';
          isEligible = true;
          reason = 'Unattached upload with 0 posts, older than 24h grace; safe to delete';
        }
      } else {
        // All posts are non-active. Check if all are CANCELLED
        const allCancelled = posts.every((p) => p.status === 'CANCELLED');
        if (allCancelled || isAlreadyArchived) {
          classification = 'CANCELLED_POST_ONLY';
          isEligible = true;
          reason = 'Exclusively associated with cancelled post(s); safe to clean up from R2';
        } else {
          classification = 'UNVERIFIED_UNKNOWN';
          isEligible = false;
          reason = `Post status is neither active nor cancelled (${posts[0].status}); retained for safety`;
        }
      }
    }

    const auditItem: R2AuditItem = {
      key,
      sizeBytes: size,
      sizeFormatted: formatBytes(size),
      lastModified: lastModDate ? lastModDate.toISOString() : null,
      classification,
      isEligibleForCleanup: isEligible,
      reason,
      workspaceId: finalWsId,
      workspaceName: finalWsName,
      mediaAssetId: dbRecord?.id || null,
      associatedPostIds,
      associatedPostTitles,
      protectedChannel: protectedChannelName,
    };

    // Category aggregations
    categoryTotals[classification].count++;
    categoryTotals[classification].bytes += size;

    if (isEligible) {
      eligibleCount++;
      eligibleBytes += size;
      eligibleItems.push(auditItem);
    } else {
      retainedCount++;
      retainedBytes += size;
      if (retainedSample.length < 50) {
        retainedSample.push(auditItem);
      }
    }

    // Workspace aggregations
    const wsKey = finalWsId || 'unassigned';
    if (!workspaceMap.has(wsKey)) {
      workspaceMap.set(wsKey, {
        workspaceId: wsKey,
        workspaceName: finalWsName,
        totalObjects: 0,
        totalBytes: 0,
        eligibleObjects: 0,
        eligibleBytes: 0,
        retainedObjects: 0,
        retainedBytes: 0,
      });
    }
    const wsStats = workspaceMap.get(wsKey)!;
    wsStats.totalObjects++;
    wsStats.totalBytes += size;
    if (isEligible) {
      wsStats.eligibleObjects++;
      wsStats.eligibleBytes += size;
    } else {
      wsStats.retainedObjects++;
      wsStats.retainedBytes += size;
    }
  }

  // Sort eligible items by size descending
  eligibleItems.sort((a, b) => b.sizeBytes - a.sizeBytes);

  // Construct Category Breakdown
  const categories: Record<R2ObjectClassification, R2CategorySummary> = {} as any;
  for (const [classKey, meta] of Object.entries(CATEGORY_META)) {
    const k = classKey as R2ObjectClassification;
    const totals = categoryTotals[k];
    categories[k] = {
      classification: k,
      label: meta.label,
      count: totals.count,
      sizeBytes: totals.bytes,
      sizeFormatted: formatBytes(totals.bytes),
      isProtected: meta.isProtected,
      description: meta.description,
    };
  }

  // Construct Workspace Breakdown sorted by total bytes descending
  const workspaces: R2WorkspaceSummary[] = Array.from(workspaceMap.values())
    .map((w) => ({
      ...w,
      totalFormatted: formatBytes(w.totalBytes),
      eligibleFormatted: formatBytes(w.eligibleBytes),
      retainedFormatted: formatBytes(w.retainedBytes),
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);

  return {
    timestamp: new Date().toISOString(),
    isR2Configured: r2Configured,
    bucketName,
    totalBucketObjects: rawR2Objects.length,
    totalBucketBytes,
    totalBucketMB: Number((totalBucketBytes / (1024 * 1024)).toFixed(2)),
    totalBucketGB: Number((totalBucketBytes / (1024 * 1024 * 1024)).toFixed(3)),

    eligibleCount,
    eligibleBytes,
    eligibleMB: Number((eligibleBytes / (1024 * 1024)).toFixed(2)),
    eligibleGB: Number((eligibleBytes / (1024 * 1024 * 1024)).toFixed(3)),

    retainedCount,
    retainedBytes,
    retainedMB: Number((retainedBytes / (1024 * 1024)).toFixed(2)),
    retainedGB: Number((retainedBytes / (1024 * 1024 * 1024)).toFixed(3)),

    categories,
    workspaces,
    eligibleItems,
    retainedSample,
    configurationNotice,
  };
}

/**
 * Execute verified safe permanent cleanup of eligible Cloudflare R2 objects with bounded concurrency
 */
export async function executeR2Cleanup(options: {
  confirmToken: string;
  actorUserId?: string;
  dryRun?: boolean;
  selectedKeys?: string[];
  deleteR2Fn?: (objectKey: string) => Promise<{ success: boolean; error?: string }>;
  auditOverride?: R2AuditReport;
}): Promise<R2CleanupExecutionResult> {
  if (options.confirmToken !== 'CONFIRM_CLEANUP') {
    throw new Error("Safety check failed: You must provide confirmToken: 'CONFIRM_CLEANUP' to execute cleanup.");
  }

  if (isCleanupInProgress) {
    throw new Error('A cleanup job is already running in background. Please wait for it to complete.');
  }

  isCleanupInProgress = true;

  try {
    const audit = options.auditOverride || (await auditR2Storage());

    const selectedSet = options.selectedKeys && options.selectedKeys.length > 0 ? new Set(options.selectedKeys) : null;

    const candidates = audit.eligibleItems.filter((item) => {
      if (selectedSet && !selectedSet.has(item.key)) return false;
      return item.isEligibleForCleanup;
    });

    const deletedKeys: R2CleanupExecutionResult['deletedKeys'] = [];
    let deletedCount = 0;
    let failedCount = 0;
    let freedBytes = 0;

    // Dry Run mode: calculate simulated outcomes without deleting anything
    if (options.dryRun) {
      for (const item of candidates) {
        deletedCount++;
        freedBytes += item.sizeBytes;
        deletedKeys.push({
          key: item.key,
          sizeFormatted: item.sizeFormatted,
          status: 'DELETED',
          reason: `Dry run: verified eligible (${item.reason})`,
        });
      }

      return {
        success: true,
        dryRun: true,
        attemptedCount: candidates.length,
        deletedCount,
        failedCount: 0,
        freedBytes,
        freedMB: Number((freedBytes / (1024 * 1024)).toFixed(2)),
        freedGB: Number((freedBytes / (1024 * 1024 * 1024)).toFixed(3)),
        deletedKeys,
        timestamp: new Date().toISOString(),
      };
    }

    // Live Execution: Bounded Concurrency (5 parallel tasks)
    const CONCURRENCY_LIMIT = 5;
    const bucketName = audit.bucketName;
    const client = isR2Configured() ? getR2Client() : null;

    let nextIdx = 0;
    const candidateResults: R2CleanupExecutionResult['deletedKeys'][0][] = new Array(candidates.length);

    async function cleanupWorker() {
      while (nextIdx < candidates.length) {
        const itemIdx = nextIdx++;
        const item = candidates[itemIdx];

        try {
          // Pre-deletion safety check: if item has mediaAssetId, double-check that no new active post was attached
          if (item.mediaAssetId) {
            const freshAsset = await prisma.mediaAsset.findUnique({
              where: { id: item.mediaAssetId },
              include: {
                posts: {
                  select: { id: true, status: true },
                },
              },
            });

            const hasActivePost = freshAsset?.posts.some((p) => ACTIVE_POST_STATUSES.includes(p.status));
            if (hasActivePost) {
              candidateResults[itemIdx] = {
                key: item.key,
                sizeFormatted: item.sizeFormatted,
                status: 'SKIPPED',
                reason: 'Safety re-check: media was recently attached to an active post; aborted deletion',
              };
              continue;
            }
          }

          // Delete from Cloudflare R2
          if (options.deleteR2Fn) {
            const delRes = await options.deleteR2Fn(item.key);
            if (!delRes.success) {
              throw new Error(delRes.error || 'Custom delete function failed');
            }
          } else if (client) {
            const deleteCmd = new DeleteObjectCommand({
              Bucket: bucketName,
              Key: item.key,
            });
            await client.send(deleteCmd);
          } else {
            throw new Error('R2 client is not configured; cannot delete S3 object.');
          }

          // Update database record if present
          if (item.mediaAssetId) {
            await prisma.mediaAsset
              .update({
                where: { id: item.mediaAssetId },
                data: {
                  url: `archived://${item.key}`,
                },
              })
              .catch(() => {});
          }

          candidateResults[itemIdx] = {
            key: item.key,
            sizeFormatted: item.sizeFormatted,
            status: 'DELETED',
            reason: 'Permanently deleted from R2 and archived in database',
          };
        } catch (err: any) {
          console.error(`[R2 Cleanup Execution Error] Key ${item.key}:`, err);
          candidateResults[itemIdx] = {
            key: item.key,
            sizeFormatted: item.sizeFormatted,
            status: 'FAILED',
            reason: err.message || 'S3 DeleteObject error',
          };
        }
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, candidates.length) }, () => cleanupWorker());
    await Promise.all(workers);

    // Collate results in deterministic order
    for (let i = 0; i < candidateResults.length; i++) {
      const res = candidateResults[i];
      if (res) {
        deletedKeys.push(res);
        if (res.status === 'DELETED') {
          deletedCount++;
          freedBytes += candidates[i].sizeBytes;
        } else if (res.status === 'FAILED') {
          failedCount++;
        }
      }
    }

    // Write audit log entry into ActivityLog
    const auditLog = await prisma.activityLog.create({
      data: {
        action: 'SUPER_ADMIN_R2_STORAGE_CLEANUP',
        actorUserId: options.actorUserId || 'super_admin_owner',
        details: `Deleted ${deletedCount} verified unnecessary R2 object(s) (${formatBytes(freedBytes)} freed). Failed: ${failedCount}.`,
        metadata: JSON.stringify({
          timestamp: new Date().toISOString(),
          actor: options.actorUserId || 'owner',
          bucketName,
          attemptedCount: candidates.length,
          deletedCount,
          failedCount,
          freedBytes,
          deletedKeys: deletedKeys.slice(0, 100), // store up to 100 sample keys in metadata
        }),
      },
    });

    return {
      success: true,
      dryRun: false,
      attemptedCount: candidates.length,
      deletedCount,
      failedCount,
      freedBytes,
      freedMB: Number((freedBytes / (1024 * 1024)).toFixed(2)),
      freedGB: Number((freedBytes / (1024 * 1024 * 1024)).toFixed(3)),
      deletedKeys,
      auditLogId: auditLog.id,
      timestamp: new Date().toISOString(),
    };
  } finally {
    isCleanupInProgress = false;
  }
}

/**
 * Retrieve recent Cloudflare R2 cleanup audit logs
 */
export async function getR2CleanupHistory(): Promise<R2CleanupLogItem[]> {
  const logs = await prisma.activityLog.findMany({
    where: {
      action: {
        in: ['SUPER_ADMIN_R2_STORAGE_CLEANUP', 'SUPER_ADMIN_SCHEDULE_CANCEL_R2_CLEANUP'],
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 25,
  });

  return logs.map((log) => {
    let parsedMetadata = null;
    try {
      if (log.metadata) parsedMetadata = JSON.parse(log.metadata);
    } catch {
      parsedMetadata = log.metadata;
    }

    return {
      id: log.id,
      action: log.action,
      actorUserId: log.actorUserId,
      details: log.details,
      metadata: parsedMetadata,
      createdAt: log.createdAt ? log.createdAt.toISOString() : new Date().toISOString(),
    };
  });
}
