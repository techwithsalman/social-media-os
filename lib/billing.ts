import prisma from './prisma';

export const PLAN_CODES = ['FREE', 'STARTER', 'PRO', 'AGENCY'] as const;
export type PlanCode = (typeof PLAN_CODES)[number];

export type UsageCreditType = 'POSTS' | 'STORAGE_MB' | 'SOCIAL_ACCOUNTS' | 'TEAM_MEMBERS';

export class EntitlementError extends Error {
  status: number;
  code: string;

  constructor(message: string, code = 'LIMIT_REACHED', status = 403) {
    super(message);
    this.name = 'EntitlementError';
    this.status = status;
    this.code = code;
  }
}

export const DEFAULT_PLAN_DEFINITIONS = [
  {
    id: 'plan_free',
    code: 'FREE',
    name: 'Free',
    description: 'Essential publishing for individual creators getting started.',
    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: 'USD',
    maxSocialAccounts: 8,
    monthlyPostLimit: 100,
    maxTeamMembers: 1,
    storageLimitMB: 500,
    bulkUploadEnabled: false,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: false,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: false,
    active: true,
    sortOrder: 10,
  },
  {
    id: 'plan_starter',
    code: 'STARTER',
    name: 'Starter',
    description: 'Creator and small team workflows with richer scheduling capacity.',
    monthlyPrice: 2400,
    yearlyPrice: 22800,
    currency: 'USD',
    maxSocialAccounts: 15,
    monthlyPostLimit: 500,
    maxTeamMembers: 2,
    storageLimitMB: 2048,
    bulkUploadEnabled: true,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: false,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: false,
    active: true,
    sortOrder: 20,
  },
  {
    id: 'plan_pro',
    code: 'PRO',
    name: 'Pro',
    description: 'High-volume publishing, team controls, and advanced analytics.',
    monthlyPrice: 5900,
    yearlyPrice: 58800,
    currency: 'USD',
    maxSocialAccounts: 30,
    monthlyPostLimit: 1500,
    maxTeamMembers: 5,
    storageLimitMB: 10240,
    bulkUploadEnabled: true,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: true,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: true,
    active: true,
    sortOrder: 30,
  },
  {
    id: 'plan_agency',
    code: 'AGENCY',
    name: 'Agency',
    description: 'Agency-scale client operations with expanded limits and support.',
    monthlyPrice: 14900,
    yearlyPrice: 154800,
    currency: 'USD',
    maxSocialAccounts: 100,
    monthlyPostLimit: 5000,
    maxTeamMembers: 20,
    storageLimitMB: 51200,
    bulkUploadEnabled: true,
    analyticsEnabled: true,
    advancedAnalyticsEnabled: true,
    schedulingEnabled: true,
    customCaptionsEnabled: true,
    prioritySupportEnabled: true,
    active: true,
    sortOrder: 40,
  },
] as const;

export function getCurrentUsagePeriodRange(now = new Date()) {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { periodStart, periodEnd };
}

export async function ensureDefaultPlans(client: typeof prisma = prisma) {
  const plans = [];

  for (const definition of DEFAULT_PLAN_DEFINITIONS) {
    const plan = await client.plan.upsert({
      where: { code: definition.code },
      update: {
        maxSocialAccounts: definition.maxSocialAccounts,
        monthlyPostLimit: definition.monthlyPostLimit,
        maxTeamMembers: definition.maxTeamMembers,
        storageLimitMB: definition.storageLimitMB,
        bulkUploadEnabled: definition.bulkUploadEnabled,
        analyticsEnabled: definition.analyticsEnabled,
        advancedAnalyticsEnabled: definition.advancedAnalyticsEnabled,
        schedulingEnabled: definition.schedulingEnabled,
        customCaptionsEnabled: definition.customCaptionsEnabled,
        prioritySupportEnabled: definition.prioritySupportEnabled,
      },
      create: definition,
    });
    plans.push(plan);
  }

  return plans;
}

function addCreditToLimit(limit: number | null | undefined, credit: number) {
  return limit === null ? null : (limit || 0) + credit;
}

export async function getPlans() {
  await ensureDefaultPlans();
  return prisma.plan.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getPlanByCode(code: string) {
  await ensureDefaultPlans();
  const plan = await prisma.plan.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!plan) {
    throw new EntitlementError(`Plan ${code} does not exist.`, 'PLAN_NOT_FOUND', 400);
  }

  return plan;
}

