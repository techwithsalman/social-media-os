import crypto from 'crypto';
import prisma from './prisma';
import { SessionPayload } from './auth';

export class TikTokOAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TikTokOAuthError';
  }
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

  return 'http://localhost:3000/tiktok/callback/';
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

  const accessToken = (data.access_token || data.data?.access_token) as string;
  const refreshToken = (data.refresh_token || data.data?.refresh_token) as string;
  const expiresIn = (data.expires_in || data.data?.expires_in || 86400) as number;
  const openId = (data.open_id || data.data?.open_id) as string;
  const scope = (data.scope || data.data?.scope || 'user.info.basic,video.upload,video.publish') as string;

  if (!accessToken) {
    throw new TikTokOAuthError('No access token returned from TikTok token endpoint', 'MISSING_ACCESS_TOKEN');
  }

  console.log('[TikTok OAuth Token Exchange Success] Tokens received successfully');

  return {
    accessToken,
    refreshToken,
    expiresIn,
    openId,
    scope,
    userId: stateRecord.userId,
    workspaceId: stateRecord.workspaceId,
  };
}

export async function fetchTikTokUserInfo(accessToken: string) {
  let openId = '';
  let displayName = '';
  let username = '';
  let avatarUrl = '';
  let isTokenAuthError = false;
  let lastErrorMessage = '';

  // 1. Fetch user info via /v2/user/info/ with basic fields authorized under user.info.basic
  try {
    const fields = 'open_id,union_id,avatar_url,avatar_url_100,avatar_large_url,display_name';
    const url = `https://open.tiktokapis.com/v2/user/info/?fields=${fields}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = await res.json();
    console.log('[TikTok User Info API] Status:', res.status, 'Error Code:', data.error?.code);

    if (res.status === 401 || data.error?.code === 'access_token_invalid' || data.error?.code === 'token_expired') {
      isTokenAuthError = true;
      lastErrorMessage = data.error?.message || 'Access token invalid or expired';
    } else if (res.ok && data.error?.code === 'ok' && data.data?.user) {
      const u = data.data.user;
      openId = u.open_id || '';
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

    const data = await res.json();
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

  if (isTokenAuthError && !openId && !displayName && !username) {
    throw new TikTokOAuthError(lastErrorMessage || 'TikTok access token is expired or invalid', 'TOKEN_EXPIRED');
  }

  if (!openId && !displayName && !username) {
    throw new TikTokOAuthError(lastErrorMessage || 'Failed to retrieve TikTok profile info', 'USER_INFO_FAILED');
  }

  if (!username && displayName) {
    username = displayName.toLowerCase().replace(/[^a-z0-9_]/g, '');
  }

  return {
    openId,
    displayName: displayName || 'TikTok Creator',
    username: username || 'tiktok_creator',
    avatarUrl: avatarUrl || null,
  };
}

export async function refreshTikTokToken(refreshToken: string) {
  const clientKey = getTikTokClientKey();
  const clientSecret = getTikTokClientSecret();

  if (!clientKey || !clientSecret) {
    throw new TikTokOAuthError('TikTok credentials missing', 'MISSING_CREDENTIALS');
  }

  console.log('[TikTok Token Refresh] Requesting new access token with refresh_token...');

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

  const data = await res.json();
  console.log('[TikTok Token Refresh] Status:', res.status, 'Error:', data.error || data.error_code || 'none');

  if (!res.ok || data.error || (data.error_code && data.error_code !== 'ok')) {
    const errCode = data.error_code || data.error || 'REFRESH_FAILED';
    const errMsg = data.error_description || data.message || 'TikTok token refresh failed';
    throw new TikTokOAuthError(errMsg, errCode);
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: (data.refresh_token as string) || refreshToken,
    expiresIn: (data.expires_in as number) || 86400,
  };
}
