import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const executions = await prisma.facebookAutoDmExecution.findMany({
      where: { workspaceId: session.workspaceId },
      include: {
        rule: { select: { name: true } },
        socialAccount: { select: { name: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({ executions });
  } catch (error) {
    console.error('Failed to fetch Facebook auto DM activity:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
