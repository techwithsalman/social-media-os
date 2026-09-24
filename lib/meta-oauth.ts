import crypto from 'crypto';
import prisma from './prisma';
import type { SessionPayload } from './auth';
import { encryptToken } from './crypto';
import { getWorkspaceEntitlements } from './billing';
import {
  buildMetaGraphUrl,
  calculateTokenExpiry,
  encodeMetaTokenMetadata,
  getConfiguredMetaRedirectUri,
  getMetaGraphApiVersion,
  isMetaOAuthConfigured,
  sanitizeMetaErrorMessage,
} from './meta-token-service';

const META_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
const META_SELECTION_TTL_MS = 30 * 60 * 1000;

type MetaSelectionPlatform = 'FACEBOOK' | 'INSTAGRAM';

interface MetaOAuthStateRow {
  id: string;
  stateHash: string;
  userId: string;
  workspaceId: string;
  redirectUri: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

interface MetaOAuthSelectionRow {
  id: string;
  selectionTokenHash: string;
  userId: string;
  workspaceId: string;
  accountsJson: string;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
}

interface MetaPageApiAccount {
  id: string;
  name?: string;
  username?: string;
  access_token?: string;
  tasks?: string[];
  picture?: {
    data?: {
      url?: string;
    };
  };
  instagram_business_account?: {
    id: string;
    username?: string;
    name?: string;
    profile_picture_url?: string;
  };
}

interface MetaInstagramApiAccount {
  id: string;
  username?: string;
  name?: string;
  profile_picture_url?: string;
}

interface MetaGraphCollection<T> {
  data?: T[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
    code?: number | string;
  };
}

interface MetaGraphErrorBody {
  error?: {
    message?: string;
    code?: number | string;
  };
}

export interface MetaDiscoveredAccount {
  id: string;
  platform: MetaSelectionPlatform;
  platformAccountId: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  linkedFacebookPageId?: string;
  encryptedAccessToken: string;
  expiresAt: string | null;
  scope: string | null;
}

export interface MetaSelectableAccount {
  id: string;
  platform: MetaSelectionPlatform;
  platformAccountId: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  linkedFacebookPageId?: string;
  alreadyConnected: boolean;
}

export class MetaOAuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'MetaOAuthError';
    this.code = code;
    this.status = status;
  }
}

function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function expiresAtIso(ttlMs: number) {
  return new Date(Date.now() + ttlMs).toISOString();
}

function assertSessionMatchesRow(
  row: { userId: string; workspaceId: string; consumedAt: Date | string | null; expiresAt: Date | string },
  session: SessionPayload
) {
  if (row.userId !== session.userId || row.workspaceId !== session.workspaceId) {
    throw new MetaOAuthError('META_STATE_INVALID', 'Meta authorization state is invalid.', 403);
  }

  if (row.consumedAt) {
    throw new MetaOAuthError('META_STATE_INVALID', 'Meta authorization state has already been used.', 400);
  }

  const expiresTime = row.expiresAt instanceof Date ? row.expiresAt.getTime() : new Date(row.expiresAt).getTime();
  if (expiresTime <= Date.now()) {
    throw new MetaOAuthError('META_STATE_EXPIRED', 'Meta authorization state has expired.', 410);
  }
}

export async function ensureMetaOAuthStorage() {
  // Managed by Prisma Client models MetaOAuthState and MetaOAuthSelection
}

async function pruneExpiredMetaOAuthRows() {
  const now = new Date();
  try {
    await prisma.metaOAuthState.deleteMany({
      where: {
        OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }],
      },
    });
    await prisma.metaOAuthSelection.deleteMany({
      where: {
        OR: [{ expiresAt: { lte: now } }, { consumedAt: { not: null } }],
      },
    });
  } catch (err) {
    console.warn('[Meta OAuth] Non-critical prune error:', err);
  }
}

function getMetaConfig(requireSecret: boolean) {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const loginConfigId = process.env.META_LOGIN_CONFIG_ID?.trim();
  const redirectUri = getConfiguredMetaRedirectUri();

  if (!appId || !loginConfigId || !redirectUri || (requireSecret && !appSecret)) {
    throw new MetaOAuthError(
      'META_CONFIG_MISSING',
      'Meta OAuth is not configured. Fill META_APP_ID, META_APP_SECRET, META_LOGIN_CONFIG_ID, and META_REDIRECT_URI.',
      500
    );
  }

  return {
    appId,
    appSecret: appSecret || '',
    loginConfigId,
    redirectUri,
  };
}

