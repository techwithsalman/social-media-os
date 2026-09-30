export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createYouTubeAuthorizationUrl, YouTubeOAuthError } from '@/lib/youtube-oauth';

function redirectToAccounts(req: NextRequest, code: string) {
  const url = new URL('/accounts', req.url);
  url.searchParams.set('youtube_error', code);
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

    const authorizationUrl = await createYouTubeAuthorizationUrl(session);
    return NextResponse.redirect(authorizationUrl);
  } catch (error) {
    if (error instanceof YouTubeOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase());
    }

    console.error('[YouTube Connect Error]:', error);
    return redirectToAccounts(req, 'youtube_oauth_failed');
  }
}
