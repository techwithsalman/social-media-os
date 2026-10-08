import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { checkPlanLimit, PlanLimitError, createPlanLimitResponse } from '@/lib/billing/plan-limits';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ruleId = params.id;
    const body = await req.json();

    const existing = await prisma.instagramAutoDmRule.findFirst({
      where: { id: ruleId, workspaceId: session.workspaceId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    const { name, keyword, matchType, message, buttonLabel, destinationUrl, enabled } = body;

    if (enabled === true && !existing.enabled) {
      const activeRules = await prisma.instagramAutoDmRule.findMany({
        where: { workspaceId: session.workspaceId, enabled: true },
        select: { mediaId: true }
      });
      const distinctPosts = new Set(activeRules.map((r: any) => r.mediaId));
      if (!distinctPosts.has(existing.mediaId)) {
        try {
          await checkPlanLimit(session.workspaceId, 'instagramAutoDm', distinctPosts.size);
        } catch (error: any) {
          if (error instanceof PlanLimitError) return createPlanLimitResponse(error);
        }
      }
    }

    const rule = await prisma.instagramAutoDmRule.update({
      where: { id: ruleId },
      data: {
        ...(name !== undefined && { name }),
        ...(keyword !== undefined && { keyword }),
        ...(matchType !== undefined && { matchType }),
        ...(message !== undefined && { message }),
        ...(buttonLabel !== undefined && { buttonLabel }),
        ...(destinationUrl !== undefined && { destinationUrl }),
        ...(enabled !== undefined && { enabled }),
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ruleId = params.id;
    
    const existing = await prisma.instagramAutoDmRule.findFirst({
      where: { id: ruleId, workspaceId: session.workspaceId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
    }

    await prisma.instagramAutoDmRule.delete({
      where: { id: ruleId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete rule' }, { status: 500 });
  }
}
