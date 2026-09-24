import prisma from './prisma';
import {
  DEFAULT_PLAN_DEFINITIONS,
  ensureDefaultPlans,
  getCurrentUsagePeriodRange,
  getPlanByCode,
  recordManualPaymentAndActivatePlan,
} from './billing';
import { logActivity } from './audit';

const DEMO_USER_PASSWORD_PLACEHOLDER = 'pending_invitation';

type DemoTenant = {
  userId: string;
  workspaceId: string;
  email: string;
  firstName: string;
  lastName: string;
  workspaceName: string;
  slug: string;
  planCode: string;
  subscriptionStatus: string;
  status?: string;
  complimentaryPlanCode?: string;
};

const demoTenants: DemoTenant[] = [
  {
    userId: 'user_demo_free',
    workspaceId: 'ws_demo_free',
    email: 'free-user@socialos.dev',
    firstName: 'Free',
    lastName: 'User',
    workspaceName: 'Free Demo Workspace',
    slug: 'demo-free-workspace',
    planCode: 'FREE',
    subscriptionStatus: 'ACTIVE',
  },
  {
    userId: 'user_demo_starter',
    workspaceId: 'ws_demo_starter',
    email: 'starter-user@socialos.dev',
    firstName: 'Starter',
    lastName: 'User',
    workspaceName: 'Starter Demo Workspace',
    slug: 'demo-starter-workspace',
    planCode: 'STARTER',
    subscriptionStatus: 'ACTIVE',
  },
  {
    userId: 'user_demo_pro',
    workspaceId: 'ws_demo_pro',
    email: 'pro-user@socialos.dev',
    firstName: 'Pro',
    lastName: 'User',
    workspaceName: 'Pro Demo Workspace',
    slug: 'demo-pro-workspace',
    planCode: 'PRO',
    subscriptionStatus: 'ACTIVE',
  },
  {
    userId: 'user_demo_agency',
    workspaceId: 'ws_demo_agency',
    email: 'agency-user@socialos.dev',
    firstName: 'Agency',
    lastName: 'User',
    workspaceName: 'Agency Demo Workspace',
    slug: 'demo-agency-workspace',
    planCode: 'AGENCY',
    subscriptionStatus: 'ACTIVE',
  },
  {
    userId: 'user_demo_complimentary',
    workspaceId: 'ws_demo_complimentary',
    email: 'complimentary-user@socialos.dev',
    firstName: 'Complimentary',
    lastName: 'Client',
    workspaceName: 'Complimentary Pro Workspace',
    slug: 'demo-complimentary-workspace',
    planCode: 'FREE',
    subscriptionStatus: 'ACTIVE',
    complimentaryPlanCode: 'PRO',
  },
  {
    userId: 'user_demo_suspended',
    workspaceId: 'ws_demo_suspended',
    email: 'suspended-user@socialos.dev',
    firstName: 'Suspended',
    lastName: 'User',
    workspaceName: 'Suspended Demo Workspace',
    slug: 'demo-suspended-workspace',
    planCode: 'STARTER',
    subscriptionStatus: 'ACTIVE',
    status: 'SUSPENDED',
  },
] as const;

async function upsertDemoUser(input: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}) {
  return prisma.user.upsert({
    where: { email: input.email },
    update: {
      firstName: input.firstName,
      lastName: input.lastName,
      status: 'ACTIVE',
    },
    create: {
      id: input.id,
      email: input.email,
      passwordHash: DEMO_USER_PASSWORD_PLACEHOLDER,
      firstName: input.firstName,
      lastName: input.lastName,
      status: 'ACTIVE',
    },
  });
}

