import crypto from 'crypto';
import prisma from './prisma';
import type { SessionPayload } from './auth';
import { encryptToken } from './crypto';

const X_OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

export class XOAuthError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = 'XOAuthError';
    this.code = code;
    this.status = status;
  }
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateCodeChallenge(verifier: string) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export async function createXAuthorizationUrl(session: SessionPayload, redirectUri: string) {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    throw new XOAuthError('X_CONFIG_MISSING', 'X_CLIENT_ID is not configured.', 500);
  }

  const state = randomToken();
  const stateHash = hashToken(state);
  const codeVerifier = randomToken(64);
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store code_verifier and redirectUri in MetaOAuthState's redirectUri field as JSON
  const stateData = JSON.stringify({ redirectUri, codeVerifier });

  await prisma.metaOAuthState.create({
    data: {
      stateHash,
      userId: session.userId,
      workspaceId: session.workspaceId,
      redirectUri: stateData, // Storing both redirectUri and codeVerifier as per instruction
      expiresAt: new Date(Date.now() + X_OAUTH_STATE_TTL_MS),
    },
  });

  const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  return authUrl.toString();
}

export async function consumeXOAuthState(state: string, session: SessionPayload) {
  const row = await prisma.metaOAuthState.findUnique({
    where: { stateHash: hashToken(state) },
  });

  if (!row) {
    throw new XOAuthError('X_STATE_INVALID', 'X authorization state is invalid or expired.', 400);
  }

  if (row.userId !== session.userId || row.workspaceId !== session.workspaceId) {
    throw new XOAuthError('X_STATE_INVALID', 'X authorization state is invalid.', 403);
  }

  if (row.consumedAt) {
    throw new XOAuthError('X_STATE_INVALID', 'X authorization state has already been used.', 400);
  }

  if (new Date(row.expiresAt).getTime() <= Date.now()) {
    throw new XOAuthError('X_STATE_EXPIRED', 'X authorization state has expired.', 410);
  }

  await prisma.metaOAuthState.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });

  try {
    const data = JSON.parse(row.redirectUri);
    return {
      redirectUri: data.redirectUri as string,
      codeVerifier: data.codeVerifier as string,
    };
  } catch (e) {
    throw new XOAuthError('X_STATE_INVALID', 'Failed to parse X authorization state data.', 500);
  }
}

export async function exchangeXCodeForToken(code: string, redirectUri: string, codeVerifier: string) {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new XOAuthError('X_CONFIG_MISSING', 'X_CLIENT_ID or X_CLIENT_SECRET is not configured.', 500);
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new XOAuthError('X_TOKEN_EXCHANGE_FAILED', data.error_description || data.error || 'Failed to exchange token.', res.status);
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}
