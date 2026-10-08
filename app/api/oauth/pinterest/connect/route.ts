import { getBaseUrl } from '@/lib/url';
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';
import prisma from '@/lib/prisma';

import { createPinterestAuthorizationUrl, PinterestOAuthError } from '@/lib/pinterest-oauth';

export const dynamic = 'force-dynamic';

function redirectToAccounts(req: NextRequest, error: string, errorDesc?: string) {
  const url = new URL('/accounts', getBaseUrl(req));
  url.searchParams.set('pinterest_error', error);
  if (errorDesc) {
    url.searchParams.set('pinterest_error_desc', errorDesc);
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
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const accountsCount = await prisma.socialAccount.count({ where: { workspaceId: session.workspaceId, status: 'CONNECTED' } });
    try {
      await checkPlanLimit(session.workspaceId, 'accounts', accountsCount);
    } catch (error: any) {
      if (error instanceof PlanLimitError) return createPlanLimitResponse(error);
    }


    const { url } = await createPinterestAuthorizationUrl(session);
    return NextResponse.redirect(url);
  } catch (error: any) {
    if (error instanceof PinterestOAuthError) {
      return redirectToAccounts(req, error.code.toLowerCase(), error.message);
    }
    return redirectToAccounts(req, 'pinterest_oauth_failed', error.message);
  }
}



