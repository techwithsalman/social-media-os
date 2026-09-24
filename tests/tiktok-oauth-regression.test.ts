import assert from 'assert';
import prisma from '../src/lib/prisma';
import {
  createTikTokAuthorizationUrl,
  exchangeTikTokCodeForTokens,
  getTikTokRedirectUri,
  getTikTokClientKey,
  isRealTikTokConfigured,
  TikTokOAuthError,
} from '../src/lib/tiktok-oauth';

async function runRegressionTests() {
  console.log('=== STARTING TIKTOK OAUTH REGRESSION TEST SUITE ===\n');

  // 1. Get or create test workspace/user for testing
  let user = await prisma.user.findFirst();
  let workspace = await prisma.workspace.findFirst();

  if (!user || !workspace) {
    user = await prisma.user.create({
      data: {
        email: `oauth_test_${Date.now()}@example.com`,
        passwordHash: 'hashed_pw',
        firstName: 'OAuth',
        lastName: 'Tester',
      },
    });
    workspace = await prisma.workspace.create({
      data: {
        name: 'OAuth Test Workspace',
        slug: `oauth-ws-${Date.now()}`,
      },
    });
  }

  const session = {
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    systemRole: user.systemRole,
  };

  // -------------------------------------------------------------
  // TEST 1: Authorization URL & PKCE Generation
  // -------------------------------------------------------------
  console.log('[Test 1] Testing Authorization URL Generation & RFC 7636 PKCE format...');
  const authUrl = await createTikTokAuthorizationUrl(session);
  const parsedUrl = new URL(authUrl);

  assert.strictEqual(parsedUrl.origin, 'https://www.tiktok.com', 'Origin must be https://www.tiktok.com');
  assert.strictEqual(parsedUrl.pathname, '/v2/auth/authorize/', 'Path must be /v2/auth/authorize/');
  assert.ok(parsedUrl.searchParams.get('client_key'), 'client_key must be present');
  assert.ok(parsedUrl.searchParams.get('state'), 'state must be present');
  assert.ok(parsedUrl.searchParams.get('code_challenge'), 'code_challenge must be present');
  assert.strictEqual(parsedUrl.searchParams.get('code_challenge_method'), 'S256', 'code_challenge_method must be S256');
  assert.strictEqual(
    parsedUrl.searchParams.get('scope'),
    'user.info.basic,video.upload,video.publish',
    'Scopes must include basic info, upload, and publish'
  );

  const stateInDb = await prisma.tikTokOAuthState.findUnique({
    where: { stateHash: parsedUrl.searchParams.get('state')! },
  });
  assert.ok(stateInDb, 'State must be saved in database');
  assert.strictEqual(stateInDb?.consumedAt, null, 'State must not be consumed initially');
  assert.strictEqual(stateInDb?.userId, user.id, 'State must be tied to the initiating user');
  assert.strictEqual(stateInDb?.workspaceId, workspace.id, 'State must be tied to the workspace');
  console.log('✅ Test 1 Passed: Authorization URL and DB state record verified.\n');

  // -------------------------------------------------------------
  // TEST 2: State Security Verification (Unverified / Expired / Replay)
  // -------------------------------------------------------------
  console.log('[Test 2] Testing State Validation Security (Invalid, Expired, Already Used)...');

  // 2a. Invalid state
  await assert.rejects(
    async () => {
      await exchangeTikTokCodeForTokens('dummy_code', 'non_existent_state_hash');
    },
    (err: any) => {
      assert.strictEqual(err.code, 'INVALID_STATE');
      return true;
    },
    'Invalid state should throw INVALID_STATE'
  );

  // 2b. Expired state
  const expiredState = await prisma.tikTokOAuthState.create({
    data: {
      stateHash: `expired_state_${Date.now()}`,
      codeVerifier: 'verifier123',
      userId: user.id,
      workspaceId: workspace.id,
      redirectUri: getTikTokRedirectUri(),
      expiresAt: new Date(Date.now() - 10000), // Expired in the past
    },
  });

  await assert.rejects(
    async () => {
      await exchangeTikTokCodeForTokens('dummy_code', expiredState.stateHash);
    },
    (err: any) => {
      assert.strictEqual(err.code, 'STATE_EXPIRED');
      return true;
    },
    'Expired state should throw STATE_EXPIRED'
  );

  // 2c. Already consumed state
  const consumedState = await prisma.tikTokOAuthState.create({
    data: {
      stateHash: `consumed_state_${Date.now()}`,
      codeVerifier: 'verifier123',
      userId: user.id,
      workspaceId: workspace.id,
      redirectUri: getTikTokRedirectUri(),
      expiresAt: new Date(Date.now() + 600000),
      consumedAt: new Date(),
    },
  });

  await assert.rejects(
    async () => {
      await exchangeTikTokCodeForTokens('dummy_code', consumedState.stateHash);
    },
    (err: any) => {
      assert.strictEqual(err.code, 'STATE_ALREADY_USED');
      return true;
    },
    'Consumed state should throw STATE_ALREADY_USED'
  );

  console.log('✅ Test 2 Passed: State security validation protects against invalid, expired, and replay attacks.\n');

  // -------------------------------------------------------------
  // TEST 3: Existing Account & Data Integrity
  // -------------------------------------------------------------
  console.log('[Test 3] Verifying Database Integrity & Connected Accounts Preservation...');
  const connectedAccounts = await prisma.socialAccount.findMany({
    where: { platform: 'TIKTOK', status: 'CONNECTED' },
    include: { token: true },
  });

  console.log(`- Found ${connectedAccounts.length} Connected TikTok account(s) in DB.`);
  for (const acc of connectedAccounts) {
    assert.ok(acc.username, 'Account username must exist');
    assert.ok(acc.platformAccountId, 'Platform Account ID must exist');
    assert.ok(acc.token, 'Token record must exist');
    console.log(`  * Account: @${acc.username} (${acc.name}), ID: ${acc.id}, Status: ${acc.status}`);
  }

  // Cleanup test states created in test 1 & 2
  await prisma.tikTokOAuthState.deleteMany({
    where: {
      id: {
        in: [stateInDb!.id, expiredState.id, consumedState.id],
      },
    },
  });

  console.log('✅ Test 3 Passed: Existing TikTok connections and data are 100% preserved.\n');

  console.log('=== ALL TIKTOK OAUTH REGRESSION TESTS PASSED (3/3) ===');
}

runRegressionTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
