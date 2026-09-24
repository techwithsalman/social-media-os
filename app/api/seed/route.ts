import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { encryptToken } from '@/lib/crypto';
import { WORKSPACE_TIMEZONE } from '@/lib/timezone';
import { bootstrapSaasDemoData } from '@/lib/saas-seed';
import {
  DEMO_SOCIAL_ACCOUNTS,
  isObsoleteDemoSocialAccount,
} from '@/lib/platforms';
import { isRealTikTokConfigured } from '@/lib/tiktok-oauth';

const DEMO_MEDIA_FILENAMES = ['product-launch-2026.jpg', 'demo-reel.mp4'];
const DEMO_POST_TITLES = [
  'Q3 Product Announcement & Roadmap',
  'Creator Workflow Deep Dive',
  'Official Social Media OS Launch Announcement',
];
const DEMO_NOTIFICATION_TITLES = [
  'Demo Accounts Seeded Successfully',
  'Demo Accounts Seeded Successfully 🎉',
  '5 Posts Scheduled for this week',
];

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = session.workspaceId;
    const userId = session.userId;

    const saasSeed = await bootstrapSaasDemoData({
      currentUserId: userId,
      currentWorkspaceId: workspaceId,
    });

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { timezone: WORKSPACE_TIMEZONE },
    });

    const existingMockAccounts = await prisma.socialAccount.findMany({
      where: {
        workspaceId,
        isMock: true,
      },
    });

    const obsoleteDemoAccountIds = existingMockAccounts
      .filter(isObsoleteDemoSocialAccount)
      .map((account) => account.id);

    if (obsoleteDemoAccountIds.length > 0) {
      await prisma.socialAccount.deleteMany({
        where: {
          workspaceId,
          id: { in: obsoleteDemoAccountIds },
        },
      });
    }

    await prisma.contentPost.deleteMany({
      where: {
        workspaceId,
        title: { in: DEMO_POST_TITLES },
      },
    });

    await prisma.mediaAsset.deleteMany({
      where: {
        workspaceId,
        filename: { in: DEMO_MEDIA_FILENAMES },
      },
    });

    await prisma.notification.deleteMany({
      where: {
        workspaceId,
        title: { in: DEMO_NOTIFICATION_TITLES },
      },
    });

    await prisma.activityLog.deleteMany({
      where: {
        workspaceId,
        OR: [
          { action: 'POST_PUBLISHED', details: { contains: 'Official Social Media OS Launch Announcement' } },
          { action: 'ACCOUNT_CONNECTED', details: { contains: 'Connected 8 demo accounts' } },
        ],
      },
    });

    const createdAccounts = [];
    for (const acc of DEMO_SOCIAL_ACCOUNTS) {
      if (acc.platform === 'TIKTOK' && isRealTikTokConfigured()) {
        continue;
      }
      const tokenData = {
        accessToken: encryptToken(`mock_${acc.platform.toLowerCase()}_token`),
        scope: acc.scope,
        expiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      };

      const account = await prisma.socialAccount.upsert({
        where: {
          workspaceId_platform_platformAccountId: {
            workspaceId,
            platform: acc.platform,
            platformAccountId: acc.platformAccountId,
          },
        },
        update: {
          name: acc.name,
          username: acc.username,
          profileImageUrl: acc.profileImageUrl,
          status: acc.status,
          isMock: true,
          token: {
            upsert: {
              create: tokenData,
              update: tokenData,
            },
          },
        },
        create: {
          workspaceId,
          platform: acc.platform,
          platformAccountId: acc.platformAccountId,
          name: acc.name,
          username: acc.username,
          profileImageUrl: acc.profileImageUrl,
          status: acc.status,
          isMock: true,
          token: {
            create: tokenData,
          },
        },
      });

      createdAccounts.push(account);
    }

    // 2. Seed Media Assets
    const demoMedia = await prisma.mediaAsset.create({
      data: {
        workspaceId,
        filename: 'product-launch-2026.jpg',
        originalName: 'product-launch-teaser.jpg',
        mimeType: 'image/jpeg',
        size: 1420500,
        url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&auto=format&fit=crop&q=80',
        thumbnailUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&auto=format&fit=crop&q=80',
      },
    });

    const demoVideo = await prisma.mediaAsset.create({
      data: {
        workspaceId,
        filename: 'demo-reel.mp4',
        originalName: 'saas-os-demo-reel.mp4',
        mimeType: 'video/mp4',
        size: 18450200,
        url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
      },
    });

    // 3. Seed Scheduled Posts
    const inTwoDays = new Date();
    inTwoDays.setDate(inTwoDays.getDate() + 2);
    inTwoDays.setHours(18, 0, 0, 0);

    const scheduledPost1 = await prisma.contentPost.create({
      data: {
        workspaceId,
        userId,
        title: 'Q3 Product Announcement & Roadmap',
        masterCaption: 'We are thrilled to unveil our next-generation Social Media OS architecture! 🚀 Manage every social channel effortlessly with intelligent sync.',
        status: 'SCHEDULED',
        scheduledFor: inTwoDays,
        timezone: WORKSPACE_TIMEZONE,
        mediaAssetId: demoMedia.id,
        platformPosts: {
          create: createdAccounts.slice(0, 4).map((acc) => ({
            socialAccountId: acc.id,
            platform: acc.platform,
            customCaption: `We are thrilled to unveil our next-generation Social Media OS architecture! 🚀 #socialmedia #productlaunch`,
            contentType: 'POST',
            status: 'SCHEDULED',
          })),
        },
      },
    });

    const inFourDays = new Date();
    inFourDays.setDate(inFourDays.getDate() + 4);
    inFourDays.setHours(14, 30, 0, 0);

    const scheduledPost2 = await prisma.contentPost.create({
      data: {
        workspaceId,
        userId,
        title: 'Creator Workflow Deep Dive',
        masterCaption: 'How top teams save 15+ hours every week scheduling across Instagram, TikTok, and YouTube simultaneously. 💡 Watch the full breakdown.',
        status: 'SCHEDULED',
        scheduledFor: inFourDays,
        timezone: WORKSPACE_TIMEZONE,
        mediaAssetId: demoVideo.id,
        platformPosts: {
          create: createdAccounts.map((acc) => ({
            socialAccountId: acc.id,
            platform: acc.platform,
            customCaption: 'How top teams save 15+ hours every week scheduling across social media. 💡',
            contentType: 'VIDEO',
            status: 'SCHEDULED',
          })),
        },
      },
    });

    // 4. Seed Published Posts
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const publishedPost = await prisma.contentPost.create({
      data: {
        workspaceId,
        userId,
        title: 'Official Social Media OS Launch Announcement',
        masterCaption: 'The future of social media management is here! Connect, sync, and publish from one unified command center. 🔥',
        status: 'PUBLISHED',
        publishedAt: yesterday,
        timezone: WORKSPACE_TIMEZONE,
        mediaAssetId: demoMedia.id,
        platformPosts: {
          create: createdAccounts.slice(0, 5).map((acc) => ({
            socialAccountId: acc.id,
            platform: acc.platform,
            customCaption: 'The future of social media management is here! 🔥',
            contentType: 'POST',
            status: 'PUBLISHED',
            externalPostId: `mock_pub_${acc.platform.toLowerCase()}`,
            externalPostUrl: `https://${acc.platform.toLowerCase()}.com/post/demo`,
          })),
        },
      },
    });

    // 5. Seed Activity Logs & Notifications
    await prisma.activityLog.createMany({
      data: [
        {
          workspaceId,
          userId,
          action: 'POST_PUBLISHED',
          details: 'Official Social Media OS Launch Announcement published across 5 accounts',
          createdAt: yesterday,
        },
        {
          workspaceId,
          userId,
          action: 'ACCOUNT_CONNECTED',
          details: 'Connected 8 demo accounts in Development Simulation Mode',
        },
      ],
    });

    await prisma.notification.createMany({
      data: [
        {
          workspaceId,
          userId,
          title: 'Demo Accounts Seeded Successfully 🎉',
          message: '8 platform accounts (Instagram, Facebook, TikTok, LinkedIn, YouTube, X, Pinterest, Snapchat) and scheduled posts have been loaded.',
          type: 'SUCCESS',
          link: '/dashboard',
        },
        {
          workspaceId,
          userId,
          title: '5 Posts Scheduled for this week',
          message: 'Your queued content is ready and will publish automatically according to your calendar.',
          type: 'INFO',
          link: '/calendar',
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message: '8 demo accounts, scheduled posts, and realistic sample data seeded successfully!',
      saasSeed,
    });
  } catch (error: any) {
    console.error('Seed API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to seed demo data' }, { status: 500 });
  }
}
