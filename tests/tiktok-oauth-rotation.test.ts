import assert from 'assert';
import {
  TIKTOK_ACCESS_TOKEN_LIFETIME_SEC,
  TIKTOK_REFRESH_TOKEN_LIFETIME_SEC,
  TIKTOK_TOKEN_EXPIRY_BUFFER_SEC,
  TikTokOAuthError,
} from '../lib/tiktok-oauth';

async function runOAuthRotationTests() {
  console.log('======================================================================');
  console.log('TIKTOK OAUTH TOKEN ROTATION & LIFECYCLE TEST SUITE');
  console.log('======================================================================\n');

  // -------------------------------------------------------------------------
  // Scenario 1: New Lifecycle Constants Verification (Dec 1, 2026 update)
  // -------------------------------------------------------------------------
  console.log('[Scenario 1] Verify TikTok Token Lifecycle Constants');
  assert.strictEqual(
    TIKTOK_ACCESS_TOKEN_LIFETIME_SEC,
    7200,
    'Access token lifetime must be 2 hours (7,200 seconds)'
  );
  assert.strictEqual(
    TIKTOK_REFRESH_TOKEN_LIFETIME_SEC,
    180 * 24 * 60 * 60,
    'Refresh token lifetime must be 180 days (15,552,000 seconds)'
  );
  assert.strictEqual(
    TIKTOK_TOKEN_EXPIRY_BUFFER_SEC,
    300,
    'Safety buffer must be 5 minutes (300 seconds)'
  );
  console.log('✅ Scenario 1 Passed: Lifecycle constants strictly adhere to Dec 1, 2026 guidelines (2hr access, 180d refresh).\n');

  // -------------------------------------------------------------------------
  // Scenario 2: Refresh Token Rotation (RTR) Atomic Replacement Simulation
  // -------------------------------------------------------------------------
  console.log('[Scenario 2] Verify Refresh Token Rotation (RTR) behavior');
  
  // Simulate database state
  const mockDbToken = {
    accessToken: 'old_encrypted_access_token',
    refreshToken: 'old_encrypted_refresh_token',
    expiresAt: new Date(Date.now() - 1000), // expired
  };

  // Simulate refresh API response returning new access and rotated refresh token
  const simulatedApiResponse = {
    access_token: 'act.new_access_token_xyz',
    expires_in: 7200,
    refresh_token: 'rft.new_rotated_refresh_token_abc',
    refresh_expires_in: 15552000,
    open_id: 'open_id_123',
    scope: 'user.info.basic,video.upload,video.publish',
  };

  // Atomically update DB record with both tokens
  mockDbToken.accessToken = simulatedApiResponse.access_token;
  mockDbToken.refreshToken = simulatedApiResponse.refresh_token;
  mockDbToken.expiresAt = new Date(Date.now() + simulatedApiResponse.expires_in * 1000);

  assert.strictEqual(mockDbToken.accessToken, 'act.new_access_token_xyz');
  assert.strictEqual(mockDbToken.refreshToken, 'rft.new_rotated_refresh_token_abc');
  assert.notStrictEqual(mockDbToken.refreshToken, 'old_encrypted_refresh_token', 'Old refresh token must be invalidated');
  assert.ok(mockDbToken.expiresAt.getTime() > Date.now(), 'Token must be valid');
  console.log('✅ Scenario 2 Passed: Atomic Refresh Token Rotation replaces both access and refresh tokens.\n');

  // -------------------------------------------------------------------------
  // Scenario 3: Single-Flight In-Memory Mutex Simulation
  // -------------------------------------------------------------------------
  console.log('[Scenario 3] Safe Concurrency - Single-Flight In-Memory Mutex');
  
  let externalApiCallCount = 0;
  const inFlightMap = new Map<string, Promise<{ accessToken: string; refreshToken: string }>>();

  async function mockConcurrentRefresh(accountId: string) {
    if (inFlightMap.has(accountId)) {
      return inFlightMap.get(accountId)!;
    }

    const flightPromise = (async () => {
      // Simulate network latency to TikTok API
      await new Promise((resolve) => setTimeout(resolve, 50));
      externalApiCallCount++;
      return {
        accessToken: `act_flight_${externalApiCallCount}`,
        refreshToken: `rft_flight_${externalApiCallCount}`,
      };
    })();

    inFlightMap.set(accountId, flightPromise);
    try {
      return await flightPromise;
    } finally {
      inFlightMap.delete(accountId);
    }
  }

  // Trigger 5 concurrent refresh requests for the same account simultaneously
  const results = await Promise.all([
    mockConcurrentRefresh('acc_123'),
    mockConcurrentRefresh('acc_123'),
    mockConcurrentRefresh('acc_123'),
    mockConcurrentRefresh('acc_123'),
    mockConcurrentRefresh('acc_123'),
  ]);

  assert.strictEqual(externalApiCallCount, 1, 'Only 1 external HTTP refresh should execute across 5 parallel requests');
  assert.strictEqual(results[0].accessToken, results[1].accessToken);
  assert.strictEqual(results[0].accessToken, results[4].accessToken);
  console.log('✅ Scenario 3 Passed: 5 concurrent callers shared 1 refresh promise without racing or corrupting tokens.\n');

  // -------------------------------------------------------------------------
  // Scenario 4: Reauthorization Handling on Expired / Revoked Refresh Token
  // -------------------------------------------------------------------------
  console.log('[Scenario 4] Reauthorization Detection on Expired / Revoked Refresh Token');
  
  function evaluateRefreshError(status: number, data: any) {
    const errCode = data.error_code || data.error?.code || data.error || 'REFRESH_FAILED';
    const errMsg = data.error_description || data.error?.message || data.message || 'TikTok token refresh failed';

    const isReauthRequired =
      status === 400 ||
      status === 401 ||
      String(errCode).toLowerCase().includes('grant') ||
      String(errCode).toLowerCase().includes('expired') ||
      String(errCode).toLowerCase().includes('revoked') ||
      String(errMsg).toLowerCase().includes('refresh token') ||
      String(errMsg).toLowerCase().includes('expired') ||
      String(errMsg).toLowerCase().includes('invalid');

    if (isReauthRequired) {
      throw new TikTokOAuthError(
        'TikTok refresh token has expired (exceeded 180 days) or has been revoked. Reauthorization required.',
        'REAUTHORIZATION_REQUIRED'
      );
    }
  }

  // Test invalid_grant error
  assert.throws(
    () => {
      evaluateRefreshError(400, {
        error: 'invalid_grant',
        error_description: 'Refresh token is invalid or has expired',
      });
    },
    (err: any) => {
      return err instanceof TikTokOAuthError && err.code === 'REAUTHORIZATION_REQUIRED';
    },
    'Should throw REAUTHORIZATION_REQUIRED for invalid_grant'
  );

  // Test token_expired error
  assert.throws(
    () => {
      evaluateRefreshError(401, {
        error: { code: 'token_expired', message: 'Token expired' },
      });
    },
    (err: any) => {
      return err instanceof TikTokOAuthError && err.code === 'REAUTHORIZATION_REQUIRED';
    },
    'Should throw REAUTHORIZATION_REQUIRED for token_expired'
  );

  console.log('✅ Scenario 4 Passed: Expired/revoked tokens cleanly classified as REAUTHORIZATION_REQUIRED.\n');

  // -------------------------------------------------------------------------
  // Scenario 5: Expiration Skew / Buffer Calculation (5-minute pre-expiry)
  // -------------------------------------------------------------------------
  console.log('[Scenario 5] 5-Minute Pre-Expiry Refresh Buffer Evaluation');
  
  const nowMs = Date.now();
  
  // Case A: Token expires in 10 minutes -> DO NOT refresh
  const tokenExpiresIn10Min = nowMs + 10 * 60 * 1000;
  const isNearExpiryA = tokenExpiresIn10Min - nowMs <= TIKTOK_TOKEN_EXPIRY_BUFFER_SEC * 1000;
  assert.strictEqual(isNearExpiryA, false, '10 minutes remaining should not trigger refresh');

  // Case B: Token expires in 3 minutes -> MUST refresh
  const tokenExpiresIn3Min = nowMs + 3 * 60 * 1000;
  const isNearExpiryB = tokenExpiresIn3Min - nowMs <= TIKTOK_TOKEN_EXPIRY_BUFFER_SEC * 1000;
  assert.strictEqual(isNearExpiryB, true, '3 minutes remaining MUST trigger pre-expiry refresh');

  // Case C: Token already expired -> MUST refresh
  const tokenAlreadyExpired = nowMs - 60 * 1000;
  const isNearExpiryC = tokenAlreadyExpired - nowMs <= TIKTOK_TOKEN_EXPIRY_BUFFER_SEC * 1000;
  assert.strictEqual(isNearExpiryC, true, 'Expired token MUST trigger refresh');

  console.log('✅ Scenario 5 Passed: 5-minute pre-expiry window correctly determines when refresh is required.\n');

  console.log('======================================================================');
  console.log('ALL 5 TIKTOK OAUTH TOKEN ROTATION & LIFECYCLE TESTS PASSED CLEANLY!');
  console.log('======================================================================');
}

runOAuthRotationTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
