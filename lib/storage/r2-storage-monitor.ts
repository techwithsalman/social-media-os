import prisma from '../prisma';
import { isR2Configured, getR2Client } from './r2';
import { processScheduledMediaCleanup } from './r2-cleanup';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export const MAX_R2_STORAGE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
export const WARN_R2_STORAGE_BYTES = 8 * 1024 * 1024 * 1024; // 8 GB (80%)
export const CRITICAL_R2_STORAGE_BYTES = 9 * 1024 * 1024 * 1024; // 9 GB (90%)

export type StorageWarningLevel = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';

export interface StorageMetrics {
  maxStorageBytes: number;
  activeStorageBytes: number;
  activeStorageMB: number;
  activeStorageGB: number;
  percentageUsed: number;
  warningLevel: StorageWarningLevel;
  warningMessage?: string;

  totalAssetsCount: number;
  activeAssetsCount: number;
  archivedAssetsCount: number;
  pendingRetryCount: number;
  pendingClaimCount: number;

  videoCount: number;
  videoBytes: number;
  imageCount: number;
  imageBytes: number;

  savedArchivedBytes: number;
  savedArchivedGB: number;

  isR2Configured: boolean;
  bucketName?: string;
  actualR2ObjectsCount?: number;
  actualR2Bytes?: number;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Audit Cloudflare R2 storage usage across database records and (optionally) live R2 bucket
 */
export async function getStorageMetrics(options?: { auditR2Bucket?: boolean }): Promise<StorageMetrics> {
  const r2Configured = isR2Configured();
  const bucketName = process.env.R2_BUCKET_NAME || undefined;

  // 1. Database aggregation for active R2 assets
  // Exclude archived assets (already deleted from R2) and local uploads
  const activeAssetsWhere = {
    NOT: [
      { url: { startsWith: 'archived://' } },
      { url: { startsWith: '/uploads/' } },
      { url: { startsWith: 'http://localhost' } },
      { url: { startsWith: 'http://127.0.0.1' } },
    ],
  };

  const [
    totalAssetsCount,
    archivedAssetsCount,
    pendingRetryCount,
    pendingClaimCount,
    activeAssets,
    archivedAssetsSum,
  ] = await Promise.all([
    prisma.mediaAsset.count(),
    prisma.mediaAsset.count({
      where: { url: { startsWith: 'archived://' } },
    }),
    prisma.mediaAsset.count({
      where: { url: { startsWith: 'archived_retry://' } },
    }),
    prisma.mediaAsset.count({
      where: { url: { startsWith: 'archived_pending://' } },
    }),
    prisma.mediaAsset.findMany({
      where: activeAssetsWhere,
      select: {
        id: true,
        size: true,
        mimeType: true,
        url: true,
      },
    }),
    prisma.mediaAsset.aggregate({
      where: { url: { startsWith: 'archived://' } },
      _sum: { size: true },
    }),
  ]);

  let activeStorageBytes = 0;
  let videoCount = 0;
  let videoBytes = 0;
  let imageCount = 0;
  let imageBytes = 0;

  for (const asset of activeAssets) {
    const assetSize = asset.size || 0;
    activeStorageBytes += assetSize;

    if (asset.mimeType?.startsWith('video/')) {
      videoCount++;
      videoBytes += assetSize;
    } else if (asset.mimeType?.startsWith('image/')) {
      imageCount++;
      imageBytes += assetSize;
    }
  }

  const savedArchivedBytes = archivedAssetsSum._sum.size || 0;
  const percentageUsed = Math.min(
    100,
    parseFloat(((activeStorageBytes / MAX_R2_STORAGE_BYTES) * 100).toFixed(2))
  );

  let warningLevel: StorageWarningLevel = 'HEALTHY';
  let warningMessage: string | undefined;

  if (activeStorageBytes >= MAX_R2_STORAGE_BYTES) {
    warningLevel = 'EXCEEDED';
    warningMessage = `CRITICAL ALERT: Cloudflare R2 storage has EXCEEDED the 10 GB limit (${formatBytes(activeStorageBytes)} / 10 GB, ${percentageUsed}%). Automatic cleanup is urgently executing.`;
  } else if (activeStorageBytes >= CRITICAL_R2_STORAGE_BYTES) {
    warningLevel = 'CRITICAL';
    warningMessage = `WARNING: Cloudflare R2 storage is at CRITICAL level (${formatBytes(activeStorageBytes)} / 10 GB, ${percentageUsed}%). Safeguards active.`;
  } else if (activeStorageBytes >= WARN_R2_STORAGE_BYTES) {
    warningLevel = 'WARNING';
    warningMessage = `NOTICE: Cloudflare R2 storage has crossed the 80% threshold (${formatBytes(activeStorageBytes)} / 10 GB, ${percentageUsed}%). Proactive cleanup enabled.`;
  }

  // 2. Optional: Direct Cloudflare R2 bucket audit via S3 API
  let actualR2ObjectsCount: number | undefined;
  let actualR2Bytes: number | undefined;

  if (options?.auditR2Bucket && r2Configured && bucketName) {
    try {
      const client = getR2Client();
      let continuationToken: string | undefined;
      let totalBucketObjects = 0;
      let totalBucketBytes = 0;

      do {
        const cmd: ListObjectsV2Command = new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        });
        const res = await client.send(cmd);
        if (res.Contents) {
          totalBucketObjects += res.Contents.length;
          for (const item of res.Contents) {
            totalBucketBytes += item.Size || 0;
          }
        }
        continuationToken = res.NextContinuationToken;
      } while (continuationToken);

      actualR2ObjectsCount = totalBucketObjects;
      actualR2Bytes = totalBucketBytes;
    } catch (err) {
      console.error('[R2 Storage Monitor] Direct R2 bucket audit failed:', err);
    }
  }

  return {
    maxStorageBytes: MAX_R2_STORAGE_BYTES,
    activeStorageBytes,
    activeStorageMB: parseFloat((activeStorageBytes / (1024 * 1024)).toFixed(2)),
    activeStorageGB: parseFloat((activeStorageBytes / (1024 * 1024 * 1024)).toFixed(3)),
    percentageUsed,
    warningLevel,
    warningMessage,

    totalAssetsCount,
    activeAssetsCount: activeAssets.length,
    archivedAssetsCount,
    pendingRetryCount,
    pendingClaimCount,

    videoCount,
    videoBytes,
    imageCount,
    imageBytes,

    savedArchivedBytes,
    savedArchivedGB: parseFloat((savedArchivedBytes / (1024 * 1024 * 1024)).toFixed(3)),

    isR2Configured: r2Configured,
    bucketName,
    actualR2ObjectsCount,
    actualR2Bytes,
  };
}

