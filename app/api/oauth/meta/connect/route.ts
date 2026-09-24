import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createMetaAuthorizationUrl, MetaOAuthError } from '@/lib/meta-oauth';
import { isRealApiMode } from '@/lib/meta-token-service';

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

    if (!isRealApiMode()) {
      return redirectToAccounts(req, 'real_mode_disabled');
    }

    const authorizationUrl = await createMetaAuthorizationUrl(session);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof MetaOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase());
    }

    return redirectToAccounts(req, 'meta_oauth_failed');
  }
}
