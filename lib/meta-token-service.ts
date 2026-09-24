import prisma from './prisma';

export const META_CALLBACK_PATH = '/api/oauth/meta/callback';
export const META_LOCAL_REDIRECT_URI = `http://localhost:3000${META_CALLBACK_PATH}`;
export const META_PRODUCTION_REDIRECT_URI = `https://app.techwithsalman.online${META_CALLBACK_PATH}`;

const DEFAULT_META_GRAPH_API_VERSION = 'v23.0';
const META_TOKEN_EXPIRY_SKEW_MS = 5 * 60 * 1000;

export type MetaPlatform = 'FACEBOOK' | 'INSTAGRAM';

export interface MetaTokenMetadata {
  provider: 'META';
  tokenType: 'PAGE_ACCESS_TOKEN';
  scopes?: string;
  linkedFacebookPageId?: string;
  pageTasks?: string[];
  loginConfigId?: string;
}

export function isRealApiMode() {
  return process.env.REAL_API_MODE === 'true' && process.env.MOCK_API_MODE !== 'true';
}

export function isMetaPlatform(platform: string): platform is MetaPlatform {
  return platform === 'FACEBOOK' || platform === 'INSTAGRAM';
}

export function getMetaGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_META_GRAPH_API_VERSION;
}

export function getMetaGraphBaseUrl() {
  return `https://graph.facebook.com/${getMetaGraphApiVersion()}`;
}

export function buildMetaGraphUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getMetaGraphBaseUrl()}${normalizedPath}`;
}

export function getConfiguredMetaRedirectUri() {
  return process.env.META_REDIRECT_URI?.trim() || '';
}

export function isMetaOAuthConfigured() {
  return Boolean(
    process.env.META_APP_ID?.trim() &&
      process.env.META_APP_SECRET?.trim() &&
      process.env.META_LOGIN_CONFIG_ID?.trim() &&
      getConfiguredMetaRedirectUri()
  );
}

export function sanitizeMetaErrorMessage(message?: string | null) {
  if (!message) return 'Meta request failed.';
  return message
    .replace(/access_token=[^&\s]+/gi, 'access_token=[redacted]')
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=[redacted]')
    .replace(/\bEAA[A-Za-z0-9_-]{20,}\b/g, '[redacted]')
    .replace(/[A-Za-z0-9_-]{120,}/g, '[redacted]');
}

export function encodeMetaTokenMetadata(metadata: Omit<MetaTokenMetadata, 'provider'>) {
  return JSON.stringify({
    provider: 'META',
    ...metadata,
  } satisfies MetaTokenMetadata);
}

export function parseMetaTokenMetadata(scope?: string | null): MetaTokenMetadata | null {
  if (!scope) return null;

  try {
    const parsed = JSON.parse(scope);
    if (parsed?.provider === 'META') {
      return parsed as MetaTokenMetadata;
    }
  } catch {
    return null;
  }

  return null;
}

export function calculateTokenExpiry(expiresIn?: number | null) {
  if (!expiresIn || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
  return new Date(Date.now() + expiresIn * 1000);
}

export function isTokenExpired(expiresAt?: Date | string | null) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now() + META_TOKEN_EXPIRY_SKEW_MS;
}

export function isLikelyMetaTokenError(errorCode?: string, errorMessage?: string) {
  const normalizedCode = String(errorCode || '').replace(/^META_/, '');
  const normalizedMessage = (errorMessage || '').toLowerCase();

  return (
    ['102', '190', '463', '467'].includes(normalizedCode) ||
    normalizedMessage.includes('access token') ||
    normalizedMessage.includes('oauth') ||
    normalizedMessage.includes('session has expired') ||
    normalizedMessage.includes('invalid token')
  );
}

export async function markMetaAccountNeedsReconnection(accountId: string) {
  await prisma.socialAccount.update({
    where: { id: accountId },
    data: { status: 'NEEDS_RECONNECTION' },
  });
}

export async function syncMetaAccountTokenStatuses(workspaceId: string) {
  const accounts = await prisma.socialAccount.findMany({
    where: {
      workspaceId,
      platform: { in: ['FACEBOOK', 'INSTAGRAM'] },
      isMock: false,
      status: 'CONNECTED',
    },
    include: { token: true },
  });

  const expiredAccountIds = accounts
    .filter((account) => !account.token?.accessToken || isTokenExpired(account.token.expiresAt))
    .map((account) => account.id);

  if (expiredAccountIds.length > 0) {
    await prisma.socialAccount.updateMany({
      where: { id: { in: expiredAccountIds }, workspaceId },
      data: { status: 'EXPIRED' },
    });
  }
}

export async function assertMetaAccountTokenUsable(account: {
  id: string;
  platform: string;
  status: string;
  isMock: boolean;
  token?: { accessToken?: string | null; expiresAt?: Date | string | null } | null;
}) {
  if (!isMetaPlatform(account.platform) || account.isMock) return;

  if (account.status !== 'CONNECTED') {
    throw new Error('This Meta account needs to be reconnected before publishing.');
  }

  if (!account.token?.accessToken) {
    await markMetaAccountNeedsReconnection(account.id);
    throw new Error('This Meta account is missing a valid token. Reconnect the account.');
  }

  if (isTokenExpired(account.token.expiresAt)) {
    await prisma.socialAccount.update({
      where: { id: account.id },
      data: { status: 'EXPIRED' },
    });
    throw new Error('This Meta account token has expired. Reconnect the account.');
  }
}

export function buildPublicMediaUrl(mediaUrl?: string | null) {
  if (!mediaUrl) return undefined;
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl;

  const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const path = mediaUrl.startsWith('/') ? mediaUrl : `/${mediaUrl}`;
  return `${appUrl}${path}`;
}
