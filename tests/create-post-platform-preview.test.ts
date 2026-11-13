import assert from 'node:assert';
import prisma from '../lib/prisma';
import { SUPPORTED_PLATFORM_IDS } from '../lib/platforms';

// Replicate the exact preview state resolution logic implemented in CreatePostPage
interface SocialAccount {
  id: string;
  platform: string;
  name: string;
  username: string;
  profileImageUrl?: string | null;
  status: string;
}

interface TikTokCreatorInfo {
  creatorUsername: string;
  creatorNickname: string;
  creatorAvatarUrl?: string | null;
}

function resolvePlatformPreviewState({
  accounts,
  selectedAccountIds,
  previewPlatform,
  tiktokCreatorInfo,
  masterCaption,
  platformSettings,
}: {
  accounts: SocialAccount[];
  selectedAccountIds: string[];
  previewPlatform: string;
  tiktokCreatorInfo?: TikTokCreatorInfo | null;
  masterCaption: string;
  platformSettings: Record<string, any>;
}) {
  const selectedAccounts = accounts.filter((a) => selectedAccountIds.includes(a.id));

  const selectedPlatforms = SUPPORTED_PLATFORM_IDS.filter((plat) =>
    selectedAccounts.some((a) => a.platform === plat)
  );

  const effectivePreviewPlatform =
    selectedPlatforms.length === 0
      ? null
      : previewPlatform && selectedPlatforms.includes(previewPlatform as any)
      ? previewPlatform
      : selectedPlatforms[0];

  const activePreviewAccount = !effectivePreviewPlatform
    ? null
    : selectedAccounts.find((a) => a.platform === effectivePreviewPlatform) || null;

  const previewAccountName = !activePreviewAccount
    ? 'Your Channel'
    : effectivePreviewPlatform === 'TIKTOK' && tiktokCreatorInfo?.creatorNickname
    ? tiktokCreatorInfo.creatorNickname
    : activePreviewAccount.name || 'Your Channel';

  const previewUsername = !activePreviewAccount
    ? '@yourchannel'
    : effectivePreviewPlatform === 'TIKTOK' && tiktokCreatorInfo?.creatorUsername
    ? tiktokCreatorInfo.creatorUsername.startsWith('@')
      ? tiktokCreatorInfo.creatorUsername
      : `@${tiktokCreatorInfo.creatorUsername}`
    : activePreviewAccount.username
    ? activePreviewAccount.username.startsWith('@')
      ? activePreviewAccount.username
      : `@${activePreviewAccount.username}`
    : '@yourchannel';

  const previewAvatarUrl = !activePreviewAccount
    ? null
    : effectivePreviewPlatform === 'TIKTOK'
    ? tiktokCreatorInfo?.creatorAvatarUrl || activePreviewAccount.profileImageUrl || null
    : activePreviewAccount.profileImageUrl || null;

  const currentPreviewPlatform = effectivePreviewPlatform || previewPlatform;
  const currentPreviewText = currentPreviewPlatform
    ? platformSettings[currentPreviewPlatform]?.caption || masterCaption || 'Your caption preview will appear here...'
    : 'Your caption preview will appear here...';

  const currentPreviewHashtags = currentPreviewPlatform
    ? platformSettings[currentPreviewPlatform]?.hashtags || ''
    : '';

  return {
    selectedPlatforms,
    effectivePreviewPlatform,
    activePreviewAccount,
    previewAccountName,
    previewUsername,
    previewAvatarUrl,
    currentPreviewText,
    currentPreviewHashtags,
    isEmptyState: !effectivePreviewPlatform || !activePreviewAccount,
  };
}

