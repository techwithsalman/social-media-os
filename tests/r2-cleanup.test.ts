import prisma from '../src/lib/prisma';
import { canDeleteMediaAsset, safeCleanupMediaAsset } from '../src/lib/storage/r2-cleanup';

async function runCleanupTests() {
  console.log('=== RUNNING R2 AUTOMATIC VIDEO CLEANUP TESTS ===\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, desc: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] Test ${total}: ${desc}`);
    } else {
      console.error(`❌ [FAIL] Test ${total}: ${desc}`);
      throw new Error(`Test failed: ${desc}`);
    }
  }

  // Setup test environment
  let workspace = await prisma.workspace.findFirst();
  let user = await prisma.user.findFirst();

  if (!workspace || !user) {
    user = await prisma.user.create({
      data: {
        email: `cleanup_user_${Date.now()}@example.com`,
        passwordHash: 'hash',
        firstName: 'Cleanup',
        lastName: 'Tester',
      },
    });
    workspace = await prisma.workspace.create({
      data: {
        name: 'Cleanup Test Workspace',
        slug: `cleanup-ws-${Date.now()}`,
      },
    });
  }

  // Create test social account for foreign key integrity
  const testAccount = await prisma.socialAccount.create({
    data: {
      workspaceId: workspace.id,
      platform: 'TIKTOK',
      platformAccountId: `tt_clean_${Date.now()}`,
      name: 'Cleanup Test Account',
      username: 'cleanup_test',
      status: 'CONNECTED',
      isMock: true,
    },
  });

  // -------------------------------------------------------------
  // TEST 1: Scheduled Post Guard (Blocks Deletion)
  // -------------------------------------------------------------
  const mediaAsset1 = await prisma.mediaAsset.create({
    data: {
      workspaceId: workspace.id,
      filename: 'scheduled_video.mp4',
      originalName: 'scheduled_video.mp4',
      mimeType: 'video/mp4',
      size: 1024,
      url: `workspaces/${workspace.id}/videos/scheduled_video.mp4`,
    },
  });

  const post1 = await prisma.contentPost.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      masterCaption: 'Scheduled Post Video Guard Test',
      status: 'SCHEDULED',
      mediaAssetId: mediaAsset1.id,
      scheduledFor: new Date(Date.now() + 3600000),
      platformPosts: {
        create: {
          socialAccountId: testAccount.id,
          platform: 'TIKTOK',
          status: 'SCHEDULED',
        },
      },
    },
  });

  const check1 = await canDeleteMediaAsset(mediaAsset1.id);
  assert(check1.canDelete === false, 'Scheduled post correctly BLOCKS deletion of video file');
  assert(check1.reason.includes('SCHEDULED'), 'Reason explicitly identifies SCHEDULED active state');

  // -------------------------------------------------------------
  // TEST 2: Multi-Platform Post Guard (1 Published, 1 Processing)
  // -------------------------------------------------------------
  const mediaAsset2 = await prisma.mediaAsset.create({
    data: {
      workspaceId: workspace.id,
      filename: 'multi_platform.mp4',
      originalName: 'multi_platform.mp4',
      mimeType: 'video/mp4',
      size: 2048,
      url: `workspaces/${workspace.id}/videos/multi_platform.mp4`,
    },
  });

  const post2 = await prisma.contentPost.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      masterCaption: 'Multi Platform Guard Test',
      status: 'PROCESSING',
      mediaAssetId: mediaAsset2.id,
      platformPosts: {
        create: [
          {
            socialAccountId: testAccount.id,
            platform: 'TIKTOK',
            status: 'PUBLISHED',
          },
          {
            socialAccountId: testAccount.id,
            platform: 'FACEBOOK',
            status: 'PROCESSING', // Still processing!
          },
        ],
      },
    },
  });

  const check2 = await canDeleteMediaAsset(mediaAsset2.id);
  assert(check2.canDelete === false, 'Multi-platform post BLOCKS deletion while Facebook is still PROCESSING');

  // Update Facebook platform post to PUBLISHED
  const fbPlatformPost = await prisma.platformPost.findFirst({
    where: { contentPostId: post2.id, platform: 'FACEBOOK' },
  });
  await prisma.platformPost.update({
    where: { id: fbPlatformPost!.id },
    data: { status: 'PUBLISHED' },
  });
  await prisma.contentPost.update({
    where: { id: post2.id },
    data: { status: 'PUBLISHED' },
  });

  const check2After = await canDeleteMediaAsset(mediaAsset2.id);
  assert(check2After.canDelete === true, 'Multi-platform post ALLOWS deletion once ALL platforms confirm PUBLISHED');

  // -------------------------------------------------------------
  // TEST 3: Failed Post Retry Window Guard
  // -------------------------------------------------------------
  const mediaAsset3 = await prisma.mediaAsset.create({
    data: {
      workspaceId: workspace.id,
      filename: 'failed_post.mp4',
      originalName: 'failed_post.mp4',
      mimeType: 'video/mp4',
      size: 3072,
      url: `workspaces/${workspace.id}/videos/failed_post.mp4`,
    },
  });

  const post3 = await prisma.contentPost.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      masterCaption: 'Failed Post Retention Test',
      status: 'FAILED',
      mediaAssetId: mediaAsset3.id,
      platformPosts: {
        create: {
          socialAccountId: testAccount.id,
          platform: 'INSTAGRAM',
          status: 'FAILED',
          errorMessage: 'Temporary network failure',
        },
      },
    },
  });

  // Check with 48h retention window
  const check3Recent = await canDeleteMediaAsset(mediaAsset3.id, { failedRetentionHours: 48 });
  assert(check3Recent.canDelete === false, 'Recently failed post BLOCKS deletion within 48h retry retention window');

  // Check with 0h retention window (expired retention)
  const check3Expired = await canDeleteMediaAsset(mediaAsset3.id, { failedRetentionHours: 0 });
  assert(check3Expired.canDelete === true, 'Failed post ALLOWS deletion after retention window expires');

  // -------------------------------------------------------------
  // TEST 4: Cross-Tenant Isolation Security Guard
  // -------------------------------------------------------------
  const cleanupCrossWorkspace = await safeCleanupMediaAsset(mediaAsset1.id, 'unauthorized_workspace_999');
  assert(cleanupCrossWorkspace.action === 'SKIPPED', 'Cross-workspace cleanup attempt correctly SKIPPED');
  assert(cleanupCrossWorkspace.reason?.includes('Security Error'), 'Cross-workspace rejection reason includes Security Error');

  // -------------------------------------------------------------
  // Cleanup Test Records
  // -------------------------------------------------------------
  await prisma.contentPost.deleteMany({
    where: { id: { in: [post1.id, post2.id, post3.id] } },
  });
  await prisma.mediaAsset.deleteMany({
    where: { id: { in: [mediaAsset1.id, mediaAsset2.id, mediaAsset3.id] } },
  });
  await prisma.socialAccount.delete({
    where: { id: testAccount.id },
  });

  console.log(`\n=== AUTOMATIC R2 CLEANUP TESTS: ${passed}/${total} PASSED ===`);
}

runCleanupTests().catch((err) => {
  console.error('R2 Cleanup Test Error:', err);
  process.exit(1);
});