async function upsertDemoSubscription(input: {
  workspaceId: string;
  planCode: string;
  status: string;
  source?: string;
  currentPeriodEnd?: Date | null;
}) {
  const plan = await getPlanByCode(input.planCode);
  const existing = await prisma.subscription.findFirst({
    where: {
      workspaceId: input.workspaceId,
      source: input.source || 'MANUAL',
    },
    orderBy: { createdAt: 'asc' },
  });

  if (existing) {
    return prisma.subscription.update({
      where: { id: existing.id },
      data: {
        planId: plan.id,
        planTier: plan.code,
        status: input.status,
        source: input.source || 'MANUAL',
        currentPeriodStart: existing.currentPeriodStart || new Date(),
        currentPeriodEnd: input.currentPeriodEnd || null,
        cancelAtPeriodEnd: false,
      },
    });
  }

  return prisma.subscription.create({
    data: {
      workspaceId: input.workspaceId,
      planId: plan.id,
      planTier: plan.code,
      status: input.status,
      source: input.source || 'MANUAL',
      startedAt: new Date(),
      currentPeriodStart: new Date(),
      currentPeriodEnd: input.currentPeriodEnd || null,
      cancelAtPeriodEnd: false,
    },
  });
}

async function ensureActivityOnce(input: {
  workspaceId?: string | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  details: string;
  metadata?: Record<string, unknown>;
}) {
  const existing = await prisma.activityLog.findFirst({
    where: {
      action: input.action,
      details: input.details,
      workspaceId: input.workspaceId || null,
      targetUserId: input.targetUserId || null,
    },
  });

  if (existing) return existing;
  return logActivity(input);
}