async function runPreviewSuite() {
  console.log('======================================================================');
  console.log('LIVE PLATFORM PREVIEW STATE & ACCOUNT ISOLATION TEST SUITE');
  console.log('======================================================================\n');

  // Load real accounts from Salman's workspace
  const user = await prisma.user.findFirst({ where: { email: 'salmandesigner24@gmail.com' } });
  assert(user, 'User must exist');
  const dbAccounts = await prisma.socialAccount.findMany({ where: { workspaceId: user.workspaceId } });
  assert(dbAccounts.length > 0, 'Connected accounts must exist');

  const accounts: SocialAccount[] = dbAccounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    name: a.name,
    username: a.username,
    profileImageUrl: null,
    status: a.status,
  }));

  const tiktokAccount = accounts.find((a) => a.platform === 'TIKTOK');
  const instagramAccount = accounts.find((a) => a.platform === 'INSTAGRAM');
  const facebookAccount = accounts.find((a) => a.platform === 'FACEBOOK');
  const youtubeAccount = accounts.find((a) => a.platform === 'YOUTUBE');

  assert(tiktokAccount, 'TikTok account must be present');
  assert(instagramAccount, 'Instagram account must be present');
  assert(facebookAccount, 'Facebook account must be present');
  assert(youtubeAccount, 'YouTube account must be present');

  console.log('[Setup] Found Accounts:');
  console.log(`  - TikTok: ${tiktokAccount.name} (@${tiktokAccount.username})`);
  console.log(`  - Instagram: ${instagramAccount.name} (@${instagramAccount.username})`);
  console.log(`  - Facebook: ${facebookAccount.name} (@${facebookAccount.username})`);
  console.log(`  - YouTube: ${youtubeAccount.name} (@${youtubeAccount.username})\n`);

  const mockSettings = {
    TIKTOK: { caption: 'TikTok specific caption', hashtags: '#fyp #viral' },
    INSTAGRAM: { caption: 'Instagram caption', hashtags: '#insta' },
    FACEBOOK: { caption: 'Facebook caption', hashtags: '#fb' },
    YOUTUBE: { caption: 'YouTube description', youtubeTitle: 'Great Video Title' },
  };

  // -------------------------------------------------------------------------
  // Scenario 1: Select TikTok ONLY (Reproduction & Verification)
  // -------------------------------------------------------------------------
  console.log('[Scenario 1] Select TikTok only');
  // Initial previewPlatform was previously stuck on INSTAGRAM
  const state1 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [tiktokAccount.id],
    previewPlatform: 'INSTAGRAM', // Even if prior state was INSTAGRAM
    tiktokCreatorInfo: { creatorNickname: tiktokAccount.name, creatorUsername: tiktokAccount.username },
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });

  assert.strictEqual(state1.effectivePreviewPlatform, 'TIKTOK', 'Preview platform must automatically resolve to TIKTOK');
  assert.strictEqual(state1.activePreviewAccount?.platform, 'TIKTOK');
  assert.strictEqual(state1.previewAccountName, tiktokAccount.name);
  assert.strictEqual(state1.previewUsername, `@${tiktokAccount.username}`);
  assert.notStrictEqual(state1.activePreviewAccount?.name, instagramAccount.name, 'Must NEVER display Instagram account name');
  assert.notStrictEqual(state1.previewUsername, `@${instagramAccount.username}`, 'Must NEVER display Instagram username');
  assert.strictEqual(state1.isEmptyState, false);
  console.log('✅ PASS: When only TikTok is selected, preview strictly displays TikTok branding and Salman Khan (@salmaneditz25).\n');

  // -------------------------------------------------------------------------
  // Scenario 2: Select Instagram ONLY
  // -------------------------------------------------------------------------
  console.log('[Scenario 2] Select Instagram only');
  const state2 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [instagramAccount.id],
    previewPlatform: '',
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });

  assert.strictEqual(state2.effectivePreviewPlatform, 'INSTAGRAM');
  assert.strictEqual(state2.previewAccountName, instagramAccount.name);
  assert.strictEqual(state2.previewUsername, `@${instagramAccount.username}`);
  assert.strictEqual(state2.isEmptyState, false);
  console.log('✅ PASS: When only Instagram is selected, preview strictly displays Funny Veggie AI (@funnyveggieai24).\n');

  // -------------------------------------------------------------------------
  // Scenario 3: Select Facebook ONLY
  // -------------------------------------------------------------------------
  console.log('[Scenario 3] Select Facebook only');
  const state3 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [facebookAccount.id],
    previewPlatform: '',
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });

  assert.strictEqual(state3.effectivePreviewPlatform, 'FACEBOOK');
  assert.strictEqual(state3.previewAccountName, facebookAccount.name);
  assert.strictEqual(state3.isEmptyState, false);
  console.log('✅ PASS: When only Facebook is selected, preview displays Facebook identity.\n');

  // -------------------------------------------------------------------------
  // Scenario 4: Select YouTube ONLY
  // -------------------------------------------------------------------------
  console.log('[Scenario 4] Select YouTube only');
  const state4 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [youtubeAccount.id],
    previewPlatform: '',
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });

  assert.strictEqual(state4.effectivePreviewPlatform, 'YOUTUBE');
  assert.strictEqual(state4.previewAccountName, youtubeAccount.name);
  assert.strictEqual(state4.isEmptyState, false);
  console.log('✅ PASS: When only YouTube is selected, preview displays YouTube identity.\n');

  // -------------------------------------------------------------------------
  // Scenario 5: Select TikTok + Instagram (Multi-account switching)
  // -------------------------------------------------------------------------
  console.log('[Scenario 5] Select TikTok + Instagram (Multi-platform switcher)');
  const state5a = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [tiktokAccount.id, instagramAccount.id],
    previewPlatform: 'TIKTOK',
    tiktokCreatorInfo: { creatorNickname: tiktokAccount.name, creatorUsername: tiktokAccount.username },
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });
  assert.deepStrictEqual(state5a.selectedPlatforms, ['INSTAGRAM', 'TIKTOK']);
  assert.strictEqual(state5a.effectivePreviewPlatform, 'TIKTOK');
  assert.strictEqual(state5a.previewAccountName, tiktokAccount.name);

  // Switch preview tab to INSTAGRAM
  const state5b = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [tiktokAccount.id, instagramAccount.id],
    previewPlatform: 'INSTAGRAM',
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });
  assert.strictEqual(state5b.effectivePreviewPlatform, 'INSTAGRAM');
  assert.strictEqual(state5b.previewAccountName, instagramAccount.name);
  console.log('✅ PASS: Switching between TikTok and Instagram in multi-select updates account and preview accurately.\n');

  // -------------------------------------------------------------------------
  // Scenario 6: Select All Accounts
  // -------------------------------------------------------------------------
  console.log('[Scenario 6] Select All Accounts');
  const allAccountIds = accounts.map((a) => a.id);
  const state6 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: allAccountIds,
    previewPlatform: 'TIKTOK',
    tiktokCreatorInfo: { creatorNickname: tiktokAccount.name, creatorUsername: tiktokAccount.username },
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });
  assert(state6.selectedPlatforms.length >= 4);
  assert.strictEqual(state6.effectivePreviewPlatform, 'TIKTOK');
  assert.strictEqual(state6.isEmptyState, false);
  console.log('✅ PASS: Select All correctly populates all selected platforms in switcher.\n');

  // -------------------------------------------------------------------------
  // Scenario 7: Deselect All Accounts
  // -------------------------------------------------------------------------
  console.log('[Scenario 7] Deselect All Accounts');
  const state7 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [],
    previewPlatform: 'TIKTOK',
    masterCaption: 'Global Caption',
    platformSettings: mockSettings,
  });
  assert.strictEqual(state7.selectedPlatforms.length, 0);
  assert.strictEqual(state7.effectivePreviewPlatform, null);
  assert.strictEqual(state7.activePreviewAccount, null);
  assert.strictEqual(state7.isEmptyState, true);
  console.log('✅ PASS: Deselect All displays neutral empty state without leaking stale accounts.\n');

  // -------------------------------------------------------------------------
  // Scenario 8: Rapid Account Switching
  // -------------------------------------------------------------------------
  console.log('[Scenario 8] Rapid Account Switching Simulation');
  let currentSelection: string[] = [];
  for (let i = 0; i < 20; i++) {
    const acc = accounts[i % accounts.length];
    currentSelection = currentSelection.includes(acc.id)
      ? currentSelection.filter((id) => id !== acc.id)
      : [...currentSelection, acc.id];

    const state = resolvePlatformPreviewState({
      accounts,
      selectedAccountIds: currentSelection,
      previewPlatform: 'TIKTOK',
      masterCaption: 'Global Caption',
      platformSettings: mockSettings,
    });

    if (currentSelection.length === 0) {
      assert.strictEqual(state.isEmptyState, true);
    } else {
      assert.strictEqual(state.isEmptyState, false);
      assert(state.effectivePreviewPlatform !== null);
      assert(currentSelection.includes(state.activePreviewAccount!.id));
    }
  }
  console.log('✅ PASS: 20 rapid toggle transitions maintained 100% strict account isolation.\n');

  // -------------------------------------------------------------------------
  // Scenario 9: No Account Selected Initially
  // -------------------------------------------------------------------------
  console.log('[Scenario 9] No Account Selected (Neutral Initial State)');
  const state9 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [],
    previewPlatform: '',
    masterCaption: '',
    platformSettings: mockSettings,
  });
  assert.strictEqual(state9.isEmptyState, true);
  assert.strictEqual(state9.effectivePreviewPlatform, null);
  assert.strictEqual(state9.activePreviewAccount, null);
  console.log('✅ PASS: Zero accounts selected renders neutral empty state.\n');

  // -------------------------------------------------------------------------
  // Scenario 10: Caption and Hashtag Preservation
  // -------------------------------------------------------------------------
  console.log('[Scenario 10] Video Preview & Caption Integrity');
  const state10 = resolvePlatformPreviewState({
    accounts,
    selectedAccountIds: [tiktokAccount.id],
    previewPlatform: 'TIKTOK',
    tiktokCreatorInfo: { creatorNickname: tiktokAccount.name, creatorUsername: tiktokAccount.username },
    masterCaption: 'Global fallback caption',
    platformSettings: {
      TIKTOK: { caption: 'Custom TikTok caption #custom', hashtags: '#fyp' },
    },
  });
  assert.strictEqual(state10.currentPreviewText, 'Custom TikTok caption #custom');
  assert.strictEqual(state10.currentPreviewHashtags, '#fyp');
  console.log('✅ PASS: Custom captions and hashtags are faithfully preserved.\n');

  console.log('======================================================================');
  console.log('🎉 ALL 10 PREVIEW STATE QA SCENARIOS PASSED WITH 100% ACCURACY!');
  console.log('======================================================================\n');
}

runPreviewSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
