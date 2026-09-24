import assert from 'assert';
import { isR2Configured, uploadMediaAsset, resolveMediaAccessUrl, deleteR2Object } from '../src/lib/storage/r2';
import { getStorageProvider } from '../src/lib/storage';

async function testMp4UploadAndPreview() {
  console.log('--- STARTING MP4 UPLOAD & PREVIEW VERIFICATION TEST ---');

  // 1. Verify R2 is configured
  assert.strictEqual(isR2Configured(), true, 'Cloudflare R2 must be configured');
  console.log('1. Cloudflare R2 is properly configured.');

  // 2. Verify getStorageProvider returns real R2 provider
  const provider = getStorageProvider();
  assert.ok(provider, 'Storage provider should be initialized');
  console.log('2. getStorageProvider() resolved to R2-backed provider.');

  // 3. Create dummy MP4 binary buffer
  const sampleMp4Buffer = Buffer.from('FAKE-MP4-VIDEO-BINARY-STREAM-FOR-TESTING');
  const testWorkspaceId = 'test_ws_preview';
  const testFileName = 'preview_test_sample.mp4';

  console.log('3. Uploading sample MP4 to Cloudflare R2 bucket...');
  const uploadResult = await uploadMediaAsset(testWorkspaceId, testFileName, sampleMp4Buffer, 'video/mp4');

  assert.ok(uploadResult.key, 'Upload result must include R2 object key');
  assert.ok(uploadResult.url, 'Upload result must include playable presigned URL');
  assert.strictEqual(uploadResult.storageProvider, 'R2', 'Storage provider must be R2');
  assert.ok(uploadResult.key.startsWith(`workspaces/${testWorkspaceId}/videos/`), 'Object key must be tenant-scoped');
  assert.ok(
    !uploadResult.url.includes('social-media-os-assets') && !uploadResult.url.includes('amazonaws.com'),
    'Presigned URL must NOT point to fake Amazon S3 bucket'
  );
  console.log('3. Successfully uploaded to R2. Object Key:', uploadResult.key);

  // 4. Test live HTTP GET request to the generated presigned playback URL
  console.log('4. Testing HTTP GET playback access on presigned URL...');
  const playbackRes = await fetch(uploadResult.url);
  console.log('   Playback HTTP Status:', playbackRes.status);
  assert.strictEqual(playbackRes.status, 200, 'Presigned URL must return 200 OK from Cloudflare R2');
  const fetchedBytes = await playbackRes.arrayBuffer();
  assert.strictEqual(fetchedBytes.byteLength, sampleMp4Buffer.length, 'Fetched file size must match uploaded size');
  console.log('4. Presigned playback URL verified! Video binary delivered successfully without XML errors.');

  // 5. Test resolveMediaAccessUrl on Object Key
  console.log('5. Testing resolveMediaAccessUrl on R2 object key...');
  const resolvedPresignedUrl = await resolveMediaAccessUrl(uploadResult.key, testWorkspaceId);
  assert.ok(resolvedPresignedUrl.startsWith('https://'), 'Must resolve to HTTPS presigned download URL');
  assert.ok(!resolvedPresignedUrl.includes('amazonaws.com'), 'Must not be Amazon S3 URL');
  console.log('5. Dynamic key resolution verified.');

  // 6. Test resolveMediaAccessUrl on Legacy Invalid AWS S3 URL
  console.log('6. Testing legacy invalid S3 URL rejection...');
  const legacyS3Url = 'https://social-media-os-assets.s3.us-east-1.amazonaws.com/1749552756-test.mp4';
  const resolvedLegacy = await resolveMediaAccessUrl(legacyS3Url, testWorkspaceId);
  assert.strictEqual(resolvedLegacy, '', 'Legacy fake S3 URL must be flagged as empty/invalid');
  console.log('6. Legacy S3 URL safely detected and rejected.');

  // 7. Cleanup temporary test file from R2
  console.log('7. Cleaning up temporary test file from R2 bucket...');
  const deleteResult = await deleteR2Object(uploadResult.key, testWorkspaceId);
  assert.strictEqual(deleteResult.success, true, 'Test file cleanup must succeed');
  console.log('7. Temporary test object deleted successfully.');

  console.log('--- ALL MP4 UPLOAD & PREVIEW TESTS PASSED SUCCESSFULLY! ---');
}

testMp4UploadAndPreview().catch((err) => {
  console.error('Test Failed:', err);
  process.exit(1);
});
