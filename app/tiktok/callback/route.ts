import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { exchangeTikTokCodeForTokens, fetchTikTokUserInfo, TikTokOAuthError } from '@/lib/tiktok-oauth';
import prisma from '@/lib/prisma';
import { encryptToken } from '@/lib/crypto';
import { assertCanConnectSocialAccount } from '@/lib/billing';

export const dynamic = 'force-dynamic';

function sanitizeErrorDescription(desc: string | null | undefined): string | undefined {
  if (!desc) return undefined;
  // Redact any sensitive tokens/secrets/keys (20+ alphanumeric chars)
  const cleaned = desc.replace(/[a-zA-Z0-9_-]{20,}/g, '***').trim();
  return cleaned.slice(0, 250);
}

function redirectToAccounts(
  req: NextRequest,
  params: { connected?: boolean; error?: string; errorDesc?: string }
) {
  const url = new URL('/accounts', req.url);
  if (params.connected) {
    url.searchParams.set('tiktok_connected', 'true');
  }
  if (params.error) {
    url.searchParams.set('tiktok_error', params.error);
  }
  if (params.errorDesc) {
    url.searchParams.set('tiktok_error_desc', params.errorDesc);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return redirectToAccounts(req, { error: 'unauthorized', errorDesc: 'You must be logged in.' });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // Extract all possible error parameters sent by TikTok Login Kit
  const error = searchParams.get('error');
  const errorCode = searchParams.get('error_code') || searchParams.get('errCode') || searchParams.get('err_code');
  const errorType = searchParams.get('error_type');
  const rawDesc =
    searchParams.get('error_description') ||
    searchParams.get('errorDescription') ||
    searchParams.get('message') ||
    searchParams.get('description');
  const errorDescription = sanitizeErrorDescription(rawDesc);

  console.log('[TIKTOK DEBUG] CALLBACK ROUTE RECEIVED REQUEST', {
    hasCode: Boolean(code),
    hasState: Boolean(state),
    error: error || undefined,
    errorCode: errorCode || undefined,
    errorType: errorType || undefined,
    errorDescription: errorDescription || undefined,
  });

  // Handle explicit errors returned from TikTok authorization page
  if (error || errorCode || errorType || (rawDesc && !code)) {
    let finalErr = 'authorization_failed';

    if (errorType === 'non_sandbox_target') {
      finalErr = 'non_sandbox_target';
    } else if (error === 'access_denied' || errorCode === 'access_denied') {
      finalErr = 'access_denied';
    } else if (
      error === 'authorization_cancelled' ||
      error === 'user_cancelled' ||
      error === 'cancelled'
    ) {
      finalErr = 'authorization_cancelled';
    } else if (error === 'invalid_scope' || errorCode === 'invalid_scope') {
      finalErr = 'invalid_scope';
    } else if (
      (rawDesc && /redirect.*uri/i.test(rawDesc)) ||
      error === 'redirect_uri_mismatch' ||
      errorCode === 'redirect_uri_mismatch' ||
      errorCode === 'invalid_redirect_uri'
    ) {
      finalErr = 'redirect_uri_mismatch';
    } else if (errorCode) {
      finalErr = String(errorCode).toLowerCase();
    } else if (error) {
      finalErr = String(error).toLowerCase();
    }

    return redirectToAccounts(req, {
      error: finalErr,
      errorDesc: errorDescription,
    });
  }

  // Handle missing required callback parameters
  if (!code && !state) {
    console.error('[TikTok Callback Error] Missing both authorization code and state parameters');
    return redirectToAccounts(req, {
      error: 'invalid_callback_params',
      errorDesc: 'No authorization code or state parameter received in callback request.',
    });
  }

  if (!code) {
    console.error('[TikTok Callback Error] Missing authorization code');
    return redirectToAccounts(req, {
      error: 'missing_code',
      errorDesc: 'TikTok did not return an authorization code. Check Developer Portal redirect URI configuration.',
    });
  }

  if (!state) {
    console.error('[TikTok Callback Error] Missing state parameter');
    return redirectToAccounts(req, {
      error: 'missing_state',
      errorDesc: 'OAuth security state parameter was not provided in callback.',
    });
  }

  try {
    const tokenResult = await exchangeTikTokCodeForTokens(code, state);
    if (tokenResult.userId !== session.userId || tokenResult.workspaceId !== session.workspaceId) {
      throw new TikTokOAuthError('OAuth state does not match your current session. Possible CSRF attack prevented.', 'STATE_MISMATCH');
    }
    const userInfo = await fetchTikTokUserInfo(tokenResult.accessToken);

    const tokenData = {
      accessToken: encryptToken(tokenResult.accessToken),
      refreshToken: tokenResult.refreshToken ? encryptToken(tokenResult.refreshToken) : null,
      scope: tokenResult.scope,
      expiresAt: new Date(Date.now() + tokenResult.expiresIn * 1000),
    };

    const existing = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: tokenResult.workspaceId,
        platform: 'TIKTOK',
        platformAccountId: userInfo.openId,
      },
    });

    if (existing) {
      await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          name: userInfo.displayName,
          username: userInfo.username,
          profileImageUrl: userInfo.avatarUrl,
          status: 'CONNECTED',
          isMock: false,
          token: {
            upsert: {
              create: tokenData,
              update: tokenData,
            },
          },
        },
      });
    } else {
      await assertCanConnectSocialAccount(tokenResult.workspaceId);

      await prisma.socialAccount.create({
        data: {
          workspaceId: tokenResult.workspaceId,
          platform: 'TIKTOK',
          platformAccountId: userInfo.openId,
          name: userInfo.displayName,
          username: userInfo.username,
          profileImageUrl: userInfo.avatarUrl,
          status: 'CONNECTED',
          isMock: false,
          token: {
            create: tokenData,
          },
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        workspaceId: tokenResult.workspaceId,
        userId: tokenResult.userId,
        action: 'ACCOUNT_CONNECTED',
        details: `Connected official TikTok account (@${userInfo.username}) via OAuth Login Kit`,
      },
    });

    return redirectToAccounts(req, { connected: true });
  } catch (err: any) {
    console.error('[TikTok OAuth Exchange Error]:', err?.message || err);
    if (err instanceof TikTokOAuthError) {
      return redirectToAccounts(req, {
        error: err.code.toLowerCase(),
        errorDesc: sanitizeErrorDescription(err.message),
      });
    }
    return redirectToAccounts(req, {
      error: 'tiktok_oauth_failed',
      errorDesc: sanitizeErrorDescription(err?.message),
    });
  }
}
