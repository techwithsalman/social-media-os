import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createPinterestAuthorizationUrl, PinterestOAuthError } from '@/lib/pinterest-oauth';

export const dynamic = 'force-dynamic';

function redirectToAccounts(req: NextRequest, error: string, errorDesc?: string) {
  const url = new URL('/accounts', req.url);
  url.searchParams.set('pinterest_error', error);
  if (errorDesc) {
    url.searchParams.set('pinterest_error_desc', errorDesc);
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

    const { url } = await createPinterestAuthorizationUrl(session);
    return NextResponse.redirect(url);
  } catch (error: any) {
    if (error instanceof PinterestOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase(), error.message);
    }
    return redirectToAccounts(req, 'pinterest_oauth_failed', error.message);
  }
}