async function requestMetaGraph<T>(
  path: string,
  params: Record<string, string>,
  method: 'GET' | 'POST' = 'GET',
): Promise<T> {
  const url = new URL(buildMetaGraphUrl(path));

  if (method === 'GET') {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const res = await fetch(url.toString(), {
    method,
    headers:
      method === 'POST'
        ? { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
        : { Accept: 'application/json' },
    body: method === 'POST' ? new URLSearchParams(params) : undefined,
  });
  const data: T & MetaGraphErrorBody = (await res.json().catch(() => ({}))) as T & MetaGraphErrorBody;

  if (!res.ok) {
    const code = data.error?.code ? `META_${data.error.code}` : 'META_API_ERROR';
    throw new MetaOAuthError(code, sanitizeMetaErrorMessage(data.error?.message), res.status);
  }

  return data as T;
}

async function requestMetaGraphUrl<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  const data: T & MetaGraphErrorBody = (await res.json().catch(() => ({}))) as T & MetaGraphErrorBody;

  if (!res.ok) {
    const code = data.error?.code ? `META_${data.error.code}` : 'META_API_ERROR';
    throw new MetaOAuthError(code, sanitizeMetaErrorMessage(data.error?.message), res.status);
  }

  return data as T;
}

async function requestPaginatedMetaGraph<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const firstUrl = new URL(buildMetaGraphUrl(path));
  Object.entries(params).forEach(([key, value]) => firstUrl.searchParams.set(key, value));

  const items: T[] = [];
  let nextUrl: string | null = firstUrl.toString();
  let pageCount = 0;

  while (nextUrl && pageCount < 10) {
    const data: MetaGraphCollection<T> = await requestMetaGraphUrl<MetaGraphCollection<T>>(nextUrl);
    items.push(...(data.data || []));
    nextUrl = data.paging?.next || null;
    pageCount += 1;
  }

  return items;
}

async function fetchInstagramAccountDetails(igAccountId: string, pageAccessToken: string) {
  try {
    return await requestMetaGraph<MetaInstagramApiAccount>(`/${igAccountId}`, {
      fields: 'id,username,name,profile_picture_url',
      access_token: pageAccessToken,
    });
  } catch {
    return null;
  }
}

function buildTokenScopeMetadata(input: {
  scopes?: string;
  linkedFacebookPageId?: string;
  pageTasks?: string[];
}) {
  return encodeMetaTokenMetadata({
    tokenType: 'PAGE_ACCESS_TOKEN',
    scopes: input.scopes,
    linkedFacebookPageId: input.linkedFacebookPageId,
    pageTasks: input.pageTasks,
    loginConfigId: process.env.META_LOGIN_CONFIG_ID?.trim(),
  });
}

export async function createMetaAuthorizationUrl(session: SessionPayload) {
  await pruneExpiredMetaOAuthRows();

  const config = getMetaConfig(false);
  const state = randomToken();
  const stateHash = hashToken(state);

  await prisma.metaOAuthState.create({
    data: {
      stateHash,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri: config.redirectUri,
      expiresAt: new Date(Date.now() + META_OAUTH_STATE_TTL_MS),
    },
  });

  const authUrl = new URL(`https://www.facebook.com/${getMetaGraphApiVersion()}/dialog/oauth`);
  authUrl.searchParams.set('client_id', config.appId);
  authUrl.searchParams.set('display', 'page');
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('config_id', config.loginConfigId);
  authUrl.searchParams.set('override_default_response_type', 'true');
  authUrl.searchParams.set('auth_type', 'rerequest');
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}

export async function consumeMetaOAuthState(state: string, session: SessionPayload) {
  const row = await prisma.metaOAuthState.findUnique({
    where: { stateHash: hashToken(state) },
  });

  if (!row) {
    throw new MetaOAuthError('META_STATE_INVALID', 'Meta authorization state is invalid.', 400);
  }

  assertSessionMatchesRow(row, session);

  const updatedRow = await prisma.metaOAuthState.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  return updatedRow;
}

