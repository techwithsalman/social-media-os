import assert from 'node:assert';
import {
  deletePostAndAssociatedMedia,
  processScheduledMediaCleanup,
  canDeleteMediaAsset,
  safeCleanupMediaAsset,
} from '../lib/storage/r2-cleanup';

console.log('========================================================================');
console.log(' POSTNEXA SCHEDULED POST PERMANENT DELETE & R2 CLEANUP TEST SUITE     ');
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

  const originalContentPost = { ...prisma.contentPost };
  const originalMediaAsset = { ...prisma.mediaAsset };
  const originalActivityLog = { ...prisma.activityLog };

  console.log('--- Test Group 1: Exclusive Media Deletion on Scheduled Post Delete ---');

  await testCase('Exclusively owned media object in R2 is deleted and archived when post is permanently deleted', async () => {
    const wsId = 'ws_tenant_1';
    const postId = 'post_scheduled_1';
    const mediaId = 'media_exclusive_1';
    const objectKey = `workspaces/${wsId}/videos/exclusive_video.mp4`;

    let postRecord: any = {
      id: postId,
      workspaceId: wsId,
      status: 'SCHEDULED',
      mediaAssetId: mediaId,
      platformPosts: [
        { id: 'pp_1', status: 'SCHEDULED', platform: 'TIKTOK' },
      ],
      mediaAsset: {
        id: mediaId,
        workspaceId: wsId,
        url: objectKey,
        createdAt: new Date(),
      },
    };

    let mediaRecord: any = {
      id: mediaId,
      workspaceId: wsId,
      url: objectKey,
      createdAt: new Date(),
      posts: [],
    };

    const deletedR2Calls: Array<{ objectKey: string; workspaceId: string }> = [];
    const auditLogs: any[] = [];

    // Mock prisma
    (prisma.contentPost as any).findUnique = async ({ where }: any) => {
      if (where.id === postId) return postRecord;
      return null;
    };
    (prisma.contentPost as any).delete = async ({ where }: any) => {
      if (where.id === postId) {
        postRecord = null;
        return { id: postId };
      }
      throw new Error('Not found');
    };
    (prisma.contentPost as any).count = async ({ where }: any) => {
      // Check other posts referencing this media
      if (where.mediaAssetId === mediaId && where.id?.not === postId) return 0;
      return 0;
    };

    (prisma.mediaAsset as any).findUnique = async ({ where }: any) => {
      if (where.id === mediaId) {
        return { ...mediaRecord, posts: postRecord ? [postRecord] : [] };
      }
      return null;
    };
    (prisma.mediaAsset as any).updateMany = async ({ where, data }: any) => {
      if (where.id === mediaId) {
        mediaRecord.url = data.url;
        return { count: 1 };
      }
      return { count: 0 };
    };
    (prisma.mediaAsset as any).update = async ({ where, data }: any) => {
      if (where.id === mediaId) {
        mediaRecord.url = data.url;
        return mediaRecord;
      }
      throw new Error('Not found');
    };
    (prisma.activityLog as any).create = async ({ data }: any) => {
      auditLogs.push(data);
      return { id: 'act_1', ...data };
    };

    const mockDeleteR2 = async (key: string, workspace: string) => {
      deletedR2Calls.push({ objectKey: key, workspaceId: workspace });
      return { success: true };
    };

    const result = await deletePostAndAssociatedMedia(postId, wsId, {
      deleteR2Fn: mockDeleteR2,
    });

    assert.strictEqual(result.success, true, 'Result must be success');
    assert.strictEqual(result.postDeleted, true, 'Post must be deleted');
    assert.strictEqual(result.mediaCleanup.action, 'DELETED', 'Media action must be DELETED');
    assert.strictEqual(postRecord, null, 'Post must be removed from DB');
    assert.strictEqual(deletedR2Calls.length, 1, 'R2 delete function must be called once');
    assert.strictEqual(deletedR2Calls[0].objectKey, objectKey, 'Deleted object key must match');
    assert.strictEqual(deletedR2Calls[0].workspaceId, wsId, 'Workspace ID must match');
    assert.strictEqual(mediaRecord.url, `archived://${objectKey}`, 'Media URL must be transitioned to archived://');
    assert.ok(auditLogs.some((l) => l.action === 'R2_MEDIA_POST_DELETED_CLEANUP'), 'Audit log must record post-deleted cleanup');
  });

  console.log('\n--- Test Group 2: Shared Media Protection ---');

  await testCase('Shared media (referenced by another post) is preserved in R2 when one post is deleted', async () => {
    const wsId = 'ws_tenant_1';
    const postId = 'post_A';
    const otherPostId = 'post_B';
    const mediaId = 'media_shared_1';
    const objectKey = `workspaces/${wsId}/videos/shared_video.mp4`;

    let postA: any = {
      id: postId,
      workspaceId: wsId,
      status: 'SCHEDULED',
      mediaAssetId: mediaId,
      platformPosts: [{ id: 'pp_a', status: 'SCHEDULED', platform: 'INSTAGRAM' }],
      mediaAsset: { id: mediaId, workspaceId: wsId, url: objectKey, createdAt: new Date() },
    };

    let mediaRecord: any = {
      id: mediaId,
      workspaceId: wsId,
      url: objectKey,
      createdAt: new Date(),
    };

    const deletedR2Calls: any[] = [];
    const auditLogs: any[] = [];

    (prisma.contentPost as any).findUnique = async ({ where }: any) => {
      if (where.id === postId) return postA;
      return null;
    };
    (prisma.contentPost as any).delete = async ({ where }: any) => {
      if (where.id === postId) {
        postA = null;
        return { id: postId };
      }
      throw new Error('Not found');
    };
    // Post B also references this media!
    (prisma.contentPost as any).count = async ({ where }: any) => {
      if (where.mediaAssetId === mediaId && where.id?.not === postId) return 1;
      return 0;
    };
    (prisma.activityLog as any).create = async ({ data }: any) => {
      auditLogs.push(data);
      return { id: 'act_shared', ...data };
    };

    const mockDeleteR2 = async (key: string, workspace: string) => {
      deletedR2Calls.push({ objectKey: key, workspaceId: workspace });
      return { success: true };
    };

    const result = await deletePostAndAssociatedMedia(postId, wsId, {
      deleteR2Fn: mockDeleteR2,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.postDeleted, true, 'Post A must be deleted');
    assert.strictEqual(result.mediaCleanup.action, 'SKIPPED', 'Media cleanup action must be SKIPPED');
    assert.ok(result.mediaCleanup.reason.includes('shared'), 'Reason must indicate media is shared');
    assert.strictEqual(deletedR2Calls.length, 0, 'R2 delete function MUST NOT be called for shared media');
    assert.strictEqual(mediaRecord.url, objectKey, 'MediaAsset URL must remain untouched');
    assert.strictEqual(postA, null, 'Post A must be deleted from DB');
  });

  await testCase('Shared media (referenced by multiple downstream posts) is preserved in R2 when post is deleted', async () => {
    const wsId = 'ws_tenant_1';
    const postId = 'post_campaign_a';
    const mediaId = 'media_campaign_shared';
    const objectKey = `workspaces/${wsId}/videos/campaign_video.mp4`;

    let post: any = {
      id: postId,
      workspaceId: wsId,
      status: 'SCHEDULED',
      mediaAssetId: mediaId,
      platformPosts: [{ id: 'pp_d', status: 'SCHEDULED', platform: 'INSTAGRAM' }],
      mediaAsset: { id: mediaId, workspaceId: wsId, url: objectKey, createdAt: new Date() },
    };

    const deletedR2Calls: any[] = [];

    (prisma.contentPost as any).findUnique = async ({ where }: any) => (where.id === postId ? post : null);
    (prisma.contentPost as any).delete = async ({ where }: any) => {
      if (where.id === postId) {
        post = null;
        return { id: postId };
      }
      throw new Error('Not found');
    };
    (prisma.contentPost as any).count = async () => 2; // Two other posts reference this shared media

    const mockDeleteR2 = async (key: string, workspace: string) => {
      deletedR2Calls.push({ objectKey: key, workspaceId: workspace });
      return { success: true };
    };

    const result = await deletePostAndAssociatedMedia(postId, wsId, {
      deleteR2Fn: mockDeleteR2,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.postDeleted, true);
    assert.strictEqual(result.mediaCleanup.action, 'SKIPPED');
    assert.strictEqual(deletedR2Calls.length, 0, 'R2 delete MUST NOT be called when other posts reference media');
  });

  console.log('\n--- Test Group 3: In-Flight & Concurrency Safety Guards ---');

  await testCase('Deletion is rejected if post or platform post is currently PROCESSING or UPLOADING', async () => {
    const wsId = 'ws_tenant_1';
    const postId = 'post_active_publishing';
    const mediaId = 'media_active_1';
    const objectKey = `workspaces/${wsId}/videos/active.mp4`;

    const post: any = {
      id: postId,
      workspaceId: wsId,
      status: 'PROCESSING', // Active publishing!
      mediaAssetId: mediaId,
      platformPosts: [{ id: 'pp_active', status: 'PROCESSING', platform: 'YOUTUBE' }],
      mediaAsset: { id: mediaId, workspaceId: wsId, url: objectKey, createdAt: new Date() },
    };

    let postDeleted = false;
    const deletedR2Calls: any[] = [];

    (prisma.contentPost as any).findUnique = async () => post;
    (prisma.contentPost as any).delete = async () => {
      postDeleted = true;
      return { id: postId };
    };

    const mockDeleteR2 = async (key: string, workspace: string) => {
      deletedR2Calls.push({ objectKey: key, workspaceId: workspace });
      return { success: true };
    };

    const result = await deletePostAndAssociatedMedia(postId, wsId, {
      deleteR2Fn: mockDeleteR2,
    });

    assert.strictEqual(result.success, false, 'Must fail when actively processing');
    assert.strictEqual(result.postDeleted, false, 'Post must not be deleted');
    assert.strictEqual(postDeleted, false, 'DB delete must not be executed');
    assert.strictEqual(deletedR2Calls.length, 0, 'R2 delete must not be called');
    assert.ok(result.error?.includes('actively publishing'), 'Error must inform user about active publishing');
  });

  console.log('\n--- Test Group 4: R2 Deletion Failure & Auto-Retry Handling ---');

  await testCase('When R2 deletion fails, post is deleted and media is marked archived_retry:// for worker retry', async () => {
    const wsId = 'ws_tenant_1';
    const postId = 'post_r2_failure';
    const mediaId = 'media_fail_1';
    const objectKey = `workspaces/${wsId}/videos/fail_video.mp4`;

    let post: any = {
      id: postId,
      workspaceId: wsId,
      status: 'SCHEDULED',
      mediaAssetId: mediaId,
      platformPosts: [{ id: 'pp_fail', status: 'SCHEDULED', platform: 'TIKTOK' }],
      mediaAsset: { id: mediaId, workspaceId: wsId, url: objectKey, createdAt: new Date() },
    };

    let mediaRecord: any = {
      id: mediaId,
      workspaceId: wsId,
      url: objectKey,
      createdAt: new Date(),
    };

    (prisma.contentPost as any).findUnique = async () => post;
    (prisma.contentPost as any).delete = async () => {
      post = null;
      return { id: postId };
    };
    (prisma.contentPost as any).count = async () => 0;

    (prisma.mediaAsset as any).findUnique = async () => ({
      ...mediaRecord,
      posts: [], // Detached post
    });
    (prisma.mediaAsset as any).updateMany = async ({ data }: any) => {
      mediaRecord.url = data.url;
      return { count: 1 };
    };
    (prisma.mediaAsset as any).update = async ({ data }: any) => {
      mediaRecord.url = data.url;
      return mediaRecord;
    };

    // R2 delete simulation failure (e.g. R2 endpoint timeout)
    const mockFailingDeleteR2 = async () => {
      return { success: false, error: 'Cloudflare R2 504 Gateway Timeout' };
    };

    const result = await deletePostAndAssociatedMedia(postId, wsId, {
      deleteR2Fn: mockFailingDeleteR2,
    });

    assert.strictEqual(result.success, true, 'Post delete should succeed');
    assert.strictEqual(result.postDeleted, true, 'Post was deleted from DB');
    assert.strictEqual(result.mediaCleanup.action, 'FAILED', 'Media action must report FAILED');
    assert.strictEqual(result.mediaCleanup.reason, 'Cloudflare R2 504 Gateway Timeout');
    assert.strictEqual(
      mediaRecord.url,
      `archived_retry://${objectKey}`,
      'Media URL must be recorded as archived_retry:// for automatic worker pickup'
    );

    // Now verify that processScheduledMediaCleanup picks up this archived_retry:// record and retries it!
    let retriedDeleted = false;
    const mockSuccessDeleteR2 = async (key: string) => {
      if (key === objectKey) retriedDeleted = true;
      return { success: true };
    };

    // Mock findMany returning the archived_retry asset
    (prisma.mediaAsset as any).findMany = async () => [
      { id: mediaId, workspaceId: wsId, url: mediaRecord.url, createdAt: mediaRecord.createdAt },
    ];

    const workerSummary = await processScheduledMediaCleanup({
      batchSize: 5,
      scanLimit: 10,
      deleteR2Fn: mockSuccessDeleteR2,
    });

    assert.strictEqual(workerSummary.deletedCount, 1, 'Cleanup worker must pick up and delete archived_retry asset');
    assert.strictEqual(retriedDeleted, true, 'R2 delete must have succeeded on retry');
    assert.strictEqual(mediaRecord.url, `archived://${objectKey}`, 'URL must be permanently transitioned to archived://');
  });

  console.log('\n--- Test Group 5: Workspace Tenant Boundary Protection ---');

  await testCase('User in workspace A cannot delete scheduled post from workspace B', async () => {
    const wsA = 'ws_user_a';
    const wsB = 'ws_user_b';
    const postId = 'post_in_ws_b';

    const postB: any = {
      id: postId,
      workspaceId: wsB,
      status: 'SCHEDULED',
      mediaAssetId: 'media_b',
      platformPosts: [],
      mediaAsset: { id: 'media_b', workspaceId: wsB, url: 'workspaces/ws_user_b/video.mp4', createdAt: new Date() },
    };

    let deleteCalled = false;
    (prisma.contentPost as any).findUnique = async () => postB;
    (prisma.contentPost as any).delete = async () => {
      deleteCalled = true;
      return { id: postId };
    };

    const result = await deletePostAndAssociatedMedia(postId, wsA); // Calling with wsA!

    assert.strictEqual(result.success, false, 'Must fail unauthorized tenant deletion');
    assert.strictEqual(deleteCalled, false, 'Must not touch post in other workspace');
    assert.strictEqual(result.error, 'Post not found');
  });

  console.log('\n--- Test Group 6: Text-Only Post Deletion ---');

  await testCase('Post without media asset is cleanly deleted with mediaCleanup action NONE', async () => {
    const wsId = 'ws_text_only';
    const postId = 'post_text_only';

    let post: any = {
      id: postId,
      workspaceId: wsId,
      status: 'SCHEDULED',
      mediaAssetId: null,
      mediaAsset: null,
      platformPosts: [{ id: 'pp_text', status: 'SCHEDULED', platform: 'X' }],
    };

    (prisma.contentPost as any).findUnique = async () => post;
    (prisma.contentPost as any).delete = async () => {
      post = null;
      return { id: postId };
    };

    const result = await deletePostAndAssociatedMedia(postId, wsId);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.postDeleted, true);
    assert.strictEqual(result.mediaCleanup.action, 'NONE');
    assert.strictEqual(post, null);
  });

  // Restore prisma originals
  Object.assign(prisma.contentPost, originalContentPost);
  Object.assign(prisma.mediaAsset, originalMediaAsset);
  Object.assign(prisma.activityLog, originalActivityLog);

  console.log('\n========================================================================');
  console.log(` ALL TESTS COMPLETED: ${passedTests}/${totalTests} PASSED`);
  console.log('========================================================================\n');
}

runSuite().catch((err) => {
  console.error('\nTest Suite Fatal Exception:', err);
  process.exit(1);
});
