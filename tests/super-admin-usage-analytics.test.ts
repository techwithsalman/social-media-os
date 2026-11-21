import assert from 'node:assert';
import {
  getSuperAdminUsageSummary,
  getSuperAdminUserUsageList,
  getSuperAdminUserUsageDetail,
  getSuperAdminGlobalStorageOverview,
  getDateRangeStart,
} from '../lib/usage-analytics';
import { OWNER_EMAIL } from '../lib/owner';

let totalTests = 0;
let passedTests = 0;

async function testCase(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    const res = fn();
    if (res instanceof Promise) await res;
    passedTests++;
    console.log(`✔ [PASS] Test ${totalTests}: ${name}`);
  } catch (err: any) {
    console.error(`✗ [FAIL] Test ${totalTests}: ${name}`);
    console.error(`   Error:`, err.message);
    throw err;
  }
}

async function runSuite() {
  console.log('========================================================================');
  console.log(' SUPER ADMIN USAGE & STORAGE ANALYTICS VERIFICATION TEST SUITE          ');
  console.log('========================================================================\n');

  const prismaModule = await import('../lib/prisma');
  const prisma = prismaModule.default;

  const origUserCount = prisma.user.count;
  const origUserFindMany = prisma.user.findMany;
  const origUserFindUnique = prisma.user.findUnique;
  const origPostCount = prisma.contentPost.count;
  const origPostFindMany = prisma.contentPost.findMany;
  const origMediaCount = prisma.mediaAsset.count;
  const origMediaFindMany = prisma.mediaAsset.findMany;
  const origMediaAggregate = prisma.mediaAsset.aggregate;
  const origSocialFindMany = prisma.socialAccount.findMany;
  const origPlatformPostFindMany = prisma.platformPost.findMany;
  const origWorkspaceFindMany = prisma.workspace.findMany;
  const origWorkspaceFindUnique = prisma.workspace.findUnique;
  const origPlanUpsert = prisma.plan.upsert;
  const origPlanFindFirst = prisma.plan.findFirst;
  const origPlanFindUnique = prisma.plan.findUnique;
  const origPlanOverrideFindFirst = prisma.planOverride.findFirst;
  const origSubscriptionFindMany = prisma.subscription.findMany;

  prisma.planOverride.findFirst = (async () => null) as any;
  prisma.subscription.findMany = (async () => []) as any;
  prisma.workspace.findUnique = (async ({ where }: any = {}) => ({
    id: where?.id || 'ws',
    name: 'Workspace',
    slug: 'workspace',
    plan: 'PRO',
    status: 'ACTIVE',
    members: [],
  })) as any;
  prisma.plan.findUnique = (async () => ({
    id: 'plan_pro',
    code: 'PRO',
    name: 'Pro',
    monthlyPostLimit: 100,
    maxSocialAccounts: 5,
    storageLimitMB: 5000,
    maxTeamMembers: 3,
    bulkUploadEnabled: true,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: true,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: true,
  })) as any;

  prisma.plan.upsert = (async ({ create, where }: any = {}) => ({
    id: `plan_${(where?.code || create?.code || 'plan').toLowerCase()}`,
    code: where?.code || create?.code || 'PRO',
    name: create?.name || 'Pro',
    monthlyPostLimit: 100,
    maxSocialAccounts: 5,
    storageLimitMB: 5000,
    maxTeamMembers: 3,
    bulkUploadEnabled: true,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: true,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: true,
  })) as any;

  prisma.plan.findFirst = (async () => ({
    id: 'plan_pro',
    code: 'PRO',
    name: 'Pro',
    monthlyPostLimit: 100,
    maxSocialAccounts: 5,
    storageLimitMB: 5000,
    maxTeamMembers: 3,
    bulkUploadEnabled: true,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: true,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: true,
  })) as any;

  try {
    // -------------------------------------------------------------------------
    console.log('--- Group 1: Date Range Filter Calculations ---');
    // -------------------------------------------------------------------------

    await testCase('Date filter returns accurate boundaries for each range', () => {
      const now = new Date();
      const allStart = getDateRangeStart('all');
      assert.strictEqual(allStart, null);

      const sevenDays = getDateRangeStart('7d');
      assert.notStrictEqual(sevenDays, null);
      const diff7 = Math.round((now.getTime() - sevenDays!.getTime()) / (24 * 60 * 60 * 1000));
      assert.strictEqual(diff7, 7);

      const thirtyDays = getDateRangeStart('30d');
      assert.notStrictEqual(thirtyDays, null);
      const diff30 = Math.round((now.getTime() - thirtyDays!.getTime()) / (24 * 60 * 60 * 1000));
      assert.strictEqual(diff30, 30);

      const today = getDateRangeStart('today');
      assert.notStrictEqual(today, null);
      assert.strictEqual(today!.getUTCHours(), 0);
      assert.strictEqual(today!.getUTCMinutes(), 0);

      const month = getDateRangeStart('month');
      assert.notStrictEqual(month, null);
      assert.strictEqual(month!.getUTCDate(), 1);
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 2: Usage Summary Cards Aggregation ---');
    // -------------------------------------------------------------------------

    await testCase('getSuperAdminUsageSummary correctly calculates counts and R2 storage', async () => {
      prisma.user.count = (async (args: any = {}) => {
        if (args?.where?.status === 'ACTIVE') return 8;
        return 10;
      }) as any;

      prisma.contentPost.count = (async (args: any = {}) => {
        if (args?.where?.status?.in?.includes('PUBLISHED')) return 45;
        if (args?.where?.status === 'SCHEDULED') return 12;
        if (args?.where?.status === 'FAILED') return 3;
        return 75; // Total
      }) as any;

      prisma.mediaAsset.count = (async (args: any = {}) => {
        if (args?.where?.mimeType?.startsWith === 'video/') return 18;
        if (args?.where?.url?.startsWith === 'archived://') return 5;
        if (args?.where?.url?.startsWith === 'archived_retry://') return 0;
        if (args?.where?.url?.startsWith === 'archived_pending://') return 0;
        return 30; // Total
      }) as any;

      prisma.mediaAsset.findMany = (async () => [
        { id: '1', size: 104857600, mimeType: 'video/mp4', url: 'https://pub.r2.dev/vid1.mp4' }, // 100 MB
        { id: '2', size: 52428800, mimeType: 'video/mp4', url: 'https://pub.r2.dev/vid2.mp4' },  // 50 MB
        { id: '3', size: 5242880, mimeType: 'image/jpeg', url: 'https://pub.r2.dev/img1.jpg' },  // 5 MB
      ]) as any;

      prisma.mediaAsset.aggregate = (async () => ({
        _sum: { size: 209715200 }, // 200 MB archived
      })) as any;

      const summary = await getSuperAdminUsageSummary();

      assert.strictEqual(summary.totalUsers, 10);
      assert.strictEqual(summary.activeUsers, 8);
      assert.strictEqual(summary.totalPosts, 75);
      assert.strictEqual(summary.totalPublishedPosts, 45);
      assert.strictEqual(summary.totalScheduledPosts, 12);
      assert.strictEqual(summary.totalFailedPosts, 3);
      assert.strictEqual(summary.totalVideosUploaded, 18);
      assert.strictEqual(summary.totalMediaFiles, 30);
      assert.strictEqual(summary.totalStorageBytes, 162529280); // 100 + 50 + 5 MB
      assert.strictEqual(summary.totalStorageMB, 155);
      assert.strictEqual(summary.storageWarningLevel, 'HEALTHY');
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 3: User Usage & Storage List (Sort & Separation) ---');
    // -------------------------------------------------------------------------

    await testCase('User usage list accurately separates content posts from platform posts and computes storage', async () => {
      prisma.user.findMany = (async () => [
        {
          id: 'user_1',
          email: 'user1@example.com',
          firstName: 'Alice',
          lastName: 'Smith',
          avatarUrl: null,
          status: 'ACTIVE',
          systemRole: 'USER',
          createdAt: new Date('2026-01-01'),
          lastActiveAt: new Date('2026-01-10'),
          workspaces: [
            {
              role: 'OWNER',
              workspace: {
                id: 'ws_1',
                name: "Alice's Studio",
                slug: 'alice-studio',
                status: 'ACTIVE',
                plan: 'PRO',
              },
            },
          ],
        },
        {
          id: 'user_2',
          email: 'user2@example.com',
          firstName: 'Bob',
          lastName: 'Jones',
          avatarUrl: null,
          status: 'ACTIVE',
          systemRole: 'USER',
          createdAt: new Date('2026-01-05'),
          lastActiveAt: new Date('2026-01-11'),
          workspaces: [
            {
              role: 'OWNER',
              workspace: {
                id: 'ws_2',
                name: "Bob's Media",
                slug: 'bob-media',
                status: 'ACTIVE',
                plan: 'STARTER',
              },
            },
          ],
        },
      ]) as any;

      prisma.contentPost.findMany = (async () => [
        // Alice has 2 content posts:
        // Post 1: Published to YouTube & Facebook (2 platform attempts, 1 unique post)
        {
          id: 'cp_1',
          workspaceId: 'ws_1',
          status: 'PUBLISHED',
          platformPosts: [
            { platform: 'YOUTUBE', status: 'PUBLISHED' },
            { platform: 'FACEBOOK', status: 'PUBLISHED' },
          ],
        },
        // Post 2: Scheduled for Instagram
        {
          id: 'cp_2',
          workspaceId: 'ws_1',
          status: 'SCHEDULED',
          platformPosts: [
            { platform: 'INSTAGRAM', status: 'SCHEDULED' },
          ],
        },
        // Bob has 1 content post: Failed to TikTok
        {
          id: 'cp_3',
          workspaceId: 'ws_2',
          status: 'FAILED',
          platformPosts: [
            { platform: 'TIKTOK', status: 'FAILED' },
          ],
        },
      ]) as any;

      prisma.mediaAsset.findMany = (async () => [
        // Alice has 1 active video of 200 MB and 1 archived video of 100 MB
        { id: 'm1', workspaceId: 'ws_1', mimeType: 'video/mp4', size: 209715200, url: 'https://pub.r2.dev/vid1.mp4' },
        { id: 'm2', workspaceId: 'ws_1', mimeType: 'video/mp4', size: 104857600, url: 'archived://cleaned/vid2.mp4' },
        // Bob has 1 active image of 5 MB
        { id: 'm3', workspaceId: 'ws_2', mimeType: 'image/jpeg', size: 5242880, url: 'https://pub.r2.dev/img1.jpg' },
      ]) as any;

      prisma.socialAccount.findMany = (async () => [
        { id: 'sa_1', workspaceId: 'ws_1', status: 'CONNECTED' },
        { id: 'sa_2', workspaceId: 'ws_1', status: 'CONNECTED' },
        { id: 'sa_3', workspaceId: 'ws_2', status: 'CONNECTED' },
      ]) as any;

      const listSortedByStorage = await getSuperAdminUserUsageList({ sortBy: 'storage', order: 'desc' });

      assert.strictEqual(listSortedByStorage.length, 2);

      // Alice should be first (200 MB > 5 MB)
      const alice = listSortedByStorage[0];
      assert.strictEqual(alice.email, 'user1@example.com');
      assert.strictEqual(alice.posts.total, 2); // 2 unique content posts
      assert.strictEqual(alice.posts.published, 1);
      assert.strictEqual(alice.posts.scheduled, 1);
      assert.strictEqual(alice.storage.activeMB, 200);
      assert.strictEqual(alice.storage.videoFiles, 1);
      assert.strictEqual(alice.storage.archivedFiles, 1);
      assert.strictEqual(alice.platforms['YOUTUBE'].published, 1);
      assert.strictEqual(alice.platforms['FACEBOOK'].published, 1);
      assert.strictEqual(alice.platforms['INSTAGRAM'].scheduled, 1);
      assert.strictEqual(alice.connectedAccountsCount, 2);

      // Bob should be second
      const bob = listSortedByStorage[1];
      assert.strictEqual(bob.email, 'user2@example.com');
      assert.strictEqual(bob.posts.total, 1);
      assert.strictEqual(bob.posts.failed, 1);
      assert.strictEqual(bob.storage.activeMB, 5);
      assert.strictEqual(bob.storage.imageFiles, 1);
      assert.strictEqual(bob.platforms['TIKTOK'].failed, 1);
      assert.strictEqual(bob.connectedAccountsCount, 1);
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 4: Detailed User Usage & Platform Analytics ---');
    // -------------------------------------------------------------------------

    await testCase('getSuperAdminUserUsageDetail provides complete platform and storage breakdown', async () => {
      prisma.user.findUnique = (async () => ({
        id: 'user_detail_1',
        email: 'creator@example.com',
        firstName: 'Farhan',
        lastName: 'Ali',
        avatarUrl: null,
        systemRole: 'USER',
        status: 'ACTIVE',
        createdAt: new Date('2026-02-01'),
        lastActiveAt: new Date('2026-02-15'),
        workspaces: [
          {
            role: 'OWNER',
            workspace: {
              id: 'ws_farhan',
              name: 'Farhan Digital',
              slug: 'farhan-digital',
              plan: 'PRO',
              status: 'ACTIVE',
              timezone: 'Asia/Karachi',
              createdAt: new Date('2026-02-01'),
            },
          },
        ],
      })) as any;

      prisma.contentPost.findMany = (async () => [
        {
          id: 'cp_10',
          title: 'Launch Video',
          masterCaption: 'Check out our new launch!',
          status: 'PUBLISHED',
          scheduledFor: null,
          publishedAt: new Date('2026-02-10'),
          createdAt: new Date('2026-02-10'),
          mediaAsset: {
            id: 'ma_vid',
            filename: 'launch.mp4',
            mimeType: 'video/mp4',
            size: 157286400, // 150 MB
            url: 'https://pub.r2.dev/launch.mp4',
          },
          platformPosts: [
            {
              id: 'pp_yt',
              platform: 'YOUTUBE',
              status: 'PUBLISHED',
              externalPostUrl: 'https://youtube.com/watch?v=123',
              errorMessage: null,
            },
            {
              id: 'pp_fb',
              platform: 'FACEBOOK',
              status: 'PUBLISHED',
              externalPostUrl: 'https://facebook.com/posts/456',
              errorMessage: null,
            },
          ],
        },
      ]) as any;

      prisma.mediaAsset.findMany = (async () => [
        {
          id: 'ma_vid',
          filename: 'launch.mp4',
          originalName: 'launch_final.mp4',
          mimeType: 'video/mp4',
          size: 157286400,
          url: 'https://pub.r2.dev/launch.mp4',
          createdAt: new Date('2026-02-10'),
        },
      ]) as any;

      prisma.socialAccount.findMany = (async () => [
        {
          id: 'acc_yt',
          platform: 'YOUTUBE',
          name: 'Farhan Tech Channel',
          username: 'farhantech',
          profileImageUrl: null,
          status: 'CONNECTED',
          isMock: false,
          createdAt: new Date('2026-02-01'),
        },
      ]) as any;

      prisma.platformPost.findMany = (async () => []) as any;

      const detail = await getSuperAdminUserUsageDetail('user_detail_1', 'all');

      assert.notStrictEqual(detail, null);
      assert.strictEqual(detail!.user.email, 'creator@example.com');
      assert.strictEqual(detail!.workspace?.name, 'Farhan Digital');
      assert.strictEqual(detail!.summary.postsCreated, 1);
      assert.strictEqual(detail!.summary.postsPublished, 1);
      assert.strictEqual(detail!.summary.videosUploaded, 1);
      assert.strictEqual(detail!.summary.activeStorageMB, 150);
      assert.strictEqual(detail!.platformBreakdown['YOUTUBE'].published, 1);
      assert.strictEqual(detail!.platformBreakdown['YOUTUBE'].successRate, 100);
      assert.strictEqual(detail!.platformBreakdown['FACEBOOK'].published, 1);
      assert.strictEqual(detail!.connectedAccounts.length, 1);
      assert.strictEqual(detail!.recentPosts.length, 1);
      assert.strictEqual(detail!.uploadHistory.length, 1);
      assert.strictEqual(detail!.uploadHistory[0].isArchived, false);
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 5: Global Storage Overview & Top Workspaces ---');
    // -------------------------------------------------------------------------

    await testCase('getSuperAdminGlobalStorageOverview ranks workspaces and formats uploads', async () => {
      prisma.workspace.findMany = (async () => [
        {
          id: 'ws_big',
          name: 'Big Studio',
          members: [{ user: { email: 'big@example.com', firstName: 'Big', lastName: 'Boss' } }],
          mediaAssets: [
            { id: '1', mimeType: 'video/mp4', size: 524288000, url: 'https://pub.r2.dev/v1.mp4' }, // 500 MB
            { id: '2', mimeType: 'video/mp4', size: 104857600, url: 'archived://v2.mp4' }, // Archived (not active)
          ],
        },
        {
          id: 'ws_small',
          name: 'Small Studio',
          members: [{ user: { email: 'small@example.com', firstName: 'Small', lastName: 'User' } }],
          mediaAssets: [
            { id: '3', mimeType: 'image/png', size: 10485760, url: 'https://pub.r2.dev/i1.png' }, // 10 MB
          ],
        },
      ]) as any;

      prisma.mediaAsset.findMany = (async () => [
        {
          id: 'm_recent_1',
          workspaceId: 'ws_big',
          workspace: { id: 'ws_big', name: 'Big Studio' },
          filename: 'video1.mp4',
          originalName: 'raw_video.mp4',
          mimeType: 'video/mp4',
          size: 524288000,
          url: 'https://pub.r2.dev/v1.mp4',
          createdAt: new Date(),
        },
      ]) as any;

      const globalOverview = await getSuperAdminGlobalStorageOverview();

      assert.strictEqual(globalOverview.topWorkspacesByStorage.length, 2);
      assert.strictEqual(globalOverview.topWorkspacesByStorage[0].workspaceName, 'Big Studio');
      assert.strictEqual(globalOverview.topWorkspacesByStorage[0].activeMB, 500);
      assert.strictEqual(globalOverview.topWorkspacesByStorage[0].videoCount, 1);
      assert.strictEqual(globalOverview.topWorkspacesByStorage[1].workspaceName, 'Small Studio');
      assert.strictEqual(globalOverview.topWorkspacesByStorage[1].activeMB, 10);
      assert.strictEqual(globalOverview.recentUploads.length, 1);
      assert.strictEqual(globalOverview.recentUploads[0].isArchived, false);
    });

  } finally {
    // Restore mocks
    prisma.user.count = origUserCount;
    prisma.user.findMany = origUserFindMany;
    prisma.user.findUnique = origUserFindUnique;
    prisma.contentPost.count = origPostCount;
    prisma.contentPost.findMany = origPostFindMany;
    prisma.mediaAsset.count = origMediaCount;
    prisma.mediaAsset.findMany = origMediaFindMany;
    prisma.mediaAsset.aggregate = origMediaAggregate;
    prisma.socialAccount.findMany = origSocialFindMany;
    prisma.platformPost.findMany = origPlatformPostFindMany;
    prisma.workspace.findMany = origWorkspaceFindMany;
    prisma.workspace.findUnique = origWorkspaceFindUnique;
    prisma.plan.upsert = origPlanUpsert;
    prisma.plan.findFirst = origPlanFindFirst;
    prisma.plan.findUnique = origPlanFindUnique;
    prisma.planOverride.findFirst = origPlanOverrideFindFirst;
    prisma.subscription.findMany = origSubscriptionFindMany;
  }

  console.log('\n========================================================================');
  console.log(` ALL USAGE & STORAGE ANALYTICS TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('========================================================================\n');
}

runSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
