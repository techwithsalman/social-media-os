const fs = require('fs');
const path = 'lib/billing.ts';
let content = fs.readFileSync(path, 'utf8');

// Patch getEffectivePlan
const regex1 = /\{ currentPeriodEnd: \{ gte: now \} \}/;
const replacement1 = `{ currentPeriodEnd: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } }`;

if (content.match(regex1)) {
  content = content.replace(regex1, replacement1);
  console.log('Patched getEffectivePlan');
}

// Add our new functions
const newFunctions = `
export async function assignManualSubscription(workspaceId: string, planCode: string, adminUserId: string) {
  const plan = await getPlanByCode(planCode);
  const now = new Date();
  
  const currentPeriodEnd = new Date(now);
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  const subscription = await prisma.subscription.create({
    data: {
      workspaceId,
      planId: plan.id,
      planTier: plan.code,
      status: 'ACTIVE',
      source: 'MANUAL',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: currentPeriodEnd,
      cancelAtPeriodEnd: false,
    },
  });

  await prisma.paymentTransaction.create({
    data: {
      workspaceId,
      planId: plan.id,
      amount: plan.monthlyPrice || 0,
      currency: plan.currency || 'USD',
      provider: 'MANUAL',
      status: 'PAID',
      paidAt: now,
      createdByAdminId: adminUserId,
      notes: 'Initial manual subscription assignment',
    }
  });

  await syncWorkspacePlanCache(workspaceId, plan.code);
  return { plan, subscription };
}

export async function renewManualSubscription(workspaceId: string, adminUserId: string) {
  const now = new Date();
  
  // Find the current active manual subscription
  const sub = await prisma.subscription.findFirst({
    where: {
      workspaceId,
      source: 'MANUAL',
    },
    orderBy: { createdAt: 'desc' },
    include: { plan: true }
  });

  if (!sub || !sub.plan) {
    throw new Error('No active manual subscription found to renew');
  }

  let newStart = now;
  let newEnd = new Date(now);
  
  if (sub.currentPeriodEnd && sub.currentPeriodEnd > now) {
    newStart = sub.currentPeriodStart || now;
    newEnd = new Date(sub.currentPeriodEnd);
  }
  
  newEnd.setMonth(newEnd.getMonth() + 1);

  const updatedSub = await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      currentPeriodStart: newStart,
      currentPeriodEnd: newEnd,
      status: 'ACTIVE', // Restore to active if it was PASTDUE
    }
  });

  await prisma.paymentTransaction.create({
    data: {
      workspaceId,
      planId: sub.plan.id,
      amount: sub.plan.monthlyPrice || 0,
      currency: sub.plan.currency || 'USD',
      provider: 'MANUAL',
      status: 'PAID',
      paidAt: now,
      createdByAdminId: adminUserId,
      notes: 'Manual monthly renewal',
    }
  });

  await syncWorkspacePlanCache(workspaceId, sub.plan.code);
  return { plan: sub.plan, subscription: updatedSub };
}
`;

fs.writeFileSync(path, content + newFunctions);
console.log('Appended billing functions');
