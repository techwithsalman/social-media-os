import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/audit';
import { recordManualPaymentAndActivatePlan } from '@/lib/billing';
import { adminErrorResponse, getPrimaryWorkspaceForUser, requireSuperAdmin } from '@/lib/super-admin';

export async function GET() {
  try {
    await requireSuperAdmin();

    const payments = await prisma.paymentTransaction.findMany({
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            members: {
              take: 1,
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        plan: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      payments: payments.map((payment) => ({
        ...payment,
        paidAt: payment.paidAt?.toISOString() || null,
        createdAt: payment.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    const body = await req.json();

    const workspace =
      body.workspaceId
        ? await prisma.workspace.findUnique({ where: { id: body.workspaceId } })
        : body.userId
        ? await getPrimaryWorkspaceForUser(body.userId)
        : null;

    if (!workspace) {
      return NextResponse.json({ error: 'Workspace is required.' }, { status: 400 });
    }

    const result = await recordManualPaymentAndActivatePlan({
      workspaceId: workspace.id,
      planCode: body.planCode,
      amount: Number(body.amount || 0),
      currency: body.currency || 'PKR',
      provider: body.provider || 'BANK_TRANSFER',
      reference: body.reference || undefined,
      notes: body.notes || undefined,
      adminUserId: admin.user.id,
      months: Number(body.months || 1),
    });

    await logActivity({
      workspaceId: workspace.id,
      actorUserId: admin.user.id,
      targetUserId: body.userId || null,
      action: 'MANUAL_PAYMENT_RECORDED',
      details: `${admin.user.email} recorded ${body.currency || 'PKR'} ${Number(body.amount || 0)} via ${body.provider || 'BANK_TRANSFER'} and activated ${result.plan.code}.`,
      metadata: {
        paymentId: result.payment.id,
        subscriptionId: result.subscription.id,
        planCode: result.plan.code,
      },
    });

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
