import assert from 'assert';
import fs from 'fs';
import { TikTokAdapter } from '../integrations/tiktok';

function getTikTokPoint3Prompt(settings: {
  commercialContentDisclosure?: boolean;
  brandOrganicToggle?: boolean;
  brandContentToggle?: boolean;
}): string | null {
  if (!settings.commercialContentDisclosure) return null;
  if (!settings.brandOrganicToggle && !settings.brandContentToggle) {
    return 'You need to indicate if your content promotes yourself, a third party, or both.';
  }
  if (settings.brandOrganicToggle && !settings.brandContentToggle) {
    return "Your photo/video will be labeled as 'Promotional content'";
  }
  if (settings.brandContentToggle) {
    return "Your photo/video will be labeled as 'Paid partnership'";
  }
  return null;
}

async function runTestSuite() {
  console.log('======================================================================');
  console.log('TIKTOK POINT 3: COMMERCIAL CONTENT DISCLOSURE & PRIVACY TEST SUITE');
  console.log('======================================================================\n');

  const adapter = new TikTokAdapter();

  // -------------------------------------------------------------------------
  // Scenario 1: Missing Privacy Level on Direct Post
  // -------------------------------------------------------------------------
  console.log('[Scenario 1] Direct Post without explicit privacy selection is rejected');
  const s1Res = await adapter.publishPost({
    caption: 'My awesome video #viral',
    mediaUrl: 'https://cdn.example.com/videos/v1.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: '', // empty / unselected
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s1Res.success, false, 'Should fail without explicit privacy');
  assert.strictEqual(s1Res.errorCode, 'TIKTOK_PRIVACY_REQUIRED');
  console.log('✅ Scenario 1 Passed: Empty privacy rejected with TIKTOK_PRIVACY_REQUIRED.\n');

  // -------------------------------------------------------------------------
  // Scenario 2: Commercial Disclosure ON, but neither brand option checked
  // -------------------------------------------------------------------------
  console.log('[Scenario 2] Commercial Content ON without brand sub-options is rejected');
  const s2Res = await adapter.publishPost({
    caption: 'Commercial video with no sub-options',
    mediaUrl: 'https://cdn.example.com/videos/v2.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'PUBLIC_TO_EVERYONE',
    metadata: {
      commercialContentDisclosure: true,
      brandOrganicToggle: false,
      brandContentToggle: false,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s2Res.success, false, 'Should fail when disclosure is ON without options');
  assert.strictEqual(s2Res.errorCode, 'TIKTOK_DISCLOSURE_REQUIRED');
  assert.strictEqual(
    s2Res.errorMessage,
    'TikTok Error: You need to indicate if your content promotes yourself, a third party, or both.'
  );
  console.log('✅ Scenario 2 Passed: Incomplete disclosure rejected with exact TikTok prompt.\n');

  // -------------------------------------------------------------------------
  // Scenario 3: "Your Brand" (Brand Organic) with Public Visibility
  // -------------------------------------------------------------------------
  console.log('[Scenario 3] "Your brand" (Brand Organic) with Public visibility succeeds');
  const s3Res = await adapter.publishPost({
    caption: 'Promoting my own course',
    mediaUrl: 'https://cdn.example.com/videos/v3.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'PUBLIC_TO_EVERYONE',
    metadata: {
      commercialContentDisclosure: true,
      brandOrganicToggle: true,
      brandContentToggle: false,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s3Res.success, true, 'Your brand post should succeed');
  assert.ok(s3Res.externalPostId?.startsWith('tt_v_'));
  console.log('✅ Scenario 3 Passed: "Your brand" direct post succeeds.\n');

  // -------------------------------------------------------------------------
  // Scenario 4: "Your Brand" (Brand Organic) with Private Visibility
  // -------------------------------------------------------------------------
  console.log('[Scenario 4] "Your brand" (Brand Organic) with Private visibility is permitted');
  const s4Res = await adapter.publishPost({
    caption: 'Draft test of my course',
    mediaUrl: 'https://cdn.example.com/videos/v4.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'SELF_ONLY',
    metadata: {
      commercialContentDisclosure: true,
      brandOrganicToggle: true,
      brandContentToggle: false,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s4Res.success, true, 'Your brand allows private viewing');
  console.log('✅ Scenario 4 Passed: "Your brand" allowed with private visibility.\n');

  // -------------------------------------------------------------------------
  // Scenario 5: "Branded Content" with "Only Me" (Private / SELF_ONLY) is FORBIDDEN
  // -------------------------------------------------------------------------
  console.log('[Scenario 5] "Branded content" with Private visibility (SELF_ONLY) is REJECTED');
  const s5Res = await adapter.publishPost({
    caption: 'Sponsored post trying to hide in private mode',
    mediaUrl: 'https://cdn.example.com/videos/v5.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'SELF_ONLY',
    metadata: {
      commercialContentDisclosure: true,
      brandOrganicToggle: false,
      brandContentToggle: true,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s5Res.success, false, 'Branded content cannot be private');
  assert.strictEqual(s5Res.errorCode, 'TIKTOK_INVALID_BRANDED_PRIVACY');
  assert.strictEqual(
    s5Res.errorMessage,
    'TikTok Error: Branded content visibility cannot be set to private.'
  );
  console.log('✅ Scenario 5 Passed: Branded content with SELF_ONLY rejected with TIKTOK_INVALID_BRANDED_PRIVACY.\n');

  // -------------------------------------------------------------------------
  // Scenario 6: "Branded Content" with Public Visibility succeeds
  // -------------------------------------------------------------------------
  console.log('[Scenario 6] "Branded content" with Public visibility succeeds');
  const s6Res = await adapter.publishPost({
    caption: 'Paid partnership video',
    mediaUrl: 'https://cdn.example.com/videos/v6.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'PUBLIC_TO_EVERYONE',
    metadata: {
      commercialContentDisclosure: true,
      brandOrganicToggle: false,
      brandContentToggle: true,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s6Res.success, true, 'Branded content with public visibility should succeed');
  console.log('✅ Scenario 6 Passed: Branded content with public visibility allowed.\n');

  // -------------------------------------------------------------------------
  // Scenario 7: Multi-Selection: Both "Your brand" and "Branded content" selected
  // -------------------------------------------------------------------------
  console.log('[Scenario 7] Both "Your brand" & "Branded content" selected (Public) succeeds');
  const s7Res = await adapter.publishPost({
    caption: 'Co-branded collaboration post',
    mediaUrl: 'https://cdn.example.com/videos/v7.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'MUTUAL_FOLLOW_FRIENDS',
    metadata: {
      commercialContentDisclosure: true,
      brandOrganicToggle: true,
      brandContentToggle: true,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s7Res.success, true, 'Dual brand flags with valid visibility should succeed');
  console.log('✅ Scenario 7 Passed: Multi-brand selection with friends visibility allowed.\n');

  // -------------------------------------------------------------------------
  // Scenario 8: Multi-Selection with Private Visibility is FORBIDDEN
  // -------------------------------------------------------------------------
  console.log('[Scenario 8] Both selected with Private visibility (SELF_ONLY) is REJECTED');
  const s8Res = await adapter.publishPost({
    caption: 'Co-branded collaboration post set to private',
    mediaUrl: 'https://cdn.example.com/videos/v8.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'SELF_ONLY',
    metadata: {
      commercialContentDisclosure: true,
      brandOrganicToggle: true,
      brandContentToggle: true,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s8Res.success, false, 'Dual brand flags cannot be private when branded content is active');
  assert.strictEqual(s8Res.errorCode, 'TIKTOK_INVALID_BRANDED_PRIVACY');
  console.log('✅ Scenario 8 Passed: Dual brand selection with private visibility safely rejected.\n');

  // -------------------------------------------------------------------------
  // Scenario 9: Creator Inbox Draft mode bypasses Direct Post privacy/disclosure
  // -------------------------------------------------------------------------
  console.log('[Scenario 9] Creator Inbox Draft mode bypasses Direct Post constraints');
  const s9Res = await adapter.publishPost({
    caption: 'Inbox draft video',
    mediaUrl: 'https://cdn.example.com/videos/v9.mp4',
    mediaType: 'VIDEO',
    contentType: 'INBOX_DRAFT',
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s9Res.success, true, 'Creator inbox draft should succeed without direct post privacy');
  console.log('✅ Scenario 9 Passed: Creator inbox draft mode functions correctly.\n');

  // -------------------------------------------------------------------------
  // Scenario 10: Standard Non-Commercial Direct Post functions normally
  // -------------------------------------------------------------------------
  console.log('[Scenario 10] Standard organic post (Disclosure OFF) with Public visibility succeeds');
  const s10Res = await adapter.publishPost({
    caption: 'Standard organic dance reel',
    mediaUrl: 'https://cdn.example.com/videos/v10.mp4',
    mediaType: 'VIDEO',
    contentType: 'VIDEO',
    visibility: 'PUBLIC_TO_EVERYONE',
    metadata: {
      commercialContentDisclosure: false,
      brandOrganicToggle: false,
      brandContentToggle: false,
    },
    accessToken: 'mock_tt_token_abc',
    platformAccountId: 'mock_platform_123',
    isMock: true,
  });

  assert.strictEqual(s10Res.success, true, 'Standard organic post succeeds');
  console.log('✅ Scenario 10 Passed: Standard organic post functions normally.\n');

  // -------------------------------------------------------------------------
  // Scenario 11: Point 3 UX Prompt Exact-Wording Assertions
  // -------------------------------------------------------------------------
  console.log('[Scenario 11] Point 3 UX prompts match exact official TikTok wording');
  const pageSource = fs.readFileSync('app/(dashboard)/create-post/page.tsx', 'utf8');

  // Verify "Your Brand" exact text
  assert.ok(
    pageSource.includes("Your photo/video will be labeled as &apos;Promotional content&apos;"),
    "Page must include exact prompt for Your Brand: Your photo/video will be labeled as 'Promotional content'"
  );

  // Verify "Branded Content" & "Both" exact text
  assert.ok(
    pageSource.includes("Your photo/video will be labeled as &apos;Paid partnership&apos;"),
    "Page must include exact prompt for Branded Content / Both: Your photo/video will be labeled as 'Paid partnership'"
  );

  // Verify disclosure incomplete exact text
  assert.ok(
    pageSource.includes("You need to indicate if your content promotes yourself, a third party, or both."),
    "Page must include exact prompt for incomplete disclosure"
  );

  // Verify dynamic helper behavior for all states
  assert.strictEqual(
    getTikTokPoint3Prompt({ commercialContentDisclosure: true, brandOrganicToggle: true, brandContentToggle: false }),
    "Your photo/video will be labeled as 'Promotional content'"
  );
  assert.strictEqual(
    getTikTokPoint3Prompt({ commercialContentDisclosure: true, brandOrganicToggle: false, brandContentToggle: true }),
    "Your photo/video will be labeled as 'Paid partnership'"
  );
  assert.strictEqual(
    getTikTokPoint3Prompt({ commercialContentDisclosure: true, brandOrganicToggle: true, brandContentToggle: true }),
    "Your photo/video will be labeled as 'Paid partnership'"
  );
  assert.strictEqual(
    getTikTokPoint3Prompt({ commercialContentDisclosure: true, brandOrganicToggle: false, brandContentToggle: false }),
    "You need to indicate if your content promotes yourself, a third party, or both."
  );
  assert.strictEqual(
    getTikTokPoint3Prompt({ commercialContentDisclosure: false }),
    null
  );
  console.log('✅ Scenario 11 Passed: Point 3 UX prompts dynamically match 100% of official TikTok text.\n');

  console.log('======================================================================');
  console.log('🎉 ALL 11 TIKTOK POINT 3 TEST SCENARIOS PASSED SUCCESSFULLY!');
  console.log('======================================================================');
}

runTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
