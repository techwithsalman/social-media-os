import { randomBytes, createHash } from 'crypto';
import prisma from './prisma';
import type { SessionPayload } from './auth';
import { encryptToken } from './crypto';
import { getWorkspaceEntitlements } from './billing';

export class PinterestOAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'PinterestOAuthError';
  }
}

export function getPinterestClientId(): string {
  return process.env.PINTEREST_CLIENT_ID?.trim() || '';
}

export function getPinterestClientSecret(): string {
  return process.env.PINTEREST_CLIENT_SECRET?.trim() || '';
}

export function getPinterestRedirectUri(): string {
  const envUri = process.env.PINTEREST_REDIRECT_URI?.trim();
  if (envUri) return envUri;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || (process.env.NODE_ENV === 'production' ? 'https://app.techwithsalman.online' : 'http://localhost:3000');
  return `${appUrl.trim()}/api/oauth/pinterest/callback`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createPinterestAuthorizationUrl(session: SessionPayload) {
  const clientId = getPinterestClientId();
  const redirectUri = getPinterestRedirectUri();

  if (!clientId) {
    throw new PinterestOAuthError('Pinterest Client ID not configured', 'MISSING_CREDENTIALS');
  }

  const state = randomToken();
  const stateHash = hashToken(state);

  await prisma.metaOAuthState.create({
    data: {
      stateHash,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  const scopes = ['user_accounts:read', 'boards:read', 'pins:read', 'pins:write'];

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(','),
    state,
  });

  return {
    url: `https://www.pinterest.com/oauth/?${params.toString()}`,
  };
}

export async function exchangePinterestCode(code: string, state: string, session: SessionPayload) {
  const stateHash = hashToken(state);

  const stateRecord = await prisma.metaOAuthState.findUnique({
    where: { stateHash },
  });

  if (!stateRecord) {
    throw new PinterestOAuthError('Invalid or expired state', 'INVALID_STATE');
  }

  if (stateRecord.userId !== session.userId || stateRecord.workspaceId !== session.workspaceId) {
    throw new PinterestOAuthError('OAuth state does not match your session. Possible CSRF attack prevented.', 'STATE_MISMATCH');
  }

  if (stateRecord.consumedAt) {
    throw new PinterestOAuthError('State already consumed', 'STATE_CONSUMED');
  }

  if (stateRecord.expiresAt < new Date()) {
    throw new PinterestOAuthError('State expired', 'STATE_EXPIRED');
  }

  await prisma.metaOAuthState.update({
    where: { id: stateRecord.id },
    data: { consumedAt: new Date() },
  });

  const clientId = getPinterestClientId();
  const clientSecret = getPinterestClientSecret();

  if (!clientId || !clientSecret) {
    throw new PinterestOAuthError('Pinterest credentials missing', 'MISSING_CREDENTIALS');
  }

  const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: stateRecord.redirectUri,
  });

  const res = await fetch('https://api.pinterest.com/v5/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${authHeader}`,
    },
    body,
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const errorMessage = data.message || data.error || 'Failed to exchange token';
    throw new PinterestOAuthError(errorMessage, 'TOKEN_EXCHANGE_FAILED');
  }

  return {
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
    refreshToken: (data.refresh_token as string) || null,
    refreshTokenExpiresIn: data.refresh_token_expires_in as number | null,
    userId: stateRecord.userId,
    workspaceId: stateRecord.workspaceId,
    scope: data.scope as string,
  };
}

export async function getPinterestProfile(accessToken: string) {
  const res = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new PinterestOAuthError(data.message || 'Failed to fetch Pinterest profile', 'PROFILE_FETCH_FAILED');
  }

  return {
    id: data.account_type === 'BUSINESS' ? data.id : data.username, // Using username as fallback ID if business ID missing
    name: data.business_name || data.username,
    username: data.username,
    picture: data.profile_image,
  };
}

export async function savePinterestAccount(
  tokenData: Awaited<ReturnType<typeof exchangePinterestCode>>,
  profile: Awaited<ReturnType<typeof getPinterestProfile>>,
  session: SessionPayload
) {
  const platformAccountId = profile.id;

  const existing = await prisma.socialAccount.findFirst({
    where: {
      workspaceId: session.workspaceId,
      platform: 'PINTEREST',
      platformAccountId,
    },
  });

  if (existing) {
    const encryptedAccessToken = encryptToken(tokenData.accessToken);
    const encryptedRefreshToken = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : null;
    const expiresAt = tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null;

    await prisma.oAuthToken.update({
      where: { socialAccountId: existing.id },
      data: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        expiresAt,
      },
    });

    await prisma.socialAccount.update({
      where: { id: existing.id },
      data: { status: 'CONNECTED', name: profile.name, profileImageUrl: profile.picture, username: profile.username },
    });

    return existing;
  }

  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (
    entitlements.limits.maxSocialAccounts !== null &&
    entitlements.usage.connectedAccounts >= entitlements.limits.maxSocialAccounts
  ) {
    throw new PinterestOAuthError(
      'SOCIAL_ACCOUNT_LIMIT_REACHED',
      `Your current plan allows ${entitlements.limits.maxSocialAccounts} connected social accounts.`
    );
  }

  const encryptedAccessToken = encryptToken(tokenData.accessToken);
  const encryptedRefreshToken = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : null;
  const expiresAt = tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null;

  const connectedAccount = await prisma.socialAccount.create({
    data: {
      workspaceId: session.workspaceId,
      platform: 'PINTEREST',
      platformAccountId,
      name: profile.name,
      username: profile.username,
      profileImageUrl: profile.picture,
      status: 'CONNECTED',
      token: {
        create: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          expiresAt,
        },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: session.workspaceId,
      action: 'SOCIAL_ACCOUNT_CONNECTED',
      details: `Connected Pinterest account: ${profile.name}`,
      metadata: JSON.stringify({ platform: 'PINTEREST', name: profile.name, resourceId: connectedAccount.id }),
    },
  });

  return connectedAccount;
}

export async function getPinterestBoards(accessToken: string) {
  const res = await fetch('https://api.pinterest.com/v5/boards', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  
  if (!res.ok) {
    console.warn('[Pinterest] Failed to fetch boards', await res.text());
    return [];
  }
  
  const data = await res.json();
  return data.items || [];
}
