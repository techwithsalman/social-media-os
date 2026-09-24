import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  consumeMetaOAuthState,
  createMetaAccountSelection,
  discoverMetaAccounts,
  exchangeMetaCodeForUserToken,
  MetaOAuthError,
} from '@/lib/meta-oauth';

function redirectToAccounts(req: NextRequest, code: string) {
  const url = new URL('/accounts', req.url);
  url.searchParams.set('meta_error', code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      const url = new URL('/login', req.url);
      url.searchParams.set('redirect', '/accounts');
      return NextResponse.redirect(url);
    }

    const { searchParams } = new URL(req.url);
    const oauthError = searchParams.get('error');
    if (oauthError) {
      return redirectToAccounts(req, oauthError === 'access_denied' ? 'authorization_cancelled' : 'meta_oauth_failed');
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      return redirectToAccounts(req, 'meta_oauth_failed');
    }

    const oauthState = await consumeMetaOAuthState(state, session);
    const token = await exchangeMetaCodeForUserToken(code, oauthState.redirectUri);
    const discoveredAccounts = await discoverMetaAccounts(token.accessToken, token.expiresAt, token.scopes);

    if (discoveredAccounts.length === 0) {
      return redirectToAccounts(req, 'no_meta_accounts');
    }

    const selectionToken = await createMetaAccountSelection(session, discoveredAccounts);
    const selectionUrl = new URL('/accounts/meta/select', req.url);
    selectionUrl.searchParams.set('token', selectionToken);
    return NextResponse.redirect(selectionUrl);
  } catch (error) {
    if (error instanceof MetaOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase());
    }

    return redirectToAccounts(req, 'meta_oauth_failed');
  }
}
