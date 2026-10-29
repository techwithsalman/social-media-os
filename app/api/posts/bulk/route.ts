import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { EntitlementError, assertCanCreateBillablePost, recordPostUsage, getWorkspaceUsage } from '@/lib/billing';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';
import { SUPPORTED_PLATFORM_IDS } from '@/lib/platforms';

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ error: 'Workspace required' }, { status: 400 });
    }

    const { items } = await req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    // Validate that all accounts belong to the workspace
    const accountIds = new Set(items.flatMap((i: any) => i.platformSettings.map((p: any) => p.socialAccountId)));
    const accounts = await prisma.socialAccount.findMany({
      where: {
        id: { in: Array.from(accountIds) },
        workspaceId: session.workspaceId,
        platform: { in: SUPPORTED_PLATFORM_IDS as unknown as string[] },
      }
    });

    if (accounts.length !== accountIds.size) {
      return NextResponse.json({ error: 'One or more selected social accounts are invalid or do not belong to this workspace.' }, { status: 400 });
    }

    // Validate that all media assets belong to the workspace
    const mediaIds = Array.from(new Set(items.map((i: any) => i.mediaAssetId).filter(Boolean)));
    if (mediaIds.length > 0) {
      const media = await prisma.mediaAsset.findMany({
        where: {
          id: { in: mediaIds },
          workspaceId: session.workspaceId
        }
      });
      if (media.length !== mediaIds.length) {
        return NextResponse.json({ error: 'One or more media assets are invalid or do not belong to this workspace.' }, { status: 400 });
      }
    }

    // Validate TikTok requirements across items: Direct Post requires an explicit valid privacy setting
    for (const item of items) {
      for (const plat of item.platformSettings || []) {
        if (plat.platform === 'TIKTOK' && plat.contentType !== 'INBOX_DRAFT') {
          const validTikTokPrivacy = ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'];
          if (!plat.visibility || !validTikTokPrivacy.includes(plat.visibility)) {
            return NextResponse.json(
              { error: 'Please select a valid privacy level for TikTok on all items before scheduling.' },
              { status: 400 }
            );
          }
        }
      }
    }


    const { postsThisMonth } = await getWorkspaceUsage(session.workspaceId);
    try {
      await checkPlanLimit(session.workspaceId, 'postsPerMonth', postsThisMonth + items.length - 1);
    } catch (error: any) {
      if (error instanceof PlanLimitError) return createPlanLimitResponse(error);
    }
    // Assert billing for the first item as a proxy for the batch (or check for all)
    // For simplicity, we just assert once to see if they can create at least one scheduled post.
    try {
      await assertCanCreateBillablePost(session.workspaceId, 'schedule');
    } catch (error) {
      if (error instanceof EntitlementError) {
        return NextResponse.json({ error: error.message }, { status: 402 });
      }
      throw error;
    }

    
    console.log('[BULK_POSTS] REQUEST_RECEIVED', { itemCount: items.length });

    // Safe, bounded batch scheduling with idempotency guard
    // Processes items in small chunks to avoid long-running Prisma transactions and serverless timeouts
    const CHUNK_SIZE = 5;
    const schedulingResults: Array<{
      item: any;
      success: boolean;
      post?: any;
      error?: string;
      isReused?: boolean;
    }> = [];

    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      const chunk = items.slice(i, i + CHUNK_SIZE);
      const chunkPromises = chunk.map(async (item: any) => {
        const {
          mediaAssetId,
          masterCaption,
          scheduledFor,
          timezone,
          platformSettings,
        } = item;

        // 1. Idempotency Guard:
        // If a post with this exact mediaAssetId and SCHEDULED status already exists in this workspace, reuse it!
        if (mediaAssetId) {
          const existing = await prisma.contentPost.findFirst({
            where: {
              workspaceId: session.workspaceId,
              mediaAssetId: mediaAssetId,
              status: 'SCHEDULED',
            },
            include: {
              platformPosts: {
                include: { publishingJobs: true },
              },
            },
          });

          if (existing && existing.platformPosts.length > 0) {
            // Verify and backfill any missing publishingJobs
            for (const pp of existing.platformPosts) {
              if (pp.publishingJobs.length === 0) {
                await prisma.publishingJob.create({
                  data: {
                    platformPostId: pp.id,
                    status: 'QUEUED',
                    scheduledAt: existing.scheduledFor || new Date(scheduledFor),
                    attempts: 0,
                    maxAttempts: 3,
                  },
                });
              }
            }

            return { post: existing, isReused: true };
          }
        }

        // 2. Atomic per-post creation with PlatformPosts and PublishingJobs
        const contentPost = await prisma.contentPost.create({
          data: {
            workspaceId: session.workspaceId,
            userId: session.userId,
            title: (masterCaption || '').slice(0, 100) || 'Scheduled Post',
            masterCaption: masterCaption || '',
            status: 'SCHEDULED',
            scheduledFor: new Date(scheduledFor),
            timezone: timezone || 'Asia/Karachi',
            mediaAssetId: mediaAssetId || null,
            platformPosts: {
              create: (platformSettings || []).map((plat: any) => ({
                socialAccountId: plat.socialAccountId,
                platform: plat.platform,
                customCaption: plat.customCaption || masterCaption || '',
                hashtags: plat.hashtags || '',
                contentType: plat.contentType || (item.mimeType?.startsWith('video') ? 'VIDEO' : 'POST'),
                visibility: plat.visibility || 'PUBLIC',
                metadata: JSON.stringify(plat.metadata || {}),
                status: 'SCHEDULED',
                publishingJobs: {
                  create: {
                    status: 'QUEUED',
                    scheduledAt: new Date(scheduledFor),
                    attempts: 0,
                    maxAttempts: 3,
                  },
                },
              })),
            },
          },
          include: {
            platformPosts: {
              include: { publishingJobs: true },
            },
          },
        });

        return { post: contentPost, isReused: false };
      });

      const chunkResults = await Promise.allSettled(chunkPromises);

      for (let j = 0; j < chunk.length; j++) {
        const res = chunkResults[j];
        if (res.status === 'fulfilled') {
          schedulingResults.push({
            item: chunk[j],
            success: true,
            post: res.value.post,
            isReused: res.value.isReused,
          });
        } else {
          console.error('[BULK_POSTS] Item scheduling error:', res.reason);
          schedulingResults.push({
            item: chunk[j],
            success: false,
            error: res.reason?.message || 'Database insert failed',
          });
        }
      }
    }

    const successfulResults = schedulingResults.filter((r) => r.success);
    const failedResults = schedulingResults.filter((r) => !r.success);
    const newlyCreated = successfulResults.filter((r) => !r.isReused);

    // Record billing usage ONLY for newly created posts (do not double-charge on retry)
    for (let i = 0; i < newlyCreated.length; i++) {
      try {
        await recordPostUsage(session.workspaceId, 'scheduled');
      } catch (err) {
        console.error('[BULK_POSTS] Failed to record usage for post:', err);
      }
    }

    return NextResponse.json({
      success: failedResults.length === 0,
      total: items.length,
      scheduledCount: successfulResults.length,
      newlyCreatedCount: newlyCreated.length,
      reusedCount: successfulResults.length - newlyCreated.length,
      failedCount: failedResults.length,
      failedItems: failedResults.map((r) => ({
        mediaAssetId: r.item.mediaAssetId,
        error: r.error,
      })),
      posts: successfulResults.map((r) => r.post?.id),
    });
  } catch (error: any) {
    console.error('[BULK_POSTS] CREATE_FAILED', error instanceof Error ? error.stack : error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bulk posts' },
      { status: 500 }
    );
  }
}

