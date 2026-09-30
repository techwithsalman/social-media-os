import { SessionPayload } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { encryptToken, decryptToken } from '@/lib/crypto';
import { randomBytes, createHash } from 'crypto';
import { getWorkspaceEntitlements } from '@/lib/billing';

export class YouTubeOAuthError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = 'YouTubeOAuthError';
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getYouTubeConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const appUrl = process.env.NODE_ENV === "production"
    ? "https://social-media-os.netlify.app"
    : "http://localhost:3000";
    
  const redirectUri = `${appUrl}/api/oauth/youtube/callback`;

  if (!clientId || !clientSecret) {
    throw new YouTubeOAuthError(
      'YOUTUBE_CONFIG_MISSING',
      'YouTube OAuth is not configured. Missing Google Client ID or Secret.',
      500
    );
  }

  return { clientId, clientSecret, redirectUri };
}

const YOUTUBE_STATE_TTL_MS = 10 * 60 * 1000;

export async function createYouTubeAuthorizationUrl(session: SessionPayload) {
  const config = getYouTubeConfig();
  const state = randomToken();
  const stateHash = hashToken(state);

  await prisma.metaOAuthState.create({
    data: {
      stateHash,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri: config.redirectUri,
      expiresAt: new Date(Date.now() + YOUTUBE_STATE_TTL_MS),
    },
  });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly');
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', state);

  return authUrl.toString();
}

export async function consumeYouTubeOAuthState(state: string, session: SessionPayload) {
  const stateHash = hashToken(state);
  
  const stateRecord = await prisma.metaOAuthState.findUnique({
    where: { stateHash },
  });

  if (!stateRecord) {
    throw new YouTubeOAuthError('INVALID_STATE', 'Invalid or expired YouTube OAuth state.', 400);
  }

  if (stateRecord.userId !== session.userId || stateRecord.workspaceId !== session.workspaceId) {
    throw new YouTubeOAuthError('UNAUTHORIZED_STATE', 'This OAuth state does not belong to your session.', 403);
  }

  if (stateRecord.consumedAt) {
    throw new YouTubeOAuthError('STATE_CONSUMED', 'This authorization was already used.', 400);
  }

  if (new Date() > stateRecord.expiresAt) {
    throw new YouTubeOAuthError('STATE_EXPIRED', 'Authorization session expired.', 400);
  }

  await prisma.metaOAuthState.update({
    where: { id: stateRecord.id },
    data: { consumedAt: new Date() },
  });

  return stateRecord;
}

export async function exchangeYouTubeCodeForToken(code: string) {
  const config = getYouTubeConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[YouTube Token Exchange Error]', data);
    throw new YouTubeOAuthError('TOKEN_EXCHANGE_FAILED', data.error_description || data.error || 'Failed to exchange token');
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scopes: data.scope,
  };
}

export async function getYouTubeChannelInfo(accessToken: string) {
  const response = await fetch('https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();
  if (!response.ok || !data.items || data.items.length === 0) {
    console.error('[YouTube Channel Info Error]', data);
    throw new YouTubeOAuthError('CHANNEL_INFO_FAILED', 'Failed to retrieve YouTube channel info');
  }

  const channel = data.items[0];
  return {
    id: channel.id,
    title: channel.snippet.title,
    thumbnailUrl: channel.snippet.thumbnails?.default?.url || null,
  };
}

export async function saveYouTubeAccount(
  tokenData: Awaited<ReturnType<typeof exchangeYouTubeCodeForToken>>,
  channelInfo: Awaited<ReturnType<typeof getYouTubeChannelInfo>>,
  session: SessionPayload
) {
  const existing = await prisma.socialAccount.findFirst({
    where: {
      workspaceId: session.workspaceId,
      platform: 'YOUTUBE',
      platformAccountId: channelInfo.id,
    },
  });

  if (existing) {
    throw new YouTubeOAuthError('ACCOUNT_EXISTS', 'This YouTube channel is already connected to this workspace.', 409);
  }

  const entitlements = await getWorkspaceEntitlements(session.workspaceId);
  if (
    entitlements.limits.maxSocialAccounts !== null &&
    entitlements.usage.connectedAccounts >= entitlements.limits.maxSocialAccounts
  ) {
    throw new YouTubeOAuthError(
      'SOCIAL_ACCOUNT_LIMIT_REACHED',
      `Your current plan allows ${entitlements.limits.maxSocialAccounts} connected social accounts.`,
      403
    );
  }

  const encryptedAccessToken = encryptToken(tokenData.accessToken);
  const encryptedRefreshToken = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : null;
  const expiresAt = tokenData.expiresIn ? new Date(Date.now() + tokenData.expiresIn * 1000) : null;

  const connectedAccount = await prisma.socialAccount.create({
    data: {
      workspaceId: session.workspaceId,
      platform: 'YOUTUBE',
      platformAccountId: channelInfo.id,
      name: channelInfo.title,
      username: channelInfo.title,
      profileImageUrl: channelInfo.thumbnailUrl,
      status: 'CONNECTED',
      isMock: false,
      token: {
        create: {
          accessToken: encryptedAccessToken,
          refreshToken: encryptedRefreshToken,
          scope: tokenData.scopes,
          expiresAt: expiresAt,
        },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      workspaceId: session.workspaceId,
      userId: session.userId,
      action: 'ACCOUNT_CONNECTED',
      details: `Connected YouTube Channel: ${channelInfo.title}.`,
    },
  });

  return connectedAccount;
}

export async function refreshYouTubeToken(socialAccountId: string) {
  const account = await prisma.socialAccount.findUnique({
    where: { id: socialAccountId },
    include: { token: true }
  });

  if (!account || account.platform !== 'YOUTUBE' || !account.token || !account.token.refreshToken) {
    throw new Error('Invalid account or missing refresh token');
  }

  const refreshToken = decryptToken(account.token.refreshToken);
  const config = getYouTubeConfig();

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    console.error('[YouTube Token Refresh Error]', data);
    
    if (data.error === 'invalid_grant') {
      await prisma.socialAccount.update({
        where: { id: socialAccountId },
        data: { status: 'NEEDS_RECONNECTION' },
      });
    }
    
    throw new Error(`Failed to refresh token: ${data.error_description || data.error}`);
  }

  const newAccessToken = encryptToken(data.access_token);
  const expiresAt = new Date(Date.now() + data.expires_in * 1000);

  let newRefreshToken = account.token.refreshToken;
  if (data.refresh_token) {
    newRefreshToken = encryptToken(data.refresh_token);
  }

  await prisma.oAuthToken.update({
    where: { socialAccountId: account.id },
    data: {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: expiresAt,
    },
  });
  
  await prisma.socialAccount.update({
    where: { id: account.id },
    data: { status: 'CONNECTED' },
  });

  return {
    accessToken: data.access_token,
  };
}
