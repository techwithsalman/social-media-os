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

    const tokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token?client_id=' + appId + '&redirect_uri=' + redirectUri + '&client_secret=' + appSecret + '&code=' + code);
    const tokenData = await tokenRes.json();

    if (tokenData.error) {
      console.error('Token Error:', tokenData.error);
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=token_exchange_failed', req.url));
    }

    const longTokenRes = await fetch('https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=' + appId + '&client_secret=' + appSecret + '&fb_exchange_token=' + tokenData.access_token);
    const longTokenData = await longTokenRes.json();
    
    const finalToken = longTokenData.access_token || tokenData.access_token;

    const pagesRes = await fetch('https://graph.facebook.com/v21.0/me/accounts?access_token=' + finalToken);
    const pagesData = await pagesRes.json();

    for (const page of pagesData.data || []) {
      const igRes = await fetch('https://graph.facebook.com/v21.0/' + page.id + '?fields=instagram_business_account&access_token=' + page.access_token);
      const igData = await igRes.json();

      if (igData.instagram_business_account) {
        const igId = igData.instagram_business_account.id;
        
        const existingAccount = await prisma.socialAccount.findFirst({
          where: { platformAccountId: igId, platform: 'INSTAGRAM', workspaceId: session.workspaceId },
          include: { token: true }
        });

        if (existingAccount && existingAccount.token) {
          await prisma.oAuthToken.update({
            where: { id: existingAccount.token.id },
            data: { autoDmAccessToken: encryptToken(page.access_token) }
          });
        }
      }
    }

    return NextResponse.redirect(new URL('/instagram-auto-dm?success=reconnected', req.url));
  } catch (err) {
    console.error('Auto DM Callback Error', err);
    return NextResponse.redirect(new URL('/instagram-auto-dm?error=internal_error', req.url));
  }
}
