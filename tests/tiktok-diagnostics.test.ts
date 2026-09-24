import assert from 'assert';
import { TikTokAdapter } from '../src/integrations/tiktok';

async function runTests() {
  console.log('Running TikTok Diagnostics & File Upload Tests...');
  const adapter = new TikTokAdapter();

  // Test 1: Mock account simulation
  console.log('Test 1: Mock account simulation...');
  const mockRes = await adapter.publishPost({
    caption: 'Test video caption',
    mediaUrl: 'https://test-bucket.r2.cloudflarestorage.com/workspaces/ws1/videos/test.mp4',
    mediaType: 'VIDEO',
    contentType: 'POST',
    visibility: 'PUBLIC',
    accessToken: 'mock_access_token_123',
    platformAccountId: 'mock_platform_acc_123',
    isMock: true,
  });

  assert.strictEqual(mockRes.success, true, 'Mock publish should succeed');
  assert.strictEqual(mockRes.isMockSimulation, true, 'Should be marked as mock simulation');
  assert.ok(mockRes.externalPostId?.includes('tt_v_'), 'Should contain mock post ID format');
  console.log('Test 1 Passed!');

  // Test 2: Real OAuth account with remote media host & secret redaction
  console.log('Test 2: Real OAuth account error handling & credential redaction...');
  const realRes = await adapter.publishPost({
    caption: 'Diagnostic test post',
    mediaUrl: 'https://pub-test12345.r2.dev/workspaces/ws1/videos/sample.mp4',
    mediaType: 'VIDEO',
    contentType: 'POST',
    visibility: 'PUBLIC',
    accessToken: 'act.test_invalid_access_token_secret_123',
    platformAccountId: 'real_acc_id_999',
    isMock: false,
  });

  assert.strictEqual(realRes.success, false, 'Invalid real token should fail cleanly');
  assert.ok(realRes.errorMessage, 'Error message should be present');
  assert.strictEqual(
    realRes.errorMessage.includes('act.test_invalid_access_token_secret_123'),
    false,
    'Access token must NOT be exposed in error message'
  );
  console.log('Test 2 Passed!');

  console.log('ALL TIKTOK DIAGNOSTIC TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