export async function bootstrapSaasDemoData(input?: {
  currentUserId?: string;
  currentWorkspaceId?: string;
}) {
  const plans = await ensureDefaultPlans();
  const currentAdminId = input?.currentUserId || null;

  if (currentAdminId && process.env.NODE_ENV !== 'production' && process.env.SEED_PROMOTE_CURRENT_USER_TO_SUPER_ADMIN !== 'false') {
    await prisma.user.update({
      where: { id: currentAdminId },
      data: { systemRole: 'SUPER_ADMIN', status: 'ACTIVE' },
    });
  }

  if (process.env.SUPER_ADMIN_EMAIL) {
    await prisma.user.updateMany({
      where: { email: process.env.SUPER_ADMIN_EMAIL.toLowerCase().trim() },
      data: { systemRole: 'SUPER_ADMIN', status: 'ACTIVE' },
    });
  }

  if (input?.currentWorkspaceId) {
    const agencyPlan = await getPlanByCode('AGENCY');
    const existingSeedOverride = await prisma.planOverride.findFirst({
      where: {
        workspaceId: input.currentWorkspaceId,
        reason: 'Development demo seed access for the approved 8-platform workspace.',
        revokedAt: null,
      },
    });

    if (existingSeedOverride) {
      await prisma.planOverride.update({
        where: { id: existingSeedOverride.id },
        data: {
          planId: agencyPlan.id,
          lifetime: true,
          expiresAt: null,
          createdByAdminId: currentAdminId,
        },
      });
    } else {
      await prisma.planOverride.create({
        data: {
          workspaceId: input.currentWorkspaceId,
          planId: agencyPlan.id,
          reason: 'Development demo seed access for the approved 8-platform workspace.',
          lifetime: true,
          createdByAdminId: currentAdminId || undefined,
        },
      });
    }

    await prisma.workspace.update({
      where: { id: input.currentWorkspaceId },
      data: { plan: agencyPlan.code },
    });
  }

  for (const tenant of demoTenants) {
    const user = await upsertDemoUser({
      id: tenant.userId,
      email: tenant.email,
      firstName: tenant.firstName,
      lastName: tenant.lastName,
    });

    const workspace = await prisma.workspace.upsert({
      where: { slug: tenant.slug },
      update: {
        name: tenant.workspaceName,
        plan: tenant.planCode,
        status: tenant.status || 'ACTIVE',
        suspendedAt: tenant.status === 'SUSPENDED' ? new Date() : null,
        suspendedReason: tenant.status === 'SUSPENDED' ? 'Demo suspension for Super Admin testing.' : null,
      },
      create: {
        id: tenant.workspaceId,
        name: tenant.workspaceName,
        slug: tenant.slug,
        plan: tenant.planCode,
        status: tenant.status || 'ACTIVE',
        suspendedAt: tenant.status === 'SUSPENDED' ? new Date() : null,
        suspendedReason: tenant.status === 'SUSPENDED' ? 'Demo suspension for Super Admin testing.' : null,
      },
    });

    await prisma.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: workspace.id,
          userId: user.id,
        },
      },
      update: { role: 'OWNER' },
      create: {
        workspaceId: workspace.id,
        userId: user.id,
        role: 'OWNER',
      },
    });

    await upsertDemoSubscription({
      workspaceId: workspace.id,
      planCode: tenant.planCode,
      status: tenant.subscriptionStatus,
      source: 'MANUAL',
    });

    if (tenant.complimentaryPlanCode) {
      const existingOverride = await prisma.planOverride.findFirst({
        where: {
          workspaceId: workspace.id,
          reason: 'Demo complimentary Pro access.',
          revokedAt: null,
        },
      });

      const proPlan = await getPlanByCode(tenant.complimentaryPlanCode);
      if (existingOverride) {
        await prisma.planOverride.update({
          where: { id: existingOverride.id },
          data: {
            planId: proPlan.id,
            lifetime: false,
            expiresAt: new Date('2026-12-31T23:59:59.000Z'),
            createdByAdminId: currentAdminId,
          },
        });
      } else {
        await prisma.planOverride.create({
          data: {
            workspaceId: workspace.id,
            planId: proPlan.id,
            reason: 'Demo complimentary Pro access.',
            expiresAt: new Date('2026-12-31T23:59:59.000Z'),
            createdByAdminId: currentAdminId,
          },
        });
      }
    }

    const { periodStart, periodEnd } = getCurrentUsagePeriodRange();

    await prisma.usagePeriod.upsert({
      where: {
        workspaceId_periodStart_periodEnd: {
          workspaceId: workspace.id,
          periodStart,
          periodEnd,
        },
      },
      update: {
        publishedPosts: tenant.planCode === 'FREE' ? 4 : tenant.planCode === 'STARTER' ? 28 : 96,
        scheduledPosts: tenant.planCode === 'FREE' ? 3 : tenant.planCode === 'STARTER' ? 18 : 44,
        uploadedBytes: BigInt(24 * 1024 * 1024),
      },
      create: {
        workspaceId: workspace.id,
        periodStart,
        periodEnd,
        publishedPosts: tenant.planCode === 'FREE' ? 4 : tenant.planCode === 'STARTER' ? 28 : 96,
        scheduledPosts: tenant.planCode === 'FREE' ? 3 : tenant.planCode === 'STARTER' ? 18 : 44,
        uploadedBytes: BigInt(24 * 1024 * 1024),
      },
    });
  }

  const manualPaymentWorkspace = await prisma.workspace.findUnique({
    where: { slug: 'demo-pro-workspace' },
  });
  if (manualPaymentWorkspace) {
    const existingPayment = await prisma.paymentTransaction.findFirst({
      where: {
        workspaceId: manualPaymentWorkspace.id,
        reference: 'DEMO-BANK-5999',
      },
    });

    if (!existingPayment) {
      await recordManualPaymentAndActivatePlan({
        workspaceId: manualPaymentWorkspace.id,
        planCode: 'PRO',
        amount: 5999,
        currency: 'PKR',
        provider: 'BANK_TRANSFER',
        reference: 'DEMO-BANK-5999',
        notes: 'Seeded offline demo payment.',
        adminUserId: currentAdminId || undefined,
        months: 1,
      });
    }
  }

  await ensureActivityOnce({
    actorUserId: currentAdminId,
    action: 'SAAS_DEMO_DATA_SEEDED',
    details: `Seeded ${plans.length} plans and ${demoTenants.length} demo SaaS workspaces.`,
    metadata: {
      planCodes: DEFAULT_PLAN_DEFINITIONS.map((plan) => plan.code),
      currentWorkspaceId: input?.currentWorkspaceId || null,
    },
  });

  return {
    plansSeeded: plans.length,
    demoUsersSeeded: demoTenants.length,
    promotedCurrentUser: Boolean(currentAdminId),
  };
}
