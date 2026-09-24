import assert from 'assert';
import prisma from '../src/lib/prisma';
import {
  getTikTokRedirectUri,
  getTikTokEnvironmentInfo,
  createTikTokAuthorizationUrl,
  isTikTokSandbox,
  maskCredential,
} from '../src/lib/tiktok-oauth';

async function runProductionOAuthTests() {
  console.log('=== RUNNING TIKTOK PRODUCTION & SANDBOX OAUTH SPECIFICATION TESTS ===\n');

  // 1. Current Active Environment
  const currentEnvInfo = getTikTokEnvironmentInfo();
  console.log('Current Active TikTok Environment Info:', currentEnvInfo);
  assert.strictEqual(typeof currentEnvInfo.isConfigured, 'boolean');
  assert.strictEqual(typeof currentEnvInfo.redirectUri, 'string');

  // 2. Test Sandbox vs Production detection
  console.log('\n[Test 1] Testing Sandbox vs Production Client Key Detection...');
  assert.strictEqual(isTikTokSandbox(), true, 'Current .env key starts with sb and should be identified as Sandbox');
  console.log('✅ Test 1 Passed: Client key prefix correctly identifies Sandbox.\n');

  // 3. Test exact Redirect URI generation
  console.log('[Test 2] Testing Production Redirect URI Resolution for techwithsalman.online...');
  const originalEnvUri = process.env.TIKTOK_REDIRECT_URI;
  const originalAppUrl = process.env.APP_URL;
  const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  try {
    // 2a. Explicit TIKTOK_REDIRECT_URI
    process.env.TIKTOK_REDIRECT_URI = 'https://techwithsalman.online/tiktok/callback/';
    assert.strictEqual(
      getTikTokRedirectUri(),
      'https://techwithsalman.online/tiktok/callback/',
      'Explicit TIKTOK_REDIRECT_URI must be preserved verbatim'
    );

    // 2b. Derived from APP_URL / NEXT_PUBLIC_APP_URL
    delete process.env.TIKTOK_REDIRECT_URI;
    process.env.APP_URL = 'https://techwithsalman.online';
    process.env.NEXT_PUBLIC_APP_URL = 'https://techwithsalman.online';
    assert.strictEqual(
      getTikTokRedirectUri(),
      'https://techwithsalman.online/tiktok/callback/',
      'APP_URL must generate /tiktok/callback/ with trailing slash'
    );

    // 2c. Derived from APP_URL with trailing slash
    process.env.APP_URL = 'https://techwithsalman.online/';
    process.env.NEXT_PUBLIC_APP_URL = 'https://techwithsalman.online/';
    assert.strictEqual(
      getTikTokRedirectUri(),
      'https://techwithsalman.online/tiktok/callback/',
      'APP_URL with trailing slash must not create double slashes'
    );
  } finally {
    // Restore original
    process.env.TIKTOK_REDIRECT_URI = originalEnvUri;
    process.env.APP_URL = originalAppUrl;
    process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl;
  }
  console.log('✅ Test 2 Passed: Production Redirect URI format for techwithsalman.online is verified.\n');

  // 4. Test Authorization URL format for Production domain
  console.log('[Test 3] Testing Authorization URL with Production HTTPS URI...');
  let user = await prisma.user.findFirst();
  let workspace = await prisma.workspace.findFirst();
  assert.ok(user && workspace, 'User and workspace should exist');

  const session = {
    userId: user.id,
    workspaceId: workspace.id,
    email: user.email,
    name: `${user.firstName} ${user.lastName}`,
    systemRole: user.systemRole,
  };

  try {
    process.env.TIKTOK_REDIRECT_URI = 'https://techwithsalman.online/tiktok/callback/';
    const authUrl = await createTikTokAuthorizationUrl(session);
    const parsed = new URL(authUrl);

    assert.strictEqual(
      parsed.searchParams.get('redirect_uri'),
      'https://techwithsalman.online/tiktok/callback/',
      'redirect_uri in authorization URL must match registered HTTPS URL'
    );

    // Check DB state record
    const stateRecord = await prisma.tikTokOAuthState.findUnique({
      where: { stateHash: parsed.searchParams.get('state')! },
    });
    assert.ok(stateRecord, 'State must exist in DB');
    assert.strictEqual(
      stateRecord?.redirectUri,
      'https://techwithsalman.online/tiktok/callback/',
      'DB state record must store the matching HTTPS redirect URI for token exchange'
    );

    // Cleanup state record
    await prisma.tikTokOAuthState.delete({ where: { id: stateRecord!.id } });
  } finally {
    process.env.TIKTOK_REDIRECT_URI = originalEnvUri;
  }
  console.log('✅ Test 3 Passed: Authorization URL and state tracking preserve HTTPS redirect URI.\n');

  // 5. Database Social Accounts Integrity Check
  console.log('[Test 4] Verifying existing Connected account integrity in DB...');
  const connectedAccounts = await prisma.socialAccount.findMany({
    where: { platform: 'TIKTOK' },
    include: { token: true },
  });

  console.log(`- Connected accounts count: ${connectedAccounts.length}`);
  for (const a of connectedAccounts) {
    console.log(`  * @${a.username} (${a.name}), status=${a.status}, isMock=${a.isMock}, hasToken=${Boolean(a.token)}`);
    assert.strictEqual(a.username, 'salmaneditz25', 'Existing connected username must remain @salmaneditz25');
    assert.strictEqual(a.status, 'CONNECTED', 'Status must remain CONNECTED');
  }
  console.log('✅ Test 4 Passed: Account @salmaneditz25 is 100% preserved.\n');

  console.log('=== ALL PRODUCTION OAUTH SPECIFICATION TESTS PASSED (4/4) ===');
}

runProductionOAuthTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