export async function exchangeMetaCodeForUserToken(code: string, redirectUri: string) {
  const config = getMetaConfig(true);

  const shortLivedToken = await requestMetaGraph<{
    access_token?: string;
    expires_in?: number;
    granted_scopes?: string;
    scope?: string;
  }>('/oauth/access_token', {
    client_id: config.appId,
    redirect_uri: redirectUri,
    client_secret: config.appSecret,
    code,
  });

  if (!shortLivedToken.access_token) {
    throw new MetaOAuthError('META_TOKEN_EXCHANGE_FAILED', 'Meta did not return an access token.', 502);
  }

  const longLivedToken = await requestMetaGraph<{
    access_token?: string;
    expires_in?: number;
    granted_scopes?: string;
    scope?: string;
  }>('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortLivedToken.access_token,
  }).catch(() => null);

  const accessToken = longLivedToken?.access_token || shortLivedToken.access_token;
  const expiresAt = calculateTokenExpiry(longLivedToken?.expires_in || shortLivedToken.expires_in);
  const scopes = longLivedToken?.granted_scopes || longLivedToken?.scope || shortLivedToken.granted_scopes || shortLivedToken.scope;

  return {
    accessToken,
    expiresAt,
    scopes,
  };
}

export async function discoverMetaAccounts(accessToken: string, tokenExpiresAt: Date | null, scopes?: string) {
  const pages = await requestPaginatedMetaGraph<MetaPageApiAccount>('/me/accounts', {
    fields:
      'id,name,username,access_token,tasks,picture{url},instagram_business_account{id,username,name,profile_picture_url}',
    access_token: accessToken,
  });

  const candidates: MetaDiscoveredAccount[] = [];
  const expiresAt = tokenExpiresAt?.toISOString() || null;

  for (const page of pages) {
    if (!page.id || !page.access_token) continue;

    const encryptedPageToken = encryptToken(page.access_token);
    const pageName = page.name || 'Facebook Page';
    const pageScope = buildTokenScopeMetadata({
      scopes,
      linkedFacebookPageId: page.id,
      pageTasks: page.tasks,
    });

    candidates.push({
      id: `FACEBOOK:${page.id}`,
      platform: 'FACEBOOK',
      platformAccountId: page.id,
      name: pageName,
      username: page.username || page.id,
      profileImageUrl: page.picture?.data?.url,
      linkedFacebookPageId: page.id,
      encryptedAccessToken: encryptedPageToken,
      expiresAt,
      scope: pageScope,
    });

    const igReference = page.instagram_business_account;
    if (!igReference?.id) continue;

    const igDetails = await fetchInstagramAccountDetails(igReference.id, page.access_token);
    const username = igDetails?.username || igReference.username || igReference.id;
    const igName = igDetails?.name || igReference.name || username;

    candidates.push({
      id: `INSTAGRAM:${igReference.id}`,
      platform: 'INSTAGRAM',
      platformAccountId: igReference.id,
      name: igName,
      username,
      profileImageUrl: igDetails?.profile_picture_url || igReference.profile_picture_url,
      linkedFacebookPageId: page.id,
      encryptedAccessToken: encryptedPageToken,
      expiresAt,
      scope: pageScope,
    });
  }

  return candidates;
}

export async function createMetaAccountSelection(session: SessionPayload, accounts: MetaDiscoveredAccount[]) {
  const token = randomToken();

  await prisma.metaOAuthSelection.create({
    data: {
      selectionTokenHash: hashToken(token),
      userId: session.userId,
      workspaceId: session.workspaceId,
      accountsJson: JSON.stringify(accounts),
      expiresAt: new Date(Date.now() + META_SELECTION_TTL_MS),
    },
  });

  return token;
}

async function getSelectionRow(token: string, session: SessionPayload) {
  const row = await prisma.metaOAuthSelection.findUnique({
    where: { selectionTokenHash: hashToken(token) },
  });

  if (!row) {
    throw new MetaOAuthError('META_SELECTION_INVALID', 'Meta account selection was not found.', 404);
  }

  assertSessionMatchesRow(row, session);
  return row;
}

