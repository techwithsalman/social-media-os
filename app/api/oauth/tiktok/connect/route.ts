import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createTikTokAuthorizationUrl, TikTokOAuthError } from '@/lib/tiktok-oauth';

export const dynamic = 'force-dynamic';

function redirectToAccounts(req: NextRequest, error: string, errorDesc?: string) {
  const url = new URL('/accounts', req.url);
  url.searchParams.set('tiktok_error', error);
  if (errorDesc) {
    url.searchParams.set('tiktok_error_desc', errorDesc);
  }
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    console.log('[TIKTOK DEBUG] CONNECT ROUTE HIT - Initiating OAuth flow...');
    const session = await getSession();
    if (!session) {
      console.log('[TIKTOK DEBUG] Unauthorized request to connect route - Redirecting to login');
      const url = new URL('/login', req.url);
      url.searchParams.set('redirect', '/accounts');
      return NextResponse.redirect(url);
    }

    const authorizationUrl = await createTikTokAuthorizationUrl(session);
    console.log('[TIKTOK DEBUG] REDIRECTING USER TO AUTH URL');
    return NextResponse.redirect(authorizationUrl);
  } catch (error: any) {
    console.log('[TIKTOK DEBUG] CONNECT ROUTE ERROR:', error.message || error);
    if (error instanceof TikTokOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase(), error.message);
    }
    return redirectToAccounts(req, 'tiktok_oauth_failed', error.message);
  }
}
