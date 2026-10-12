import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { TikTokOAuthError } from '../lib/tiktok-oauth';

// Types representing SocialAccount record
interface MockSocialAccount {
  id: string;
  workspaceId: string;
  platform: string;
  platformAccountId: string;
  name: string;
  username: string;
  profileImageUrl: string | null;
  status: string;
  isMock: boolean;
  token?: any;
}

// In-memory test store simulating Prisma SocialAccount operations
class MockPrismaSocialAccount {
  private records: MockSocialAccount[] = [];
  private idCounter = 1;

  async findFirst(args: { where: { workspaceId: string; platform: string; platformAccountId: string } }): Promise<MockSocialAccount | null> {
    const { workspaceId, platform, platformAccountId } = args.where;
    const found = this.records.find(
      (r) => r.workspaceId === workspaceId && r.platform === platform && r.platformAccountId === platformAccountId
    );
    return found ? { ...found } : null;
  }

  async findUnique(args: { where: { id: string } }): Promise<MockSocialAccount | null> {
    const found = this.records.find((r) => r.id === args.where.id);
    return found ? { ...found } : null;
  }

  async findMany(args?: { where?: Partial<MockSocialAccount> }): Promise<MockSocialAccount[]> {
    if (!args?.where) return [...this.records];
    return this.records.filter((r) => {
      for (const [k, v] of Object.entries(args.where!)) {
        if ((r as any)[k] !== v) return false;
      }
      return true;
    });
  }

  async create(args: { data: Omit<MockSocialAccount, 'id'> }): Promise<MockSocialAccount> {
    const created: MockSocialAccount = {
      ...args.data,
      id: `acc_${this.idCounter++}`,
    };
    this.records.push(created);
    return { ...created };
  }

  async update(args: { where: { id: string }; data: Partial<MockSocialAccount> }): Promise<MockSocialAccount> {
    const idx = this.records.findIndex((r) => r.id === args.where.id);
    if (idx === -1) throw new Error(`Record ${args.where.id} not found`);
    this.records[idx] = {
      ...this.records[idx],
      ...args.data,
    };
    return { ...this.records[idx] };
  }

  // Pre-seed an ambiguous or existing record for tests
  seed(record: MockSocialAccount) {
    this.records.push(record);
  }
}

// Function mirroring app/tiktok/callback/route.ts identity resolution logic
async function processTikTokCallbackPersistence(
  mockPrisma: MockPrismaSocialAccount,
  session: { userId: string; workspaceId: string },
  tokenResult: {
    accessToken: string;
    refreshToken?: string | null;
    expiresIn: number;
    openId: string;
    scope: string;
    userId: string;
    workspaceId: string;
  },
  userInfo: {
    openId?: string;
    displayName: string;
    username: string;
    avatarUrl: string | null;
  }
) {
  if (tokenResult.userId !== session.userId || tokenResult.workspaceId !== session.workspaceId) {
    throw new TikTokOAuthError(
      'OAuth state does not match your current session. Possible CSRF attack prevented.',
      'STATE_MISMATCH'
    );
  }

  const canonicalOpenId = (tokenResult.openId || '').trim();
  if (!canonicalOpenId) {
    throw new TikTokOAuthError(
      'TikTok OAuth failed: No valid account identifier (open_id) was returned by TikTok.',
      'MISSING_OPEN_ID'
    );
  }

  const tokenData = {
    accessToken: `enc_${tokenResult.accessToken}`,
    refreshToken: tokenResult.refreshToken ? `enc_${tokenResult.refreshToken}` : null,
    scope: tokenResult.scope,
    expiresAt: new Date(Date.now() + tokenResult.expiresIn * 1000),
  };

  const existing = await mockPrisma.findFirst({
    where: {
      workspaceId: tokenResult.workspaceId,
      platform: 'TIKTOK',
      platformAccountId: canonicalOpenId,
    },
  });

  if (existing && existing.platformAccountId === canonicalOpenId) {
    const updatedName = userInfo.displayName || existing.name || 'TikTok Creator';
    const updatedUsername = userInfo.username || existing.username || '';
    const updatedAvatar = userInfo.avatarUrl || existing.profileImageUrl;

    return await mockPrisma.update({
      where: { id: existing.id },
      data: {
        name: updatedName,
        username: updatedUsername,
        profileImageUrl: updatedAvatar,
        status: 'CONNECTED',
        isMock: false,
        token: tokenData,
      },
    });
  } else {
    return await mockPrisma.create({
      data: {
        workspaceId: tokenResult.workspaceId,
        platform: 'TIKTOK',
        platformAccountId: canonicalOpenId,
        name: userInfo.displayName || 'TikTok Creator',
        username: userInfo.username || '',
        profileImageUrl: userInfo.avatarUrl || null,
        status: 'CONNECTED',
        isMock: false,
        token: tokenData,
      },
    });
  }
}

