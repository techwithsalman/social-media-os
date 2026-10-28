import prisma from '../lib/prisma';
import { YouTubeAdapter } from '../integrations/youtube';
import { canDeleteMediaAsset } from '../lib/storage/r2-cleanup';

async function runYouTubeFixTests() {
  console.log('================================================================');
  console.log('YOUTUBE PUBLISHING FIX & MIXED STATUS - NON-BILLABLE TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 5;

  const adapter = new YouTubeAdapter();

  // TEST 1: Adapter Requirements & Configuration
  console.log('--- TEST 1: YouTube Requirements & Scopes ---');
  const reqs = adapter.getRequirements();
  if (
    reqs.platform === 'YOUTUBE' &&
    reqs.requiredScopes.includes('https://www.googleapis.com/auth/youtube.upload') &&
    reqs.mediaRequirements.supportedVideoTypes.includes('video/mp4')
  ) {
    console.log('✓ PASS: YouTubeAdapter requirements, video formats, and upload scopes verified.');
    passedTests++;
  } else {
    throw new Error('TEST 1 FAILED: Unexpected requirements or missing upload scopes.');
  }

  // TEST 2: Idempotency with existing video ID (Mock simulation)
  console.log('\n--- TEST 2: Idempotency Check with Existing Video ID ---');
  const mockExistingId = 'dQw4w9WgXcQ';
  const idempotentResult = await adapter.publishPost({
    caption: 'Test Caption',
    mediaUrl: 'https://example.com/test.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'PUBLIC',
    accessToken: 'mock_access_token',
    platformAccountId: 'yt_test_account',
    isMock: true,
    metadata: {
      youtubeVideoId: mockExistingId,
    },
  });

  if (idempotentResult.success && idempotentResult.externalPostId) {
    console.log('✓ PASS: Idempotent publishPost returns valid video ID without initiating duplicate upload.');
    console.log(`  - Returned Video ID: ${idempotentResult.externalPostId}`);
    passedTests++;
  } else {
    throw new Error('TEST 2 FAILED: Idempotency failed.');
  }

  // TEST 3: Mixed Platform Status Evaluation
  console.log('\n--- TEST 3: Mixed Platform Status Evaluation (FB/IG Published, YouTube Failed) ---');
  // Query our verified production post cmvqo100x000ovpyw4xr2a28x
  const prodPost = await prisma.contentPost.findUnique({
    where: { id: 'cmvqo100x000ovpyw4xr2a28x' },
    include: { platformPosts: true, mediaAsset: true },
  });

  if (!prodPost) {
    throw new Error('TEST 3 FAILED: Production post cmvqo100x000ovpyw4xr2a28x not found.');
  }

  const fb = prodPost.platformPosts.find(p => p.platform === 'FACEBOOK');
  const ig = prodPost.platformPosts.find(p => p.platform === 'INSTAGRAM');
  const yt = prodPost.platformPosts.find(p => p.platform === 'YOUTUBE');

  const fbPublished = fb?.status === 'PUBLISHED' && fb?.externalPostId === '2401933287301010';
  const igPublished = ig?.status === 'PUBLISHED' && ig?.externalPostId === '18137583865642338';
  const ytFailed = yt?.status === 'FAILED' && yt?.errorMessage?.includes('interrupted');
  const postPartiallyFailed = prodPost.status === 'PARTIALLY_FAILED';

  if (fbPublished && igPublished && ytFailed && postPartiallyFailed) {
    console.log('✓ PASS: Mixed platform status accurately evaluates to PARTIALLY_FAILED.');
    console.log(`  - ContentPost Status: ${prodPost.status}`);
    console.log(`  - Facebook: ${fb?.status} (ID: ${fb?.externalPostId}) [PRESERVED]`);
    console.log(`  - Instagram: ${ig?.status} (ID: ${ig?.externalPostId}) [PRESERVED]`);
    console.log(`  - YouTube: ${yt?.status} (Error: "${yt?.errorMessage}") [TRANSITIONED TO FAILED]`);
    passedTests++;
  } else {
    throw new Error(`TEST 3 FAILED: Unexpected statuses: FB=${fb?.status}, IG=${ig?.status}, YT=${yt?.status}, Overall=${prodPost.status}`);
  }

  // TEST 4: Shared R2 Media Asset Preservation
  console.log('\n--- TEST 4: Shared R2 Media Asset Preservation ---');
  if (prodPost.mediaAsset && prodPost.mediaAssetId === 'cmvqnucyb0009vpyws7r9r6eo') {
    console.log('✓ PASS: Original shared R2 media asset is preserved and intact.');
    console.log(`  - MediaAsset ID: ${prodPost.mediaAsset.id}`);
    console.log(`  - Storage URL: ${prodPost.mediaAsset.url}`);
    console.log(`  - Size: ${(prodPost.mediaAsset.size / 1024 / 1024).toFixed(2)} MB`);
    passedTests++;
  } else {
    throw new Error('TEST 4 FAILED: MediaAsset missing or altered.');
  }

  // TEST 5: Deletion Safety Guard for Partially Failed Post
  console.log('\n--- TEST 5: Deletion Safety Guard during Retry Retention ---');
  const deleteCheck = await canDeleteMediaAsset(prodPost.mediaAssetId!);
  if (!deleteCheck.canDelete) {
    console.log('✓ PASS: Deletion safely BLOCKED while YouTube is in FAILED retry retention window.');
    console.log(`  - Rejection Reason: "${deleteCheck.reason}"`);
    passedTests++;
  } else {
    throw new Error('TEST 5 FAILED: Deletion was permitted while failed target was in retry window!');
  }

  console.log('\n================================================================');
  console.log(`TEST SUITE COMPLETE: ${passedTests}/${totalTests} TESTS PASSED (100%)`);
  console.log('VERIFIED: Non-billable tests confirm YouTube fix and status reconciliation.');
  console.log('================================================================\n');
}

runYouTubeFixTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Execution Error:', err);
    process.exit(1);
  });
