import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSuperAdmin } from '@/lib/super-admin';
import { getPlanByCode } from '@/lib/billing';

export async function POST(): Promise<NextResponse> {
  const admin = await requireSuperAdmin();
  if ('error' in admin) return admin.error as NextResponse;

  const targetEmail = 'salmankhan03312545937@gmail.com';
  const user = await prisma.user.findUnique({
    where: { email: targetEmail },
    include: { workspaces: { include: { workspace: true } } }
  });

  if (!user || !user.workspaces[0]) {
    return NextResponse.json({ success: false, message: 'User or workspace not found.' });
  }

  const workspace = user.workspaces[0].workspace;

  const sub = await prisma.subscription.findFirst({
    where: { workspaceId: workspace.id, source: 'MANUAL', planTier: 'STARTER' }
  });

  if (!sub) {
    return NextResponse.json({ success: false, message: 'No legacy STARTER manual subscription found.' });
  }

  let updated = false;

  // Backfill currentPeriodEnd if missing
  if (!sub.currentPeriodEnd) {
    const now = new Date();
    const newEnd = new Date(sub.startedAt || now);
    newEnd.setMonth(newEnd.getMonth() + 1);
    
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { currentPeriodEnd: newEnd, currentPeriodStart: sub.startedAt || now }
    });
    updated = true;
  }

  // Backfill PaymentTransaction if missing
  const existingTx = await prisma.paymentTransaction.findFirst({
    where: { workspaceId: workspace.id, provider: 'MANUAL', planId: sub.planId }
  });
  
  if (!existingTx && sub.planId) {
    const plan = await getPlanByCode('STARTER');
    await prisma.paymentTransaction.create({
      data: {
        workspaceId: workspace.id,
        planId: sub.planId,
        amount: plan.monthlyPrice || 24,
        currency: plan.currency || 'USD',
        provider: 'MANUAL',
        status: 'PAID',
        paidAt: sub.startedAt || new Date(),
        notes: 'Backfilled from previous STARTER assignment'
      }
    });
    updated = true;
  }

  return NextResponse.json({ 
    success: true, 
    message: updated ? 'Backfilled successfully.' : 'No backfill needed (already complete).',
    workspaceId: workspace.id,
    updated
  });
}