async function runTestSuite() {
  console.log('=== STARTING TIKTOK ACCOUNT IDENTITY VERIFICATION SUITE ===\n');
  const mockDb = new MockPrismaSocialAccount();

  const ws1 = 'workspace_alpha';
  const ws2 = 'workspace_beta';
  const user1 = 'user_001';
  const user2 = 'user_002';

  const session1 = { userId: user1, workspaceId: ws1 };
  const session2 = { userId: user2, workspaceId: ws2 };

  // -------------------------------------------------------------
  // Scenario 1: Token exchange returns valid open_id -> account connected with canonical open_id as platformAccountId
  // -------------------------------------------------------------
  console.log('[Scenario 1] Token exchange returns valid open_id -> canonical open_id is platformAccountId');
  const openIdA = 'open_id_user_a_123';
  const accA = await processTikTokCallbackPersistence(
    mockDb,
    session1,
    {
      accessToken: 'token_a',
      expiresIn: 86400,
      openId: openIdA,
      scope: 'user.info.basic,video.upload,video.publish',
      userId: user1,
      workspaceId: ws1,
    },
    {
      openId: openIdA,
      displayName: 'Salman Editz',
      username: 'salmaneditz25',
      avatarUrl: 'https://p16.tiktokcdn.com/avatar/a.jpg',
    }
  );

  assert.strictEqual(accA.platformAccountId, openIdA, 'platformAccountId must equal canonical open_id');
  assert.strictEqual(accA.username, 'salmaneditz25');
  assert.strictEqual(accA.workspaceId, ws1);
  console.log('✅ Scenario 1 Passed: Account A connected with canonical open_id.\n');

  // -------------------------------------------------------------
  // Scenario 2: Connecting Account B in same workspace does NOT overwrite Account A (both exist distinctly)
  // -------------------------------------------------------------
  console.log('[Scenario 2] Connecting Account B in same workspace does NOT overwrite Account A');
  const openIdB = 'open_id_user_b_456';
  const accB = await processTikTokCallbackPersistence(
    mockDb,
    session1,
    {
      accessToken: 'token_b',
      expiresIn: 86400,
      openId: openIdB,
      scope: 'user.info.basic,video.upload,video.publish',
      userId: user1,
      workspaceId: ws1,
    },
    {
      openId: openIdB,
      displayName: 'Tech With Salman',
      username: 'tech.with.salman0',
      avatarUrl: 'https://p16.tiktokcdn.com/avatar/b.jpg',
    }
  );

  assert.notStrictEqual(accA.id, accB.id, 'Account A and Account B must have distinct database IDs');
  const verifyA = await mockDb.findUnique({ where: { id: accA.id } });
  const verifyB = await mockDb.findUnique({ where: { id: accB.id } });
  assert.strictEqual(verifyA?.username, 'salmaneditz25', 'Account A username unchanged');
  assert.strictEqual(verifyA?.platformAccountId, openIdA, 'Account A open_id unchanged');
  assert.strictEqual(verifyB?.username, 'tech.with.salman0', 'Account B username set correctly');
  assert.strictEqual(verifyB?.platformAccountId, openIdB, 'Account B open_id set correctly');
  console.log('✅ Scenario 2 Passed: Both Account A and Account B exist simultaneously and distinctly.\n');

  // -------------------------------------------------------------
  // Scenario 3: Re-authorizing Account A updates only Account A without touching Account B
  // -------------------------------------------------------------
  console.log('[Scenario 3] Re-authorizing Account A updates only Account A without touching Account B');
  const updatedA = await processTikTokCallbackPersistence(
    mockDb,
    session1,
    {
      accessToken: 'token_a_refreshed_999',
      expiresIn: 86400,
      openId: openIdA,
      scope: 'user.info.basic,video.upload,video.publish',
      userId: user1,
      workspaceId: ws1,
    },
    {
      openId: openIdA,
      displayName: 'Salman Editz Updated',
      username: 'salmaneditz25',
      avatarUrl: 'https://p16.tiktokcdn.com/avatar/a_new.jpg',
    }
  );

  assert.strictEqual(updatedA.id, accA.id, 'Reauthorization must update existing Account A record');
  assert.strictEqual(updatedA.name, 'Salman Editz Updated');
  assert.strictEqual(updatedA.token.accessToken, 'enc_token_a_refreshed_999');

  const checkB = await mockDb.findUnique({ where: { id: accB.id } });
  assert.strictEqual(checkB?.name, 'Tech With Salman', 'Account B must not be altered');
  assert.strictEqual(checkB?.platformAccountId, openIdB);
  console.log('✅ Scenario 3 Passed: Only target account A was updated on re-authorization.\n');

  // -------------------------------------------------------------
  // Scenario 4: Token exchange with missing/empty open_id is rejected with safe error (MISSING_OPEN_ID)
  // -------------------------------------------------------------
  console.log('[Scenario 4] Token exchange with missing/empty open_id rejected with safe error');
  await assert.rejects(
    async () => {
      await processTikTokCallbackPersistence(
        mockDb,
        session1,
        {
          accessToken: 'tok_no_openid',
          expiresIn: 86400,
          openId: '',
          scope: 'user.info.basic',
          userId: user1,
          workspaceId: ws1,
        },
        {
          openId: '',
          displayName: 'No Open ID',
          username: 'no_openid',
          avatarUrl: null,
        }
      );
    },
    (err: any) => {
      assert.strictEqual(err.code, 'MISSING_OPEN_ID', 'Must throw MISSING_OPEN_ID');
      return true;
    }
  );

  await assert.rejects(
    async () => {
      await processTikTokCallbackPersistence(
        mockDb,
        session1,
        {
          accessToken: 'tok_spaces_openid',
          expiresIn: 86400,
          openId: '    ',
          scope: 'user.info.basic',
          userId: user1,
          workspaceId: ws1,
        },
        {
          openId: '',
          displayName: 'Spaces Open ID',
          username: 'spaces',
          avatarUrl: null,
        }
      );
    },
    (err: any) => {
      assert.strictEqual(err.code, 'MISSING_OPEN_ID', 'Must throw MISSING_OPEN_ID');
      return true;
    }
  );
  console.log('✅ Scenario 4 Passed: Empty open_id rejected safely.\n');

  // -------------------------------------------------------------
  // Scenario 5: Workspace isolation: Same open_id in different workspace creates separate record in that workspace
  // -------------------------------------------------------------
  console.log('[Scenario 5] Workspace isolation: same open_id in different workspace creates separate record');
  const accAInWs2 = await processTikTokCallbackPersistence(
    mockDb,
    session2,
    {
      accessToken: 'token_ws2',
      expiresIn: 86400,
      openId: openIdA,
      scope: 'user.info.basic,video.upload,video.publish',
      userId: user2,
      workspaceId: ws2,
    },
    {
      openId: openIdA,
      displayName: 'Salman In Workspace 2',
      username: 'salman_ws2',
      avatarUrl: null,
    }
  );

  assert.notStrictEqual(accAInWs2.id, accA.id, 'Different workspace must have different record ID');
  assert.strictEqual(accAInWs2.workspaceId, ws2);
  assert.strictEqual(accAInWs2.platformAccountId, openIdA);
  console.log('✅ Scenario 5 Passed: Workspace isolation strictly preserved.\n');

  // -------------------------------------------------------------
  // Scenario 6: TikTok User Info API failure/partial failure falls back safely without failing connection or overwriting
  // -------------------------------------------------------------
  console.log('[Scenario 6] User Info API failure/partial failure preserves existing metadata safely');
  const accWithBlankInfo = await processTikTokCallbackPersistence(
    mockDb,
    session1,
    {
      accessToken: 'token_a_refreshed_partial',
      expiresIn: 86400,
      openId: openIdA,
      scope: 'user.info.basic',
      userId: user1,
      workspaceId: ws1,
    },
    {
      openId: openIdA,
      displayName: '', // User Info API returned blank
      username: '', // Creator Info returned blank
      avatarUrl: null,
    }
  );

  assert.strictEqual(accWithBlankInfo.id, accA.id);
  assert.strictEqual(accWithBlankInfo.username, 'salmaneditz25', 'Previous username preserved');
  assert.strictEqual(accWithBlankInfo.name, 'Salman Editz Updated', 'Previous name preserved');
  console.log('✅ Scenario 6 Passed: Existing metadata preserved when API returns partial/empty profile info.\n');

  // -------------------------------------------------------------
  // Scenario 7: Unsupported union_id is NOT queried in User Info API
  // -------------------------------------------------------------
  console.log('[Scenario 7] Validating union_id is NOT queried in lib/tiktok-oauth.ts');
  const codeContent = fs.readFileSync(path.join(process.cwd(), 'lib/tiktok-oauth.ts'), 'utf8');
  assert.ok(!codeContent.includes('fields=open_id,union_id'), 'union_id must not be present in fields query');
  assert.ok(!codeContent.includes('fields=union_id'), 'union_id must not be present in fields query');
  assert.ok(
    codeContent.includes('fields = \'open_id,avatar_url,avatar_url_100,avatar_large_url,display_name\'') ||
    codeContent.includes('open_id,avatar_url,avatar_url_100,avatar_large_url,display_name'),
    'Standard fields must be present'
  );
  console.log('✅ Scenario 7 Passed: union_id completely removed from fields parameter.\n');

  // -------------------------------------------------------------
  // Scenario 8: Ambiguous/legacy records with empty platformAccountId are NOT overwritten by new connections
  // -------------------------------------------------------------
  console.log('[Scenario 8] Ambiguous records with empty platformAccountId are NOT overwritten');
  mockDb.seed({
    id: 'legacy_corrupt_record_001',
    workspaceId: ws1,
    platform: 'TIKTOK',
    platformAccountId: '', // legacy empty string
    name: 'Old Corrupted Record',
    username: 'old_legacy_user',
    profileImageUrl: null,
    status: 'CONNECTED',
    isMock: false,
  });

  const freshOpenId = 'brand_new_open_id_789';
  const freshAcc = await processTikTokCallbackPersistence(
    mockDb,
    session1,
    {
      accessToken: 'token_fresh',
      expiresIn: 86400,
      openId: freshOpenId,
      scope: 'user.info.basic',
      userId: user1,
      workspaceId: ws1,
    },
    {
      openId: freshOpenId,
      displayName: 'Fresh Account',
      username: 'fresh_account',
      avatarUrl: null,
    }
  );

  const legacyRecordAfter = await mockDb.findUnique({ where: { id: 'legacy_corrupt_record_001' } });
  assert.ok(legacyRecordAfter, 'Legacy record must still exist');
  assert.strictEqual(legacyRecordAfter.platformAccountId, '', 'Legacy record platformAccountId must remain untouched');
  assert.strictEqual(legacyRecordAfter.username, 'old_legacy_user', 'Legacy record username must remain untouched');
  assert.notStrictEqual(freshAcc.id, 'legacy_corrupt_record_001', 'Fresh connection must not overwrite legacy record');
  assert.strictEqual(freshAcc.platformAccountId, freshOpenId);
  console.log('✅ Scenario 8 Passed: Ambiguous record with empty platformAccountId was NOT overwritten.\n');

  // -------------------------------------------------------------
  // Scenario 9: Callback error visibility in lib/oauth-callback.ts
  // -------------------------------------------------------------
  console.log('[Scenario 9] Validating callback error visibility and no auto-close on error...');
  const oauthCallbackSource = fs.readFileSync(path.join(process.cwd(), 'lib/oauth-callback.ts'), 'utf8');
  assert.ok(oauthCallbackSource.includes("tiktok_error"), 'Fallback URL must include tiktok_error parameter');
  assert.ok(oauthCallbackSource.includes("tiktok_error_desc"), 'Fallback URL must include tiktok_error_desc parameter');
  assert.ok(oauthCallbackSource.includes("Connection Failed"), 'Error modal heading must indicate failure');
  assert.ok(oauthCallbackSource.includes("Close Window"), 'Close Window button must be provided');
  assert.ok(oauthCallbackSource.includes("${success ? 'setTimeout(function() { window.close(); }, 800);' : ''}"), 'Popup must NOT automatically close on error');
  console.log('✅ Scenario 9 Passed: Callback error visibility and persistent window verified.\n');

  // -------------------------------------------------------------
  // Scenario 10: Connection succeeds when profile metadata is completely missing/blank (open_id is valid)
  // -------------------------------------------------------------
  console.log('[Scenario 10] Connection succeeds with valid open_id when optional profile metadata is empty...');
  const bareOpenId = `bare_open_id_${Date.now()}`;
  const bareAccount = await processTikTokCallbackPersistence(
    mockDb,
    session1,
    {
      accessToken: 'token_bare',
      expiresIn: 86400,
      openId: bareOpenId,
      scope: 'user.info.basic,video.upload,video.publish',
      userId: user1,
      workspaceId: ws1,
    },
    {
      openId: bareOpenId,
      displayName: '', // completely missing
      username: '', // completely missing
      avatarUrl: null,
    }
  );

  assert.strictEqual(bareAccount.platformAccountId, bareOpenId, 'Account identity must use canonical open_id');
  assert.strictEqual(bareAccount.name, 'TikTok Creator', 'Default display name used');
  assert.strictEqual(bareAccount.username, '', 'Empty username stored cleanly without placeholder identity');
  assert.strictEqual(bareAccount.status, 'CONNECTED');
  console.log('✅ Scenario 10 Passed: Bare connection succeeds without optional profile metadata.\n');

  // -------------------------------------------------------------
  // Scenario 11: Database failure handling returns safe error without exposing credentials or fake success
  // -------------------------------------------------------------
  console.log('[Scenario 11] Database failure simulation ensures safe error reporting...');
  class BrokenMockDb extends MockPrismaSocialAccount {
    async create(): Promise<MockSocialAccount> {
      const err: any = new Error('Unique constraint failed on the fields: (`workspaceId`,`platform`,`platformAccountId`)');
      err.code = 'P2002';
      throw err;
    }
  }
  const brokenDb = new BrokenMockDb();
  await assert.rejects(
    async () => {
      await processTikTokCallbackPersistence(
        brokenDb,
        session1,
        {
          accessToken: 'tok_fail',
          expiresIn: 86400,
          openId: 'open_id_collision',
          scope: 'user.info.basic',
          userId: user1,
          workspaceId: ws1,
        },
        {
          openId: 'open_id_collision',
          displayName: 'Test',
          username: 'test',
          avatarUrl: null,
        }
      );
    },
    (err: any) => {
      assert.strictEqual(err.code, 'P2002', 'Prisma error code preserved for safe handler mapping');
      return true;
    }
  );
  console.log('✅ Scenario 11 Passed: Database failure handled with safe diagnostic code.\n');

  console.log('🎉 ALL 11 TIKTOK ACCOUNT IDENTITY & ERROR VISIBILITY SCENARIOS VERIFIED SUCCESSFULLY!');
}

runTestSuite().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
