import assert from 'node:assert';
import {
  APPROVED_YOUTUBE_CHANNELS,
  normalizeKey,
  matchProtectedYouTubeChannel,
  auditScheduledPosts,
  executeBulkCancelScheduledPosts,
} from '../lib/super-admin-scheduled-cancel';

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
  console.log(' SUPER ADMIN SCHEDULED POSTS BULK CANCEL & WHITELIST TEST SUITE        ');
  console.log('========================================================================\n');

  const prismaModule = await import('../lib/prisma');
  const prisma = prismaModule.default;

  const origContentPostFindMany = prisma.contentPost.findMany;
  const origContentPostUpdate = prisma.contentPost.update;
  const origPlatformPostUpdateMany = prisma.platformPost.updateMany;
  const origPublishingJobUpdateMany = prisma.publishingJob.updateMany;
  const origActivityLogCreate = prisma.activityLog.create;

  try {
    // -------------------------------------------------------------------------
    console.log('--- Group 1: Protected YouTube Whitelist Matching ---');
    // -------------------------------------------------------------------------

    await testCase('Correctly matches all 4 approved YouTube channels by handle or title', () => {
      // 1. Tech With Salman
      const res1 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        name: 'Tech With Salman',
        username: '@Tech With Salman',
      });
      assert.strictEqual(res1.isProtected, true);
      assert.strictEqual(res1.channel?.displayName, 'Tech With Salman');

      // 2. Beyond History
      const res2 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        name: 'Beyond History',
        username: '@BeyondHistory',
      });
      assert.strictEqual(res2.isProtected, true);
      assert.strictEqual(res2.channel?.displayName, 'Beyond History');

      // 3. Sheru Bhai Official
      const res3 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        name: 'Sheru Bhai Official',
        username: '@SheruBhaiOfficial',
      });
      assert.strictEqual(res3.isProtected, true);
      assert.strictEqual(res3.channel?.displayName, 'Sheru Bhai Official');

      // 4. VEXORA
      const res4 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        name: 'VEXORA',
        username: '@vexora',
      });
      assert.strictEqual(res4.isProtected, true);
      assert.strictEqual(res4.channel?.displayName, 'VEXORA');
    });

    await testCase('Rejects non-YouTube platforms even with identical channel name', () => {
      const fb = matchProtectedYouTubeChannel({
        platform: 'FACEBOOK',
        name: 'Tech With Salman',
        username: '@TechWithSalman',
      });
      assert.strictEqual(fb.isProtected, false);

      const ig = matchProtectedYouTubeChannel({
        platform: 'INSTAGRAM',
        name: 'Beyond History',
        username: '@beyondhistory',
      });
      assert.strictEqual(ig.isProtected, false);

      const tt = matchProtectedYouTubeChannel({
        platform: 'TIKTOK',
        name: 'VEXORA',
        username: '@vexora',
      });
      assert.strictEqual(tt.isProtected, false);
    });

    await testCase('Rejects other unapproved YouTube channels', () => {
      const otherYt = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        name: 'Some Random Vlogger',
        username: '@randomvlogger',
      });
      assert.strictEqual(otherYt.isProtected, false);

      const competitor = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        name: 'Tech Review Daily',
        username: '@techreview',
      });
      assert.strictEqual(competitor.isProtected, false);
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 2: Audit & Multi-Platform Post Classification ---');
    // -------------------------------------------------------------------------

    await testCase('auditScheduledPosts correctly classifies pure protected, partial, and candidate posts', async () => {
      prisma.contentPost.findMany = (async () => [
        // Post 1: Pure protected YouTube post (@Tech With Salman)
        {
          id: 'post_yt_only',
          workspaceId: 'ws_owner',
          title: 'YouTube Tech Tutorial',
          masterCaption: 'Learning Next.js 14',
          scheduledFor: new Date('2026-12-01T10:00:00Z'),
          status: 'SCHEDULED',
          mediaAsset: { id: 'media_1' },
          workspace: {
            id: 'ws_owner',
            name: "Salman's Studio",
            slug: 'salman-studio',
            members: [{ user: { email: 'salmandesigner24@gmail.com', firstName: 'Salman', lastName: 'Designer' } }],
          },
          platformPosts: [
            {
              id: 'pp_yt_1',
              platform: 'YOUTUBE',
              status: 'SCHEDULED',
              socialAccountId: 'sa_yt_1',
              socialAccount: {
                id: 'sa_yt_1',
                platform: 'YOUTUBE',
                name: 'Tech With Salman',
                username: '@Tech With Salman',
                platformAccountId: 'UC_tech_salman',
              },
            },
          ],
        },
        // Post 2: Multi-platform post (YouTube @Beyond History + Facebook + Instagram)
        {
          id: 'post_multi',
          workspaceId: 'ws_owner',
          title: 'Historical Documentary',
          masterCaption: 'Ancient civilization secrets',
          scheduledFor: new Date('2026-12-02T14:00:00Z'),
          status: 'SCHEDULED',
          mediaAsset: { id: 'media_2' },
          workspace: {
            id: 'ws_owner',
            name: "Salman's Studio",
            slug: 'salman-studio',
            members: [{ user: { email: 'salmandesigner24@gmail.com', firstName: 'Salman', lastName: 'Designer' } }],
          },
          platformPosts: [
            {
              id: 'pp_yt_beyond',
              platform: 'YOUTUBE',
              status: 'SCHEDULED',
              socialAccountId: 'sa_yt_beyond',
              socialAccount: {
                id: 'sa_yt_beyond',
                platform: 'YOUTUBE',
                name: 'Beyond History',
                username: '@Beyond History',
                platformAccountId: 'UC_beyond_history',
              },
            },
            {
              id: 'pp_fb_1',
              platform: 'FACEBOOK',
              status: 'SCHEDULED',
              socialAccountId: 'sa_fb_1',
              socialAccount: {
                id: 'sa_fb_1',
                platform: 'FACEBOOK',
                name: 'Salman FB Page',
                username: 'salmanpage',
                platformAccountId: 'FB_123',
              },
            },
            {
              id: 'pp_ig_1',
              platform: 'INSTAGRAM',
              status: 'SCHEDULED',
              socialAccountId: 'sa_ig_1',
              socialAccount: {
                id: 'sa_ig_1',
                platform: 'INSTAGRAM',
                name: 'Salman IG',
                username: 'salman_ig',
                platformAccountId: 'IG_123',
              },
            },
          ],
        },
        // Post 3: Non-whitelisted post (Other user, TikTok only)
        {
          id: 'post_tiktok_other',
          workspaceId: 'ws_tenant_2',
          title: 'Dancing Reel',
          masterCaption: 'Fun dance clip',
          scheduledFor: new Date('2026-12-03T18:00:00Z'),
          status: 'SCHEDULED',
          mediaAsset: { id: 'media_3' },
          workspace: {
            id: 'ws_tenant_2',
            name: 'Other Tenant',
            slug: 'other-tenant',
            members: [{ user: { email: 'other@example.com', firstName: 'Other', lastName: 'User' } }],
          },
          platformPosts: [
            {
              id: 'pp_tt_1',
              platform: 'TIKTOK',
              status: 'SCHEDULED',
              socialAccountId: 'sa_tt_1',
              socialAccount: {
                id: 'sa_tt_1',
                platform: 'TIKTOK',
                name: 'Other TikTok',
                username: 'other_tt',
                platformAccountId: 'TT_456',
              },
            },
          ],
        },
      ]) as any;

      const audit = await auditScheduledPosts();

      assert.strictEqual(audit.totalScheduledPosts, 3);
      assert.strictEqual(audit.totalPlatformTargets, 5); // 1 + 3 + 1
      assert.strictEqual(audit.counts.protectedExclusivePosts, 1);
      assert.strictEqual(audit.counts.protectedPartialPosts, 1);
      assert.strictEqual(audit.counts.cancelCandidatePosts, 1);
      assert.strictEqual(audit.counts.totalPreservedTargets, 2); // Tech With Salman + Beyond History
      assert.strictEqual(audit.counts.totalCancelledTargets, 3); // FB + IG + TikTok

      // Check classifications
      assert.strictEqual(audit.items[0].classification, 'PROTECTED_EXCLUSIVE');
      assert.strictEqual(audit.items[1].classification, 'PROTECTED_PARTIAL');
      assert.strictEqual(audit.items[2].classification, 'CANCEL_CANDIDATE');
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 3: Safe Bulk Cancellation Execution ---');
    // -------------------------------------------------------------------------

    await testCase('Cancellation requires confirmToken CONFIRM_CANCEL', async () => {
      await assert.rejects(
        async () => {
          await executeBulkCancelScheduledPosts({ confirmToken: 'WRONG_TOKEN' });
        },
        /Invalid confirmation token/
      );
    });

    await testCase('Executes partial multi-platform cancellation and keeps protected YouTube targets', async () => {
      const updatedPlatformPostIds: string[] = [];
      const updatedContentPostIds: string[] = [];

      prisma.platformPost.updateMany = (async ({ where }: any) => {
        if (where?.id?.in) {
          updatedPlatformPostIds.push(...where.id.in);
        }
        return { count: where?.id?.in?.length || 0 };
      }) as any;

      prisma.publishingJob.updateMany = (async () => ({ count: 0 })) as any;

      prisma.contentPost.update = (async ({ where }: any) => {
        updatedContentPostIds.push(where.id);
        return { id: where.id, status: 'CANCELLED' };
      }) as any;

      let loggedAction = '';
      prisma.activityLog.create = (async ({ data }: any) => {
        loggedAction = data.action;
        return { id: 'log_audit_1', createdAt: new Date() };
      }) as any;

      const result = await executeBulkCancelScheduledPosts({
        confirmToken: 'CONFIRM_CANCEL',
        actorUserId: 'owner_user_id',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.dryRun, false);

      // Total cancelled targets: 3 (FB + IG + TikTok)
      assert.strictEqual(result.cancelledTargetsCount, 3);
      // Cancelled posts: 1 (The pure TikTok post)
      assert.strictEqual(result.cancelledPostsCount, 1);
      // Preserved protected posts: 2
      assert.strictEqual(result.preservedProtectedPostsCount, 2);

      // Verify the IDs updated
      assert.strictEqual(updatedPlatformPostIds.includes('pp_fb_1'), true);
      assert.strictEqual(updatedPlatformPostIds.includes('pp_ig_1'), true);
      assert.strictEqual(updatedPlatformPostIds.includes('pp_tt_1'), true);

      // NEVER cancel the whitelisted YouTube targets!
      assert.strictEqual(updatedPlatformPostIds.includes('pp_yt_1'), false);
      assert.strictEqual(updatedPlatformPostIds.includes('pp_yt_beyond'), false);

      // NEVER cancel the multi-platform parent post because it still has Beyond History YouTube!
      assert.strictEqual(updatedContentPostIds.includes('post_multi'), false);
      assert.strictEqual(updatedContentPostIds.includes('post_yt_only'), false);

      // The pure TikTok post was cancelled:
      assert.strictEqual(updatedContentPostIds.includes('post_tiktok_other'), true);

      assert.strictEqual(loggedAction, 'SUPER_ADMIN_BULK_CANCEL_SCHEDULED');
      assert.strictEqual(result.recoveryLog.snapshot.length, 2);
    });

  } finally {
    // Restore mocks
    prisma.contentPost.findMany = origContentPostFindMany;
    prisma.contentPost.update = origContentPostUpdate;
    prisma.platformPost.updateMany = origPlatformPostUpdateMany;
    prisma.publishingJob.updateMany = origPublishingJobUpdateMany;
    prisma.activityLog.create = origActivityLogCreate;
  }

  console.log('\n========================================================================');
  console.log(` ALL BULK CANCEL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('========================================================================\n');
}

runSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
