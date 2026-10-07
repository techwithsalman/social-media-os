import { getBaseUrl } from '@/lib/url';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  exchangeLinkedInCode, 
  getLinkedInProfile, 
  saveLinkedInAccount, 
  LinkedInOAuthError 
} from '@/lib/linkedin-oauth';

export const dynamic = 'force-dynamic';

function redirectToAccounts(req: NextRequest, success?: boolean, error?: string) {
  const url = new URL('/accounts', getBaseUrl(req));
  if (success) {
    url.searchParams.set('linkedin_success', '1');
  } else if (error) {
    url.searchParams.set('linkedin_error', error);
  }
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
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam === 'user_cancelled_login' || errorParam === 'access_denied') {
      return redirectToAccounts(req, false, 'access_denied');
    }

    if (!code || !state) {
      return redirectToAccounts(req, false, 'missing_params');
    }

    // 1. Exchange Code for Token and Verify State
    const tokenData = await exchangeLinkedInCode(code, state, session);

    // 2. Get Profile Info
    const profile = await getLinkedInProfile(tokenData.accessToken);

    // 3. Save Account
    await saveLinkedInAccount(tokenData, profile, session);

    return redirectToAccounts(req, true);
  } catch (error: any) {
    console.error('[LinkedIn Callback Error]:', error);
    if (error instanceof LinkedInOAuthError) {
      return redirectToAccounts(req, false, error.code.toLowerCase());
    }
    return redirectToAccounts(req, false, 'callback_failed');
  }
}
