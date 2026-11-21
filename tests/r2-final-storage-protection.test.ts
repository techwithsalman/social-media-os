import assert from 'node:assert';
import {
  safeCleanupMediaAsset,
  canDeleteMediaAsset,
  processScheduledMediaCleanup,
  DEFAULT_FAILED_RETENTION_HOURS,
} from '../lib/storage/r2-cleanup';
import {
  getStorageMetrics,
  enforceStorageSafeguards,
  MAX_R2_STORAGE_BYTES,
  WARN_R2_STORAGE_BYTES,
  CRITICAL_R2_STORAGE_BYTES,
  formatBytes,
} from '../lib/storage/r2-storage-monitor';

console.log('========================================================================');
console.log(' POSTNEXA R2 STORAGE PROTECTION & 10 GB SAFEGUARDS TEST SUITE           ');
console.log('========================================================================\n');

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
  const prismaModule = await import('../lib/prisma');
  const prisma = prismaModule.default;

  const origMediaFindMany = prisma.mediaAsset.findMany;
  const origMediaFindUnique = prisma.mediaAsset.findUnique;
  const origMediaUpdateMany = prisma.mediaAsset.updateMany;
  const origMediaUpdate = prisma.mediaAsset.update;
  const origMediaCount = prisma.mediaAsset.count;
  const origMediaAggregate = prisma.mediaAsset.aggregate;
  const origActivityLog = prisma.activityLog.create;

  try {
    console.log('--- Group 1: Automatic Deletion & Platform Lifecycle ---');

    await testCase('Deletes R2 asset when post is PUBLISHED across platforms', async () => {
      const mockAsset = {
        id: 'asset_published_1',
        workspaceId: 'ws_test_1',
        url: 'workspaces/ws_test_1/videos/pub_video.mp4',
        createdAt: new Date(),
        posts: [
          {
            id: 'post_1',
            status: 'PUBLISHED',
            platformPosts: [
              { id: 'pp_yt', platform: 'YOUTUBE', status: 'PUBLISHED', publishingJobs: [] },
              { id: 'pp_fb', platform: 'FACEBOOK', status: 'PUBLISHED', publishingJobs: [] },
              { id: 'pp_ig', platform: 'INSTAGRAM', status: 'PUBLISHED', publishingJobs: [] },
            ],
          },
        ],
      };

      prisma.mediaAsset.findUnique = (async ({ where }: any) => {
        if (where.id === 'asset_published_1') return mockAsset;
        return null;
      }) as any;

      let claimed = false;
      prisma.mediaAsset.updateMany = (async () => {
        claimed = true;
        return { count: 1 };
      }) as any;

      let updatedUrl = '';
      prisma.mediaAsset.update = (async ({ data }: any) => {
        updatedUrl = data.url;
        return { ...mockAsset, url: data.url };
      }) as any;

      prisma.activityLog.create = (async () => ({})) as any;

      let r2DeleteCalledWith = '';
      const mockDeleteR2 = async (key: string, ws: string) => {
        r2DeleteCalledWith = key;
        return { success: true };
      };

      const result = await safeCleanupMediaAsset('asset_published_1', 'ws_test_1', {
        deleteR2Fn: mockDeleteR2,
      });

      assert.strictEqual(result.action, 'DELETED');
      assert.strictEqual(result.success, true);
      assert.strictEqual(r2DeleteCalledWith, 'workspaces/ws_test_1/videos/pub_video.mp4');
      assert.strictEqual(claimed, true);
      assert.strictEqual(updatedUrl, 'archived://workspaces/ws_test_1/videos/pub_video.mp4');
    });

    console.log('\n--- Group 2: Protection of Active, Scheduled & Failed Media ---');

    await testCase('Protects media belonging to SCHEDULED posts from deletion', async () => {
      const mockScheduledAsset = {
        id: 'asset_sched_1',
        workspaceId: 'ws_test_1',
        url: 'workspaces/ws_test_1/videos/sched_video.mp4',
        createdAt: new Date(),
        posts: [
          {
            id: 'post_sched',
            status: 'SCHEDULED',
            platformPosts: [
              { id: 'pp_sched', platform: 'TIKTOK', status: 'SCHEDULED', publishingJobs: [] },
            ],
          },
        ],
      };

      prisma.mediaAsset.findUnique = (async () => mockScheduledAsset) as any;

      const check = await canDeleteMediaAsset('asset_sched_1');
      assert.strictEqual(check.canDelete, false);
      assert.match(check.reason, /active ContentPost/i);

      let r2Called = false;
      const res = await safeCleanupMediaAsset('asset_sched_1', 'ws_test_1', {
        deleteR2Fn: async () => {
          r2Called = true;
          return { success: true };
        },
      });

      assert.strictEqual(res.action, 'SKIPPED');
      assert.strictEqual(r2Called, false);
    });

    await testCase('Protects media belonging to PROCESSING or UPLOADING jobs', async () => {
      const mockProcessingAsset = {
        id: 'asset_proc_1',
        workspaceId: 'ws_test_1',
        url: 'workspaces/ws_test_1/videos/proc_video.mp4',
        createdAt: new Date(),
        posts: [
          {
            id: 'post_proc',
            status: 'PROCESSING',
            platformPosts: [
              {
                id: 'pp_proc',
                platform: 'YOUTUBE',
                status: 'PROCESSING',
                publishingJobs: [{ id: 'job_1', status: 'UPLOADING' }],
              },
            ],
          },
        ],
      };

      prisma.mediaAsset.findUnique = (async () => mockProcessingAsset) as any;

      const check = await canDeleteMediaAsset('asset_proc_1');
      assert.strictEqual(check.canDelete, false);
      assert.match(check.reason, /active/i);
    });

    await testCase('Protects failed posts within 48h retention grace period for retries', async () => {
      const now = Date.now();
      const mockFailedAsset = {
        id: 'asset_fail_1',
        workspaceId: 'ws_test_1',
        url: 'workspaces/ws_test_1/videos/fail_video.mp4',
        createdAt: new Date(now - 2 * 3600 * 1000), // Failed 2h ago
        posts: [
          {
            id: 'post_fail',
            status: 'FAILED',
            updatedAt: new Date(now - 2 * 3600 * 1000),
            platformPosts: [
              {
                id: 'pp_fail',
                platform: 'LINKEDIN',
                status: 'FAILED',
                updatedAt: new Date(now - 2 * 3600 * 1000),
                publishingJobs: [],
              },
            ],
          },
        ],
      };

      prisma.mediaAsset.findUnique = (async () => mockFailedAsset) as any;

      const checkWithinGrace = await canDeleteMediaAsset('asset_fail_1');
      assert.strictEqual(checkWithinGrace.canDelete, false);
      assert.match(checkWithinGrace.reason, /remaining retry retention window/i);

      // Now simulate post that failed 50 hours ago (past 48h window)
      mockFailedAsset.posts[0].updatedAt = new Date(now - 50 * 3600 * 1000);
      mockFailedAsset.posts[0].platformPosts[0].updatedAt = new Date(now - 50 * 3600 * 1000);

      const checkPastGrace = await canDeleteMediaAsset('asset_fail_1');
      assert.strictEqual(checkPastGrace.canDelete, true);
    });

    console.log('\n--- Group 3: Shared Media Protection Across Multiple Posts ---');

    await testCase('Protects shared media if another post still needs it', async () => {
      const mockSharedAsset = {
        id: 'asset_shared_1',
        workspaceId: 'ws_test_1',
        url: 'workspaces/ws_test_1/videos/shared_video.mp4',
        createdAt: new Date(),
        posts: [
          {
            id: 'post_pub',
            status: 'PUBLISHED',
            platformPosts: [
              { id: 'pp_pub', platform: 'INSTAGRAM', status: 'PUBLISHED', publishingJobs: [] },
            ],
          },
          {
            id: 'post_still_scheduled',
            status: 'SCHEDULED',
            platformPosts: [
              { id: 'pp_sched', platform: 'TIKTOK', status: 'SCHEDULED', publishingJobs: [] },
            ],
          },
        ],
      };

      prisma.mediaAsset.findUnique = (async () => mockSharedAsset) as any;

      const check = await canDeleteMediaAsset('asset_shared_1');
      assert.strictEqual(check.canDelete, false);
      assert.match(check.reason, /active ContentPost post_still_scheduled/i);

      let r2Called = false;
      const res = await safeCleanupMediaAsset('asset_shared_1', 'ws_test_1', {
        deleteR2Fn: async () => {
          r2Called = true;
          return { success: true };
        },
      });

      assert.strictEqual(res.action, 'SKIPPED');
      assert.strictEqual(r2Called, false);
    });

    console.log('\n--- Group 4: R2 Deletion Retry Handling ---');

    await testCase('Sets archived_retry:// if Cloudflare R2 returns an error', async () => {
      const mockAsset = {
        id: 'asset_err_1',
        workspaceId: 'ws_test_1',
        url: 'workspaces/ws_test_1/videos/err_video.mp4',
        createdAt: new Date(),
        posts: [
          {
            id: 'post_err',
            status: 'PUBLISHED',
            platformPosts: [
              { id: 'pp_err', platform: 'YOUTUBE', status: 'PUBLISHED', publishingJobs: [] },
            ],
          },
        ],
      };

      prisma.mediaAsset.findUnique = (async () => mockAsset) as any;
      prisma.mediaAsset.updateMany = (async () => ({ count: 1 })) as any;

      let retryStateSaved = '';
      prisma.mediaAsset.update = (async ({ data }: any) => {
        retryStateSaved = data.url;
        return { ...mockAsset, url: data.url };
      }) as any;

      const res = await safeCleanupMediaAsset('asset_err_1', 'ws_test_1', {
        deleteR2Fn: async () => ({ success: false, error: 'R2 503 Service Unavailable' }),
      });

      assert.strictEqual(res.action, 'FAILED');
      assert.strictEqual(retryStateSaved, 'archived_retry://workspaces/ws_test_1/videos/err_video.mp4');
    });

    console.log('\n--- Group 5: 10 GB Storage Safeguards & Health Monitoring ---');

    await testCase('Accurately tracks active storage and flags 80% (WARNING) and 100% (EXCEEDED)', async () => {
      // 1. Test NORMAL/HEALTHY state (1 GB used out of 10 GB)
      prisma.mediaAsset.count = (async (args?: any) => {
        const startsWith = args?.where?.url?.startsWith;
        if (startsWith === 'archived://') return 50;
        if (startsWith === 'archived_retry://') return 1;
        if (startsWith === 'archived_pending://') return 0;
        return 75; // total
      }) as any;

      prisma.mediaAsset.findMany = (async () => [
        { id: 'm1', size: 500 * 1024 * 1024, mimeType: 'video/mp4', url: 'workspaces/ws/videos/1.mp4' },
        { id: 'm2', size: 500 * 1024 * 1024, mimeType: 'video/mp4', url: 'workspaces/ws/videos/2.mp4' },
      ]) as any; // 1 GB total

      prisma.mediaAsset.aggregate = (async () => ({
        _sum: { size: 5 * 1024 * 1024 * 1024 }, // 5 GB archived
      })) as any;

      const healthyMetrics = await getStorageMetrics();
      assert.strictEqual(healthyMetrics.activeStorageBytes, 1000 * 1024 * 1024);
      assert.strictEqual(healthyMetrics.warningLevel, 'HEALTHY');
      assert.strictEqual(healthyMetrics.videoCount, 2);
      assert.strictEqual(healthyMetrics.archivedAssetsCount, 50);

      // 2. Test WARNING state (8.5 GB used, >= 80%)
      prisma.mediaAsset.findMany = (async () => [
        { id: 'm_big', size: 8.5 * 1024 * 1024 * 1024, mimeType: 'video/mp4', url: 'workspaces/ws/videos/big.mp4' },
      ]) as any;

      const warnMetrics = await getStorageMetrics();
      assert.strictEqual(warnMetrics.warningLevel, 'WARNING');
      assert.match(warnMetrics.warningMessage || '', /crossed the 80% threshold/i);

      // 3. Test EXCEEDED state (10.5 GB used, > 10 GB)
      prisma.mediaAsset.findMany = (async () => [
        { id: 'm_huge', size: 10.5 * 1024 * 1024 * 1024, mimeType: 'video/mp4', url: 'workspaces/ws/videos/huge.mp4' },
      ]) as any;

      const exceededMetrics = await getStorageMetrics();
      assert.strictEqual(exceededMetrics.warningLevel, 'EXCEEDED');
      assert.match(exceededMetrics.warningMessage || '', /EXCEEDED the 10 GB limit/i);
    });

    await testCase('enforceStorageSafeguards proactively triggers maintenance cleanup when warning threshold reached', async () => {
      // Mock storage at 8.2 GB (triggers warning)
      prisma.mediaAsset.findMany = (async (args: any) => {
        // If query is from getStorageMetrics active assets
        if (args?.select?.size) {
          return [
            { id: 'm_heavy', size: 8.2 * 1024 * 1024 * 1024, mimeType: 'video/mp4', url: 'workspaces/ws/videos/heavy.mp4' },
          ];
        }
        // If query is from processScheduledMediaCleanup candidate scan
        return [];
      }) as any;

      prisma.mediaAsset.count = (async () => 1) as any;
      prisma.mediaAsset.aggregate = (async () => ({ _sum: { size: 0 } })) as any;

      const result = await enforceStorageSafeguards();
      assert.strictEqual(result.proactiveCleanupTriggered, true);
      assert.strictEqual(result.metrics.warningLevel, 'WARNING');
    });

  } finally {
    // Restore original prisma methods
    prisma.mediaAsset.findMany = origMediaFindMany;
    prisma.mediaAsset.findUnique = origMediaFindUnique;
    prisma.mediaAsset.updateMany = origMediaUpdateMany;
    prisma.mediaAsset.update = origMediaUpdate;
    prisma.mediaAsset.count = origMediaCount;
    prisma.mediaAsset.aggregate = origMediaAggregate;
    prisma.activityLog.create = origActivityLog;
  }

  console.log('\n========================================================================');
  console.log(` ALL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('========================================================================\n');
}

runSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
