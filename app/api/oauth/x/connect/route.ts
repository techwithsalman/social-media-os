export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';
import prisma from '@/lib/prisma';

import { createXAuthorizationUrl } from '@/lib/x-oauth';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams, origin } = new URL(request.url);
    const redirectUri = `${origin}/api/oauth/x/callback`;

    const authUrl = await createXAuthorizationUrl(session, redirectUri);
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('[X OAuth Connect Error]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}



