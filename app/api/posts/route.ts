import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decryptToken } from '@/lib/crypto';
import { PublishingEngine } from '@/lib/queue/publisher';
import { WORKSPACE_TIMEZONE, zonedDateTimeToUtcDate } from '@/lib/timezone';
import { EntitlementError, assertCanCreateBillablePost, recordPostUsage, getWorkspaceUsage } from '@/lib/billing';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';
import { validateWorkspacePostTargets } from '@/lib/social-account-validation';
import { resolveMediaAccessUrl } from '@/lib/storage/r2';

function parseScheduleDate(body: any, timezone: string) {
  if (body.scheduledDate || body.scheduledTime) {
    if (!body.scheduledDate || !body.scheduledTime) {
      throw new Error('Publish Date and Publish Time are required.');
    }

    return zonedDateTimeToUtcDate(body.scheduledDate, body.scheduledTime, timezone);
  }

  if (!body.scheduledFor) return null;

  const scheduleDate = new Date(body.scheduledFor);
  if (Number.isNaN(scheduleDate.getTime())) {
    throw new Error('Scheduled date and time is invalid.');
  }

  return scheduleDate;
}

function dedupePlatformSettingsByAccount(platformSettings: any[]) {
  const uniqueSettings = new Map<string, any>();

  platformSettings.forEach((setting) => {
    if (setting?.socialAccountId && !uniqueSettings.has(setting.socialAccountId)) {
      uniqueSettings.set(setting.socialAccountId, setting);
    }
  });

  return Array.from(uniqueSettings.values());
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const whereClause: any = {
      workspaceId: session.workspaceId,
    };

    if (status) {
      if (status === 'SCHEDULED') {
        whereClause.status = 'SCHEDULED';
      } else if (status === 'PUBLISHED' || status === 'HISTORY') {
        whereClause.status = { in: ['PUBLISHED', 'INBOX_DRAFT', 'PROCESSING', 'PARTIALLY_FAILED', 'FAILED'] };
      } else if (status === 'DRAFT') {
        whereClause.status = 'DRAFT';
      } else if (status === 'FAILED') {
        whereClause.status = 'FAILED';
      }
    }

    const posts = await prisma.contentPost.findMany({
      where: whereClause,
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: {
              select: {
                id: true,
                platform: true,
                name: true,
                username: true,
                profileImageUrl: true,
                isMock: true,
                token: true,
              },
            },
          },
        },
      },
      orderBy: status === 'SCHEDULED' ? { scheduledFor: 'asc' } : { createdAt: 'desc' },
      take: limit,
    });

    const resolvedPosts = await Promise.all(
      posts.map(async (p) => {
        // Process media asset
        let resolvedMediaAsset = p.mediaAsset;
        if (p.mediaAsset) {
          let resolvedUrl = p.mediaAsset.url;
          if (resolvedUrl) {
            resolvedUrl = await resolveMediaAccessUrl(resolvedUrl, session.workspaceId);
          }
          let resolvedThumbnailUrl = p.mediaAsset.thumbnailUrl;
          if (resolvedThumbnailUrl) {
            resolvedThumbnailUrl = await resolveMediaAccessUrl(resolvedThumbnailUrl, session.workspaceId);
          }
          resolvedMediaAsset = {
            ...p.mediaAsset,
            url: resolvedUrl || '',
            thumbnailUrl: resolvedThumbnailUrl || null,
          };
        }

        // Process platform posts for Instagram permalinks
        const resolvedPlatformPosts = await Promise.all(
          p.platformPosts.map(async (pp) => {
            let updatedPp = { ...pp };
            
            // If it's a published Instagram post with a numeric fallback URL
            if (
              pp.platform === 'INSTAGRAM' &&
              pp.status === 'PUBLISHED' &&
              pp.externalPostUrl &&
              pp.externalPostUrl.includes('instagram.com/p/') &&
              pp.externalPostId
            ) {
              const isNumericP = /\/p\/\d+$/.test(pp.externalPostUrl);
              
              if (isNumericP && (pp.socialAccount as any)?.token) {
                try {
                  const tokenData = typeof (pp.socialAccount as any).token === 'string' ? JSON.parse((pp.socialAccount as any).token) : (pp.socialAccount as any).token;
                  if (tokenData && tokenData.accessToken) {
                    const decryptedToken = decryptToken(tokenData.accessToken);
                    const metaRes = await fetch(`https://graph.instagram.com/v21.0/${pp.externalPostId}?fields=permalink&access_token=${decryptedToken}`);
                    const metaData = await metaRes.json();
                    if (metaData && metaData.permalink) {
                      updatedPp.externalPostUrl = metaData.permalink;
                    }
                  }
                } catch (err) {
                  console.error('[PUBLISHED_VIEW] Failed to resolve permalink dynamically:', err);
                }
              }
            }

            // Remove sensitive token
            if (updatedPp.socialAccount && (updatedPp.socialAccount as any).token) {
              delete (updatedPp.socialAccount as any).token;
            }

            return updatedPp;
          })
        );

        return {
          ...p,
          mediaAsset: resolvedMediaAsset,
          platformPosts: resolvedPlatformPosts,
        };
      })
    );

    return NextResponse.json({ posts: resolvedPosts });
  } catch (error: any) {
    console.error('Fetch posts error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch posts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      title,
      masterCaption,
      mediaAssetId,
      scheduledFor,
      scheduledDate,
      scheduledTime,
      timezone = WORKSPACE_TIMEZONE,
      publishNow = false,
      platformSettings = [], // Array<{ socialAccountId: string, platform: string, customCaption?: string, hashtags?: string, contentType?: string, visibility?: string, metadata?: any }>
    } = body;

    const uniquePlatformSettings = await validateWorkspacePostTargets(
      session.workspaceId,
      dedupePlatformSettingsByAccount(platformSettings || [])
    );

    const hasYouTube = uniquePlatformSettings.some((p: any) => p.platform === 'YOUTUBE');
    if (hasYouTube) {
      if (!mediaAssetId) {
        return NextResponse.json({ error: 'Please upload a video before publishing to YouTube.' }, { status: 400 });
      }
      // We could also check the mimeType here by querying Prisma if we want to be thorough, but client side usually checks this.
    }

    if (!masterCaption && uniquePlatformSettings.length === 0) {
      return NextResponse.json({ error: 'Post caption or content is required.' }, { status: 400 });
    }

    if (uniquePlatformSettings.length === 0) {
      return NextResponse.json({ error: 'Please select at least one social account.' }, { status: 400 });
    }

    // Determine initial status
    let initialStatus = 'DRAFT';
    let scheduleDate: Date | null = null;

    try {
      scheduleDate = parseScheduleDate(
        { scheduledFor, scheduledDate, scheduledTime },
        timezone || WORKSPACE_TIMEZONE
      );
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (publishNow) {
      initialStatus = 'PROCESSING';
    } else if (scheduleDate) {
      initialStatus = 'SCHEDULED';
    }

    if (initialStatus === 'SCHEDULED' || publishNow) {
      const { postsThisMonth } = await getWorkspaceUsage(session.workspaceId);
      try {
        await checkPlanLimit(session.workspaceId, 'postsPerMonth', postsThisMonth);
      } catch (error: any) {
        if (error instanceof PlanLimitError) return createPlanLimitResponse(error);
      }
    }
    if (initialStatus === 'SCHEDULED') {
      await assertCanCreateBillablePost(session.workspaceId, 'schedule');
    }

    if (publishNow) {
      await assertCanCreateBillablePost(session.workspaceId, 'publish');
    }

    // Create ContentPost and nested PlatformPost records
    const post = await prisma.contentPost.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.userId,
        title: title || masterCaption.slice(0, 50),
        masterCaption,
        status: initialStatus,
        scheduledFor: scheduleDate,
        timezone: timezone || WORKSPACE_TIMEZONE,
        mediaAssetId: mediaAssetId || null,
        platformPosts: {
          create: uniquePlatformSettings.map((p: any) => ({
            socialAccountId: p.socialAccountId,
            platform: p.platform,
            customCaption: p.customCaption || null,
            hashtags: p.hashtags || null,
            contentType: p.contentType || 'POST',
            visibility: p.visibility || 'PUBLIC',
            metadata: p.metadata ? JSON.stringify(p.metadata) : null,
            status: initialStatus === 'PROCESSING' ? 'QUEUED' : initialStatus,
          })),
        },
      },
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: true,
          },
        },
      },
    });

    // If publishNow was requested, trigger PublishingEngine
    if (publishNow) {
      const publishResult = await PublishingEngine.publishContentPost(post.id);
      if (publishResult.overallStatus !== 'FAILED') {
        await recordPostUsage(session.workspaceId, 'published');
      }
      return NextResponse.json({
        success: true,
        post,
        publishResult,
      });
    }

    // If scheduled, log activity
    if (scheduleDate) {
      await recordPostUsage(session.workspaceId, 'scheduled');

      await prisma.activityLog.create({
        data: {
          workspaceId: session.workspaceId,
          userId: session.userId,
          action: 'POST_SCHEDULED',
          details: `Scheduled post across ${uniquePlatformSettings.length} platforms for ${scheduleDate.toISOString()}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error: any) {
    console.error('Create post error:', error);
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Failed to create post' }, { status: 500 });
  }
}