/**
 * Storage safety check & proactive enforcement:
 * Inspects R2 storage consumption against the 10 GB cap.
 * If usage is >= 80% (8 GB), proactively triggers maintenance cleanup of eligible terminal assets
 * while maintaining 100% protection for scheduled, processing, retrying, and shared media.
 */
export async function enforceStorageSafeguards(): Promise<{
  metrics: StorageMetrics;
  proactiveCleanupTriggered: boolean;
  cleanupSummary?: any;
}> {
  const metrics = await getStorageMetrics();

  if (metrics.warningLevel !== 'HEALTHY') {
    console.warn(`[R2 Storage Safeguard] ${metrics.warningMessage}`);

    // Storage is near or above 80%: proactively trigger cleanup with expanded scan limit
    try {
      const cleanupSummary = await processScheduledMediaCleanup({
        batchSize: 5,
        scanLimit: 25,
      });

      console.log(
        `[R2 Storage Safeguard] Proactive cleanup executed: Deleted ${cleanupSummary.deletedCount} asset(s), scanned ${cleanupSummary.scannedCount}.`
      );

      return {
        metrics,
        proactiveCleanupTriggered: true,
        cleanupSummary,
      };
    } catch (cleanupErr) {
      console.error('[R2 Storage Safeguard] Proactive cleanup failed:', cleanupErr);
      return {
        metrics,
        proactiveCleanupTriggered: true,
        cleanupSummary: { error: cleanupErr },
      };
    }
  }

  return {
    metrics,
    proactiveCleanupTriggered: false,
  };
}
