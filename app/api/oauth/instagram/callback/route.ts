import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  consumeInstagramOAuthState,
  exchangeInstagramCode,
  saveInstagramAccount,
  InstagramOAuthError,
} from '@/lib/instagram-oauth';

function getBaseUrl(req: NextRequest) {
  let host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!host || host.includes('.netlify.app')) {
    host = 'app.techwithsalman.online';
  }
  const protocol = host.includes('localhost') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

function redirectToAccounts(req: NextRequest, code: string) {
  const url = new URL('/accounts', getBaseUrl(req));
  url.searchParams.set('meta_error', code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      const url = new URL('/login', getBaseUrl(req));
      url.searchParams.set('redirect', '/accounts');
      return NextResponse.redirect(url);
    }

    const { searchParams } = new URL(req.url);
    const oauthError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (oauthError) {
      console.error('[Instagram OAuth Error]:', oauthError, errorDescription);
      return redirectToAccounts(req, oauthError === 'access_denied' ? 'authorization_cancelled' : 'instagram_oauth_failed');
    }

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const mode = state?.startsWith('reconnect:') ? 'reconnect' : 'add';

    if (!code || !state) {
      return redirectToAccounts(req, 'instagram_oauth_failed');
    }

    // Validate state securely
    const oauthState = await consumeInstagramOAuthState(state, session);
    
    // Exchange token and fetch profile
    const profile = await exchangeInstagramCode(code, oauthState.redirectUri);
    
    // Save isolated to the workspace
    await saveInstagramAccount(profile, session, mode as any);

    // Redirect to Connected Accounts successfully
    const successUrl = new URL('/accounts?instagram_connected=1', getBaseUrl(req));
    return NextResponse.redirect(successUrl);
  } catch (error) {
    if (error instanceof InstagramOAuthError) {
      console.error('[Instagram Callback Error]:', error.message);
      return redirectToAccounts(req, error.code.toLowerCase());
    }

    console.error('[Instagram Callback Exception]:', error);
    return redirectToAccounts(req, 'instagram_oauth_failed');
  }
}