async function getOrCreateUsagePeriod(workspaceId: string, now = new Date()) {
  const { periodStart, periodEnd } = getCurrentUsagePeriodRange(now);

  return prisma.usagePeriod.upsert({
    where: {
      workspaceId_periodStart_periodEnd: {
        workspaceId,
        periodStart,
        periodEnd,
      },
    },
    update: {},
    create: {
      workspaceId,
      periodStart,
      periodEnd,
    },
  });
}

export async function getEffectivePlan(workspaceId: string, now = new Date()) {
  await ensureDefaultPlans();

  const [workspace, activeOverride, subscriptions, freePlan] = await Promise.all([
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        id: true,
        name: true,
        plan: true,
        status: true,
        suspendedAt: true,
        suspendedReason: true,
      },
    }),
    prisma.planOverride.findFirst({
      where: {
        workspaceId,
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ lifetime: true }, { expiresAt: null }, { expiresAt: { gte: now } }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.subscription.findMany({
      where: {
        workspaceId,
        status: { in: ['ACTIVE', 'MANUAL', 'TRIALING'] },
        OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) } }, { trialEndsAt: { gte: now } }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.plan.findUnique({ where: { code: 'FREE' } }),
  ]);

  if (!workspace) {
    throw new EntitlementError('Workspace not found.', 'WORKSPACE_NOT_FOUND', 404);
  }

  if (activeOverride) {
    return {
      workspace,
      plan: activeOverride.plan,
      source: 'OVERRIDE' as const,
      subscription: null,
      override: activeOverride,
    };
  }

  const activeSubscription = subscriptions.find((subscription) =>
    ['ACTIVE', 'MANUAL'].includes(subscription.status)
  );
  if (activeSubscription?.plan) {
    return {
      workspace,
      plan: activeSubscription.plan,
      source: activeSubscription.source === 'MANUAL' ? ('MANUAL_SUBSCRIPTION' as const) : ('SUBSCRIPTION' as const),
      subscription: activeSubscription,
      override: null,
    };
  }

  const trialSubscription = subscriptions.find((subscription) => subscription.status === 'TRIALING');
  if (trialSubscription?.plan) {
    return {
      workspace,
      plan: trialSubscription.plan,
      source: 'TRIAL' as const,
      subscription: trialSubscription,
      override: null,
    };
  }

  if (!freePlan) {
    throw new EntitlementError('Free plan is not configured.', 'PLAN_NOT_FOUND', 500);
  }

  return {
    workspace,
    plan: freePlan,
    source: 'FREE' as const,
    subscription: null,
    override: null,
  };
}

