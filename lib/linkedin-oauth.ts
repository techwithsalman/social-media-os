import { randomBytes, createHash } from 'crypto';
import prisma from './prisma';
import type { SessionPayload } from './auth';
import { encryptToken } from './crypto';
import { getWorkspaceEntitlements } from './billing';

export class LinkedInOAuthError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'LinkedInOAuthError';
  }
}

export function getLinkedInClientId(): string {
  return process.env.LINKEDIN_CLIENT_ID?.trim() || '';
}

export function getLinkedInClientSecret(): string {
  return process.env.LINKEDIN_CLIENT_SECRET?.trim() || '';
}

export function getLinkedInRedirectUri(): string {
  const envUri = process.env.LINKEDIN_REDIRECT_URI?.trim();
  if (envUri) return envUri;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000';
  return `${appUrl.trim()}/api/oauth/linkedin/callback`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createLinkedInAuthorizationUrl(session: SessionPayload) {
  const clientId = getLinkedInClientId();
  const redirectUri = getLinkedInRedirectUri();

  if (!clientId) {
    throw new LinkedInOAuthError('LinkedIn Client ID not configured', 'MISSING_CREDENTIALS');
  }

  const state = randomToken();
  const stateHash = hashToken(state);

  // Reuse MetaOAuthState table as a generic OAuth state store
  await prisma.metaOAuthState.create({
    data: {
      stateHash,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'openid profile email w_member_social',
  });

  return {
    url: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
  };
}

export async function exchangeLinkedInCode(code: string, state: string, session: SessionPayload) {
  const stateHash = hashToken(state);

  const stateRecord = await prisma.metaOAuthState.findUnique({
    where: { stateHash },
  });

  if (!stateRecord) { throw new LinkedInOAuthError('Invalid or expired state', 'INVALID_STATE'); } if (stateRecord.userId !== session.userId || stateRecord.workspaceId !== session.workspaceId) { throw new LinkedInOAuthError('OAuth state does not match your session. Possible CSRF attack prevented.', 'STATE_MISMATCH'); }

  if (stateRecord.consumedAt) {
    throw new LinkedInOAuthError('State already consumed', 'STATE_CONSUMED');
  }

  if (stateRecord.expiresAt < new Date()) {
    throw new LinkedInOAuthError('State expired', 'STATE_EXPIRED');
  }

  await prisma.metaOAuthState.update({
    where: { id: stateRecord.id },
    data: { consumedAt: new Date() },
  });

  const clientId = getLinkedInClientId();
  const clientSecret = getLinkedInClientSecret();

  if (!clientId || !clientSecret) {
    throw new LinkedInOAuthError('LinkedIn credentials missing', 'MISSING_CREDENTIALS');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: stateRecord.redirectUri,
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    const errorMessage = data.error_description || data.error || 'Failed to exchange token';
    throw new LinkedInOAuthError(errorMessage, 'TOKEN_EXCHANGE_FAILED');
  }

  return {
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
    refreshToken: (data.refresh_token as string) || null,
    refreshTokenExpiresIn: data.refresh_token_expires_in as number | null,
    userId: stateRecord.userId,
    workspaceId: stateRecord.workspaceId,
  };
}

export async function getLinkedInProfile(accessToken: string) {
  const res = await fetch('https://api.linkedin.com/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new LinkedInOAuthError(data.message || 'Failed to fetch LinkedIn profile', 'PROFILE_FETCH_FAILED');
  }

  return {
    sub: data.sub, // The URN is 'urn:li:person:' + sub ? No, for community management we can just use the sub. Actually, we should check if we need to prefix it. Wait, the API requires 'urn:li:person:${sub}'. Let's just return the `sub` here.
    name: data.name || `${data.given_name || ''} ${data.family_name || ''}`.trim(),
    picture: data.picture,
    email: data.email,
  };
}

export async function saveLinkedInAccount(
  tokenData: Awaited<ReturnType<typeof exchangeLinkedInCode>>,
  profile: Awaited<ReturnType<typeof getLinkedInProfile>>,
  session: SessionPayload
) {
  const platformAccountId = profile.sub;

  const existing = await prisma.socialAccount.findFirst({
    where: {
      workspaceId: session.workspaceId,
      platform: 'LINKEDIN',
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
      data: { status: 'CONNECTED', name: profile.name, profileImageUrl: profile.picture },
    });

    return existing;
  }

  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (
    entitlements.limits.maxSocialAccounts !== null &&
    entitlements.usage.connectedAccounts >= entitlements.limits.maxSocialAccounts
  ) {
    throw new LinkedInOAuthError(
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
      platform: 'LINKEDIN',
      platformAccountId,
      name: profile.name,
      username: profile.email || profile.name,
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
      details: `Connected LinkedIn account: ${profile.name}`,
      metadata: JSON.stringify({ platform: 'LINKEDIN', name: profile.name, resourceId: connectedAccount.id }),
    },
  });

  return connectedAccount;
}

export async function getLinkedInOrganizations(accessToken: string) {
  const res = await fetch('https://api.linkedin.com/v2/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED', {
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  if (!res.ok) {
    console.warn('[LinkedIn] Failed to fetch organizations');
    return [];
  }

  const data = await res.json();
  return data.elements || [];
}

