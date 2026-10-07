import { getBaseUrl } from '@/lib/url';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { 
  consumeYouTubeOAuthState, 
  exchangeYouTubeCodeForToken, 
  getYouTubeChannelInfo, 
  saveYouTubeAccount, 
  YouTubeOAuthError 
} from '@/lib/youtube-oauth';

function redirectToAccounts(req: NextRequest, success?: boolean, error?: string) {
  const url = new URL('/accounts', getBaseUrl(req));
  if (success) {
    url.searchParams.set('youtube_success', '1');
  } else if (error) {
    url.searchParams.set('youtube_error', error);
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

    if (errorParam === 'access_denied') {
      return redirectToAccounts(req, false, 'access_denied');
    }

    if (!code || !state) {
      return redirectToAccounts(req, false, 'missing_params');
    }

    // 1. Verify State
    await consumeYouTubeOAuthState(state, session);

    // 2. Exchange Code for Token
    const tokenData = await exchangeYouTubeCodeForToken(code);

    // 3. Get Channel Info
    const channelInfo = await getYouTubeChannelInfo(tokenData.accessToken);

    // 4. Save Account
    await saveYouTubeAccount(tokenData, channelInfo, session);

    return redirectToAccounts(req, true);
  } catch (error) {
    if (error instanceof YouTubeOAuthError) {
      return redirectToAccounts(req, false, error.code.toLowerCase());
    }

    console.error('[YouTube Callback Error]:', error);
    return redirectToAccounts(req, false, 'callback_failed');
  }
}
