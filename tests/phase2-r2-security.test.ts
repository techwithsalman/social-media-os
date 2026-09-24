import {
  buildR2ObjectKey,
  verifyR2ObjectWorkspaceOwnership,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  resolveMediaAccessUrl,
  isR2Configured,
} from '../src/lib/storage/r2';

async function runPhase2SecurityTests() {
  console.log('=== RUNNING PHASE 2 R2 SECURITY VERIFICATION TESTS ===\n');

  let testPassedCount = 0;
  let totalTests = 0;

  function assert(condition: boolean, description: string) {
    totalTests++;
    if (condition) {
      testPassedCount++;
      console.log(`✅ [PASS] Test ${totalTests}: ${description}`);
    } else {
      console.error(`❌ [FAIL] Test ${totalTests}: ${description}`);
      throw new Error(`Test failed: ${description}`);
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Object Key Workspace Path Isolation
  // -------------------------------------------------------------
  const key1 = buildR2ObjectKey('workspace_alpha', 'demo_reel.mp4');
  assert(
    key1.startsWith('workspaces/workspace_alpha/videos/'),
    'Object key prefix matches workspaces/workspace_alpha/videos/'
  );

  // -------------------------------------------------------------
  // TEST 2: Workspace Ownership Enforcement Verification
  // -------------------------------------------------------------
  const alphaOwnership = verifyR2ObjectWorkspaceOwnership(key1, 'workspace_alpha');
  const betaOwnership = verifyR2ObjectWorkspaceOwnership(key1, 'workspace_beta');

  assert(alphaOwnership === true, 'workspace_alpha correctly authorized for its own object key');
  assert(betaOwnership === false, 'workspace_beta correctly rejected for workspace_alpha object key');

  // -------------------------------------------------------------
  // TEST 3: Cross-Client Unauthorized Access Rejection
  // -------------------------------------------------------------
  let crossTenantBlocked = false;
  try {
    await resolveMediaAccessUrl(key1, 'workspace_beta');
  } catch (err: any) {
    if (err.message.includes('Unauthorized cross-client access')) {
      crossTenantBlocked = true;
    }
  }
  assert(crossTenantBlocked, 'Cross-client access attempt by workspace_beta threw Unauthorized error');

  // -------------------------------------------------------------
  // TEST 4: Presigned URL Generation (Mock Configured Environment)
  // -------------------------------------------------------------
  process.env.R2_ACCOUNT_ID = 'test_acc_123456';
  process.env.R2_ACCESS_KEY_ID = 'test_key_id';
  process.env.R2_SECRET_ACCESS_KEY = 'test_secret_key_abcdef1234567890';
  process.env.R2_BUCKET_NAME = 'test-private-media-bucket';

  assert(isR2Configured() === true, 'isR2Configured() returns true when R2 env vars are present');

  const uploadResult = await getPresignedUploadUrl('workspace_alpha', 'user_video.mp4', 'video/mp4', 900);
  assert(
    uploadResult.uploadUrl.includes('test_acc_123456.r2.cloudflarestorage.com') &&
      uploadResult.uploadUrl.includes('X-Amz-Signature'),
    'getPresignedUploadUrl generates valid S3/R2 presigned HTTP PUT URL'
  );

  const downloadUrl = await getPresignedDownloadUrl(uploadResult.objectKey, 3600);
  assert(
    downloadUrl.includes('test_acc_123456.r2.cloudflarestorage.com') &&
      downloadUrl.includes('X-Amz-Algorithm=AWS4-HMAC-SHA256') &&
      downloadUrl.includes('X-Amz-Signature'),
    'getPresignedDownloadUrl generates valid short-lived presigned HTTP GET URL'
  );

  // -------------------------------------------------------------
  // TEST 5: Backward Compatibility for Local Media URLs
  // -------------------------------------------------------------
  const localPath = '/uploads/178955_local_video.mp4';
  const resolvedLocal = await resolveMediaAccessUrl(localPath, 'workspace_alpha');
  assert(resolvedLocal === localPath, 'Local upload path returns unchanged for backward compatibility');

  console.log(`\n=== PHASE 2 R2 SECURITY VERIFICATION: ${testPassedCount}/${totalTests} TESTS PASSED ===`);
}

runPhase2SecurityTests().catch((err) => {
  console.error('Phase 2 Security Test Error:', err);
  process.exit(1);
});
