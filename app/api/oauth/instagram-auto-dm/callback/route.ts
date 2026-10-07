import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { encryptToken } from '@/lib/crypto';
import { getSession } from '@/lib/auth';
import crypto from 'crypto';

function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.redirect(new URL('/login', req.url));

    const code = req.nextUrl.searchParams.get('code');
    const statePayload = req.nextUrl.searchParams.get('state');

    if (!code || !statePayload) {
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=missing_code_or_state', req.url));
    }

    const stateHash = hashToken(statePayload);

    const oauthState = await prisma.metaOAuthState.findFirst({
      where: { stateHash, userId: session.userId, workspaceId: session.workspaceId },
      orderBy: { createdAt: 'desc' }
    });

    if (!oauthState) {
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=invalid_state', req.url));
    }

    const parts = statePayload.split('_');
    if (parts.length < 2) {
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=invalid_state_format', req.url));
    }
    const targetAccountId = parts[1];

    const appId = process.env.AUTO_DM_INSTAGRAM_APP_ID;
    const appSecret = process.env.AUTO_DM_INSTAGRAM_APP_SECRET;
    const redirectUri = process.env.AUTO_DM_INSTAGRAM_REDIRECT_URI || ((process.env.NODE_ENV === 'production' ? 'https://app.techwithsalman.online' : req.nextUrl.origin) + '/api/oauth/instagram-auto-dm/callback');

    // Exchange short token
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
    const returnedIgId = tokenData.user_id?.toString();

    // Exchange long token
    const longTokenUrl = new URL('https://graph.instagram.com/access_token');
    longTokenUrl.searchParams.set('grant_type', 'ig_exchange_token');
    longTokenUrl.searchParams.set('client_secret', appSecret as string);
    longTokenUrl.searchParams.set('access_token', shortToken);

    const longTokenRes = await fetch(longTokenUrl.toString());
    const longTokenData = await longTokenRes.json();
    const finalToken = longTokenData.access_token || shortToken;

    // Securely bind the token to the explicitly requested workspace account
    const existingAccount = await prisma.socialAccount.findFirst({
      where: { id: targetAccountId, workspaceId: session.workspaceId, platform: 'INSTAGRAM' },
      include: { token: true }
    });

    if (existingAccount && existingAccount.token) {
      await prisma.oAuthToken.update({
        where: { id: existingAccount.token.id },
        data: { autoDmAccessToken: encryptToken(finalToken) }
      });
      
      // Optional: Verify that returnedIgId matches expected platformAccountId
      // However, sometimes IGID != IGSID. As long as we trust the workspace/session binding, we are safe.
      console.log('Successfully enabled Auto DM for SocialAccount:', existingAccount.id);
    } else {
      console.error('Target account not found in DB:', targetAccountId);
      return NextResponse.redirect(new URL('/instagram-auto-dm?error=account_not_found', req.url));
    }

    return NextResponse.redirect(new URL('/instagram-auto-dm?success=enabled', req.url));
  } catch (err) {
    console.error('Auto DM Callback Error', err);
    return NextResponse.redirect(new URL('/instagram-auto-dm?error=internal_error', req.url));
  }
}
