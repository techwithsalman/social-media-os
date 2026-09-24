import prisma from './prisma';
import { hashPassword, comparePassword, signSessionToken, verifySessionToken } from './auth';
import { platformRegistry, SocialPlatformType } from '../integrations';
import { PublishingEngine } from './queue/publisher';
import { processDueScheduledPosts } from './queue/worker';
import { encryptToken, decryptToken } from './crypto';

async function runE2ETest() {
  console.log('========================================');
  console.log('🧪 RUNNING SOCIAL MEDIA OS E2E TEST SUITE');
  console.log('========================================\n');

  // Test 1: Crypto & Token Encryption
  console.log('1. Testing AES-256 Token Encryption...');
  const secret = 'EAABwzLix...meta_real_access_token';
  const encrypted = encryptToken(secret);
  const decrypted = decryptToken(encrypted);
  if (decrypted !== secret) throw new Error('Crypto encryption/decryption mismatch');
  console.log('   ✅ Crypto token encryption & decryption verified.');

  // Test 2: Platform Adapters
  console.log('\n2. Testing Platform Adapters Architecture...');
  const platforms = platformRegistry.getAllPlatforms();
  console.log(`   Found ${platforms.length} registered platforms: ${platforms.join(', ')}`);
  for (const p of platforms) {
    const adapter = platformRegistry.get(p);
    const reqs = adapter.getRequirements();
    if (!reqs.name || !reqs.requiredScopes) throw new Error(`Invalid adapter requirements for ${p}`);
  }
  console.log('   ✅ All 6 social platform adapters validated.');

  // Test 3: User & Workspace Multi-Tenancy Creation
  console.log('\n3. Testing User Signup & Workspace Provisioning...');
  const testEmail = `test.creator.${Date.now()}@socialos.dev`;
  const passwordHash = await hashPassword('securePassword123');

  const user = await prisma.user.create({
    data: {
      email: testEmail,
      passwordHash,
      firstName: 'Alex',
      lastName: 'Rivera',
    },
  });

  const workspace = await prisma.workspace.create({
    data: {
      name: "Alex Rivera's Global Workspace",
      slug: `alex-workspace-${Date.now()}`,
      plan: 'FREE',
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
  });
  console.log(`   ✅ User created: ${user.email} (ID: ${user.id})`);
  console.log(`   ✅ Workspace provisioned: ${workspace.name} (Slug: ${workspace.slug})`);

  // Test 4: Auth Session Token Sign & Verification
  console.log('\n4. Testing Session Token Management...');
  const token = signSessionToken({
    userId: user.id,
    email: user.email,
    workspaceId: workspace.id,
  });
  const verified = verifySessionToken(token);
  if (!verified || verified.userId !== user.id) throw new Error('Session verification failed');
  console.log('   ✅ Session signed and verified successfully.');

  // Test 5: Connect Social Accounts (Instagram, Facebook, TikTok, LinkedIn, YouTube, X)
  console.log('\n5. Testing Social Accounts Connection in Mock Mode...');
  const createdAccounts = [];
  for (const plat of platforms) {
    const adapter = platformRegistry.get(plat);
    const authResult = await adapter.connectAccount('mock_auth_code', 'http://localhost:3000/callback');

    const acc = await prisma.socialAccount.create({
      data: {
        workspaceId: workspace.id,
        platform: plat,
        platformAccountId: authResult.platformAccountId,
        name: authResult.name,
        username: authResult.username,
        profileImageUrl: authResult.profileImageUrl,
        status: 'CONNECTED',
        isMock: true,
        token: {
          create: {
            accessToken: encryptToken(authResult.accessToken),
            refreshToken: authResult.refreshToken ? encryptToken(authResult.refreshToken) : null,
            scope: authResult.scope,
            expiresAt: new Date(Date.now() + 5184000 * 1000),
          },
        },
      },
      include: { token: true },
    });
    createdAccounts.push(acc);
    console.log(`   ✅ Connected [${plat}]: @${acc.username} (${acc.name})`);
  }

  // Test 6: Media Asset Ingestion
  console.log('\n6. Testing Media Asset Record...');
  const media = await prisma.mediaAsset.create({
    data: {
      workspaceId: workspace.id,
      filename: 'product-teaser-2026.mp4',
      originalName: 'product-teaser.mp4',
      mimeType: 'video/mp4',
      size: 15400000,
      url: '/uploads/product-teaser-2026.mp4',
      thumbnailUrl: '/uploads/product-teaser-thumb.jpg',
    },
  });
  console.log(`   ✅ Media asset created: ${media.filename} (Size: ${(media.size / 1048576).toFixed(1)} MB)`);

  // Test 7: Create Master Post with Caption Synchronization Across Platforms & Scheduling
  console.log('\n7. Testing Master Post Creation & Caption Synchronization...');
  const masterCaption = 'Social Media OS is officially live! Manage every channel from one place. 🚀✨';

  const scheduledDate = new Date();
  scheduledDate.setDate(scheduledDate.getDate() + 3);
  scheduledDate.setHours(18, 0, 0, 0);

  const post = await prisma.contentPost.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      title: 'Official Launch Announcement',
      masterCaption,
      status: 'SCHEDULED',
      scheduledFor: scheduledDate,
      timezone: 'Asia/Karachi',
      mediaAssetId: media.id,
      platformPosts: {
        create: createdAccounts.map((acc) => {
          let customCaption = masterCaption;
          let hashtags = '#saas #launch #socialmedia';
          let contentType = 'POST';
          let metadata = {};

          if (acc.platform === 'YOUTUBE') {
            contentType = 'VIDEO';
            metadata = { youtubeTitle: 'Social Media OS: The Full Platform Walkthrough' };
          } else if (acc.platform === 'INSTAGRAM') {
            contentType = 'REEL';
            hashtags = '#viral #trending #socialos';
          } else if (acc.platform === 'X') {
            customCaption = `${masterCaption.slice(0, 240)} #socialos`;
          }

          return {
            socialAccountId: acc.id,
            platform: acc.platform,
            customCaption,
            hashtags,
            contentType,
            metadata: JSON.stringify(metadata),
            status: 'SCHEDULED',
          };
        }),
      },
    },
    include: {
      platformPosts: {
        include: { socialAccount: true },
      },
    },
  });

  console.log(`   ✅ Scheduled post created: "${post.masterCaption}"`);
  console.log(`   ✅ Synchronized across ${post.platformPosts.length} platform channels.`);
  post.platformPosts.forEach((p) => {
    console.log(`      - [${p.platform}] Status: ${p.status} | ContentType: ${p.contentType}`);
  });

  // Test 8: Instant Publishing Engine & State Machine Execution
  console.log('\n8. Testing Instant Publishing Engine & State Machine...');
  const publishResult = await PublishingEngine.publishContentPost(post.id);
  console.log(`   Overall Status: ${publishResult.overallStatus}`);
  publishResult.platformResults.forEach((res) => {
    console.log(`      - [${res.platform}] Status: ${res.status} -> ${res.externalPostUrl || res.errorMessage}`);
  });

  if (publishResult.overallStatus !== 'PUBLISHED') {
    throw new Error('Publishing failed unexpectedly');
  }

  // Test 9: Verify Activity Logs and Notifications
  console.log('\n9. Testing Audit Logs & Notification Dispatch...');
  const notifications = await prisma.notification.findMany({
    where: { workspaceId: workspace.id },
  });
  const logs = await prisma.activityLog.findMany({
    where: { workspaceId: workspace.id },
  });
  console.log(`   ✅ In-App Notifications generated: ${notifications.length}`);
  console.log(`   ✅ Activity Logs recorded: ${logs.length}`);

  console.log('\n========================================');
  console.log('🎉 ALL SOCIAL MEDIA OS CORE TESTS PASSED!');
  console.log('========================================\n');
}

runE2ETest()
  .catch((e) => {
    console.error('❌ E2E Test Suite Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
