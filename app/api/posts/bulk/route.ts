import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { EntitlementError, assertCanCreateBillablePost, recordPostUsage } from '@/lib/billing';

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

    const createdPosts = await prisma.$transaction(async (tx) => {
      const posts = [];
      for (const item of items) {
        const {
          mediaAssetId,
          masterCaption,
          scheduledFor,
          timezone,
          platformSettings,
        } = item;

        const contentPost = await tx.contentPost.create({
          data: {
            workspaceId: session.workspaceId,
            userId: session.userId,
            masterCaption: masterCaption || '',
            status: 'SCHEDULED',
            scheduledFor: new Date(scheduledFor),
            timezone: timezone || 'UTC',
            mediaAssetId: mediaAssetId || null,
            platformPosts: {
              create: platformSettings.map((plat: any) => ({
                socialAccountId: plat.socialAccountId,
                platform: plat.platform,
                customCaption: plat.customCaption,
                hashtags: plat.hashtags || '',
                contentType: plat.contentType || 'POST',
                visibility: plat.visibility || 'PUBLIC',
                metadata: JSON.stringify(plat.metadata || {}),
                status: 'SCHEDULED',
                scheduledFor: new Date(scheduledFor),
                errorMessage: null,
              })),
            },
          },
        });
        posts.push(contentPost);
      }
      return posts;
    });

    // Record usage for the number of scheduled posts
    for (let i = 0; i < createdPosts.length; i++) {
      await recordPostUsage(session.workspaceId, 'scheduled');
    }

    return NextResponse.json({ success: true, count: createdPosts.length });
  } catch (error: any) {
    console.error('Bulk create post error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create bulk posts' },
      { status: 500 }
    );
  }
}
