import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = params.id;
    if (!postId) {
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 });
    }

    const post = await prisma.contentPost.findUnique({
      where: { id: postId },
      include: {
        platformPosts: true,
      },
    });

    if (!post || post.workspaceId !== session.workspaceId) {
      return NextResponse.json(
        { error: 'Post not found or access denied.' },
        { status: 404 }
      );
    }

    const now = new Date();

    // Find the manual platform posts
    const targetManualPosts = post.platformPosts.filter(
      (p) => p.platform === 'FACEBOOK_PROFILE'
    );

    if (targetManualPosts.length === 0) {
      return NextResponse.json(
        { error: 'No Facebook Personal Profile target found on this post.' },
        { status: 400 }
      );
    }

    // Update target manual platform posts to PUBLISHED
    for (const pPost of targetManualPosts) {
      await prisma.platformPost.update({
        where: { id: pPost.id },
        data: {
          status: 'PUBLISHED',
          errorMessage: 'Manually published on Facebook by user',
          updatedAt: now,
        },
      });
    }

    // Re-evaluate parent ContentPost status
    const allPlatformPosts = await prisma.platformPost.findMany({
      where: { contentPostId: post.id },
    });

    const allPublished = allPlatformPosts.every(
      (p) => p.status === 'PUBLISHED' || p.status === 'INBOX_DRAFT'
    );

    if (allPublished) {
      await prisma.contentPost.update({
        where: { id: post.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
          updatedAt: now,
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.userId,
        action: 'MANUAL_PUBLISH_CONFIRMED',
        details: `Confirmed manual publishing for Facebook Personal Profile on post "${post.title || post.masterCaption.slice(0, 40)}"`,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Marked as published successfully on Facebook Personal Profile.',
    });
  } catch (error: any) {
    console.error('[Confirm Manual Publish Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm manual publishing.' },
      { status: 500 }
    );
  }
}
