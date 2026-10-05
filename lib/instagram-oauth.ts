import prisma from './prisma';
import { randomBytes, createHash } from 'crypto';
import { SessionPayload } from './auth';
import { getWorkspaceEntitlements } from './billing';
import { encryptToken } from './crypto';

export class InstagramOAuthError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
    this.name = 'InstagramOAuthError';
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getInstagramConfig(requireSecret: boolean) {
  const appId = process.env.INSTAGRAM_APP_ID?.trim() || process.env.META_APP_ID?.trim();
  const appSecret = process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim();
  
  const appUrl = process.env.NODE_ENV === "production"
    ? (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://app.techwithsalman.online")
    : "http://localhost:3000";
    
  const redirectUri = `${appUrl}/api/oauth/instagram/callback`;

  if (!appId || (requireSecret && !appSecret)) {
    throw new InstagramOAuthError(
      'INSTAGRAM_CONFIG_MISSING',
      'Instagram OAuth is not configured. Missing App ID or Secret.',
      500
    );
  }

  return { appId, appSecret, redirectUri };
}

const INSTAGRAM_STATE_TTL_MS = 10 * 60 * 1000;

export async function createInstagramAuthorizationUrl(session: SessionPayload) {
  const config = getInstagramConfig(false);
  const state = randomToken();
  const stateHash = hashToken(state);

  // We reuse MetaOAuthState to avoid schema changes
  await prisma.metaOAuthState.create({
    data: {
      stateHash,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri: config.redirectUri,
      expiresAt: new Date(Date.now() + INSTAGRAM_STATE_TTL_MS),
    },
  });

  const authUrl = new URL('https://www.instagram.com/oauth/authorize');
  authUrl.searchParams.set('enable_fb_login', '0');
  authUrl.searchParams.set('force_authentication', '1');
  authUrl.searchParams.set('client_id', config.appId!);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'instagram_business_basic,instagram_business_content_publish');
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}

export async function consumeInstagramOAuthState(state: string, session: SessionPayload) {
  const stateHash = hashToken(state);
  
  const stateRecord = await prisma.metaOAuthState.findUnique({
    where: { stateHash },
  });

  if (!stateRecord) {
    throw new InstagramOAuthError('INVALID_STATE', 'Invalid or expired Instagram OAuth state.', 400);
  }

  if (stateRecord.userId !== session.userId || stateRecord.workspaceId !== session.workspaceId) {
    throw new InstagramOAuthError('UNAUTHORIZED_STATE', 'This OAuth state does not belong to your session.', 403);
  }

  if (stateRecord.consumedAt) {
    throw new InstagramOAuthError('STATE_CONSUMED', 'This authorization was already used.', 400);
  }

  if (new Date() > stateRecord.expiresAt) {
    throw new InstagramOAuthError('STATE_EXPIRED', 'Authorization session expired.', 400);
  }

  await prisma.metaOAuthState.update({
    where: { id: stateRecord.id },
    data: { consumedAt: new Date() },
  });

  return stateRecord;
}

export async function exchangeInstagramCode(code: string, redirectUri: string) {
  const config = getInstagramConfig(true);

  // 1. Exchange Code for Short-Lived Token
  const shortLivedRes = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.appId!,
      client_secret: config.appSecret!,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
      code,
    }),
  });

  const shortLivedData = await shortLivedRes.json();
  if (!shortLivedRes.ok || !shortLivedData.access_token) {
    console.error('[Instagram OAuth] Short-lived token error:', shortLivedData);
    throw new InstagramOAuthError('TOKEN_EXCHANGE_FAILED', 'Failed to exchange Instagram authorization code.', 400);
  }

  const shortLivedToken = shortLivedData.access_token;

  // 2. Exchange for Long-Lived Token
  const longLivedRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${config.appSecret}&access_token=${shortLivedToken}`
  );
  const longLivedData = await longLivedRes.json();
  
  const accessToken = longLivedData.access_token || shortLivedToken;
  const expiresIn = longLivedData.expires_in || 5184000; // default 60 days
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // 3. Fetch User Profile
  const userRes = await fetch(`https://graph.instagram.com/v23.0/me?fields=id,username,name,profile_picture_url&access_token=${accessToken}`);
  const userData = await userRes.json();

  if (!userRes.ok || !userData.id) {
    console.error('[Instagram OAuth] User profile error:', userData);
    throw new InstagramOAuthError('PROFILE_FETCH_FAILED', 'Failed to retrieve Instagram profile data.', 400);
  }

  return {
    accessToken,
    expiresAt,
    id: userData.id,
    username: userData.username || userData.id,
    name: userData.name || userData.username || 'Instagram Professional',
    profileImageUrl: userData.profile_picture_url || null,
  };
}

export async function saveInstagramAccount(
  profile: Awaited<ReturnType<typeof exchangeInstagramCode>>,
  session: SessionPayload
) {
  // Prevent duplicate Instagram accounts in the same workspace
  const existing = await prisma.socialAccount.findFirst({
    where: {
      workspaceId: session.workspaceId,
      platform: 'INSTAGRAM',
      platformAccountId: profile.id,
    },
  });

  if (existing) {
    throw new InstagramOAuthError('ACCOUNT_EXISTS', 'This Instagram account is already connected to this workspace.', 409);
  }

  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (
    entitlements.limits.maxSocialAccounts !== null &&
    entitlements.usage.connectedAccounts >= entitlements.limits.maxSocialAccounts
  ) {
    throw new InstagramOAuthError(
      'SOCIAL_ACCOUNT_LIMIT_REACHED',
      `Your current plan allows ${entitlements.limits.maxSocialAccounts} connected social accounts.`,
      403
    );
  }

  const encryptedAccessToken = encryptToken(profile.accessToken);

  const connectedAccount = await prisma.socialAccount.create({
    data: {
      workspaceId: session.workspaceId,
      platform: 'INSTAGRAM',
      platformAccountId: profile.id,
      name: profile.name,
      username: profile.username,
      profileImageUrl: profile.profileImageUrl,
      status: 'CONNECTED',
      isMock: false,
      token: {
        create: {
          accessToken: encryptedAccessToken,
          refreshToken: null,
          scope: 'instagram_business_basic,instagram_business_content_publish',
          expiresAt: profile.expiresAt,
        },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: 'ACCOUNT_CONNECTED',
      details: `Connected Instagram Professional account @${profile.username}.`,
    },
  });

  return connectedAccount;
}
