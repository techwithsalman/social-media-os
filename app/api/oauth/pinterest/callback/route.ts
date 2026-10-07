import { createOAuthCallbackResponse } from '@/lib/oauth-callback';
import { getBaseUrl } from '@/lib/url';
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
  return createOAuthCallbackResponse('PINTEREST', !!success, error, getBaseUrl(req));
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

    return createOAuthCallbackResponse('PINTEREST', true, undefined, getBaseUrl(req));
  } catch (error: any) {
    console.error('[Pinterest Callback Error]:', error);
    if (error instanceof PinterestOAuthError) {
      return redirectToAccounts(req, false, error.code.toLowerCase());
    }
    return redirectToAccounts(req, false, 'callback_failed');
  }
}
