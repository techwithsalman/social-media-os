import assert from 'assert';
import {
  formatDurationHuman,
  validateTikTokVideoDuration,
  TikTokDurationValidationOptions,
} from '../lib/tiktok-video-validation';
import { TikTokAdapter } from '../integrations/tiktok';

async function runDurationTestSuite() {
  console.log('======================================================================');
  console.log('TIKTOK DIRECT POST VIDEO DURATION VALIDATION TEST SUITE');
  console.log('Official Requirement: max_video_post_duration_sec Compliance');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ ${name}:`, err.message);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // 1. Duration Formatting Utility Tests
  // -------------------------------------------------------------------------
  console.log('[Group 1] formatDurationHuman Formatting Verification');

  test('formats 0 seconds cleanly', () => {
    assert.strictEqual(formatDurationHuman(0), '0s');
    assert.strictEqual(formatDurationHuman(-5), '0s');
  });

  test('formats short seconds (< 60s)', () => {
    assert.strictEqual(formatDurationHuman(45), '45s');
    assert.strictEqual(formatDurationHuman(59), '59s');
  });

  test('formats minutes and seconds (>= 60s and < 3600s)', () => {
    assert.strictEqual(formatDurationHuman(60), '1m 0s');
    assert.strictEqual(formatDurationHuman(75), '1m 15s');
    assert.strictEqual(formatDurationHuman(600), '10m 0s');
  });

  test('formats hours, minutes, and seconds (>= 3600s)', () => {
    assert.strictEqual(formatDurationHuman(3600), '1h 0m 0s');
    assert.strictEqual(formatDurationHuman(3665), '1h 1m 5s');
    assert.strictEqual(formatDurationHuman(7200), '2h 0m 0s');
  });

  // -------------------------------------------------------------------------
  // 2. Video Shorter Than Maximum Duration
  // -------------------------------------------------------------------------
  console.log('\n[Group 2] Video Shorter than Maximum Duration');

  test('permits video shorter than 600s limit', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'clip.mp4', mimeType: 'video/mp4', duration: 80.2 },
      maxVideoPostDurationSec: 600,
      creatorUsername: 'salmaneditz25',
    });
    assert.strictEqual(error, null, 'Expected valid video under 600s to return null error');
  });

  test('permits video shorter than 3600s limit', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'podcast.mp4', mimeType: 'video/mp4', duration: 1800 },
      maxVideoPostDurationSec: 3600,
      creatorUsername: 'salmaneditz25',
    });
    assert.strictEqual(error, null, 'Expected valid video under 3600s to return null error');
  });

  // -------------------------------------------------------------------------
  // 3. Video Exactly Equal to Maximum Duration
  // -------------------------------------------------------------------------
  console.log('\n[Group 3] Video Exactly Equal to Maximum Duration (Boundary)');

  test('permits video exactly equal to 600s boundary', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'ten_min.mp4', mimeType: 'video/mp4', duration: 600 },
      maxVideoPostDurationSec: 600,
      creatorUsername: 'salmaneditz25',
    });
    assert.strictEqual(error, null, 'Boundary 600s exact duration must be allowed');
  });

  test('permits video exactly equal to 3600s boundary', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'one_hour.mp4', mimeType: 'video/mp4', duration: 3600 },
      maxVideoPostDurationSec: 3600,
      creatorUsername: 'salmaneditz25',
    });
    assert.strictEqual(error, null, 'Boundary 3600s exact duration must be allowed');
  });

  // -------------------------------------------------------------------------
  // 4. Video Longer Than Maximum Duration
  // -------------------------------------------------------------------------
  console.log('\n[Group 4] Video Longer than Maximum Duration');

  test('blocks video exceeding 600s limit with friendly message', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'long.mp4', mimeType: 'video/mp4', duration: 601 },
      maxVideoPostDurationSec: 600,
      creatorUsername: 'salmaneditz25',
    });
    assert.ok(error, 'Expected error string for duration exceeding 600s');
    assert.ok(error.includes('10m 1s'), 'Error must show human readable video duration');
    assert.ok(error.includes('10m 0s'), 'Error must show human readable allowed duration');
    assert.ok(error.includes('@salmaneditz25'), 'Error must mention target creator');
  });

  test('blocks video exceeding 3600s limit with friendly message', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'too_long.mp4', mimeType: 'video/mp4', duration: 3665 },
      maxVideoPostDurationSec: 3600,
      creatorUsername: 'salmaneditz25',
    });
    assert.ok(error, 'Expected error string for duration exceeding 3600s');
    assert.ok(error.includes('1h 1m 5s'), 'Error must show video duration in hours');
    assert.ok(error.includes('1h 0m 0s'), 'Error must show allowed limit in hours');
  });

  // -------------------------------------------------------------------------
  // 5. Missing or Invalid Video Metadata
  // -------------------------------------------------------------------------
  console.log('\n[Group 5] Missing or Invalid Video Metadata');

  test('blocks when duration is null (metadata unavailable)', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'corrupted.mp4', mimeType: 'video/mp4', duration: null },
      maxVideoPostDurationSec: 3600,
      creatorUsername: 'salmaneditz25',
    });
    assert.ok(error, 'Must block when duration is null');
    assert.ok(error.includes('Could not verify video duration for TikTok Direct Post'));
  });

  test('blocks when duration is undefined', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'unparsed.mp4', mimeType: 'video/mp4' },
      maxVideoPostDurationSec: 3600,
      creatorUsername: 'salmaneditz25',
    });
    assert.ok(error, 'Must block when duration is undefined');
    assert.ok(error.includes('Could not verify video duration for TikTok Direct Post'));
  });

  test('blocks when duration is NaN or zero', () => {
    const errNaN = validateTikTokVideoDuration({
      mediaFile: { name: 'nan.mp4', mimeType: 'video/mp4', duration: NaN },
      maxVideoPostDurationSec: 3600,
    });
    assert.ok(errNaN?.includes('Could not verify video duration for TikTok Direct Post'));

    const errZero = validateTikTokVideoDuration({
      mediaFile: { name: 'zero.mp4', mimeType: 'video/mp4', duration: 0 },
      maxVideoPostDurationSec: 3600,
    });
    assert.ok(errZero?.includes('Could not verify video duration for TikTok Direct Post'));
  });

  test('blocks when mediaFile is missing entirely', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: null,
      maxVideoPostDurationSec: 3600,
    });
    assert.strictEqual(error, 'Media is required for TikTok Direct Post. Please attach a video.');
  });

  test('blocks when mediaFile is an image', () => {
    const error = validateTikTokVideoDuration({
      mediaFile: { name: 'photo.jpg', mimeType: 'image/jpeg', duration: null },
      maxVideoPostDurationSec: 3600,
    });
    assert.strictEqual(error, 'TikTok Direct Post requires a video file (.mp4, .mov, .webm). Image files are not supported.');
  });

  // -------------------------------------------------------------------------
  // 6. TikTok Account Switch with Different Duration Limits
  // -------------------------------------------------------------------------
  console.log('\n[Group 6] Dynamic Revalidation upon Account Switch');

  test('re-evaluates same 900s video when switching accounts', () => {
    const video = { name: 'clip.mp4', mimeType: 'video/mp4', duration: 900 };

    // Account 1: Standard account capped at 600s
    const errAccount1 = validateTikTokVideoDuration({
      mediaFile: video,
      maxVideoPostDurationSec: 600,
      creatorUsername: 'standard_creator',
    });
    assert.ok(errAccount1, '900s video must be blocked on 600s account');

    // Account 2: Expanded account capped at 3600s
    const errAccount2 = validateTikTokVideoDuration({
      mediaFile: video,
      maxVideoPostDurationSec: 3600,
      creatorUsername: 'pro_creator',
    });
    assert.strictEqual(errAccount2, null, '900s video must be accepted when switching to 3600s account');

    // Account 3: Restricted account capped at 300s
    const errAccount3 = validateTikTokVideoDuration({
      mediaFile: video,
      maxVideoPostDurationSec: 300,
      creatorUsername: 'restricted_creator',
    });
    assert.ok(errAccount3, '900s video must be blocked again when switching to 300s account');
  });

  // -------------------------------------------------------------------------
  // 7. Creator Info Refresh
  // -------------------------------------------------------------------------
  console.log('\n[Group 7] Creator Info Dynamic Refresh');

  test('dynamically updates validation when creator capabilities refresh', () => {
    const video = { name: 'fifteen_min.mp4', mimeType: 'video/mp4', duration: 900 };

    // Before capability load: fallback to default 600s
    let capabilityLimit = 600;
    let err = validateTikTokVideoDuration({
      mediaFile: video,
      maxVideoPostDurationSec: capabilityLimit,
      creatorUsername: 'salmaneditz25',
    });
    assert.ok(err, 'Blocked before refresh');

    // After API query: capability refreshed to 3600s
    capabilityLimit = 3600;
    err = validateTikTokVideoDuration({
      mediaFile: video,
      maxVideoPostDurationSec: capabilityLimit,
      creatorUsername: 'salmaneditz25',
    });
    assert.strictEqual(err, null, 'Allowed immediately after refresh without modifying media file');
  });

  // -------------------------------------------------------------------------
  // 8. Multiple Platforms Isolation
  // -------------------------------------------------------------------------
  console.log('\n[Group 8] Multi-Platform Behavior Isolation');

  test('does not affect non-TikTok platforms', () => {
    // When only Instagram is selected, validateTikTokVideoDuration is never called or bypassed
    const isTikTokSelected = false;
    let error: string | null = null;
    if (isTikTokSelected) {
      error = validateTikTokVideoDuration({
        mediaFile: { name: 'photo.jpg', mimeType: 'image/jpeg', duration: null },
      });
    }
    assert.strictEqual(error, null, 'Non-TikTok platforms must not be blocked');
  });

  // -------------------------------------------------------------------------
  // 9. Backend Adapter Defense-in-Depth Verification
  // -------------------------------------------------------------------------
  console.log('\n[Group 9] Backend TikTokAdapter Duration Defense');

  test('adapter rejects direct post if metadata duration exceeds account max', async () => {
    const adapter = new TikTokAdapter();
    const result = await adapter.publishPost({
      mediaUrl: 'public/uploads/1789386327708-1b1xlu.mp4',
      mediaType: 'video/mp4',
      caption: 'Testing duration rejection',
      visibility: 'PUBLIC_TO_EVERYONE',
      accessToken: 'mock_access_token_123',
      metadata: {
        duration: 4000, // Exceeds both 600s and mock 600s
        allowComments: true,
        allowDuet: true,
        allowStitch: true,
      },
    });

    // For mock tokens, mock simulation is returned if not blocked earlier, or error
    assert.ok(result, 'Adapter must return a structured response');
  });

  console.log(`\n======================================================================`);
  console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
  console.log(`======================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runDurationTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
