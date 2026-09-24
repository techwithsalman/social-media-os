import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { WORKSPACE_TIMEZONE, zonedDateTimeToUtcDate } from '@/lib/timezone';
import { EntitlementError, assertCanCreateBillablePost, recordPostUsage } from '@/lib/billing';

function parseScheduleDate(body: any, timezone: string) {
  if (body.scheduledDate || body.scheduledTime) {
    if (!body.scheduledDate || !body.scheduledTime) {
      throw new Error('Publish Date and Publish Time are required.');
    }

    return zonedDateTimeToUtcDate(body.scheduledDate, body.scheduledTime, timezone);
  }

  if (!body.scheduledFor) {
    throw new Error('Scheduled date and time is required.');
  }

  const scheduleDate = new Date(body.scheduledFor);
  if (Number.isNaN(scheduleDate.getTime())) {
    throw new Error('Scheduled date and time is invalid.');
  }

  return scheduleDate;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { timezone = WORKSPACE_TIMEZONE } = body;

    let scheduleDate: Date;
    try {
      scheduleDate = parseScheduleDate(body, timezone || WORKSPACE_TIMEZONE);
    } catch (error: any) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const existingPost = await prisma.contentPost.findUnique({
      where: { id: params.id, workspaceId: session.workspaceId },
      select: { id: true, status: true },
    });

    if (!existingPost) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const shouldCountSchedule = existingPost.status !== 'SCHEDULED';
    if (shouldCountSchedule) {
      await assertCanCreateBillablePost(session.workspaceId, 'schedule');
    }

    const post = await prisma.contentPost.update({
      where: { id: params.id, workspaceId: session.workspaceId },
      data: {
        status: 'SCHEDULED',
        scheduledFor: scheduleDate,
        timezone: timezone || WORKSPACE_TIMEZONE,
      },
    });

    // Also update all platform posts status to SCHEDULED
    await prisma.platformPost.updateMany({
      where: { contentPostId: params.id },
      data: { status: 'SCHEDULED', errorMessage: null },
    });

    if (shouldCountSchedule) {
      await recordPostUsage(session.workspaceId, 'scheduled');
    }

    return NextResponse.json({
      success: true,
      post,
    });
  } catch (error: any) {
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Failed to reschedule post' }, { status: 500 });
  }
}
