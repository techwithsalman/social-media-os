import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { assertPaidSubscription, accessControlErrorResponse, AccessControlError } from '@/lib/access-control';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await assertPaidSubscription(session);

    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || 50), 100);

    const executions = await prisma.instagramAutoDmExecution.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        rule: { select: { name: true, keyword: true } },
        socialAccount: { select: { name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ executions });
  } catch (error: any) {
    if (error instanceof AccessControlError) {
      return accessControlErrorResponse(error);
    }
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch activity' }, { status: 500 });
  }
}
