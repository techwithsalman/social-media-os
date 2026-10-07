import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createInstagramAuthorizationUrl, InstagramOAuthError } from '@/lib/instagram-oauth';
import { isRealApiMode } from '@/lib/meta-token-service';

function redirectToAccounts(req: NextRequest, code: string) {
  const url = new URL('/accounts', req.url);
  url.searchParams.set('meta_error', code);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    const isDebug = req.nextUrl.searchParams.get('debug') === '1';

    if (!session && !isDebug) {
      const url = new URL('/login', req.url);
      url.searchParams.set('redirect', '/accounts');
      return NextResponse.redirect(url);
    }

    if (!isRealApiMode() && !isDebug) {
      return redirectToAccounts(req, 'real_mode_disabled');
    }

    const mode = (req.nextUrl.searchParams.get('mode') as 'add' | 'reconnect') || 'add';
    const authorizationUrl = await createInstagramAuthorizationUrl(session || { userId: 'debug', workspaceId: 'debug' } as any, mode);
    const parsedUrl = new URL(authorizationUrl);
    
    const diagnostic = {
      endpoint: parsedUrl.origin + parsedUrl.pathname,
      client_id: parsedUrl.searchParams.get('client_id'),
      redirect_uri: parsedUrl.searchParams.get('redirect_uri'),
      scopes: parsedUrl.searchParams.get('scope'),
      commit: 'v-fix-scopes-01'
    };

    console.log('INSTAGRAM_OAUTH_DIAGNOSTIC:', diagnostic);

    if (isDebug) {
      return NextResponse.json(diagnostic);
    }

    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof InstagramOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase());
    }

    console.error('[Instagram Connect Error]:', error);
    return redirectToAccounts(req, 'instagram_oauth_failed');
  }
}
