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
  const origMediaAssetFindUnique = prisma.mediaAsset.findUnique;
  const origMediaAssetUpdate = prisma.mediaAsset.update;
  const origMediaAssetUpdateMany = prisma.mediaAsset.updateMany;

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
                platformAccountId: 'UCBnZGCVHvAdpgxAmofMWMIA',
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
                platformAccountId: 'UCIfCPF9nczFDWt13KradQSw',
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

    // -------------------------------------------------------------------------
    console.log('\n--- Group 4: Automatic Cloudflare R2 Media Cleanup ---');
    // -------------------------------------------------------------------------

    const sampleMediaPosts = [
      // Post A: Whitelisted YouTube channel (@Sheru Bhai Official) with 10MB media
      {
        id: 'post_media_yt',
        workspaceId: 'ws_owner',
        title: 'Sheru Bhai Special',
        masterCaption: 'Exclusive video on Sheru Bhai Official',
        scheduledFor: new Date('2026-12-10T10:00:00Z'),
        status: 'SCHEDULED',
        workspace: {
          id: 'ws_owner',
          name: "Salman's Studio",
          slug: 'salman-studio',
          members: [{ user: { email: 'salmandesigner24@gmail.com', firstName: 'Salman', lastName: 'Designer' } }],
        },
        platformPosts: [
          {
            id: 'pp_yt_sheru',
            platform: 'YOUTUBE',
            status: 'SCHEDULED',
            socialAccountId: 'sa_yt_sheru',
            socialAccount: {
              id: 'sa_yt_sheru',
              platform: 'YOUTUBE',
              name: 'Sheru Bhai Official',
              username: '@SheruBhaiOfficial',
              platformAccountId: 'UC0YEctuSxrrTusjvr6T0weQ',
            },
          },
        ],
        mediaAsset: {
          id: 'media_yt_sheru',
          originalName: 'sheru_clip.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 10 * 1024 * 1024, // 10 MB
          storageKey: 'workspaces/ws_owner/sheru_clip.mp4',
          posts: [
            {
              id: 'post_media_yt',
              status: 'SCHEDULED',
              platformPosts: [
                {
                  platform: 'YOUTUBE',
                  status: 'SCHEDULED',
                  socialAccount: {
                    platform: 'YOUTUBE',
                    name: 'Sheru Bhai Official',
                    username: '@SheruBhaiOfficial',
                    platformAccountId: 'UC0YEctuSxrrTusjvr6T0weQ',
                  },
                },
              ],
            },
          ],
        },
      },
      // Post B: Pure TikTok post with exclusive 25MB media (Eligible for R2 delete)
      {
        id: 'post_cancel_exclusive',
        workspaceId: 'ws_tenant',
        title: 'Exclusive TikTok Clip',
        masterCaption: 'Dance clip to be cancelled',
        scheduledFor: new Date('2026-12-11T12:00:00Z'),
        status: 'SCHEDULED',
        workspace: {
          id: 'ws_tenant',
          name: 'Tenant Workspace',
          slug: 'tenant-ws',
          members: [{ user: { email: 'tenant@example.com', firstName: 'Tenant', lastName: 'User' } }],
        },
        platformPosts: [
          {
            id: 'pp_tt_exclusive',
            platform: 'TIKTOK',
            status: 'SCHEDULED',
            socialAccountId: 'sa_tt_exclusive',
            socialAccount: {
              id: 'sa_tt_exclusive',
              platform: 'TIKTOK',
              name: 'Random TikToker',
              username: 'random_tt',
              platformAccountId: 'TT_999',
            },
          },
        ],
        mediaAsset: {
          id: 'media_cancel_exclusive',
          originalName: 'dance.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 25 * 1024 * 1024, // 25 MB
          storageKey: 'workspaces/ws_tenant/dance.mp4',
          posts: [
            {
              id: 'post_cancel_exclusive',
              status: 'SCHEDULED',
              platformPosts: [
                {
                  platform: 'TIKTOK',
                  status: 'SCHEDULED',
                  socialAccount: {
                    platform: 'TIKTOK',
                    name: 'Random TikToker',
                    username: 'random_tt',
                    platformAccountId: 'TT_999',
                  },
                },
              ],
            },
          ],
        },
      },
      // Post C: Cancelled schedule whose media is shared with a PUBLISHED post (Must NOT delete)
      {
        id: 'post_cancel_shared_pub',
        workspaceId: 'ws_tenant',
        title: 'Shared with Published Post',
        masterCaption: 'Will be cancelled but media is published elsewhere',
        scheduledFor: new Date('2026-12-12T14:00:00Z'),
        status: 'SCHEDULED',
        workspace: {
          id: 'ws_tenant',
          name: 'Tenant Workspace',
          slug: 'tenant-ws',
          members: [{ user: { email: 'tenant@example.com', firstName: 'Tenant', lastName: 'User' } }],
        },
        platformPosts: [
          {
            id: 'pp_ig_shared',
            platform: 'INSTAGRAM',
            status: 'SCHEDULED',
            socialAccountId: 'sa_ig_shared',
            socialAccount: {
              id: 'sa_ig_shared',
              platform: 'INSTAGRAM',
              name: 'IG Account',
              username: 'ig_acc',
              platformAccountId: 'IG_999',
            },
          },
        ],
        mediaAsset: {
          id: 'media_shared_pub',
          originalName: 'shared_video.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 15 * 1024 * 1024, // 15 MB
          storageKey: 'workspaces/ws_tenant/shared_video.mp4',
          posts: [
            {
              id: 'post_cancel_shared_pub',
              status: 'SCHEDULED',
              platformPosts: [],
            },
            {
              id: 'post_already_published',
              status: 'PUBLISHED',
              platformPosts: [],
            },
          ],
        },
      },
      // Post D: Cancelled schedule whose media is shared with a DRAFT post (Must NOT delete)
      {
        id: 'post_cancel_shared_draft',
        workspaceId: 'ws_tenant',
        title: 'Shared with Draft Post',
        masterCaption: 'Will be cancelled but media is in a draft',
        scheduledFor: new Date('2026-12-13T16:00:00Z'),
        status: 'SCHEDULED',
        workspace: {
          id: 'ws_tenant',
          name: 'Tenant Workspace',
          slug: 'tenant-ws',
          members: [{ user: { email: 'tenant@example.com', firstName: 'Tenant', lastName: 'User' } }],
        },
        platformPosts: [
          {
            id: 'pp_fb_draft',
            platform: 'FACEBOOK',
            status: 'SCHEDULED',
            socialAccountId: 'sa_fb_draft',
            socialAccount: {
              id: 'sa_fb_draft',
              platform: 'FACEBOOK',
              name: 'FB Page',
              username: 'fb_page',
              platformAccountId: 'FB_999',
            },
          },
        ],
        mediaAsset: {
          id: 'media_shared_draft',
          originalName: 'draft_video.mp4',
          mimeType: 'video/mp4',
          sizeBytes: 5 * 1024 * 1024, // 5 MB
          storageKey: 'workspaces/ws_tenant/draft_video.mp4',
          posts: [
            {
              id: 'post_cancel_shared_draft',
              status: 'SCHEDULED',
              platformPosts: [],
            },
            {
              id: 'post_in_draft_state',
              status: 'DRAFT',
              platformPosts: [],
            },
          ],
        },
      },
    ];

    await testCase('Audit accurately classifies media for R2 cleanup and calculates storage', async () => {
      prisma.contentPost.findMany = (async () => sampleMediaPosts) as any;

      const audit = await auditScheduledPosts();

      assert.strictEqual(audit.totalScheduledPosts, 4);
      assert.strictEqual(audit.mediaSummary.totalAttachedMedia, 4);

      // Verify exact classifications
      const postA = audit.items.find((i) => i.id === 'post_media_yt');
      assert.strictEqual(postA?.mediaAudit?.status, 'RETAINED_PROTECTED_CHANNEL');

      const postB = audit.items.find((i) => i.id === 'post_cancel_exclusive');
      assert.strictEqual(postB?.mediaAudit?.status, 'ELIGIBLE_FOR_R2_DELETE');

      const postC = audit.items.find((i) => i.id === 'post_cancel_shared_pub');
      assert.strictEqual(postC?.mediaAudit?.status, 'RETAINED_PUBLISHED');

      const postD = audit.items.find((i) => i.id === 'post_cancel_shared_draft');
      assert.strictEqual(postD?.mediaAudit?.status, 'RETAINED_DRAFT');

      // Summary verification
      assert.strictEqual(audit.mediaSummary.expectedDeletedMediaCount, 1); // Only post B
      assert.strictEqual(audit.mediaSummary.expectedFreedStorageBytes, 25 * 1024 * 1024);
      assert.strictEqual(audit.mediaSummary.expectedFreedStorageMB, 25);
      assert.strictEqual(audit.mediaSummary.protectedChannelMediaRetainedCount, 1);
      assert.strictEqual(audit.mediaSummary.sharedMediaRetainedCount, 2);
    });

    await testCase('Dry run preview computes expected R2 storage freed without deleting any files', async () => {
      prisma.contentPost.findMany = (async () => sampleMediaPosts) as any;

      let r2DeleteCalled = false;
      const mockDeleteR2 = async () => {
        r2DeleteCalled = true;
        return { success: true };
      };

      const result = await executeBulkCancelScheduledPosts({
        confirmToken: 'CONFIRM_CANCEL',
        dryRun: true,
        deleteR2Fn: mockDeleteR2,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.dryRun, true);
      assert.strictEqual(result.cancelledPostsCount, 3);
      assert.strictEqual(result.mediaCleanupResult.deletedR2Count, 1);
      assert.strictEqual(result.mediaCleanupResult.freedMB, 25);
      assert.strictEqual(result.mediaCleanupResult.retainedProtectedChannelCount, 1);
      assert.strictEqual(result.mediaCleanupResult.retainedSharedCount, 2);
      assert.strictEqual(r2DeleteCalled, false, 'deleteR2Fn must NEVER be called in dry-run mode');
    });

    await testCase('Live cancellation purges exclusive R2 media and strictly retains protected/shared media', async () => {
      prisma.contentPost.findMany = (async () => sampleMediaPosts) as any;
      prisma.contentPost.update = (async () => ({ id: 'mock' })) as any;
      prisma.platformPost.updateMany = (async () => ({ count: 1 })) as any;
      prisma.publishingJob.updateMany = (async () => ({ count: 0 })) as any;
      prisma.activityLog.create = (async () => ({ id: 'log_r2', createdAt: new Date() })) as any;
      prisma.mediaAsset.updateMany = (async () => ({ count: 1 })) as any;

      // Mock media asset query and update
      const updatedMediaUrls: Record<string, string> = {};
      prisma.mediaAsset.findUnique = (async ({ where }: any) => {
        if (where.id === 'media_cancel_exclusive') {
          return {
            id: 'media_cancel_exclusive',
            workspaceId: 'ws_tenant',
            url: 'https://r2.socialos.dev/workspaces/ws_tenant/dance.mp4',
            storageKey: 'workspaces/ws_tenant/dance.mp4',
            createdAt: new Date(),
            updatedAt: new Date(),
            posts: [
              {
                id: 'post_cancel_exclusive',
                status: 'CANCELLED',
                platformPosts: [
                  {
                    id: 'pp_tt_exclusive',
                    platform: 'TIKTOK',
                    status: 'CANCELLED',
                    metadata: null,
                    updatedAt: new Date(),
                    publishingJobs: [],
                  },
                ],
              },
            ],
          };
        }
        return null;
      }) as any;

      prisma.mediaAsset.update = (async ({ where, data }: any) => {
        updatedMediaUrls[where.id] = data.url;
        return { id: where.id, ...data };
      }) as any;

      const deletedKeys: string[] = [];
      const mockDeleteR2 = async (key: string, wsId: string) => {
        deletedKeys.push(key);
        return { success: true };
      };

      const result = await executeBulkCancelScheduledPosts({
        confirmToken: 'CONFIRM_CANCEL',
        actorUserId: 'owner_user_id',
        cleanupMedia: true,
        deleteR2Fn: mockDeleteR2,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mediaCleanupResult.deletedR2Count, 1);
      assert.strictEqual(result.mediaCleanupResult.freedMB, 25);
      assert.strictEqual(result.mediaCleanupResult.failedRetryCount, 0);

      // Verify that deleteR2 was called strictly for the exclusive media
      assert.strictEqual(deletedKeys.length, 1);
      assert.strictEqual(deletedKeys[0], 'workspaces/ws_tenant/dance.mp4');

      // Verify database record was archived
      assert.strictEqual(updatedMediaUrls['media_cancel_exclusive'], 'archived://workspaces/ws_tenant/dance.mp4');

      // Verify protected YouTube media was NEVER passed for deletion
      assert.strictEqual(deletedKeys.includes('workspaces/ws_owner/sheru_clip.mp4'), false);
      assert.strictEqual(deletedKeys.includes('workspaces/ws_tenant/shared_video.mp4'), false);
      assert.strictEqual(deletedKeys.includes('workspaces/ws_tenant/draft_video.mp4'), false);
    });

    await testCase('R2 deletion failure marks asset for background retry without throwing or crashing', async () => {
      prisma.contentPost.findMany = (async () => [sampleMediaPosts[1]]) as any; // Only post B
      prisma.contentPost.update = (async () => ({ id: 'mock' })) as any;
      prisma.platformPost.updateMany = (async () => ({ count: 1 })) as any;
      prisma.publishingJob.updateMany = (async () => ({ count: 0 })) as any;
      prisma.activityLog.create = (async () => ({ id: 'log_r2_fail', createdAt: new Date() })) as any;
      prisma.mediaAsset.updateMany = (async () => ({ count: 1 })) as any;

      const updatedMediaUrls: Record<string, string> = {};
      prisma.mediaAsset.findUnique = (async () => ({
        id: 'media_cancel_exclusive',
        workspaceId: 'ws_tenant',
        url: 'https://r2.socialos.dev/workspaces/ws_tenant/dance.mp4',
        storageKey: 'workspaces/ws_tenant/dance.mp4',
        createdAt: new Date(),
        updatedAt: new Date(),
        posts: [
          {
            id: 'post_cancel_exclusive',
            status: 'CANCELLED',
            platformPosts: [
              {
                id: 'pp_tt_exclusive',
                platform: 'TIKTOK',
                status: 'CANCELLED',
                metadata: null,
                updatedAt: new Date(),
                publishingJobs: [],
              },
            ],
          },
        ],
      })) as any;

      prisma.mediaAsset.update = (async ({ where, data }: any) => {
        updatedMediaUrls[where.id] = data.url;
        return { id: where.id, ...data };
      }) as any;

      const mockFailingDeleteR2 = async () => {
        return { success: false, error: 'Simulated R2 connection timeout' };
      };

      const result = await executeBulkCancelScheduledPosts({
        confirmToken: 'CONFIRM_CANCEL',
        actorUserId: 'owner_user_id',
        cleanupMedia: true,
        deleteR2Fn: mockFailingDeleteR2,
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.mediaCleanupResult.deletedR2Count, 0);
      assert.strictEqual(result.mediaCleanupResult.failedRetryCount, 1);
      assert.strictEqual(result.mediaCleanupResult.deletedMediaAssets[0].status, 'FAILED_RETRY');

      // Verify asset marked for retry
      assert.strictEqual(updatedMediaUrls['media_cancel_exclusive'], 'archived_retry://workspaces/ws_tenant/dance.mp4');
    });

    // -------------------------------------------------------------------------
    console.log('\n--- Group 5: Pre-Production Security & Concurrency Verification ---');
    // -------------------------------------------------------------------------

    await testCase('Matches protected YouTube channels by actual Channel ID and env variable', () => {
      // 1. All 4 canonical verified channel IDs must be recognized as protected
      const ch1 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        platformAccountId: 'UCBnZGCVHvAdpgxAmofMWMIA',
        name: 'Tech With Salman',
        username: '@Tech With Salman',
      });
      assert.strictEqual(ch1.isProtected, true);
      assert.strictEqual(ch1.channel?.displayName, 'Tech With Salman');
      assert.ok(ch1.matchReason?.includes('UCBnZGCVHvAdpgxAmofMWMIA'));

      const ch2 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        platformAccountId: 'UCIfCPF9nczFDWt13KradQSw',
        name: 'Beyond History',
        username: '@Beyond History',
      });
      assert.strictEqual(ch2.isProtected, true);
      assert.strictEqual(ch2.channel?.displayName, 'Beyond History');
      assert.ok(ch2.matchReason?.includes('UCIfCPF9nczFDWt13KradQSw'));

      const ch3 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        platformAccountId: 'UC0YEctuSxrrTusjvr6T0weQ',
        name: 'Sheru Bhai Official',
        username: '@SheruBhaiOfficial',
      });
      assert.strictEqual(ch3.isProtected, true);
      assert.strictEqual(ch3.channel?.displayName, 'Sheru Bhai Official');
      assert.ok(ch3.matchReason?.includes('UC0YEctuSxrrTusjvr6T0weQ'));

      const ch4 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        platformAccountId: 'UCWYHIx472E94uiSgoMmpsUQ',
        name: 'VEXORA',
        username: '@vexora',
      });
      assert.strictEqual(ch4.isProtected, true);
      assert.strictEqual(ch4.channel?.displayName, 'VEXORA');
      assert.ok(ch4.matchReason?.includes('UCWYHIx472E94uiSgoMmpsUQ'));

      // 2. Conflicting Channel ID Guard: An unapproved channel ID CANNOT spoof protection using an approved name
      const spoof1 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        platformAccountId: 'UC_unapproved_spoof_1',
        name: 'Tech With Salman',
        username: '@TechWithSalman',
      });
      assert.strictEqual(spoof1.isProtected, false, 'Conflicting channel ID must NOT be protected even if name matches');
      assert.ok(spoof1.matchReason?.includes('Unapproved Channel ID'));

      const spoof2 = matchProtectedYouTubeChannel({
        platform: 'YOUTUBE',
        platformAccountId: 'UC_unapproved_spoof_2',
        name: 'VEXORA Official',
        username: '@vexora',
      });
      assert.strictEqual(spoof2.isProtected, false, 'Conflicting channel ID must NOT be protected even if username matches');

      // 3. Environment variable APPROVED_YOUTUBE_CHANNEL_IDS matching
      const origEnv = process.env.APPROVED_YOUTUBE_CHANNEL_IDS;
      try {
        process.env.APPROVED_YOUTUBE_CHANNEL_IDS = 'UCBnZGCVHvAdpgxAmofMWMIA,UCIfCPF9nczFDWt13KradQSw,UC0YEctuSxrrTusjvr6T0weQ,UCWYHIx472E94uiSgoMmpsUQ';

        const envMatch = matchProtectedYouTubeChannel({
          platform: 'YOUTUBE',
          platformAccountId: 'UCBnZGCVHvAdpgxAmofMWMIA',
          name: 'Renamed Channel Title',
          username: 'custom_handle',
        });
        assert.strictEqual(envMatch.isProtected, true);
      } finally {
        process.env.APPROVED_YOUTUBE_CHANNEL_IDS = origEnv;
      }
    });

    await testCase('Protects in-flight posts (PROCESSING / UPLOADING) from cancellation and R2 deletion', async () => {
      const inFlightPosts = [
        {
          id: 'post_in_flight_processing',
          workspaceId: 'ws_tenant',
          title: 'Currently Publishing Video',
          masterCaption: 'In flight clip',
          scheduledFor: new Date('2026-12-01T10:00:00Z'),
          status: 'PROCESSING',
          workspace: {
            id: 'ws_tenant',
            name: 'Tenant Workspace',
            slug: 'tenant-ws',
            members: [{ user: { email: 'tenant@example.com', firstName: 'Tenant', lastName: 'User' } }],
          },
          platformPosts: [
            {
              id: 'pp_processing_1',
              platform: 'TIKTOK',
              status: 'PROCESSING',
              socialAccountId: 'sa_tt_1',
              socialAccount: {
                id: 'sa_tt_1',
                platform: 'TIKTOK',
                name: 'TikTok User',
                username: 'ttuser',
                platformAccountId: 'TT_1',
              },
            },
          ],
          mediaAsset: {
            id: 'media_in_flight',
            originalName: 'inflight.mp4',
            mimeType: 'video/mp4',
            size: 50 * 1024 * 1024,
            url: 'https://r2.socialos.dev/workspaces/ws_tenant/inflight.mp4',
            posts: [
              {
                id: 'post_in_flight_processing',
                status: 'PROCESSING',
                platformPosts: [{ id: 'pp_processing_1', platform: 'TIKTOK', status: 'PROCESSING' }],
              },
            ],
          },
        },
      ];

      prisma.contentPost.findMany = (async () => inFlightPosts) as any;

      const audit = await auditScheduledPosts();
      assert.strictEqual(audit.counts.inFlightPosts, 1);
      assert.strictEqual(audit.items[0].classification, 'IN_FLIGHT');
      assert.strictEqual(audit.items[0].mediaAudit?.status, 'RETAINED_IN_FLIGHT');

      // Cancellation execution MUST skip in-flight posts completely
      let r2DeleteCalled = false;
      const result = await executeBulkCancelScheduledPosts({
        confirmToken: 'CONFIRM_CANCEL',
        deleteR2Fn: async () => {
          r2DeleteCalled = true;
          return { success: true };
        },
      });

      assert.strictEqual(result.cancelledPostsCount, 0);
      assert.strictEqual(result.cancelledTargetsCount, 0);
      assert.strictEqual(result.skippedInFlightCount, 1);
      assert.strictEqual(result.mediaCleanupResult.deletedR2Count, 0);
      assert.strictEqual(r2DeleteCalled, false, 'In-flight media must NEVER be deleted');
    });

    await testCase('Multi-platform cancellation matrix handles LinkedIn, Facebook, Instagram, TikTok, X, Pinterest', async () => {
      const allPlatformsPost = [
        {
          id: 'post_omnichannel',
          workspaceId: 'ws_owner',
          title: 'Omnichannel Campaign',
          masterCaption: 'Global update across 7 platforms',
          scheduledFor: new Date('2026-12-05T10:00:00Z'),
          status: 'SCHEDULED',
          workspace: {
            id: 'ws_owner',
            name: "Salman's Studio",
            slug: 'salman-studio',
            members: [{ user: { email: 'salmandesigner24@gmail.com', firstName: 'Salman', lastName: 'Designer' } }],
          },
          platformPosts: [
            {
              id: 'pp_yt_vexora',
              platform: 'YOUTUBE',
              status: 'SCHEDULED',
              socialAccountId: 'sa_yt_vex',
              socialAccount: {
                id: 'sa_yt_vex',
                platform: 'YOUTUBE',
                name: 'VEXORA',
                username: '@vexora',
                platformAccountId: 'UCWYHIx472E94uiSgoMmpsUQ',
              },
            },
            {
              id: 'pp_li',
              platform: 'LINKEDIN',
              status: 'SCHEDULED',
              socialAccountId: 'sa_li',
              socialAccount: { id: 'sa_li', platform: 'LINKEDIN', name: 'LinkedIn Account', username: 'li_user' },
            },
            {
              id: 'pp_fb',
              platform: 'FACEBOOK',
              status: 'SCHEDULED',
              socialAccountId: 'sa_fb',
              socialAccount: { id: 'sa_fb', platform: 'FACEBOOK', name: 'Facebook Page', username: 'fb_page' },
            },
            {
              id: 'pp_ig',
              platform: 'INSTAGRAM',
              status: 'SCHEDULED',
              socialAccountId: 'sa_ig',
              socialAccount: { id: 'sa_ig', platform: 'INSTAGRAM', name: 'Instagram Account', username: 'ig_user' },
            },
            {
              id: 'pp_tt',
              platform: 'TIKTOK',
              status: 'SCHEDULED',
              socialAccountId: 'sa_tt',
              socialAccount: { id: 'sa_tt', platform: 'TIKTOK', name: 'TikTok Account', username: 'tt_user' },
            },
            {
              id: 'pp_x',
              platform: 'X',
              status: 'SCHEDULED',
              socialAccountId: 'sa_x',
              socialAccount: { id: 'sa_x', platform: 'X', name: 'X Account', username: 'x_user' },
            },
            {
              id: 'pp_pin',
              platform: 'PINTEREST',
              status: 'SCHEDULED',
              socialAccountId: 'sa_pin',
              socialAccount: { id: 'sa_pin', platform: 'PINTEREST', name: 'Pinterest Board', username: 'pin_user' },
            },
          ],
          mediaAsset: {
            id: 'media_omnichannel',
            originalName: 'omni.mp4',
            mimeType: 'video/mp4',
            size: 30 * 1024 * 1024,
            url: 'https://r2.socialos.dev/workspaces/ws_owner/omni.mp4',
            posts: [
              {
                id: 'post_omnichannel',
                status: 'SCHEDULED',
                platformPosts: [
                  {
                    platform: 'YOUTUBE',
                    status: 'SCHEDULED',
                    socialAccount: { platform: 'YOUTUBE', name: 'VEXORA', username: '@vexora' },
                  },
                ],
              },
            ],
          },
        },
      ];

      prisma.contentPost.findMany = (async () => allPlatformsPost) as any;
      const cancelledPlatformIds: string[] = [];
      prisma.platformPost.updateMany = (async ({ where }: any) => {
        cancelledPlatformIds.push(...(where?.id?.in || []));
        return { count: where?.id?.in?.length || 0 };
      }) as any;
      prisma.publishingJob.updateMany = (async () => ({ count: 0 })) as any;
      prisma.activityLog.create = (async () => ({ id: 'log_omni', createdAt: new Date() })) as any;

      let r2DeleteCalled = false;
      const result = await executeBulkCancelScheduledPosts({
        confirmToken: 'CONFIRM_CANCEL',
        deleteR2Fn: async () => {
          r2DeleteCalled = true;
          return { success: true };
        },
      });

      // Exactly 6 non-whitelisted platforms cancelled (LinkedIn, FB, IG, TikTok, X, Pinterest)
      assert.strictEqual(result.cancelledTargetsCount, 6);
      assert.strictEqual(cancelledPlatformIds.includes('pp_li'), true);
      assert.strictEqual(cancelledPlatformIds.includes('pp_fb'), true);
      assert.strictEqual(cancelledPlatformIds.includes('pp_ig'), true);
      assert.strictEqual(cancelledPlatformIds.includes('pp_tt'), true);
      assert.strictEqual(cancelledPlatformIds.includes('pp_x'), true);
      assert.strictEqual(cancelledPlatformIds.includes('pp_pin'), true);

      // YouTube target preserved:
      assert.strictEqual(cancelledPlatformIds.includes('pp_yt_vexora'), false);

      // Parent ContentPost kept active:
      assert.strictEqual(result.cancelledPostsCount, 0);
      assert.strictEqual(result.preservedProtectedPostsCount, 1);

      // Media attached to VEXORA YouTube must NOT be deleted:
      assert.strictEqual(r2DeleteCalled, false);
      assert.strictEqual(result.mediaCleanupResult.deletedR2Count, 0);
      assert.strictEqual(result.mediaCleanupResult.retainedProtectedChannelCount, 1);
    });

    await testCase('Repeated cancellation requests are idempotent and produce zero side-effects', async () => {
      // When no scheduled posts remain
      prisma.contentPost.findMany = (async () => []) as any;
      prisma.activityLog.create = (async () => ({ id: 'log_empty', createdAt: new Date() })) as any;

      const result = await executeBulkCancelScheduledPosts({
        confirmToken: 'CONFIRM_CANCEL',
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.cancelledPostsCount, 0);
      assert.strictEqual(result.cancelledTargetsCount, 0);
      assert.strictEqual(result.mediaCleanupResult.deletedR2Count, 0);
    });

    await testCase('Cross-workspace R2 deletion attempt is rejected by security boundary guard', async () => {
      const { safeCleanupMediaAsset } = await import('../lib/storage/r2-cleanup');

      // Asset belongs to ws_tenant_A, but cleanup is invoked for ws_tenant_B
      prisma.mediaAsset.findUnique = (async () => ({
        id: 'asset_cross_ws',
        workspaceId: 'ws_tenant_A',
        url: 'https://r2.socialos.dev/workspaces/ws_tenant_A/video.mp4',
        storageKey: 'workspaces/ws_tenant_A/video.mp4',
        posts: [],
      })) as any;

      let r2DeleteCalled = false;
      const res = await safeCleanupMediaAsset('asset_cross_ws', 'ws_tenant_B', {
        deleteR2Fn: async () => {
          r2DeleteCalled = true;
          return { success: true };
        },
      });

      assert.strictEqual(res.success, false);
      assert.strictEqual(res.action, 'SKIPPED');
      assert.ok(res.reason?.includes('Workspace mismatch'));
      assert.strictEqual(r2DeleteCalled, false, 'Cross-workspace R2 deletion must be blocked');
    });

  } finally {
    // Restore mocks
    prisma.contentPost.findMany = origContentPostFindMany;
    prisma.contentPost.update = origContentPostUpdate;
    prisma.platformPost.updateMany = origPlatformPostUpdateMany;
    prisma.publishingJob.updateMany = origPublishingJobUpdateMany;
    prisma.activityLog.create = origActivityLogCreate;
    prisma.mediaAsset.findUnique = origMediaAssetFindUnique;
    prisma.mediaAsset.update = origMediaAssetUpdate;
    prisma.mediaAsset.updateMany = origMediaAssetUpdateMany;
  }

  console.log('\n========================================================================');
  console.log(` ALL BULK CANCEL TESTS PASSED: ${passedTests}/${totalTests}`);
  console.log('========================================================================\n');
}

runSuite().catch((err) => {
  console.error('\nTest Suite Failed:', err);
  process.exit(1);
});