export async function getActiveUsageCredits(workspaceId: string, now = new Date()) {
  const credits = await prisma.usageCredit.findMany({
    where: {
      workspaceId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    orderBy: { createdAt: 'desc' },
  });

  const totals: Record<UsageCreditType, number> = {
    POSTS: 0,
    STORAGE_MB: 0,
    SOCIAL_ACCOUNTS: 0,
    TEAM_MEMBERS: 0,
  };

  credits.forEach((credit) => {
    if (credit.type in totals) {
      totals[credit.type as UsageCreditType] += credit.amount;
    }
  });

  return { credits, totals };
}

export async function getWorkspaceUsage(workspaceId: string, now = new Date()) {
  const usagePeriod = await getOrCreateUsagePeriod(workspaceId, now);
  const [connectedAccounts, teamMembers, storageAggregate] = await Promise.all([
    prisma.socialAccount.count({
      where: { workspaceId, status: 'CONNECTED' },
    }),
    prisma.workspaceMember.count({
      where: { workspaceId },
    }),
    prisma.mediaAsset.aggregate({
      where: { workspaceId },
      _sum: { size: true },
    }),
  ]);

  const storageUsedBytes = storageAggregate._sum.size || 0;

  return {
    periodStart: usagePeriod.periodStart,
    periodEnd: usagePeriod.periodEnd,
    publishedPosts: usagePeriod.publishedPosts,
    scheduledPosts: usagePeriod.scheduledPosts,
    postsThisMonth: usagePeriod.publishedPosts + usagePeriod.scheduledPosts,
    uploadedBytes: Number(usagePeriod.uploadedBytes),
    bulkUploadCount: usagePeriod.bulkUploadCount,
    connectedAccounts,
    teamMembers,
    storageUsedBytes,
    storageUsedMB: Math.ceil(storageUsedBytes / (1024 * 1024)),
  };
}

export async function getWorkspaceEntitlements(workspaceId: string, now = new Date()) {
  const [effectivePlan, usage, activeCredits] = await Promise.all([
    getEffectivePlan(workspaceId, now),
    getWorkspaceUsage(workspaceId, now),
    getActiveUsageCredits(workspaceId, now),
  ]);

  const limits = {
    maxSocialAccounts: addCreditToLimit(effectivePlan.plan.maxSocialAccounts, activeCredits.totals.SOCIAL_ACCOUNTS),
    monthlyPostLimit: addCreditToLimit(effectivePlan.plan.monthlyPostLimit, activeCredits.totals.POSTS),
    maxTeamMembers: addCreditToLimit(effectivePlan.plan.maxTeamMembers, activeCredits.totals.TEAM_MEMBERS),
    storageLimitMB: addCreditToLimit(effectivePlan.plan.storageLimitMB, activeCredits.totals.STORAGE_MB),
  };

  return {
    workspace: effectivePlan.workspace,
    plan: effectivePlan.plan,
    source: effectivePlan.source,
    subscription: effectivePlan.subscription,
    override: effectivePlan.override,
    limits,
    features: {
      bulkUploadEnabled: effectivePlan.plan.bulkUploadEnabled,
      analyticsEnabled: effectivePlan.plan.analyticsEnabled,
      advancedAnalyticsEnabled: effectivePlan.plan.advancedAnalyticsEnabled,
      schedulingEnabled: effectivePlan.plan.schedulingEnabled,
      customCaptionsEnabled: effectivePlan.plan.customCaptionsEnabled,
      prioritySupportEnabled: effectivePlan.plan.prioritySupportEnabled,
    },
    usage,
    credits: activeCredits.credits,
  };
}

export async function assertWorkspaceActive(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { status: true, suspendedReason: true },
  });

  if (!workspace) {
    throw new EntitlementError('Workspace not found.', 'WORKSPACE_NOT_FOUND', 404);
  }

  if (workspace.status === 'SUSPENDED') {
    throw new EntitlementError(
      workspace.suspendedReason
        ? `This workspace is suspended: ${workspace.suspendedReason}`
        : 'This workspace is suspended. Publishing and scheduling are unavailable.',
      'WORKSPACE_SUSPENDED',
      403
    );
  }
}

export async function assertCanCreateBillablePost(workspaceId: string, action: 'publish' | 'schedule') {
  await assertWorkspaceActive(workspaceId);
  const entitlements = await getWorkspaceEntitlements(workspaceId);

  if (action === 'schedule' && !entitlements.features.schedulingEnabled) {
    throw new EntitlementError('Scheduling is not included in your current plan.', 'FEATURE_NOT_AVAILABLE', 403);
  }

  if (
    entitlements.limits.monthlyPostLimit !== null &&
    entitlements.usage.postsThisMonth + 1 > entitlements.limits.monthlyPostLimit
  ) {
    throw new EntitlementError(
      `You have used all ${entitlements.limits.monthlyPostLimit} posts included in your ${entitlements.plan.name} plan.`,
      'MONTHLY_POST_LIMIT_REACHED',
      403
    );
  }
}

export async function assertCanConnectSocialAccount(workspaceId: string) {
  await assertWorkspaceActive(workspaceId);
  const entitlements = await getWorkspaceEntitlements(workspaceId);

  if (
    entitlements.limits.maxSocialAccounts !== null &&
    entitlements.usage.connectedAccounts + 1 > entitlements.limits.maxSocialAccounts
  ) {
    throw new EntitlementError(
      `You have reached your connected account limit of ${entitlements.limits.maxSocialAccounts} on the ${entitlements.plan.name} plan.`,
      'SOCIAL_ACCOUNT_LIMIT_REACHED',
      403
    );
  }
}

export async function assertCanInviteTeamMember(workspaceId: string) {
  await assertWorkspaceActive(workspaceId);
  const entitlements = await getWorkspaceEntitlements(workspaceId);

  if (
    entitlements.limits.maxTeamMembers !== null &&
    entitlements.usage.teamMembers + 1 > entitlements.limits.maxTeamMembers
  ) {
    throw new EntitlementError(
      `You have reached your team member limit of ${entitlements.limits.maxTeamMembers} on the ${entitlements.plan.name} plan.`,
      'TEAM_MEMBER_LIMIT_REACHED',
      403
    );
  }
}

