import assert from 'assert';
import prisma from '../src/lib/prisma';
import {
  createMetaAuthorizationUrl,
  consumeMetaOAuthState,
  createMetaAccountSelection,
  getMetaSelectionView,
  connectSelectedMetaAccounts,
  MetaOAuthError,
} from '../src/lib/meta-oauth';

async function runMetaOAuthPrismaTests() {
  console.log('=== RUNNING META OAUTH PRISMA REFACTOR TESTS ===\n');

  // 1. Get test user and workspace
  let user = await prisma.user.findFirst();
  let workspace = await prisma.workspace.findFirst();
  assert.ok(user && workspace, 'User and workspace must exist in test database');

  const session = {
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    systemRole: user.systemRole,
  };

  const otherSession = {
    userId: 'other_user_id',
    workspaceId: 'other_workspace_id',
    email: 'other@example.com',
    name: 'Other User',
    systemRole: 'USER',
  };

  // -------------------------------------------------------------
  // TEST 1: Meta OAuth State Storage via Prisma Client
  // -------------------------------------------------------------
  console.log('[Test 1] Testing Meta OAuth state creation & storage via Prisma Client...');
  const originalAppId = process.env.META_APP_ID;
  const originalLoginConfigId = process.env.META_LOGIN_CONFIG_ID;
  const originalRedirectUri = process.env.META_REDIRECT_URI;

  process.env.META_APP_ID = 'test_meta_app_id';
  process.env.META_LOGIN_CONFIG_ID = 'test_meta_login_config_id';
  process.env.META_REDIRECT_URI = 'http://localhost:3000/api/oauth/meta/callback';

  let authUrl = '';
  try {
    authUrl = await createMetaAuthorizationUrl(session);
  } finally {
    process.env.META_APP_ID = originalAppId;
    process.env.META_LOGIN_CONFIG_ID = originalLoginConfigId;
    process.env.META_REDIRECT_URI = originalRedirectUri;
  }

  const parsedUrl = new URL(authUrl);
  const stateFromUrl = parsedUrl.searchParams.get('state');
  assert.ok(stateFromUrl, 'State parameter must be present in authUrl');

  // Verify record in Prisma MetaOAuthState model
  const statesInDb = await prisma.metaOAuthState.findMany({
    where: { userId: session.userId, workspaceId: session.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  assert.strictEqual(statesInDb.length, 1, 'State record must exist in MetaOAuthState table');
  assert.strictEqual(statesInDb[0].consumedAt, null, 'State must not be consumed initially');
  console.log('✅ Test 1 Passed: Meta OAuth state created and verified in database.\n');

  // -------------------------------------------------------------
  // TEST 2: Consume State with Prisma Client & Security Checks
  // -------------------------------------------------------------
  console.log('[Test 2] Testing state consumption & session validation...');

  // 2a. Wrong session
  await assert.rejects(
    async () => {
      await consumeMetaOAuthState(stateFromUrl!, otherSession);
    },
    (err: any) => {
      assert.strictEqual(err.code, 'META_STATE_INVALID');
      return true;
    },
    'Mismatched session must be rejected'
  );

  // 2b. Valid consumption
  const consumedRow = await consumeMetaOAuthState(stateFromUrl!, session);
  assert.ok(consumedRow.consumedAt, 'Consumed state must have consumedAt timestamp');

  // 2c. Replay / already used state
  await assert.rejects(
    async () => {
      await consumeMetaOAuthState(stateFromUrl!, session);
    },
    (err: any) => {
      assert.strictEqual(err.code, 'META_STATE_INVALID');
      return true;
    },
    'Replay of already consumed state must be rejected'
  );
  console.log('✅ Test 2 Passed: State consumption, security match, and replay protection verified.\n');

  // -------------------------------------------------------------
  // TEST 3: Meta Account Selection via Prisma Client
  // -------------------------------------------------------------
  console.log('[Test 3] Testing Meta Account Selection creation & retrieval...');

  const mockDiscoveredAccounts = [
    {
      id: 'FACEBOOK:page_12345',
      platform: 'FACEBOOK' as const,
      platformAccountId: 'page_12345',
      name: 'Test Business Page',
      username: 'test_biz_page',
      profileImageUrl: 'https://example.com/avatar.jpg',
      encryptedAccessToken: 'enc_token_123',
      expiresAt: null,
      scope: 'pages_show_list',
    },
  ];

  const selectionToken = await createMetaAccountSelection(session, mockDiscoveredAccounts);
  assert.ok(selectionToken, 'Selection token must be generated');

  const selectionView = await getMetaSelectionView(selectionToken, session);
  assert.strictEqual(selectionView.accounts.length, 1);
  assert.strictEqual(selectionView.accounts[0].name, 'Test Business Page');
  assert.strictEqual(selectionView.accounts[0].alreadyConnected, false);
  console.log('✅ Test 3 Passed: Meta Account Selection created & parsed via Prisma.\n');

  // -------------------------------------------------------------
  // TEST 4: Cleanup & Data Integrity Verification
  // -------------------------------------------------------------
  console.log('[Test 4] Cleaning up test records & asserting database integrity...');
  await prisma.metaOAuthState.deleteMany({
    where: { userId: session.userId },
  });
  await prisma.metaOAuthSelection.deleteMany({
    where: { userId: session.userId },
  });

  // Verify TikTok and other records are intact
  const tiktokAccounts = await prisma.socialAccount.findMany({
    where: { platform: 'TIKTOK' },
  });
  console.log(`- TikTok accounts count in DB: ${tiktokAccounts.length}`);
  assert.ok(tiktokAccounts.some((a) => a.username === 'salmaneditz25'), 'TikTok account @salmaneditz25 must remain intact');
  console.log('✅ Test 4 Passed: All test records cleaned up, @salmaneditz25 preserved.\n');

  console.log('=== ALL META OAUTH PRISMA REFACTOR TESTS PASSED (4/4) ===');
}

runMetaOAuthPrismaTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
