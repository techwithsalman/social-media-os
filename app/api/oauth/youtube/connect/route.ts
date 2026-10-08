import { getBaseUrl } from '@/lib/url';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';
import prisma from '@/lib/prisma';

import { createYouTubeAuthorizationUrl, YouTubeOAuthError } from '@/lib/youtube-oauth';

function redirectToAccounts(req: NextRequest, code: string) {
  const url = new URL('/accounts', getBaseUrl(req));
  url.searchParams.set('youtube_error', code);
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
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const accountsCount = await prisma.socialAccount.count({ where: { workspaceId: session.workspaceId, status: 'CONNECTED' } });
    try {
      await checkPlanLimit(session.workspaceId, 'accounts', accountsCount);
    } catch (error: any) {
      if (error instanceof PlanLimitError) return createPlanLimitResponse(error);
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



