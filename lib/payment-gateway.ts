import prisma from './prisma';
import { getPlanByCode } from './billing';

export type BillingProvider = 'SAFE_PAY' | 'STRIPE' | 'OTHER';

export async function createCheckout(input: {
  workspaceId: string;
  planCode: string;
  provider: BillingProvider;
}) {
  await getPlanByCode(input.planCode);

  return {
    available: false,
    provider: input.provider,
    message: 'Online payments are coming soon.',
  };
}

export async function handleWebhook(provider: BillingProvider, payload: unknown) {
  return {
    received: true,
    provider,
    processed: false,
    message: 'Webhook endpoint is reserved for future payment gateway integration.',
    payloadType: typeof payload,
  };
}

export async function activateSubscription(input: {
  workspaceId: string;
  planCode: string;
  source: BillingProvider | 'MANUAL';
  externalCustomerId?: string;
  externalSubscriptionId?: string;
}) {
  const plan = await getPlanByCode(input.planCode);
  const now = new Date();

  const subscription = await prisma.subscription.create({
    data: {
      workspaceId: input.workspaceId,
      planId: plan.id,
      planTier: plan.code,
      status: 'ACTIVE',
      source: input.source,
      startedAt: now,
      currentPeriodStart: now,
      externalCustomerId: input.externalCustomerId || null,
      externalSubscriptionId: input.externalSubscriptionId || null,
    },
  });

  await prisma.workspace.update({
    where: { id: input.workspaceId },
    data: { plan: plan.code },
  });

  return subscription;
}

export async function cancelSubscription(subscriptionId: string) {
  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'CANCELED',
      cancelAtPeriodEnd: true,
    },
  });
}

export async function renewSubscription(subscriptionId: string, months = 1) {
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found.');
  }

  const currentEnd = subscription.currentPeriodEnd || new Date();
  const nextEnd = new Date(currentEnd);
  nextEnd.setMonth(nextEnd.getMonth() + Math.max(1, months));

  return prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: nextEnd,
      cancelAtPeriodEnd: false,
    },
  });
}
