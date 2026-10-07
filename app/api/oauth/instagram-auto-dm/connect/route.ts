import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}
function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.redirect(new URL('/login', req.url));

    const appId = process.env.AUTO_DM_INSTAGRAM_APP_ID;
    if (!appId) return NextResponse.redirect(new URL('/instagram-auto-dm?error=missing_auto_dm_env', req.url));

    const redirectUri = process.env.AUTO_DM_INSTAGRAM_REDIRECT_URI || (req.nextUrl.origin + '/api/oauth/instagram-auto-dm/callback');

    const state = randomToken();
    const stateHash = hashToken(state);

    await prisma.metaOAuthState.create({
      data: {
        stateHash,
        userId: session.userId,
        workspaceId: session.workspaceId,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const url = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('display', 'page');
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    url.searchParams.set('scope', 'instagram_basic,instagram_manage_comments,instagram_manage_messages,pages_show_list,pages_read_engagement');

    return NextResponse.redirect(url.toString());
  } catch (err) {
    console.error('[Auto DM OAuth Connect Error]', err);
    return NextResponse.redirect(new URL('/instagram-auto-dm?error=auto_dm_connect_failed', req.url));
  }
}