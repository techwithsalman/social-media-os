import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { PublishingEngine } from '@/lib/queue/publisher';
import prisma from '@/lib/prisma';
import { EntitlementError, assertCanCreateBillablePost, assertWorkspaceActive, recordPostUsage } from '@/lib/billing';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const post = await prisma.contentPost.findUnique({
      where: { id: params.id, workspaceId: session.workspaceId },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const shouldCountPublish = !['SCHEDULED', 'PUBLISHED', 'PARTIALLY_FAILED'].includes(post.status);
    if (shouldCountPublish) {
      await assertCanCreateBillablePost(session.workspaceId, 'publish');
    } else {
      await assertWorkspaceActive(session.workspaceId);
    }

    const result = await PublishingEngine.publishContentPost(post.id);

    if (shouldCountPublish && result.overallStatus !== 'FAILED') {
      await recordPostUsage(session.workspaceId, 'published');
    }

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error('Publish post error:', error);
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Failed to publish post' }, { status: 500 });
  }
}