export async function assertCanUploadFile(workspaceId: string, fileSizeBytes: number) {
  await assertWorkspaceActive(workspaceId);
  const entitlements = await getWorkspaceEntitlements(workspaceId);
  if (entitlements.limits.storageLimitMB === null) {
    return;
  }

  const limitBytes = entitlements.limits.storageLimitMB * 1024 * 1024;

  if (entitlements.usage.storageUsedBytes + fileSizeBytes > limitBytes) {
    throw new EntitlementError(
      `You have reached your storage limit. Storage Used: ${entitlements.usage.storageUsedMB} MB / ${entitlements.limits.storageLimitMB} MB.`,
      'STORAGE_LIMIT_REACHED',
      403
    );
  }
}

export async function recordPostUsage(workspaceId: string, kind: 'published' | 'scheduled') {
  const usagePeriod = await getOrCreateUsagePeriod(workspaceId);

  return prisma.usagePeriod.update({
    where: { id: usagePeriod.id },
    data:
      kind === 'published'
        ? { publishedPosts: { increment: 1 } }
        : { scheduledPosts: { increment: 1 } },
  });
}

export async function recordUploadedBytes(workspaceId: string, bytes: number) {
  const usagePeriod = await getOrCreateUsagePeriod(workspaceId);

  return prisma.usagePeriod.update({
    where: { id: usagePeriod.id },
    data: {
      uploadedBytes: { increment: BigInt(bytes) },
    },
  });
}

export async function resetCurrentUsage(workspaceId: string) {
  const usagePeriod = await getOrCreateUsagePeriod(workspaceId);

  return prisma.usagePeriod.update({
    where: { id: usagePeriod.id },
    data: {
      publishedPosts: 0,
      scheduledPosts: 0,
      uploadedBytes: 0,
      bulkUploadCount: 0,
    },
  });
}

export async function setCurrentPostUsage(workspaceId: string, postsThisMonth: number) {
  const usagePeriod = await getOrCreateUsagePeriod(workspaceId);

  return prisma.usagePeriod.update({
    where: { id: usagePeriod.id },
    data: {
      publishedPosts: Math.max(0, Math.floor(postsThisMonth)),
      scheduledPosts: 0,
    },
  });
}

export async function syncWorkspacePlanCache(workspaceId: string, planCode: string) {
  return prisma.workspace.update({
    where: { id: workspaceId },
    data: { plan: planCode },
  });
}

export async function changeWorkspacePlan(workspaceId: string, planCode: string) {
  const plan = await getPlanByCode(planCode);
  const now = new Date();

  const subscription = await prisma.subscription.create({
    data: {
      workspaceId,
      planId: plan.id,
      planTier: plan.code,
      status: 'ACTIVE',
      source: 'MANUAL',
      startedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
    },
  });

  await syncWorkspacePlanCache(workspaceId, plan.code);
  return { plan, subscription };
}

