import crypto from 'crypto';
import prisma from './prisma';
import { SessionPayload } from './auth';
import { decryptToken, encryptToken } from './crypto';

export class TikTokOAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TikTokOAuthError';
  }
}

/**
 * TikTok Token Lifecycle Constants (Effective December 1, 2026 update)
 * - Access tokens valid for 2 hours (7,200 seconds)
 * - Refresh tokens valid for 180 days (15,552,000 seconds)
 * - Each successful refresh returns a brand new refresh token and invalidates the previous one (Refresh Token Rotation)
 */
export const TIKTOK_ACCESS_TOKEN_LIFETIME_SEC = 2 * 60 * 60; // 7,200s (2 hours)
export const TIKTOK_REFRESH_TOKEN_LIFETIME_SEC = 180 * 24 * 60 * 60; // 15,552,000s (180 days)
export const TIKTOK_TOKEN_EXPIRY_BUFFER_SEC = 5 * 60; // 5 minutes safety buffer before expiry

export interface TikTokTokenRefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
  openId?: string;
  scope?: string;
}

function sanitizeEnv(val: string | undefined): string {
  if (!val) return '';
  return val.trim().replace(/^["']|["']$/g, '').replace(/\r/g, '');
}

export function getTikTokClientKey(): string {
  return sanitizeEnv(process.env.TIKTOK_CLIENT_KEY);
}

export function getTikTokClientSecret(): string {
  return sanitizeEnv(process.env.TIKTOK_CLIENT_SECRET);
}

export function getTikTokRedirectUri(): string {
  const envUri = sanitizeEnv(process.env.TIKTOK_REDIRECT_URI);
  if (envUri) return envUri;

  const appUrl = sanitizeEnv(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL);
  if (appUrl) {
    const cleanAppUrl = appUrl.replace(/\/+$/, '');
    return `${cleanAppUrl}/tiktok/callback/`;
  }

  return (process.env.NODE_ENV === 'production' ? 'https://app.techwithsalman.online/tiktok/callback/' : 'http://localhost:3000/tiktok/callback/');
}

export function maskCredential(val: string): string {
  if (!val || val.length <= 6) return '***';
  return `${val.slice(0, 3)}***${val.slice(-3)}`;
}

export function isRealTikTokConfigured(): boolean {
  const key = getTikTokClientKey();
  const secret = getTikTokClientSecret();
  return Boolean(key && secret);
}

export function isTikTokSandbox(): boolean {
  const clientKey = getTikTokClientKey();
  return clientKey.startsWith('sb');
}

export function getTikTokEnvironmentInfo() {
  const clientKey = getTikTokClientKey();
  const redirectUri = getTikTokRedirectUri();
  const isConfigured = isRealTikTokConfigured();
  const isSandbox = isTikTokSandbox();

  return {
    isConfigured,
    environment: isSandbox ? ('SANDBOX' as const) : ('PRODUCTION' as const),
    clientKeyMasked: maskCredential(clientKey),
    redirectUri,
    isHttps: redirectUri.startsWith('https://'),
  };
}

function generatePkceVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function createTikTokAuthorizationUrl(session: SessionPayload): Promise<string> {
  const clientKey = getTikTokClientKey();
  if (!clientKey) {
    throw new TikTokOAuthError('TIKTOK_CLIENT_KEY is missing in environment variables', 'MISSING_CLIENT_KEY');
  }

  const redirectUri = getTikTokRedirectUri();
  const state = crypto.randomBytes(24).toString('hex');
  const codeVerifier = generatePkceVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.tikTokOAuthState.create({
    data: {
      stateHash: state,
      codeVerifier,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri,
      expiresAt,
    },
  });

  const scope = 'user.info.basic,video.upload,video.publish';

  const params = new URLSearchParams({
    client_key: clientKey,
    scope,
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    disable_auto_auth: '1',
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;

  console.log('[TIKTOK DEBUG] CLIENT KEY:', maskCredential(clientKey));
  console.log('[TIKTOK DEBUG] REDIRECT URI:', redirectUri);
  console.log('[TIKTOK DEBUG] PKCE CHALLENGE FORMAT: BASE64URL');
  console.log('[TIKTOK DEBUG] AUTH URL INITIATED');

  return authUrl;
}

export async function exchangeTikTokCodeForTokens(code: string, state: string) {
  console.log('[TikTok OAuth State Validation] Validating state prefix:', state ? state.slice(0, 8) + '...' : 'none');
  const stateRecord = await prisma.tikTokOAuthState.findUnique({
    where: { stateHash: state },
  });

  if (!stateRecord) {
    console.error('[TikTok OAuth State Error] Invalid or unverified state');
    throw new TikTokOAuthError('Invalid or unverified OAuth state', 'INVALID_STATE');
  }

  if (stateRecord.consumedAt) {
    console.error('[TikTok OAuth State Error] State already consumed');
    throw new TikTokOAuthError('OAuth state already consumed. Please restart login.', 'STATE_ALREADY_USED');
  }

  if (stateRecord.expiresAt < new Date()) {
    console.error('[TikTok OAuth State Error] State expired');
    throw new TikTokOAuthError('OAuth state expired. Please restart login.', 'STATE_EXPIRED');
  }

  console.log('[TikTok OAuth State Valid] State matched successfully for user:', stateRecord.userId);

  // Mark state as consumed
  await prisma.tikTokOAuthState.update({
    where: { id: stateRecord.id },
    data: { consumedAt: new Date() },
  });

  const clientKey = getTikTokClientKey();
  const clientSecret = getTikTokClientSecret();

  if (!clientKey || !clientSecret) {
    throw new TikTokOAuthError('TikTok API credentials missing in .env', 'MISSING_CREDENTIALS');
  }

  const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
  const body = new URLSearchParams({
    client_key: clientKey,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: stateRecord.redirectUri,
    code_verifier: stateRecord.codeVerifier,
  });

  console.log('[TikTok OAuth Token Exchange] Exchanging code for tokens...', {
    clientKey: maskCredential(clientKey),
    redirectUri: stateRecord.redirectUri,
  });

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json().catch(() => ({}));

  const hasError =
    !res.ok ||
    (data.error && data.error !== 'ok' && (typeof data.error !== 'object' || data.error.code !== 'ok')) ||
    (data.error_code && data.error_code !== 'ok' && data.error_code !== 0 && data.error_code !== '0');

  if (hasError) {
    const errorMsg =
      data.error_description ||
      (typeof data.error === 'object' ? data.error?.message : data.error) ||
      data.message ||
      'Failed to exchange token with TikTok';
    const errorCode =
      data.error_code ||
      (typeof data.error === 'object' ? data.error?.code : data.error) ||
      'TOKEN_EXCHANGE_FAILED';

    console.error('[TikTok OAuth Token Exchange Error]', {
      status: res.status,
      errorCode,
      errorDescription: errorMsg,
    });
    throw new TikTokOAuthError(errorMsg, String(errorCode).toUpperCase());
  }

  const accessToken = ((data.access_token || data.data?.access_token) as string || '').trim();
  const refreshToken = ((data.refresh_token || data.data?.refresh_token) as string || '').trim();
  const expiresIn = (data.expires_in || data.data?.expires_in || TIKTOK_ACCESS_TOKEN_LIFETIME_SEC) as number;
  const refreshExpiresIn = (data.refresh_expires_in || data.data?.refresh_expires_in || TIKTOK_REFRESH_TOKEN_LIFETIME_SEC) as number;
  const rawOpenId = (data.open_id || data.data?.open_id || data.openId || data.data?.openId) as string;
  const openId = (rawOpenId || '').trim();
  const scope = (data.scope || data.data?.scope || 'user.info.basic,video.upload,video.publish') as string;

  if (!accessToken) {
    throw new TikTokOAuthError('No access token returned from TikTok token endpoint', 'MISSING_ACCESS_TOKEN');
  }

  if (!openId) {
    throw new TikTokOAuthError('TikTok OAuth failed: No valid account identifier (open_id) was returned by TikTok.', 'MISSING_OPEN_ID');
  }

  console.log('[TikTok OAuth Token Exchange Success] Tokens and canonical open_id received successfully');

  return {
    accessToken,
    refreshToken,
    expiresIn,
    refreshExpiresIn,
    openId,
    scope,
    userId: stateRecord.userId,
    workspaceId: stateRecord.workspaceId,
  };
}

export async function fetchTikTokUserInfo(accessToken: string, canonicalOpenId?: string) {
  let openId = (canonicalOpenId || '').trim();
  let displayName = '';
  let username = '';
  let avatarUrl = '';
  let isTokenAuthError = false;
  let lastErrorMessage = '';

  // 1. Fetch user info via /v2/user/info/ with only supported fields under user.info.basic (no union_id)
  try {
    const fields = 'open_id,avatar_url,avatar_url_100,avatar_large_url,display_name';
    const url = `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json().catch(() => ({}));
    console.log('[TikTok User Info API] Status:', res.status, 'Error Code:', data.error?.code);

    if (res.status === 401 || data.error?.code === 'access_token_invalid' || data.error?.code === 'token_expired') {
      isTokenAuthError = true;
      lastErrorMessage = data.error?.message || 'Access token invalid or expired';
    } else if (res.ok && data.error?.code === 'ok' && data.data?.user) {
      const u = data.data.user;
      if (u.open_id) openId = u.open_id.trim();
      displayName = u.display_name || '';
      avatarUrl = u.avatar_url || u.avatar_large_url || u.avatar_url_100 || '';
    } else if (data.error?.message) {
      lastErrorMessage = data.error.message;
    }
  } catch (err: any) {
    console.warn('[TikTok User Info API Exception]:', err?.message || err);
  }

  // 2. Fetch creator info via /v2/post/publish/creator_info/query/ for creator_username
  try {
    const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = await res.json().catch(() => ({}));
    console.log('[TikTok Creator Info Query API] Status:', res.status, 'Error Code:', data.error?.code);

    if (res.status === 401 || data.error?.code === 'access_token_invalid' || data.error?.code === 'token_expired') {
      isTokenAuthError = true;
      if (!lastErrorMessage) lastErrorMessage = data.error?.message || 'Access token invalid or expired';
    } else if (res.ok && data.error?.code === 'ok' && data.data) {
      const d = data.data;
      if (!displayName && d.creator_nickname) {
        displayName = d.creator_nickname;
      }
      if (!avatarUrl && d.creator_avatar_url) {
        avatarUrl = d.creator_avatar_url;
      }
      if (d.creator_username) {
        username = d.creator_username;
      }
    }
  } catch (err: any) {
    console.warn('[TikTok Creator Info Query API Exception]:', err?.message || err);
  }

  if (isTokenAuthError && !openId) {
    throw new TikTokOAuthError(lastErrorMessage || 'TikTok access token is expired or invalid', 'TOKEN_EXPIRED');
  }

  // If both openId and profile info are completely absent, we cannot identify the account
  if (!openId) {
    throw new TikTokOAuthError(lastErrorMessage || 'Failed to retrieve TikTok account identifier', 'USER_INFO_FAILED');
  }

  if (!username && displayName) {
    username = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  return {
    openId,
    displayName: displayName || (username ? `@${username}` : 'TikTok Creator'),
    username: username || '',
    avatarUrl: avatarUrl || null,
  };
}

export async function refreshTikTokToken(refreshToken: string): Promise<TikTokTokenRefreshResult> {
  const clientKey = getTikTokClientKey();
  const clientSecret = getTikTokClientSecret();

  if (!clientKey || !clientSecret) {
    throw new TikTokOAuthError('TikTok credentials missing', 'MISSING_CREDENTIALS');
  }

  console.log('[TikTok Token Refresh] Initiating atomic refresh token rotation with TikTok OAuth API...');

  const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  const data = await res.json().catch(() => ({}));
  console.log('[TikTok Token Refresh] Status:', res.status, 'Error:', data.error || data.error_code || 'none');

  if (!res.ok || data.error || (data.error_code && data.error_code !== 'ok' && data.error_code !== 0)) {
    const errCode = data.error_code || data.error?.code || data.error || 'REFRESH_FAILED';
    const errMsg = data.error_description || data.error?.message || data.message || 'TikTok token refresh failed';

    const isReauthRequired =
      res.status === 400 ||
      res.status === 401 ||
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

    throw new TikTokOAuthError(errMsg, String(errCode).toUpperCase());
  }

  const rawAccessToken = ((data.access_token || data.data?.access_token) as string || '').trim();
  const rawRefreshToken = ((data.refresh_token || data.data?.refresh_token) as string || '').trim();
  const expiresIn = (data.expires_in || data.data?.expires_in || TIKTOK_ACCESS_TOKEN_LIFETIME_SEC) as number;
  const refreshExpiresIn = (data.refresh_expires_in || data.data?.refresh_expires_in || TIKTOK_REFRESH_TOKEN_LIFETIME_SEC) as number;
  const openId = (data.open_id || data.data?.open_id) as string | undefined;
  const scope = (data.scope || data.data?.scope) as string | undefined;

  if (!rawAccessToken) {
    throw new TikTokOAuthError('No access token returned from TikTok refresh endpoint', 'MISSING_ACCESS_TOKEN');
  }

  // Under Refresh Token Rotation, TikTok issues a new refresh token and invalidates the previous one
  const newRefreshToken = rawRefreshToken || refreshToken;

  return {
    accessToken: rawAccessToken,
    refreshToken: newRefreshToken,
    expiresIn,
    refreshExpiresIn,
    openId,
    scope,
  };
}

// Concurrency control: Single-flight in-memory promise map preventing parallel refresh collisions
const inFlightTikTokRefreshes = new Map<string, Promise<string>>();

/**
 * Atomically refreshes the TikTok OAuth token for the given account with safe concurrency locking.
 * Handles Refresh Token Rotation: saves new access_token AND new refresh_token atomically.
 * Updates account status to EXPIRED if reauthorization is required.
 */
export async function refreshTikTokTokenWithLock(accountId: string): Promise<string> {
  // If a refresh is already in-flight for this account, await the existing promise
  if (inFlightTikTokRefreshes.has(accountId)) {
    console.log(`[TikTok Concurrency Lock] Reusing in-flight refresh promise for account: ${accountId}`);
    return inFlightTikTokRefreshes.get(accountId)!;
  }

  const refreshFlight = (async () => {
    try {
      const account = await prisma.socialAccount.findUnique({
        where: { id: accountId },
        include: { token: true },
      });

      if (!account) {
        throw new TikTokOAuthError('TikTok social account not found in database', 'ACCOUNT_NOT_FOUND');
      }

      if (account.isMock) {
        return 'mock_refreshed_tiktok_token';
      }

      if (!account.token || !account.token.refreshToken) {
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { status: 'NEEDS_RECONNECTION' },
        });
        throw new TikTokOAuthError('No OAuth refresh token available for this account. Reconnection required.', 'REAUTHORIZATION_REQUIRED');
      }

      // Check if another concurrent thread / worker already completed the refresh
      const existingExpiresAt = account.token.expiresAt ? new Date(account.token.expiresAt).getTime() : 0;
      if (existingExpiresAt - Date.now() > TIKTOK_TOKEN_EXPIRY_BUFFER_SEC * 1000) {
        console.log(`[TikTok Concurrency Lock] Account ${accountId} token was already refreshed by another concurrent process.`);
        return decryptToken(account.token.accessToken);
      }

      const decryptedRefreshToken = decryptToken(account.token.refreshToken);
      const refreshResult = await refreshTikTokToken(decryptedRefreshToken);

      const newEncryptedAccess = encryptToken(refreshResult.accessToken);
      const newEncryptedRefresh = encryptToken(refreshResult.refreshToken);
      const newExpiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000);

      // Atomic persistence of both rotated tokens
      await prisma.oAuthToken.update({
        where: { socialAccountId: accountId },
        data: {
          accessToken: newEncryptedAccess,
          refreshToken: newEncryptedRefresh,
          expiresAt: newExpiresAt,
        },
      });

      // Update account status to CONNECTED if it was in error state
      if (account.status !== 'CONNECTED') {
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { status: 'CONNECTED' },
        });
      }

      console.log(`[TikTok Concurrency Lock] Successfully persisted rotated tokens for @${account.username}. New access token valid for ${refreshResult.expiresIn}s.`);
      return refreshResult.accessToken;
    } catch (err: any) {
      if (err instanceof TikTokOAuthError && err.code === 'REAUTHORIZATION_REQUIRED') {
        console.warn(`[TikTok Token Service] Reauthorization required for account ${accountId}: ${err.message}`);
        await prisma.socialAccount.update({
          where: { id: accountId },
          data: { status: 'EXPIRED' },
        });
      }
      throw err;
    } finally {
      inFlightTikTokRefreshes.delete(accountId);
    }
  })();

  inFlightTikTokRefreshes.set(accountId, refreshFlight);
  return refreshFlight;
}

/**
 * Returns a guaranteed-valid TikTok access token for the given account.
 * Automatically checks token expiration (2 hours) and refreshes with concurrency locking if within 5-min expiry window.
 */
export async function getOrRefreshValidTikTokToken(accountId: string): Promise<string> {
  const account = await prisma.socialAccount.findUnique({
    where: { id: accountId },
    include: { token: true },
  });

  if (!account) {
    throw new TikTokOAuthError('TikTok social account not found', 'ACCOUNT_NOT_FOUND');
  }

  if (account.isMock) {
    return 'mock_tiktok_access_token';
  }

  if (!account.token || !account.token.accessToken) {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { status: 'NEEDS_RECONNECTION' },
    });
    throw new TikTokOAuthError('No OAuth access token available for this TikTok account. Please reconnect.', 'REAUTHORIZATION_REQUIRED');
  }

  const tokenRecord = account.token;
  const nowMs = Date.now();
  const expiresAtMs = tokenRecord.expiresAt ? new Date(tokenRecord.expiresAt).getTime() : 0;
  const isNearOrPastExpiry = expiresAtMs - nowMs <= TIKTOK_TOKEN_EXPIRY_BUFFER_SEC * 1000;

  if (isNearOrPastExpiry) {
    console.log(`[TikTok Token Service] Token for @${account.username} is expiring or expired (expiresAt: ${tokenRecord.expiresAt}). Initiating atomic refresh...`);
    return refreshTikTokTokenWithLock(accountId);
  }

  return decryptToken(tokenRecord.accessToken);
}
