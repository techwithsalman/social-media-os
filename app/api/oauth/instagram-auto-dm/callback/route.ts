import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encryptToken } from '@/lib/crypto';
import { getSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.redirect(new URL('/login', req.url));

    const code = req.nextUrl.searchParams.get('code');
    const state = req.nextUrl.searchParams.get('state');

    if (!code || !state) {
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=missing_code', req.url));
    }

    const oauthState = await prisma.metaOAuthState.findFirst({
      where: { userId: session.userId, workspaceId: session.workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    if (!oauthState) {
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=invalid_state', req.url));
    }

    const appId = process.env.AUTO_DM_INSTAGRAM_APP_ID;
    const appSecret = process.env.AUTO_DM_INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.AUTO_DM_INSTAGRAM_REDIRECT_URI || ((process.env.NODE_ENV === 'production' ? 'https://app.techwithsalman.online' : req.nextUrl.origin) + '/api/oauth/instagram-auto-dm/callback');

    // 1. Exchange code for short-lived token via POST to api.instagram.com
    const body = new URLSearchParams({
      client_id: appId as string,
      client_secret: appSecret as string,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri as string,
      code: code as string
    });

    const tokenRes = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    
    const tokenData = await tokenRes.json();

    if (tokenData.error_message || !tokenData.access_token) {
      console.error('Instagram Token Error:', tokenData);
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=token_exchange_failed', req.url));
    }

    const shortToken = tokenData.access_token;
    const igId = tokenData.user_id?.toString();

    if (!igId) {
      console.error('Instagram Token Error: No user_id returned', tokenData);
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=missing_user_id', req.url));
    }

    // 2. Exchange for long-lived token via GET to graph.instagram.com
    const longTokenUrl = new URL('https://graph.instagram.com/access_token');
    longTokenUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longTokenUrl.searchParams.set('client_secret', appSecret as string);
    longTokenUrl.searchParams.set('access_token', shortToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();
    
    const finalToken = longTokenData.access_token || shortToken;

    // 3. Find the existing SocialAccount by platformAccountId === igId
    const existingAccount = await prisma.socialAccount.findFirst({
      where: { platformAccountId: igId, platform: 'INSTAGRAM', workspaceId: session.workspaceId },
      include: { token: true }
    });

    if (existingAccount && existingAccount.token) {
      await prisma.oAuthToken.update({
        where: { id: existingAccount.token.id },
        data: { autoDmAccessToken: encryptToken(finalToken) }
      });
    } else {
      // If the account wasn't connected for publishing first, we can't save it because we require the publishing token to exist.
      // Usually, they select it from the UI, so it MUST exist.
      console.error('Account not found in DB for igId:', igId);
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=account_not_found', req.url));
    }

    return NextResponse.redirect(new URL('/instagram-auto-dm?success=reconnected', req.url));
  } catch (err) {
    console.error('Auto DM Callback Error', err);
    return NextResponse.redirect(new URL('/instagram-auto-dm?error=internal_error', req.url));
  }
}
