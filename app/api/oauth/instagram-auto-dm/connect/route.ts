import { getBaseUrl } from '@/lib/url';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';
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
    if (!session) return NextResponse.redirect(new URL('/login', getBaseUrl(req)));

    const appId = process.env.AUTO_DM_INSTAGRAM_APP_ID;
    if (!appId) return NextResponse.redirect(new URL('/instagram-auto-dm?error=missing_auto_dm_env', getBaseUrl(req)));

    const accountId = req.nextUrl.searchParams.get('accountId');
    if (!accountId) return NextResponse.redirect(new URL('/instagram-auto-dm?error=missing_account_id', getBaseUrl(req)));

    // Verify account exists and belongs to user
    const account = await prisma.socialAccount.findFirst({
      where: { id: accountId, workspaceId: session.workspaceId, platform: 'INSTAGRAM' }
    });
    if (!account) return NextResponse.redirect(new URL('/instagram-auto-dm?error=invalid_account', getBaseUrl(req)));

    const redirectUri = process.env.AUTO_DM_INSTAGRAM_REDIRECT_URI || ((process.env.NODE_ENV === 'production' ? 'https://app.techwithsalman.online' : req.nextUrl.origin) + '/api/oauth/instagram-auto-dm/callback');

    const rawState = randomToken();
    const statePayload = rawState + '_' + accountId;
    const stateHash = hashToken(statePayload);

    await prisma.metaOAuthState.create({
      data: {
        stateHash,
        userId: session.userId,
        workspaceId: session.workspaceId,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    const url = new URL('https://api.instagram.com/oauth/authorize');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', statePayload);
    url.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_messages,instagram_business_manage_comments');

    return NextResponse.redirect(url.toString());
  } catch (err) {
    console.error('[Auto DM OAuth Connect Error]', err);
    return NextResponse.redirect(new URL('/instagram-auto-dm?error=auto_dm_connect_failed', getBaseUrl(req)));
  }
}




