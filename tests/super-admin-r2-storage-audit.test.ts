import assert from 'node:assert';
import {
  auditR2Storage,
  executeR2Cleanup,
  getR2CleanupHistory,
  ORPHAN_GRACE_PERIOD_MS,
} from '../lib/storage/r2-audit-service';

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

async function runStorageAuditSuite() {
  console.log('========================================================================');
  console.log(' CLOUDFLARE R2 STORAGE AUDIT & SAFE CLEANUP TEST SUITE                 ');
  console.log('========================================================================\n');

  const prismaModule = await import('../lib/prisma');
  const prisma = prismaModule.default;

  const origMediaAssetFindMany = prisma.mediaAsset.findMany;
  const origMediaAssetFindUnique = prisma.mediaAsset.findUnique;
  const origMediaAssetUpdate = prisma.mediaAsset.update;
  const origActivityLogCreate = prisma.activityLog.create;
  const origActivityLogFindMany = prisma.activityLog.findMany;

  try {
    // -------------------------------------------------------------------------
    console.log('--- Group 1: R2 Object Reconciliation & Classification Matrix ---');
    // -------------------------------------------------------------------------

    const now = Date.now();
    const oldDate = new Date(now - (ORPHAN_GRACE_PERIOD_MS + 3600 * 1000 * 48)); // 72 hours ago
    const recentDate = new Date(now - 3600 * 1000 * 2); // 2 hours ago

    const sampleDbMedia = [
      // 1. Published Post media (100 MB)
      {
        id: 'media_published',
        workspaceId: 'ws_tenant_1',
        filename: 'published_video.mp4',
        url: 'https://r2.cloudflarestorage.com/social-media-os-videos/workspaces/ws_tenant_1/videos/published_video.mp4',
        storageKey: 'workspaces/ws_tenant_1/videos/published_video.mp4',
        workspace: { id: 'ws_tenant_1', name: 'Tenant 1 Workspace', slug: 't1' },
        posts: [
          {
            id: 'post_pub_1',
            title: 'Published Campaign Video',
            status: 'PUBLISHED',
            platformPosts: [{ id: 'pp_1', platform: 'INSTAGRAM', status: 'PUBLISHED', socialAccount: null, publishingJobs: [] }],
          },
        ],
      },
      // 2. Protected YouTube Channel media: Tech With Salman (500 MB)
      {
        id: 'media_yt_tech_salman',
        workspaceId: 'ws_owner',
        filename: 'tech_tutorial.mp4',
        url: 'workspaces/ws_owner/videos/tech_tutorial.mp4',
        storageKey: 'workspaces/ws_owner/videos/tech_tutorial.mp4',
        workspace: { id: 'ws_owner', name: 'Owner Workspace', slug: 'owner' },
        posts: [
          {
            id: 'post_yt_1',
            title: 'Tech With Salman Official Tutorial',
            status: 'SCHEDULED',
            platformPosts: [
              {
                id: 'pp_yt_1',
                platform: 'YOUTUBE',
                status: 'SCHEDULED',
                socialAccount: {
                  id: 'sa_yt_1',
                  platform: 'YOUTUBE',
                  name: 'Tech With Salman',
                  username: '@Tech With Salman',
                  platformAccountId: 'UCBnZGCVHvAdpgxAmofMWMIA',
                },
                publishingJobs: [],
              },
            ],
          },
        ],
      },
      // 3. Protected YouTube Channel media: Beyond History (300 MB)
      {
        id: 'media_yt_beyond',
        workspaceId: 'ws_owner',
        filename: 'history_doc.mp4',
        url: 'workspaces/ws_owner/videos/history_doc.mp4',
        storageKey: 'workspaces/ws_owner/videos/history_doc.mp4',
        workspace: { id: 'ws_owner', name: 'Owner Workspace', slug: 'owner' },
        posts: [
          {
            id: 'post_yt_2',
            title: 'Ancient Egypt Mystery',
            status: 'SCHEDULED',
            platformPosts: [
              {
                id: 'pp_yt_2',
                platform: 'YOUTUBE',
                status: 'SCHEDULED',
                socialAccount: {
                  id: 'sa_yt_2',
                  platform: 'YOUTUBE',
                  name: 'Beyond History',
                  username: '@BeyondHistory',
                  platformAccountId: 'UCIfCPF9nczFDWt13KradQSw',
                },
                publishingJobs: [],
              },
            ],
          },
        ],
      },
      // 4. Protected YouTube Channel media: Sheru Bhai Official (200 MB)
      {
        id: 'media_yt_sheru',
        workspaceId: 'ws_owner',
        filename: 'sheru_vlog.mp4',
        url: 'workspaces/ws_owner/videos/sheru_vlog.mp4',
        storageKey: 'workspaces/ws_owner/videos/sheru_vlog.mp4',
        workspace: { id: 'ws_owner', name: 'Owner Workspace', slug: 'owner' },
        posts: [
          {
            id: 'post_yt_3',
            title: 'Sheru Bhai Live Vlog',
            status: 'SCHEDULED',
            platformPosts: [
              {
                id: 'pp_yt_3',
                platform: 'YOUTUBE',
                status: 'SCHEDULED',
                socialAccount: {
                  id: 'sa_yt_3',
                  platform: 'YOUTUBE',
                  name: 'Sheru Bhai Official',
                  username: '@SheruBhaiOfficial',
                  platformAccountId: 'UC0YEctuSxrrTusjvr6T0weQ',
                },
                publishingJobs: [],
              },
            ],
          },
        ],
      },
      // 5. Protected YouTube Channel media: VEXORA (400 MB)
      {
        id: 'media_yt_vexora',
        workspaceId: 'ws_owner',
        filename: 'vexora_tech.mp4',
        url: 'workspaces/ws_owner/videos/vexora_tech.mp4',
        storageKey: 'workspaces/ws_owner/videos/vexora_tech.mp4',
        workspace: { id: 'ws_owner', name: 'Owner Workspace', slug: 'owner' },
        posts: [
          {
            id: 'post_yt_4',
            title: 'VEXORA AI Innovations',
            status: 'SCHEDULED',
            platformPosts: [
              {
                id: 'pp_yt_4',
                platform: 'YOUTUBE',
                status: 'SCHEDULED',
                socialAccount: {
                  id: 'sa_yt_4',
                  platform: 'YOUTUBE',
                  name: 'VEXORA',
                  username: '@vexora',
                  platformAccountId: 'UCWYHIx472E94uiSgoMmpsUQ',
                },
                publishingJobs: [],
              },
            ],
          },
        ],
      },
      // 6. Active Scheduled media (Non-whitelisted, but actively scheduled - 50 MB)
      {
        id: 'media_scheduled_active',
        workspaceId: 'ws_tenant_2',
        filename: 'dance_clip.mp4',
        url: 'workspaces/ws_tenant_2/videos/dance_clip.mp4',
        storageKey: 'workspaces/ws_tenant_2/videos/dance_clip.mp4',
        workspace: { id: 'ws_tenant_2', name: 'Tenant 2 Workspace', slug: 't2' },
        posts: [
          {
            id: 'post_sched_1',
            title: 'Upcoming TikTok Dance',
            status: 'SCHEDULED',
            platformPosts: [{ id: 'pp_tt', platform: 'TIKTOK', status: 'SCHEDULED', socialAccount: null, publishingJobs: [] }],
          },
        ],
      },
      // 7. Saved Draft media (25 MB)
      {
        id: 'media_draft',
        workspaceId: 'ws_tenant_2',
        filename: 'draft_reel.mp4',
        url: 'workspaces/ws_tenant_2/videos/draft_reel.mp4',
        storageKey: 'workspaces/ws_tenant_2/videos/draft_reel.mp4',
        workspace: { id: 'ws_tenant_2', name: 'Tenant 2 Workspace', slug: 't2' },
        posts: [
          {
            id: 'post_draft_1',
            title: 'Unfinished Draft Reel',
            status: 'DRAFT',
            platformPosts: [],
          },
        ],
      },
      // 8. Shared media across multiple posts (150 MB)
      {
        id: 'media_shared',
        workspaceId: 'ws_tenant_1',
        filename: 'company_intro.mp4',
        url: 'workspaces/ws_tenant_1/videos/company_intro.mp4',
        storageKey: 'workspaces/ws_tenant_1/videos/company_intro.mp4',
        workspace: { id: 'ws_tenant_1', name: 'Tenant 1 Workspace', slug: 't1' },
        posts: [
          { id: 'post_cancelled_shared', title: 'Cancelled Post', status: 'CANCELLED', platformPosts: [] },
          { id: 'post_active_shared', title: 'Active Post', status: 'SCHEDULED', platformPosts: [] },
        ],
      },
      // 9. Cancelled Post Only Media (120 MB) -> ELIGIBLE
      {
        id: 'media_cancelled_exclusive',
        workspaceId: 'ws_tenant_3',
        filename: 'cancelled_promo.mp4',
        url: 'workspaces/ws_tenant_3/videos/cancelled_promo.mp4',
        storageKey: 'workspaces/ws_tenant_3/videos/cancelled_promo.mp4',
        workspace: { id: 'ws_tenant_3', name: 'Tenant 3 Workspace', slug: 't3' },
        posts: [
          {
            id: 'post_canc_exclusive',
            title: 'Cancelled Promo Clip',
            status: 'CANCELLED',
            platformPosts: [{ id: 'pp_canc', platform: 'INSTAGRAM', status: 'CANCELLED', socialAccount: null, publishingJobs: [] }],
          },
        ],
      },
    ];

    const mockR2BucketObjects = [
      { key: 'workspaces/ws_tenant_1/videos/published_video.mp4', size: 100 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_owner/videos/tech_tutorial.mp4', size: 500 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_owner/videos/history_doc.mp4', size: 300 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_owner/videos/sheru_vlog.mp4', size: 200 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_owner/videos/vexora_tech.mp4', size: 400 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_tenant_2/videos/dance_clip.mp4', size: 50 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_tenant_2/videos/draft_reel.mp4', size: 25 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_tenant_1/videos/company_intro.mp4', size: 150 * 1024 * 1024, lastModified: oldDate },
      { key: 'workspaces/ws_tenant_3/videos/cancelled_promo.mp4', size: 120 * 1024 * 1024, lastModified: oldDate }, // ELIGIBLE (Cancelled)
      { key: 'workspaces/ws_tenant_3/videos/abandoned_orphan.mp4', size: 80 * 1024 * 1024, lastModified: oldDate }, // ELIGIBLE (Orphan > 24h)
      { key: 'workspaces/ws_tenant_1/videos/recent_upload.mp4', size: 40 * 1024 * 1024, lastModified: recentDate }, // RETAINED (Grace < 24h)
      { key: 'random_folder/unknown_file.bin', size: 10 * 1024 * 1024, lastModified: oldDate }, // RETAINED (Unknown format)
    ];

    prisma.mediaAsset.findMany = (async () => sampleDbMedia) as any;

    await testCase('auditR2Storage correctly classifies all 12 test objects according to safety rules', async () => {
      const report = await auditR2Storage({ mockObjects: mockR2BucketObjects });

      assert.strictEqual(report.totalBucketObjects, 12);

      // Verify exact counts
      assert.strictEqual(report.categories.PUBLISHED.count, 1);
      assert.strictEqual(report.categories.PROTECTED_YOUTUBE.count, 4);
      assert.strictEqual(report.categories.SCHEDULED.count, 1);
      assert.strictEqual(report.categories.DRAFT.count, 1);
      assert.strictEqual(report.categories.SHARED.count, 1);
      assert.strictEqual(report.categories.CANCELLED_POST_ONLY.count, 1);
      assert.strictEqual(report.categories.CONFIRMED_ORPHAN.count, 1);
      assert.strictEqual(report.categories.UNATTACHED_GRACE.count, 1);
      assert.strictEqual(report.categories.UNVERIFIED_UNKNOWN.count, 1);

      // Verify eligible files: exactly 2 files (Cancelled promo + Abandoned orphan)
      assert.strictEqual(report.eligibleCount, 2);
      assert.strictEqual(report.retainedCount, 10);

      // Check eligible bytes: 120 MB + 80 MB = 200 MB
      const expectedEligibleBytes = 200 * 1024 * 1024;
      assert.strictEqual(report.eligibleBytes, expectedEligibleBytes);
      assert.strictEqual(report.eligibleMB, 200);

      const eligibleKeys = report.eligibleItems.map((i) => i.key);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_tenant_3/videos/cancelled_promo.mp4'), true);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_tenant_3/videos/abandoned_orphan.mp4'), true);

      // IMMUTABLE CHECKS: The 4 approved YouTube channels must NEVER be eligible
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_owner/videos/tech_tutorial.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_owner/videos/history_doc.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_owner/videos/sheru_vlog.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_owner/videos/vexora_tech.mp4'), false);

      // IMMUTABLE CHECKS: Published, draft, scheduled, shared, recent grace files must NEVER be eligible
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_tenant_1/videos/published_video.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_tenant_2/videos/dance_clip.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_tenant_2/videos/draft_reel.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_tenant_1/videos/company_intro.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('workspaces/ws_tenant_1/videos/recent_upload.mp4'), false);
      assert.strictEqual(eligibleKeys.includes('random_folder/unknown_file.bin'), false);
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 2: Protected YouTube Channel Immutability ---');
    // -------------------------------------------------------------------------

    await testCase('Protects all 4 YouTube channel IDs strictly regardless of post status', async () => {
      const report = await auditR2Storage({ mockObjects: mockR2BucketObjects });

      const techSalmanItem = report.retainedSample.find((i) => i.key === 'workspaces/ws_owner/videos/tech_tutorial.mp4');
      assert.strictEqual(techSalmanItem?.classification, 'PROTECTED_YOUTUBE');
      assert.strictEqual(techSalmanItem?.isEligibleForCleanup, false);
      assert.strictEqual(techSalmanItem?.protectedChannel, 'Tech With Salman');

      const beyondHistoryItem = report.retainedSample.find((i) => i.key === 'workspaces/ws_owner/videos/history_doc.mp4');
      assert.strictEqual(beyondHistoryItem?.classification, 'PROTECTED_YOUTUBE');
      assert.strictEqual(beyondHistoryItem?.isEligibleForCleanup, false);
      assert.strictEqual(beyondHistoryItem?.protectedChannel, 'Beyond History');

      const sheruBhaiItem = report.retainedSample.find((i) => i.key === 'workspaces/ws_owner/videos/sheru_vlog.mp4');
      assert.strictEqual(sheruBhaiItem?.classification, 'PROTECTED_YOUTUBE');
      assert.strictEqual(sheruBhaiItem?.isEligibleForCleanup, false);
      assert.strictEqual(sheruBhaiItem?.protectedChannel, 'Sheru Bhai Official');

      const vexoraItem = report.retainedSample.find((i) => i.key === 'workspaces/ws_owner/videos/vexora_tech.mp4');
      assert.strictEqual(vexoraItem?.classification, 'PROTECTED_YOUTUBE');
      assert.strictEqual(vexoraItem?.isEligibleForCleanup, false);
      assert.strictEqual(vexoraItem?.protectedChannel, 'VEXORA');
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 3: Cleanup Safety Gates & Execution ---');
    // -------------------------------------------------------------------------

    await testCase('Rejects execution without exact confirmToken CONFIRM_CLEANUP', async () => {
      await assert.rejects(
        async () => {
          await executeR2Cleanup({ confirmToken: 'WRONG' });
        },
        /Safety check failed/
      );
    });

    await testCase('Dry run mode simulates deletion without invoking S3 delete command', async () => {
      let s3DeleteCalled = false;
      const report = await auditR2Storage({ mockObjects: mockR2BucketObjects });

      const result = await executeR2Cleanup({
        confirmToken: 'CONFIRM_CLEANUP',
        dryRun: true,
        auditOverride: report,
        deleteR2Fn: async () => {
          s3DeleteCalled = true;
          return { success: true };
        },
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.dryRun, true);
      assert.strictEqual(result.deletedCount, 2);
      assert.strictEqual(result.freedMB, 200);
      assert.strictEqual(s3DeleteCalled, false, 'deleteR2Fn must NEVER be called in dry run mode');
    });

    await testCase('Live execution safely deletes only eligible objects, updates DB, and records ActivityLog', async () => {
      const report = await auditR2Storage({ mockObjects: mockR2BucketObjects });
      const deletedKeysList: string[] = [];
      const updatedMediaUrls: Record<string, string> = {};

      prisma.mediaAsset.findUnique = (async ({ where }: any) => {
        return sampleDbMedia.find((m) => m.id === where.id) as any;
      }) as any;

      prisma.mediaAsset.update = (async ({ where, data }: any) => {
        updatedMediaUrls[where.id] = data.url;
        return { id: where.id, url: data.url };
      }) as any;

      let loggedAction = '';
      let loggedDetails = '';
      prisma.activityLog.create = (async ({ data }: any) => {
        loggedAction = data.action;
        loggedDetails = data.details;
        return { id: 'log_r2_audit_1', createdAt: new Date() };
      }) as any;

      const result = await executeR2Cleanup({
        confirmToken: 'CONFIRM_CLEANUP',
        dryRun: false,
        auditOverride: report,
        deleteR2Fn: async (key: string) => {
          deletedKeysList.push(key);
          return { success: true };
        },
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.dryRun, false);
      assert.strictEqual(result.deletedCount, 2);
      assert.strictEqual(result.freedMB, 200);
      assert.strictEqual(deletedKeysList.length, 2);

      // Verify the deleted keys
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_tenant_3/videos/cancelled_promo.mp4'), true);
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_tenant_3/videos/abandoned_orphan.mp4'), true);

      // Verify the 4 protected YouTube channels were NEVER touched
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_owner/videos/tech_tutorial.mp4'), false);
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_owner/videos/history_doc.mp4'), false);
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_owner/videos/sheru_vlog.mp4'), false);
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_owner/videos/vexora_tech.mp4'), false);

      // Verify DB media asset was archived
      assert.strictEqual(
        updatedMediaUrls['media_cancelled_exclusive'],
        'archived://workspaces/ws_tenant_3/videos/cancelled_promo.mp4'
      );

      // Verify ActivityLog
      assert.strictEqual(loggedAction, 'SUPER_ADMIN_R2_STORAGE_CLEANUP');
      assert.ok(loggedDetails.includes('2 verified unnecessary R2 object(s)'));
      assert.strictEqual(result.auditLogId, 'log_r2_audit_1');
    });

    await testCase('Race-condition guard: aborts deletion if a file became attached to an active post', async () => {
      const report = await auditR2Storage({ mockObjects: mockR2BucketObjects });
      const deletedKeysList: string[] = [];

      // Simulate a concurrent user attaching the previously cancelled media to a brand new active post
      prisma.mediaAsset.findUnique = (async ({ where }: any) => {
        if (where.id === 'media_cancelled_exclusive') {
          return {
            id: 'media_cancelled_exclusive',
            posts: [{ id: 'post_new_scheduled', status: 'SCHEDULED' }],
          };
        }
        return null;
      }) as any;

      const result = await executeR2Cleanup({
        confirmToken: 'CONFIRM_CLEANUP',
        dryRun: false,
        auditOverride: report,
        deleteR2Fn: async (key: string) => {
          deletedKeysList.push(key);
          return { success: true };
        },
      });

      assert.strictEqual(result.success, true);
      // The race-conditioned file was SKIPPED by the safety guard!
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_tenant_3/videos/cancelled_promo.mp4'), false);
      // The true orphan was still deleted safely
      assert.strictEqual(deletedKeysList.includes('workspaces/ws_tenant_3/videos/abandoned_orphan.mp4'), true);
      assert.strictEqual(result.deletedCount, 1);
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 4: Cleanup Activity Log History ---');
    // -------------------------------------------------------------------------

    await testCase('getR2CleanupHistory returns sorted cleanup activity logs', async () => {
      prisma.activityLog.findMany = (async () => [
        {
          id: 'log_1',
          action: 'SUPER_ADMIN_R2_STORAGE_CLEANUP',
          actorUserId: 'owner_id',
          details: 'Deleted 2 verified unnecessary R2 object(s) (200.00 MB freed).',
          metadata: JSON.stringify({ freedBytes: 200 * 1024 * 1024 }),
          createdAt: new Date('2026-11-23T00:30:00Z'),
        },
      ]) as any;

      const history = await getR2CleanupHistory();
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].id, 'log_1');
      assert.strictEqual(history[0].action, 'SUPER_ADMIN_R2_STORAGE_CLEANUP');
      assert.strictEqual(history[0].metadata?.freedBytes, 200 * 1024 * 1024);
    });

  } finally {
    // Restore mocks
    prisma.mediaAsset.findMany = origMediaAssetFindMany;
    prisma.mediaAsset.findUnique = origMediaAssetFindUnique;
    prisma.mediaAsset.update = origMediaAssetUpdate;
    prisma.activityLog.create = origActivityLogCreate;
    prisma.activityLog.findMany = origActivityLogFindMany;
  }

  console.log('\n========================================================================');
  console.log(` ALL R2 STORAGE AUDIT & CLEANUP TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('========================================================================\n');
}

runStorageAuditSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
