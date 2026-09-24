import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { PublishingEngine } from '@/lib/queue/publisher';
import { WORKSPACE_TIMEZONE, zonedDateTimeToUtcDate } from '@/lib/timezone';
import { EntitlementError, assertCanCreateBillablePost, recordPostUsage } from '@/lib/billing';
import { validateWorkspacePostTargets } from '@/lib/social-account-validation';
import { resolveMediaAccessUrl } from '@/lib/storage/r2';

function parseScheduleDate(body: any, timezone: string) {
  if (body.scheduledFor === null) return null;

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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const post = await prisma.contentPost.findUnique({
      where: { id: params.id, workspaceId: session.workspaceId },
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: true,
            publishingJobs: {
              include: {
                attemptsHistory: true,
              },
            },
          },
        },
      },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    if (post.mediaAsset && post.mediaAsset.url) {
      const resolvedUrl = await resolveMediaAccessUrl(post.mediaAsset.url, session.workspaceId);
      post.mediaAsset.url = resolvedUrl;
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error fetching post' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existingPost = await prisma.contentPost.findUnique({
      where: { id: params.id, workspaceId: session.workspaceId },
    });

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
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
      status,
      platformSettings = [],
    } = body;

    const uniquePlatformSettings = await validateWorkspacePostTargets(
      session.workspaceId,
      dedupePlatformSettingsByAccount(platformSettings || [])
    );

    if (!masterCaption && uniquePlatformSettings.length === 0) {
      return NextResponse.json({ error: 'Post caption or content is required.' }, { status: 400 });
    }

    if (uniquePlatformSettings.length === 0) {
      return NextResponse.json({ error: 'Please select at least one social account.' }, { status: 400 });
    }

    let scheduleDate: Date | null = null;
    try {
      scheduleDate = parseScheduleDate(
        { scheduledFor, scheduledDate, scheduledTime },
        timezone || WORKSPACE_TIMEZONE
      );
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (status === 'SCHEDULED' && !scheduleDate) {
      return NextResponse.json({ error: 'Scheduled date and time is required.' }, { status: 400 });
    }

    const nextStatus = publishNow
      ? 'PROCESSING'
      : status === 'SCHEDULED' || scheduleDate
      ? 'SCHEDULED'
      : 'DRAFT';

    const shouldCountSchedule = nextStatus === 'SCHEDULED' && existingPost.status !== 'SCHEDULED';
    const shouldCountPublish =
      publishNow && !['SCHEDULED', 'PUBLISHED', 'PARTIALLY_FAILED'].includes(existingPost.status);

    if (shouldCountSchedule) {
      await assertCanCreateBillablePost(session.workspaceId, 'schedule');
    }

    if (shouldCountPublish) {
      await assertCanCreateBillablePost(session.workspaceId, 'publish');
    }

    await prisma.contentPost.update({
      where: { id: params.id, workspaceId: session.workspaceId },
      data: {
        title: title || masterCaption.slice(0, 50),
        masterCaption,
        status: nextStatus,
        scheduledFor: nextStatus === 'SCHEDULED' ? scheduleDate : null,
        timezone: timezone || WORKSPACE_TIMEZONE,
        mediaAssetId: mediaAssetId || null,
      },
    });

    await prisma.platformPost.deleteMany({
      where: { contentPostId: params.id },
    });

    await prisma.platformPost.createMany({
      data: uniquePlatformSettings.map((p: any) => ({
        contentPostId: params.id,
        socialAccountId: p.socialAccountId,
        platform: p.platform,
        customCaption: p.customCaption || null,
        hashtags: p.hashtags || null,
        contentType: p.contentType || 'POST',
        visibility: p.visibility || 'PUBLIC',
        metadata: p.metadata ? JSON.stringify(p.metadata) : null,
        status: nextStatus === 'PROCESSING' ? 'QUEUED' : nextStatus,
      })),
    });

    const post = await prisma.contentPost.findUnique({
      where: { id: params.id, workspaceId: session.workspaceId },
      include: {
        mediaAsset: true,
        platformPosts: {
          include: {
            socialAccount: true,
          },
        },
      },
    });

    if (scheduleDate && nextStatus === 'SCHEDULED') {
      if (shouldCountSchedule) {
        await recordPostUsage(session.workspaceId, 'scheduled');
      }

      await prisma.activityLog.create({
        data: {
          workspaceId: session.workspaceId,
          userId: session.userId,
          action: 'POST_RESCHEDULED',
          details: `Scheduled post across ${uniquePlatformSettings.length} platforms for ${scheduleDate.toISOString()}`,
        },
      });
    }

    if (publishNow) {
      const publishResult = await PublishingEngine.publishContentPost(params.id);
      if (shouldCountPublish && publishResult.overallStatus !== 'FAILED') {
        await recordPostUsage(session.workspaceId, 'published');
      }
      return NextResponse.json({
        success: true,
        post,
        publishResult,
      });
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error: any) {
    console.error('Update post error:', error);
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Error updating post' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { status } = await req.json();
    if (status !== 'CANCELLED') {
      return NextResponse.json({ error: 'Unsupported post update.' }, { status: 400 });
    }

    const post = await prisma.contentPost.findUnique({
      where: { id: params.id, workspaceId: session.workspaceId },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const updatedPost = await prisma.contentPost.update({
      where: { id: params.id, workspaceId: session.workspaceId },
      data: { status: 'CANCELLED' },
    });

    await prisma.platformPost.updateMany({
      where: { contentPostId: params.id },
      data: { status: 'CANCELLED', errorMessage: null },
    });

    await prisma.activityLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.userId,
        action: 'POST_CANCELLED',
        details: `Cancelled scheduled post ${params.id}`,
      },
    });

    return NextResponse.json({
      success: true,
      post: updatedPost,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error updating post' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await prisma.contentPost.delete({
      where: { id: params.id, workspaceId: session.workspaceId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Error deleting post' }, { status: 500 });
  }
}