function parseSelectionAccounts(row: { accountsJson: string }) {
  try {
    const accounts = JSON.parse(row.accountsJson) as MetaDiscoveredAccount[];
    return accounts.filter((account) => account.platform === 'FACEBOOK' || account.platform === 'INSTAGRAM');
  } catch {
    throw new MetaOAuthError('META_SELECTION_INVALID', 'Meta account selection is invalid.', 400);
  }
}

async function getExistingMetaAccountKeys(workspaceId: string) {
  const existingAccounts = await prisma.socialAccount.findMany({
    where: {
      workspaceId,
      platform: { in: ['FACEBOOK', 'INSTAGRAM'] },
    },
    select: {
      platform: true,
      platformAccountId: true,
    },
  });

  return new Set(existingAccounts.map((account) => `${account.platform}:${account.platformAccountId}`));
}

export async function getMetaSelectionView(token: string, session: SessionPayload) {
  const row = await getSelectionRow(token, session);
  const accounts = parseSelectionAccounts(row);
  const existingKeys = await getExistingMetaAccountKeys(session.workspaceId);

  return {
    accounts: accounts.map<MetaSelectableAccount>((account) => ({
      id: account.id,
      platform: account.platform,
      platformAccountId: account.platformAccountId,
      name: account.name,
      username: account.username,
      profileImageUrl: account.profileImageUrl,
      linkedFacebookPageId: account.linkedFacebookPageId,
      alreadyConnected: existingKeys.has(`${account.platform}:${account.platformAccountId}`),
    })),
    expiresAt: row.expiresAt instanceof Date ? row.expiresAt.toISOString() : String(row.expiresAt),
  };
}

export async function connectSelectedMetaAccounts(
  token: string,
  selectedAccountIds: string[],
  session: SessionPayload
) {
  const selectedIds = new Set(selectedAccountIds);
  if (selectedIds.size === 0) {
    throw new MetaOAuthError('META_SELECTION_REQUIRED', 'Choose at least one Meta account to connect.', 400);
  }

  const row = await getSelectionRow(token, session);
  const accounts = parseSelectionAccounts(row);
  const selectedAccounts = accounts.filter((account) => selectedIds.has(account.id));

  if (selectedAccounts.length === 0) {
    throw new MetaOAuthError('META_SELECTION_REQUIRED', 'Choose at least one valid Meta account to connect.', 400);
  }

  const existingKeys = await getExistingMetaAccountKeys(session.workspaceId);
  const newAccounts = selectedAccounts.filter(
    (account) => !existingKeys.has(`${account.platform}:${account.platformAccountId}`)
  );

  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (
    entitlements.limits.maxSocialAccounts !== null &&
    entitlements.usage.connectedAccounts + newAccounts.length > entitlements.limits.maxSocialAccounts
  ) {
    throw new MetaOAuthError(
      'SOCIAL_ACCOUNT_LIMIT_REACHED',
      `Your current plan allows ${entitlements.limits.maxSocialAccounts} connected social accounts.`,
      403
    );
  }

  const connectedAccounts = [];

  for (const account of newAccounts) {
    const connectedAccount = await prisma.socialAccount.create({
      data: {
        workspaceId: session.workspaceId,
        platform: account.platform,
        platformAccountId: account.platformAccountId,
        name: account.name,
        username: account.username,
        profileImageUrl: account.profileImageUrl,
        status: 'CONNECTED',
        isMock: false,
        token: {
          create: {
            accessToken: account.encryptedAccessToken,
            refreshToken: null,
            scope: account.scope,
            expiresAt: account.expiresAt ? new Date(account.expiresAt) : null,
          },
        },
      },
    });

    connectedAccounts.push({
      id: connectedAccount.id,
      platform: connectedAccount.platform,
      name: connectedAccount.name,
      username: connectedAccount.username,
    });
  }

  await prisma.metaOAuthSelection.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: 'ACCOUNT_CONNECTED',
      details: `Connected ${connectedAccounts.length} Meta account(s) via Facebook Login for Business.`,
    },
  });

  return {
    connectedAccounts,
    skippedDuplicates: selectedAccounts.length - newAccounts.length,
  };
}

export function canStartMetaOAuth() {
  return isMetaOAuthConfigured();
}
