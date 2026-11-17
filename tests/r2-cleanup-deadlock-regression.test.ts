import assert from 'node:assert';
import {
  processScheduledMediaCleanup,
  safeCleanupMediaAsset,
  canDeleteMediaAsset,
  DEFAULT_FAILED_RETENTION_HOURS,
  DEFAULT_ABANDONED_RETENTION_HOURS,
} from '../lib/storage/r2-cleanup';

console.log('========================================================================');
console.log(' POSTNEXA R2 CLEANUP DEADLOCK REGRESSION & FAIR SELECTION TEST SUITE   ');
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
  const originalFindMany = prismaModule.default.mediaAsset.findMany;
  const originalFindUnique = prismaModule.default.mediaAsset.findUnique;
  const originalUpdateMany = prismaModule.default.mediaAsset.updateMany;
  const originalUpdate = prismaModule.default.mediaAsset.update;
  const originalActivityLog = prismaModule.default.activityLog.create;

  console.log('--- Test Group 1: Exact Head-of-Line Starvation Reproduction & Resolution ---');

  await testCase('Worker bypasses 2 permanently blocked assets and deletes subsequent eligible assets', async () => {
    const now = Date.now();
    const oldDate = new Date(now - 48 * 3600 * 1000); // 48h ago

    // Mock dataset simulating production state:
    // Asset 1 & 2: blocked (posts have no platformPosts)
    // Asset 3: eligible unattached (>24h)
    // Asset 4: eligible completed post
    const mockDbAssets: any[] = [
      {
        id: 'asset_blocked_1',
        workspaceId: 'ws_prod',
        url: 'workspaces/ws_prod/videos/blocked_1.mp4',
        createdAt: new Date(oldDate.getTime() - 10000),
        posts: [{ id: 'post_1', status: 'PUBLISHED', platformPosts: [] }],
      },
      {
        id: 'asset_blocked_2',
        workspaceId: 'ws_prod',
        url: 'workspaces/ws_prod/videos/blocked_2.mp4',
        createdAt: new Date(oldDate.getTime() - 5000),
        posts: [{ id: 'post_2', status: 'PUBLISHED', platformPosts: [] }],
      },
      {
        id: 'asset_eligible_3',
        workspaceId: 'ws_prod',
        url: 'workspaces/ws_prod/videos/eligible_3.mp4',
        createdAt: oldDate,
        posts: [], // unattached
      },
      {
        id: 'asset_eligible_4',
        workspaceId: 'ws_prod',
        url: 'workspaces/ws_prod/videos/eligible_4.mp4',
        createdAt: new Date(oldDate.getTime() + 5000),
        posts: [
          {
            id: 'post_4',
            status: 'PUBLISHED',
            platformPosts: [{ id: 'pp_4', platform: 'INSTAGRAM', status: 'PUBLISHED', publishingJobs: [] }],
          },
        ],
      },
    ];

    const deletedR2Keys: string[] = [];
    const updatedUrls: Record<string, string> = {};

    try {
      (prismaModule.default.mediaAsset as any).findMany = async (args: any) => {
        // Evaluate candidate filter
        const candidates = mockDbAssets.filter((a) => {
          if (a.url.startsWith('archived://') || a.url.startsWith('archived_pending://')) return false;
          // Unattached check
          if (a.posts.length === 0) {
            const ageMs = now - new Date(a.createdAt).getTime();
            return ageMs >= DEFAULT_ABANDONED_RETENTION_HOURS * 3600 * 1000;
          }
          // Completed posts check
          return a.posts.every(
            (p: any) =>
              ['PUBLISHED', 'CANCELLED', 'INBOX_DRAFT'].includes(p.status) &&
              p.platformPosts &&
              p.platformPosts.length > 0 &&
              p.platformPosts.every((pp: any) => ['PUBLISHED', 'CANCELLED', 'INBOX_DRAFT'].includes(pp.status))
          );
        });
        return candidates.slice(0, args?.take || 15);
      };

      (prismaModule.default.mediaAsset as any).findUnique = async ({ where }: any) => {
        const found = mockDbAssets.find((a) => a.id === where.id);
        if (!found) return null;
        return {
          ...found,
          url: updatedUrls[found.id] || found.url,
        };
      };

      (prismaModule.default.mediaAsset as any).updateMany = async () => ({ count: 1 });
      (prismaModule.default.mediaAsset as any).update = async ({ where, data }: any) => {
        updatedUrls[where.id] = data.url;
        return {};
      };
      (prismaModule.default.activityLog as any).create = async () => ({});

      const summary = await processScheduledMediaCleanup({
        batchSize: 2,
        scanLimit: 10,
        deleteR2Fn: async (key) => {
          deletedR2Keys.push(key);
          return { success: true };
        },
      });

      // Starvation is broken: Asset 1 & 2 were filtered out, Asset 3 & 4 were processed and deleted!
      assert.strictEqual(summary.deletedCount, 2, 'Must delete 2 eligible assets');
      assert.strictEqual(summary.failedCount, 0, 'No failures');
      assert.strictEqual(deletedR2Keys.length, 2, 'Must issue 2 R2 deletions');
      assert.ok(deletedR2Keys.includes('workspaces/ws_prod/videos/eligible_3.mp4'), 'Eligible unattached asset was deleted');
      assert.ok(deletedR2Keys.includes('workspaces/ws_prod/videos/eligible_4.mp4'), 'Eligible completed asset was deleted');
      assert.strictEqual(
        updatedUrls['asset_eligible_3'],
        'archived://workspaces/ws_prod/videos/eligible_3.mp4',
        'Asset 3 URL transitioned to archived://'
      );
      assert.strictEqual(
        updatedUrls['asset_eligible_4'],
        'archived://workspaces/ws_prod/videos/eligible_4.mp4',
        'Asset 4 URL transitioned to archived://'
      );
    } finally {
      (prismaModule.default.mediaAsset as any).findMany = originalFindMany;
      (prismaModule.default.mediaAsset as any).findUnique = originalFindUnique;
      (prismaModule.default.mediaAsset as any).updateMany = originalUpdateMany;
      (prismaModule.default.mediaAsset as any).update = originalUpdate;
      (prismaModule.default.activityLog as any).create = originalActivityLog;
    }
  });

  console.log('\n--- Test Group 2: Mixed Batches with Blocked, Eligible, Archived & Missing Assets ---');

  await testCase('Mixed batch correctly isolates eligible assets and preserves protected assets', async () => {
    const now = Date.now();
    const oldDate = new Date(now - 50 * 3600 * 1000);
    const recentDate = new Date(now - 2 * 3600 * 1000); // 2h ago (< 24h)

    const mixedAssets: any[] = [
      {
        id: 'asset_active_sched',
        workspaceId: 'ws_mix',
        url: 'workspaces/ws_mix/videos/sched.mp4',
        createdAt: oldDate,
        posts: [
          {
            id: 'post_sched',
            status: 'SCHEDULED',
            platformPosts: [{ id: 'pp_s', platform: 'TIKTOK', status: 'SCHEDULED' }],
          },
        ],
      },
      {
        id: 'asset_active_proc',
        workspaceId: 'ws_mix',
        url: 'workspaces/ws_mix/videos/proc.mp4',
        createdAt: oldDate,
        posts: [
          {
            id: 'post_proc',
            status: 'PROCESSING',
            platformPosts: [{ id: 'pp_p', platform: 'INSTAGRAM', status: 'PROCESSING' }],
          },
        ],
      },
      {
        id: 'asset_retry_window',
        workspaceId: 'ws_mix',
        url: 'workspaces/ws_mix/videos/failed_recent.mp4',
        createdAt: oldDate,
        posts: [
          {
            id: 'post_fail',
            status: 'FAILED',
            updatedAt: recentDate,
            platformPosts: [{ id: 'pp_f', platform: 'FACEBOOK', status: 'FAILED' }],
          },
        ],
      },
      {
        id: 'asset_grace_period',
        workspaceId: 'ws_mix',
        url: 'workspaces/ws_mix/videos/fresh_upload.mp4',
        createdAt: recentDate, // < 24h old
        posts: [],
      },
      {
        id: 'asset_eligible_unattached',
        workspaceId: 'ws_mix',
        url: 'workspaces/ws_mix/videos/old_orphaned.mp4',
        createdAt: oldDate, // > 24h old
        posts: [],
      },
      {
        id: 'asset_eligible_completed',
        workspaceId: 'ws_mix',
        url: 'workspaces/ws_mix/videos/completed.mp4',
        createdAt: oldDate,
        posts: [
          {
            id: 'post_comp',
            status: 'PUBLISHED',
            platformPosts: [{ id: 'pp_c', platform: 'YOUTUBE', status: 'PUBLISHED' }],
          },
        ],
      },
    ];

    const deletedKeys: string[] = [];

    try {
      // Simulate scan limit with the smart candidate query
      (prismaModule.default.mediaAsset as any).findMany = async (args: any) => {
        return mixedAssets
          .filter((a) => {
            if (a.url.startsWith('archived://')) return false;
            if (a.posts.length === 0) {
              const age = now - new Date(a.createdAt).getTime();
              return age >= DEFAULT_ABANDONED_RETENTION_HOURS * 3600 * 1000;
            }
            return a.posts.every(
              (p: any) =>
                !['SCHEDULED', 'QUEUED', 'PROCESSING', 'UPLOADING', 'RETRYING', 'DRAFT'].includes(p.status) &&
                p.platformPosts &&
                p.platformPosts.length > 0 &&
                p.platformPosts.every((pp: any) => !['SCHEDULED', 'QUEUED', 'PROCESSING', 'UPLOADING', 'RETRYING', 'DRAFT'].includes(pp.status))
            );
          })
          .slice(0, args?.take || 10);
      };

      (prismaModule.default.mediaAsset as any).findUnique = async ({ where }: any) => {
        return mixedAssets.find((a) => a.id === where.id) || null;
      };

      (prismaModule.default.mediaAsset as any).updateMany = async () => ({ count: 1 });
      (prismaModule.default.mediaAsset as any).update = async () => ({});
      (prismaModule.default.activityLog as any).create = async () => ({});

      const summary = await processScheduledMediaCleanup({
        batchSize: 5,
        scanLimit: 10,
        deleteR2Fn: async (key) => {
          deletedKeys.push(key);
          return { success: true };
        },
      });

      // Active, processing, fresh uploads, and retry-window posts were shielded
      assert.strictEqual(summary.deletedCount, 2, 'Both eligible terminal/unattached assets are deleted');
      assert.ok(deletedKeys.includes('workspaces/ws_mix/videos/old_orphaned.mp4'), 'Old orphaned asset deleted');
      assert.ok(deletedKeys.includes('workspaces/ws_mix/videos/completed.mp4'), 'Completed post asset deleted');
      assert.ok(!deletedKeys.includes('workspaces/ws_mix/videos/sched.mp4'), 'SCHEDULED asset preserved');
      assert.ok(!deletedKeys.includes('workspaces/ws_mix/videos/proc.mp4'), 'PROCESSING asset preserved');
      assert.ok(!deletedKeys.includes('workspaces/ws_mix/videos/failed_recent.mp4'), 'Retry-window asset preserved');
      assert.ok(!deletedKeys.includes('workspaces/ws_mix/videos/fresh_upload.mp4'), 'Grace-period asset preserved');
    } finally {
      (prismaModule.default.mediaAsset as any).findMany = originalFindMany;
      (prismaModule.default.mediaAsset as any).findUnique = originalFindUnique;
      (prismaModule.default.mediaAsset as any).updateMany = originalUpdateMany;
      (prismaModule.default.mediaAsset as any).update = originalUpdate;
      (prismaModule.default.activityLog as any).create = originalActivityLog;
    }
  });

  console.log('\n--- Test Group 3: Shared Media Protection & Concurrent Cleanup Safety ---');

  await testCase('Shared media asset is protected while any referencing post is active', async () => {
    try {
      (prismaModule.default.mediaAsset as any).findUnique = async () => ({
        id: 'asset_shared_1',
        workspaceId: 'ws_shared',
        url: 'workspaces/ws_shared/videos/common_reel.mp4',
        posts: [
          {
            id: 'post_published',
            status: 'PUBLISHED',
            platformPosts: [{ id: 'pp_1', platform: 'INSTAGRAM', status: 'PUBLISHED' }],
          },
          {
            id: 'post_still_scheduled',
            status: 'SCHEDULED',
            platformPosts: [{ id: 'pp_2', platform: 'TIKTOK', status: 'SCHEDULED' }],
          },
        ],
      });

      const check = await canDeleteMediaAsset('asset_shared_1');
      assert.strictEqual(check.canDelete, false, 'Shared media must not be deleted while second post is SCHEDULED');
      assert.match(check.reason, /SCHEDULED/i);

      let r2Called = false;
      const cleanup = await safeCleanupMediaAsset('asset_shared_1', 'ws_shared', {
        deleteR2Fn: async () => {
          r2Called = true;
          return { success: true };
        },
      });

      assert.strictEqual(cleanup.action, 'SKIPPED');
      assert.strictEqual(r2Called, false, 'R2 delete must not be called for shared active media');
    } finally {
      (prismaModule.default.mediaAsset as any).findUnique = originalFindUnique;
    }
  });

  await testCase('Concurrent worker atomic claim prevents race conditions', async () => {
    try {
      (prismaModule.default.mediaAsset as any).findUnique = async () => ({
        id: 'asset_concurrent',
        workspaceId: 'ws_concur',
        url: 'workspaces/ws_concur/videos/shared.mp4',
        posts: [],
        createdAt: new Date(Date.now() - 48 * 3600 * 1000),
      });

      // Worker 2 simulates that Worker 1 already claimed the asset (updateMany matches 0)
      (prismaModule.default.mediaAsset as any).updateMany = async () => ({ count: 0 });

      let r2Called = false;
      const result = await safeCleanupMediaAsset('asset_concurrent', 'ws_concur', {
        deleteR2Fn: async () => {
          r2Called = true;
          return { success: true };
        },
      });

      assert.strictEqual(result.action, 'SKIPPED');
      assert.match(result.reason || '', /claimed|cleaned up/i);
      assert.strictEqual(r2Called, false, 'Concurrent worker must not perform duplicate R2 deletion');
    } finally {
      (prismaModule.default.mediaAsset as any).findUnique = originalFindUnique;
      (prismaModule.default.mediaAsset as any).updateMany = originalUpdateMany;
    }
  });

  console.log('\n--- Test Group 4: Idempotent Database Transitions & R2 Deletion Failure Handling ---');

  await testCase('R2 deletion failure marks archived_retry:// and suppresses false activity log', async () => {
    let recordedUrl: string | null = null;
    let activityLogCreated = false;

    try {
      (prismaModule.default.mediaAsset as any).findUnique = async () => ({
        id: 'asset_fail_retry',
        workspaceId: 'ws_fail',
        url: 'workspaces/ws_fail/videos/fail.mp4',
        posts: [],
        createdAt: new Date(Date.now() - 48 * 3600 * 1000),
      });

      (prismaModule.default.mediaAsset as any).updateMany = async () => ({ count: 1 });
      (prismaModule.default.mediaAsset as any).update = async ({ data }: any) => {
        recordedUrl = data.url;
        return {};
      };
      (prismaModule.default.activityLog as any).create = async () => {
        activityLogCreated = true;
        return {};
      };

      const result = await safeCleanupMediaAsset('asset_fail_retry', 'ws_fail', {
        deleteR2Fn: async () => ({ success: false, error: 'Cloudflare R2 503 Service Unavailable' }),
      });

      assert.strictEqual(result.action, 'FAILED');
      assert.strictEqual(result.success, false);
      assert.strictEqual(recordedUrl, 'archived_retry://workspaces/ws_fail/videos/fail.mp4');
      assert.strictEqual(activityLogCreated, false, 'Must not record false R2_MEDIA_AUTO_CLEANUP log on failure');
    } finally {
      (prismaModule.default.mediaAsset as any).findUnique = originalFindUnique;
      (prismaModule.default.mediaAsset as any).updateMany = originalUpdateMany;
      (prismaModule.default.mediaAsset as any).update = originalUpdate;
      (prismaModule.default.activityLog as any).create = originalActivityLog;
    }
  });

  await testCase('Already missing R2 object (S3 204) cleanly archives asset and records audit log', async () => {
    let recordedUrl: string | null = null;
    let loggedAction: string | null = null;

    try {
      (prismaModule.default.mediaAsset as any).findUnique = async () => ({
        id: 'asset_ghost_204',
        workspaceId: 'ws_ghost',
        url: 'workspaces/ws_ghost/videos/already_gone.mp4',
        posts: [],
        createdAt: new Date(Date.now() - 48 * 3600 * 1000),
      });

      (prismaModule.default.mediaAsset as any).updateMany = async () => ({ count: 1 });
      (prismaModule.default.mediaAsset as any).update = async ({ data }: any) => {
        recordedUrl = data.url;
        return {};
      };
      (prismaModule.default.activityLog as any).create = async ({ data }: any) => {
        loggedAction = data.action;
        return {};
      };

      // In S3 and Cloudflare R2, deleting a non-existent object returns success (HTTP 204)
      const result = await safeCleanupMediaAsset('asset_ghost_204', 'ws_ghost', {
        deleteR2Fn: async () => ({ success: true }),
      });

      assert.strictEqual(result.action, 'DELETED');
      assert.strictEqual(result.success, true);
      assert.strictEqual(recordedUrl, 'archived://workspaces/ws_ghost/videos/already_gone.mp4');
      assert.strictEqual(loggedAction, 'R2_MEDIA_AUTO_CLEANUP');
    } finally {
      (prismaModule.default.mediaAsset as any).findUnique = originalFindUnique;
      (prismaModule.default.mediaAsset as any).updateMany = originalUpdateMany;
      (prismaModule.default.mediaAsset as any).update = originalUpdate;
      (prismaModule.default.activityLog as any).create = originalActivityLog;
    }
  });

  console.log('\n========================================================================');
  console.log(` ALL ${totalTests} TESTS PASSED SUCCESSFULLY! (${passedTests}/${totalTests})`);
  console.log('========================================================================\n');
}

runSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
