import prisma from './prisma';
import { getPlans, getWorkspaceEntitlements, serializeEntitlements } from './billing';

export function toIso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function moneyFromMinorUnits(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

export async function getAdminOverview() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalWorkspaces,
    connectedSocialAccounts,
    postsPublishedThisMonth,
    postsScheduled,
    failedPosts,
    storageAggregate,
    trialUsers,
    paidUsers,
    activeSubscriptions,
    manualSubscriptions,
    complimentaryUsers,
    recentUsers,
    recentActivity,
    reconnectionIssues,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.workspace.count({ where: { status: 'SUSPENDED' } }),
    prisma.workspace.count(),
    prisma.socialAccount.count({ where: { status: 'CONNECTED' } }),
    prisma.contentPost.count({
      where: {
        status: { in: ['PUBLISHED', 'PARTIALLY_FAILED'] },
        publishedAt: { gte: monthStart },
      },
    }),
    prisma.contentPost.count({ where: { status: 'SCHEDULED' } }),
    prisma.contentPost.count({ where: { status: 'FAILED' } }),
    prisma.mediaAsset.aggregate({ _sum: { size: true } }),
    prisma.subscription.count({ where: { status: 'TRIALING' } }),
    prisma.subscription.count({
      where: {
        status: { in: ['ACTIVE', 'MANUAL'] },
        planTier: { not: 'FREE' },
      },
    }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
    prisma.subscription.count({ where: { source: 'MANUAL' } }),
    prisma.planOverride.count({
      where: {
        revokedAt: null,
        OR: [{ lifetime: true }, { expiresAt: null }, { expiresAt: { gte: now } }],
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
    }),
    prisma.socialAccount.count({
      where: { status: { in: ['EXPIRED', 'NEEDS_RECONNECTION', 'DISCONNECTED'] } },
    }),
  ]);

  return {
    stats: {
      totalUsers,
      activeUsers,
      trialUsers,
      paidUsers,
      suspendedUsers,
      totalWorkspaces,
      connectedSocialAccounts,
      postsPublishedThisMonth,
      postsScheduled,
      failedPosts,
      mrr: 0,
      storageUsedBytes: storageAggregate._sum.size || 0,
      activeSubscriptions,
      manualSubscriptions,
      complimentaryUsers,
      reconnectionIssues,
    },
    recentUsers: recentUsers.map((user) => ({
      ...user,
      createdAt: user.createdAt.toISOString(),
    })),
    recentActivity: recentActivity.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    })),
  };
}

export async function getAdminUserRows() {
  await getPlans();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      systemRole: true,
      status: true,
      createdAt: true,
      lastActiveAt: true,
      workspaces: {
        include: {
          workspace: true,
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  return Promise.all(
    users.map(async (user) => {
      const workspace = user.workspaces[0]?.workspace || null;
      const entitlements = workspace ? await getWorkspaceEntitlements(workspace.id) : null;

      return {
        id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        firstName: user.firstName,
        lastName: user.lastName,
        systemRole: user.systemRole,
        status: workspace?.status || user.status,
        joinedAt: user.createdAt.toISOString(),
        lastActiveAt: toIso(user.lastActiveAt),
        workspace: workspace
          ? {
              id: workspace.id,
              name: workspace.name,
              slug: workspace.slug,
              status: workspace.status,
            }
          : null,
        currentPlan: entitlements?.plan.code || 'FREE',
        currentPlanName: entitlements?.plan.name || 'Free',
        subscriptionStatus: entitlements?.subscription?.status || entitlements?.source || 'FREE',
        effectivePlanSource: entitlements?.source || 'FREE',
        connectedAccounts: entitlements?.usage.connectedAccounts || 0,
        postsUsedThisMonth: entitlements?.usage.postsThisMonth || 0,
        storageUsedBytes: entitlements?.usage.storageUsedBytes || 0,
        teamMembers: entitlements?.usage.teamMembers || 0,
      };
    })
  );
}

export async function getAdminUserDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      systemRole: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      lastActiveAt: true,
      workspaces: {
        include: {
          workspace: true,
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!user) return null;

  const workspace = user.workspaces[0]?.workspace || null;
  const entitlements = workspace ? await getWorkspaceEntitlements(workspace.id) : null;

  const [
    connectedAccounts,
    recentPosts,
    recentActivity,
    teamMembers,
    paymentTransactions,
    subscriptions,
    planOverrides,
    notifications,
  ] = workspace
    ? await Promise.all([
        prisma.socialAccount.findMany({
          where: { workspaceId: workspace.id },
          select: {
            id: true,
            platform: true,
            name: true,
            username: true,
            status: true,
            isMock: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.contentPost.findMany({
          where: { workspaceId: workspace.id },
          select: {
            id: true,
            title: true,
            masterCaption: true,
            status: true,
            scheduledFor: true,
            publishedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.activityLog.findMany({
          where: {
            OR: [{ workspaceId: workspace.id }, { targetUserId: user.id }],
          },
          orderBy: { createdAt: 'desc' },
          take: 12,
        }),
        prisma.workspaceMember.findMany({
          where: { workspaceId: workspace.id },
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
          orderBy: { joinedAt: 'asc' },
        }),
        prisma.paymentTransaction.findMany({
          where: { workspaceId: workspace.id },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.subscription.findMany({
          where: { workspaceId: workspace.id },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.planOverride.findMany({
          where: { workspaceId: workspace.id },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
        prisma.notification.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
      ])
    : [[], [], [], [], [], [], [], []];

  return {
    user: {
      ...user,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      lastActiveAt: toIso(user.lastActiveAt),
      workspaces: undefined,
    },
    workspace: workspace
      ? {
          ...workspace,
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
          suspendedAt: toIso(workspace.suspendedAt),
        }
      : null,
    entitlements: entitlements ? serializeEntitlements(entitlements) : null,
    connectedAccounts: connectedAccounts.map((account) => ({
      ...account,
      createdAt: account.createdAt.toISOString(),
    })),
    recentPosts: recentPosts.map((post) => ({
      ...post,
      scheduledFor: toIso(post.scheduledFor),
      publishedAt: toIso(post.publishedAt),
      createdAt: post.createdAt.toISOString(),
    })),
    recentActivity: recentActivity.map((activity) => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    })),
    teamMembers: teamMembers.map((member) => ({
      id: member.id,
      role: member.role,
      joinedAt: member.joinedAt.toISOString(),
      user: member.user,
    })),
    paymentTransactions: paymentTransactions.map((payment) => ({
      ...payment,
      paidAt: toIso(payment.paidAt),
      createdAt: payment.createdAt.toISOString(),
      plan: payment.plan,
    })),
    subscriptions: subscriptions.map((subscription) => ({
      ...subscription,
      startedAt: subscription.startedAt.toISOString(),
      currentPeriodStart: toIso(subscription.currentPeriodStart),
      currentPeriodEnd: toIso(subscription.currentPeriodEnd),
      trialEndsAt: toIso(subscription.trialEndsAt),
      createdAt: subscription.createdAt.toISOString(),
      updatedAt: subscription.updatedAt.toISOString(),
    })),
    planOverrides: planOverrides.map((override) => ({
      ...override,
      startsAt: override.startsAt.toISOString(),
      expiresAt: toIso(override.expiresAt),
      revokedAt: toIso(override.revokedAt),
      createdAt: override.createdAt.toISOString(),
    })),
    notifications: notifications.map((notification) => ({
      ...notification,
      createdAt: notification.createdAt.toISOString(),
    })),
  };
}