export async function grantPlanOverride(input: {
  workspaceId: string;
  planCode: string;
  reason: string;
  expiresAt?: Date | null;
  lifetime?: boolean;
  adminUserId?: string;
}) {
  const plan = await getPlanByCode(input.planCode);

  await prisma.planOverride.updateMany({
    where: {
      workspaceId: input.workspaceId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const override = await prisma.planOverride.create({
    data: {
      workspaceId: input.workspaceId,
      planId: plan.id,
      reason: input.reason,
      expiresAt: input.lifetime ? null : input.expiresAt || null,
      lifetime: Boolean(input.lifetime),
      createdByAdminId: input.adminUserId,
    },
    include: { plan: true },
  });

  await syncWorkspacePlanCache(input.workspaceId, plan.code);
  return override;
}

export async function revokeActivePlanOverrides(workspaceId: string) {
  const now = new Date();
  await prisma.planOverride.updateMany({
    where: {
      workspaceId,
      revokedAt: null,
    },
    data: { revokedAt: now },
  });

  const effectivePlan = await getEffectivePlan(workspaceId);
  await syncWorkspacePlanCache(workspaceId, effectivePlan.plan.code);
  return effectivePlan;
}

export async function addUsageCredit(input: {
  workspaceId: string;
  type: UsageCreditType;
  amount: number;
  reason: string;
  expiresAt?: Date | null;
  adminUserId?: string;
}) {
  return prisma.usageCredit.create({
    data: {
      workspaceId: input.workspaceId,
      type: input.type,
      amount: input.amount,
      reason: input.reason,
      expiresAt: input.expiresAt || null,
      createdByAdminId: input.adminUserId,
    },
  });
}

export async function recordManualPaymentAndActivatePlan(input: {
  workspaceId: string;
  planCode: string;
  amount: number;
  currency: string;
  provider: string;
  reference?: string;
  notes?: string;
  adminUserId?: string;
  months?: number;
}) {
  const plan = await getPlanByCode(input.planCode);
  const now = new Date();
  const months = Math.max(1, input.months || 1);
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + months);

  const result = await prisma.$transaction(async (tx) => {
    const payment = await tx.paymentTransaction.create({
      data: {
        workspaceId: input.workspaceId,
        planId: plan.id,
        amount: input.amount,
        currency: input.currency,
        provider: input.provider,
        reference: input.reference || null,
        status: 'PAID',
        paidAt: now,
        notes: input.notes || null,
        createdByAdminId: input.adminUserId,
      },
    });

    const subscription = await tx.subscription.create({
      data: {
        workspaceId: input.workspaceId,
        planId: plan.id,
        planTier: plan.code,
        status: 'ACTIVE',
        source: 'MANUAL',
        startedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    await tx.workspace.update({
      where: { id: input.workspaceId },
      data: { plan: plan.code },
    });

    return { payment, subscription };
  });

  return { plan, ...result };
}

export function serializeEntitlements(entitlements: Awaited<ReturnType<typeof getWorkspaceEntitlements>>) {
  return {
    ...entitlements,
    usage: {
      ...entitlements.usage,
      uploadedBytes: Number(entitlements.usage.uploadedBytes),
      storageUsedBytes: Number(entitlements.usage.storageUsedBytes),
    },
    credits: entitlements.credits.map((credit) => ({
      ...credit,
      createdAt: credit.createdAt.toISOString(),
      startsAt: credit.startsAt.toISOString(),
      expiresAt: credit.expiresAt?.toISOString() || null,
      revokedAt: credit.revokedAt?.toISOString() || null,
    })),
    plan: {
      ...entitlements.plan,
      createdAt: entitlements.plan.createdAt.toISOString(),
      updatedAt: entitlements.plan.updatedAt.toISOString(),
    },
    workspace: {
      ...entitlements.workspace,
      suspendedAt: entitlements.workspace.suspendedAt?.toISOString() || null,
    },
    override: entitlements.override
      ? {
          ...entitlements.override,
          startsAt: entitlements.override.startsAt.toISOString(),
          expiresAt: entitlements.override.expiresAt?.toISOString() || null,
          createdAt: entitlements.override.createdAt.toISOString(),
          revokedAt: entitlements.override.revokedAt?.toISOString() || null,
        }
      : null,
    subscription: entitlements.subscription
      ? {
          ...entitlements.subscription,
          startedAt: entitlements.subscription.startedAt.toISOString(),
          currentPeriodStart: entitlements.subscription.currentPeriodStart?.toISOString() || null,
          currentPeriodEnd: entitlements.subscription.currentPeriodEnd?.toISOString() || null,
          trialEndsAt: entitlements.subscription.trialEndsAt?.toISOString() || null,
          createdAt: entitlements.subscription.createdAt.toISOString(),
          updatedAt: entitlements.subscription.updatedAt.toISOString(),
        }
      : null,
  };
}

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

export function computePaymentStatus(sub: any) {
  if (!sub || sub.source !== 'MANUAL' || !sub.currentPeriodEnd) return 'FREE';
  const now = new Date();
  
  // Strip time for day comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(sub.currentPeriodEnd);
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  const graceEnd = new Date(endDate);
  graceEnd.setDate(graceEnd.getDate() + 3);
  
  if (today.getTime() === endDate.getTime()) {
    return 'DUE';
  } else if (today < endDate) {
    return 'PAID';
  } else if (today <= graceEnd) {
    return 'PAST_DUE';
  } else {
    return 'EXPIRED';
  }
}

export async function downgradeToFree(workspaceId: string, adminUserId: string) {
  // Cancel manual subscription
  await prisma.subscription.updateMany({
    where: { workspaceId, source: 'MANUAL', status: 'ACTIVE' },
    data: { status: 'CANCELED', currentPeriodEnd: new Date() }
  });
  await syncWorkspacePlanCache(workspaceId, 'FREE');
  return { plan: 'FREE' };
}
