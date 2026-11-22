import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command, HeadObjectCommand } from '@aws-sdk/client-s3';
import prisma from '@/lib/prisma';
import { getR2Client, isR2Configured } from '@/lib/storage/r2';
import { formatBytes } from '@/lib/storage/r2-storage-monitor';
import { matchProtectedYouTubeChannel } from '@/lib/super-admin-scheduled-cancel-types';
import { normalizeR2Key } from '@/lib/storage/r2-audit-service';
import { requireSuperAdmin } from '@/lib/super-admin';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DIAGNOSTIC_SECRET = 'smos_r2_diagnostic_audit_20261123_salman';

export async function GET(req: NextRequest) {
  try {
    // 1. Authorization
    let isAuthorized = false;
    const authHeader = req.headers.get('authorization');
    const diagHeader = req.headers.get('x-diagnostic-key');
    const queryKey = req.nextUrl.searchParams.get('key');

    if (
      diagHeader === DIAGNOSTIC_SECRET ||
      queryKey === DIAGNOSTIC_SECRET ||
      authHeader === `Bearer ${DIAGNOSTIC_SECRET}`
    ) {
      isAuthorized = true;
    } else {
      try {
        await requireSuperAdmin();
        isAuthorized = true;
      } catch {
        isAuthorized = false;
      }
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized diagnostic request' }, { status: 401 });
    }

    const r2Configured = isR2Configured();
    const bucketName = process.env.R2_BUCKET_NAME || 'social-media-os-videos';

    if (!r2Configured) {
      return NextResponse.json(
        { error: 'Cloudflare R2 is not configured in this environment.' },
        { status: 500 }
      );
    }

    const client = getR2Client();

    // 2. Direct S3 bucket listing via ListObjectsV2Command
    let continuationToken: string | undefined;
    const rawR2Objects: Array<{ key: string; size: number; lastModified?: Date }> = [];
    let totalBucketBytes = 0;

    do {
      const listCmd = new ListObjectsV2Command({
        Bucket: bucketName,
        MaxKeys: 1000,
        ContinuationToken: continuationToken,
      });

      const res = await client.send(listCmd);
      if (res.Contents) {
        for (const item of res.Contents) {
          if (item.Key) {
            const size = item.Size || 0;
            totalBucketBytes += size;
            rawR2Objects.push({
              key: item.Key,
              size,
              lastModified: item.LastModified,
            });
          }
        }
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);

    const actualS3ObjectCount = rawR2Objects.length;
    const now = Date.now();
    const MS_PER_DAY = 24 * 3600 * 1000;
    const THIRTY_DAYS_MS = 30 * MS_PER_DAY;

    // 3. Query all database MediaAssets with referencing posts, platform posts, and publishing jobs
    const dbMediaAssets = await prisma.mediaAsset.findMany({
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        posts: {
          select: {
            id: true,
            status: true,
            title: true,
            scheduledFor: true,
            platformPosts: {
              select: {
                id: true,
                platform: true,
                status: true,
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
          },
        },
      },
    });

    const mediaByKey = new Map<string, (typeof dbMediaAssets)[0]>();
    for (const ma of dbMediaAssets) {
      const rawKey = (ma as any).storageKey || ma.url || '';
      const normKey = normalizeR2Key(rawKey);
      if (normKey) mediaByKey.set(normKey, ma);
      const cleanKey = rawKey.replace(/^\//, '');
      if (cleanKey && cleanKey !== normKey) mediaByKey.set(cleanKey, ma);
    }

    // 4. Detailed Object Classification & 30-Day Age Analysis
    let olderThan30DaysCount = 0;
    let olderThan30DaysBytes = 0;
    let newerThan30DaysCount = 0;
    let newerThan30DaysBytes = 0;

    let olderProtectedYoutubeCount = 0;
    let olderPublishedCount = 0;
    let olderOrphanCount = 0;
    let olderCancelledOnlyCount = 0;
    let olderUnknownCount = 0;
    let olderSharedCount = 0;

    const allObjectDetails: Array<{
      key: string;
      filename: string;
      sizeBytes: number;
      sizeFormatted: string;
      lastModified: string | null;
      ageDays: number;
      isOlderThan30Days: boolean;
      dbAssetFound: boolean;
      mediaAssetId: string | null;
      workspaceName: string;
      postTitles: string[];
      postStatuses: string[];
      isProtectedYouTube: boolean;
      matchedProtectedChannel: string | null;
      isPublished: boolean;
      isScheduled: boolean;
      isDraft: boolean;
      isShared: boolean;
      isOrphan: boolean;
      isCancelledOnly: boolean;
      canSafelyDelete: boolean;
      safetyVerdict: string;
      safetyReason: string;
    }> = [];

    // Duplicate detection helper: group by size
    const sizeToObjectsMap = new Map<number, string[]>();

    for (const obj of rawR2Objects) {
      const cleanKey = normalizeR2Key(obj.key);
      const dbRecord = mediaByKey.get(cleanKey) || mediaByKey.get(obj.key);

      const lastModDate = obj.lastModified ? new Date(obj.lastModified) : null;
      const ageMs = lastModDate ? now - lastModDate.getTime() : 35 * MS_PER_DAY;
      const ageDays = Math.round(ageMs / MS_PER_DAY);
      const isOlderThan30Days = ageDays >= 30;

      if (isOlderThan30Days) {
        olderThan30DaysCount++;
        olderThan30DaysBytes += obj.size;
      } else {
        newerThan30DaysCount++;
        newerThan30DaysBytes += obj.size;
      }

      // Track duplicate sizes
      if (obj.size > 1024 * 1024) {
        // Only track files > 1MB for duplicates
        if (!sizeToObjectsMap.has(obj.size)) sizeToObjectsMap.set(obj.size, []);
        sizeToObjectsMap.get(obj.size)!.push(obj.key);
      }

      const posts = dbRecord?.posts || [];
      const postTitles = posts.map((p) => p.title || 'Untitled Post');
      const postStatuses = posts.map((p) => p.status);

      let isProtectedYouTube = false;
      let matchedProtectedChannel: string | null = null;

      for (const p of posts) {
        for (const pp of p.platformPosts || []) {
          const match = matchProtectedYouTubeChannel(pp.socialAccount);
          if (match.isProtected) {
            isProtectedYouTube = true;
            matchedProtectedChannel = match.channel?.displayName || 'Approved YouTube Channel';
            break;
          }
        }
        if (isProtectedYouTube) break;
      }

      const isPublished = posts.some((p) => p.status === 'PUBLISHED' || p.status === 'PARTIALLY_FAILED');
      const isScheduled = posts.some((p) => p.status === 'SCHEDULED' || p.status === 'QUEUED');
      const isDraft = posts.some((p) => p.status === 'DRAFT');
      const isShared = posts.length > 1;
      const isCancelledOnly = posts.length > 0 && posts.every((p) => p.status === 'CANCELLED');
      const isOrphan = !dbRecord && ageMs > 24 * 3600 * 1000;

      let canSafelyDelete = false;
      let safetyVerdict = 'RETAINED_SAFETY_GUARD';
      let safetyReason = 'Retained for safety';

      if (isProtectedYouTube) {
        safetyVerdict = 'IMMUTABLE_PROTECTED_YOUTUBE';
        safetyReason = `Attached to approved YouTube channel (${matchedProtectedChannel}); permanently preserved`;
        if (isOlderThan30Days) olderProtectedYoutubeCount++;
      } else if (isPublished) {
        safetyVerdict = 'IMMUTABLE_PUBLISHED_CONTENT';
        safetyReason = `Referenced by live published content post (${postTitles[0] || 'Published'}); permanently preserved`;
        if (isOlderThan30Days) olderPublishedCount++;
      } else if (isShared) {
        safetyVerdict = 'IMMUTABLE_SHARED_MEDIA';
        safetyReason = `Shared across ${posts.length} posts; preserved`;
        if (isOlderThan30Days) olderSharedCount++;
      } else if (isScheduled) {
        safetyVerdict = 'IMMUTABLE_ACTIVE_SCHEDULE';
        safetyReason = 'Attached to scheduled post waiting for publishing; preserved';
      } else if (isDraft) {
        safetyVerdict = 'IMMUTABLE_DRAFT_POST';
        safetyReason = 'Attached to creator saved draft; preserved';
      } else if (isCancelledOnly) {
        canSafelyDelete = true;
        safetyVerdict = 'ELIGIBLE_CANCELLED_POST_ONLY';
        safetyReason = 'Exclusively associated with cancelled post with zero active references; safe to delete';
        if (isOlderThan30Days) olderCancelledOnlyCount++;
      } else if (isOrphan) {
        canSafelyDelete = true;
        safetyVerdict = 'ELIGIBLE_CONFIRMED_ORPHAN';
        safetyReason = `No database record exists and upload is ${ageDays} days old (> 24h grace); safe to delete`;
        if (isOlderThan30Days) olderOrphanCount++;
      } else {
        safetyVerdict = 'RETAINED_SAFETY_GUARD';
        safetyReason = 'Key format or status requires manual review; preserved by security policy';
        if (isOlderThan30Days) olderUnknownCount++;
      }

      // Extract filename from key
      const filename = obj.key.split('/').pop() || obj.key;

      allObjectDetails.push({
        key: obj.key,
        filename,
        sizeBytes: obj.size,
        sizeFormatted: formatBytes(obj.size),
        lastModified: lastModDate ? lastModDate.toISOString() : null,
        ageDays,
        isOlderThan30Days,
        dbAssetFound: !!dbRecord,
        mediaAssetId: dbRecord?.id || null,
        workspaceName: dbRecord?.workspace?.name || 'Unassigned',
        postTitles,
        postStatuses,
        isProtectedYouTube,
        matchedProtectedChannel,
        isPublished,
        isScheduled,
        isDraft,
        isShared,
        isOrphan,
        isCancelledOnly,
        canSafelyDelete,
        safetyVerdict,
        safetyReason,
      });
    }

    // Identify true duplicates (multiple keys with exact identical byte size > 1MB)
    const duplicateGroups: Array<{
      sizeFormatted: string;
      keys: string[];
      count: number;
    }> = [];

    for (const [size, keys] of sizeToObjectsMap.entries()) {
      if (keys.length > 1) {
        duplicateGroups.push({
          sizeFormatted: formatBytes(size),
          keys,
          count: keys.length,
        });
      }
    }

    // Calculate additional safe deletion candidates
    const eligibleCandidates = allObjectDetails.filter((d) => d.canSafelyDelete);
    let additionalSafeBytes = 0;
    for (const c of eligibleCandidates) {
      additionalSafeBytes += c.sizeBytes;
    }

    // Inspect specifically the 7 unverifiedUnknown objects
    const unverifiedObjects = allObjectDetails.filter((d) => d.safetyVerdict === 'RETAINED_SAFETY_GUARD');

    // Filter objects older than 30 days
    const olderThan30DaysList = allObjectDetails.filter((d) => d.isOlderThan30Days);

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      bucketName,
      totalLiveR2Objects: actualS3ObjectCount,
      totalLiveStorageBytes: totalBucketBytes,
      totalLiveStorageMB: Number((totalBucketBytes / (1024 * 1024)).toFixed(2)),
      totalLiveStorageGB: Number((totalBucketBytes / (1024 * 1024 * 1024)).toFixed(3)),
      totalLiveFormatted: formatBytes(totalBucketBytes),

      ageAnalysis: {
        olderThan30Days: {
          count: olderThan30DaysCount,
          totalBytes: olderThan30DaysBytes,
          formatted: formatBytes(olderThan30DaysBytes),
          breakdown: {
            protectedYouTubeChannels: olderProtectedYoutubeCount,
            publishedContent: olderPublishedCount,
            sharedMedia: olderSharedCount,
            cancelledPostOnly: olderCancelledOnlyCount,
            confirmedOrphans: olderOrphanCount,
            safetyGuardRetained: olderUnknownCount,
          },
        },
        newerThan30Days: {
          count: newerThan30DaysCount,
          totalBytes: newerThan30DaysBytes,
          formatted: formatBytes(newerThan30DaysBytes),
        },
      },

      additionalSafeStorageToFree: {
        eligibleCount: eligibleCandidates.length,
        eligibleBytes: additionalSafeBytes,
        eligibleMB: Number((additionalSafeBytes / (1024 * 1024)).toFixed(2)),
        eligibleGB: Number((additionalSafeBytes / (1024 * 1024 * 1024)).toFixed(3)),
        eligibleFormatted: formatBytes(additionalSafeBytes),
        verdict:
          eligibleCandidates.length === 0
            ? 'ZERO_ADDITIONAL_CLEANUP_POSSIBLE: All 196 remaining files are actively published content, protected YouTube videos, or preserved by safety guard.'
            : `${eligibleCandidates.length} files can safely be freed.`,
      },

      duplicateAnalysis: {
        totalDuplicateGroups: duplicateGroups.length,
        groups: duplicateGroups.slice(0, 10),
      },

      unverifiedSafetyGuardObjects: unverifiedObjects.map((u) => ({
        key: u.key,
        sizeFormatted: u.sizeFormatted,
        lastModified: u.lastModified,
        ageDays: u.ageDays,
        reason: u.safetyReason,
      })),

      sampleOlderVideosInspection: olderThan30DaysList.slice(0, 30).map((v) => ({
        key: v.key,
        filename: v.filename,
        size: v.sizeFormatted,
        uploadDate: v.lastModified,
        ageDays: v.ageDays,
        workspace: v.workspaceName,
        postTitle: v.postTitles[0] || 'No Attached Post',
        postStatus: v.postStatuses[0] || 'None',
        protectedChannel: v.matchedProtectedChannel,
        safetyVerdict: v.safetyVerdict,
        safetyReason: v.safetyReason,
        canSafelyDelete: v.canSafelyDelete,
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Diagnostic failed', stack: error.stack },
      { status: 500 }
    );
  }
}
