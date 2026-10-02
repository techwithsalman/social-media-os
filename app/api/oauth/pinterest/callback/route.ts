import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  exchangePinterestCode, 
  getPinterestProfile, 
  savePinterestAccount, 
  PinterestOAuthError 
} from '@/lib/pinterest-oauth';

export const dynamic = 'force-dynamic';

function redirectToAccounts(req: NextRequest, success?: boolean, error?: string) {
  const url = new URL('/accounts', req.url);
  if (success) {
    url.searchParams.set('pinterest_success', '1');
  } else if (error) {
    url.searchParams.set('pinterest_error', error);
  }
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
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam === 'access_denied') {
      return redirectToAccounts(req, false, 'access_denied');
    }

    if (!code || !state) {
      return redirectToAccounts(req, false, 'missing_params');
    }

    // 1. Exchange Code for Token and Verify State
    const tokenData = await exchangePinterestCode(code, state, session);

    // 2. Get Profile Info
    const profile = await getPinterestProfile(tokenData.accessToken);

    // 3. Save Account
    await savePinterestAccount(tokenData, profile, session);

    return redirectToAccounts(req, true);
  } catch (error: any) {
    console.error('[Pinterest Callback Error]:', error);
    if (error instanceof PinterestOAuthError) {
      return redirectToAccounts(req, false, error.code.toLowerCase());
    }
    return redirectToAccounts(req, false, 'callback_failed');
  }
}
