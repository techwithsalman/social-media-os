import { NextResponse } from 'next/server';
import { redirect } from 'next/navigation';
import prisma from './prisma';
import { getSession, getCurrentUser, SessionPayload } from './auth';
import { isOwnerEmail, isOwnerUser } from './owner';

export class AccessControlError extends Error {
  status: number;
  code: string;
  redirectUrl?: string;

  constructor(message: string, status = 402, code = 'SUBSCRIPTION_REQUIRED', redirectUrl = '/billing') {
    super(message);
    this.name = 'AccessControlError';
    this.status = status;
    this.code = code;
    this.redirectUrl = redirectUrl;
  }
}

export const SUBSCRIPTION_REQUIRED_PAYLOAD = {
  error: 'PAYMENT_REQUIRED',
  code: 'SUBSCRIPTION_REQUIRED',
  message: 'A valid paid subscription is required to access this feature.',
  redirect: '/billing',
} as const;

export function createPaymentRequiredResponse() {
  return NextResponse.json(SUBSCRIPTION_REQUIRED_PAYLOAD, { status: 402 });
}

export function accessControlErrorResponse(error: unknown) {
  if (error instanceof AccessControlError) {
    return NextResponse.json(
      {
        error: error.status === 402 ? 'PAYMENT_REQUIRED' : error.message,
        code: error.code,
        message: error.message,
        redirect: error.redirectUrl || '/billing',
      },
      { status: error.status }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Access denied' },
    { status: 500 }
  );
}

export interface PaidAccessVerificationResult {
  authorized: boolean;
  isOwner: boolean;
  reason?: string;
  planTier?: string;
  statusCode?: number;
}

/**
 * Server-side verification of genuine paid access for a user and workspace.
 * 1. Owner always receives full permanent access.
 * 2. Non-owner users must have:
 *    - Active user status (not suspended)
 *    - Active workspace status (not suspended)
 *    - Valid workspace membership
 *    - Not a demo/seeded account (e.g. pro-user@socialos.dev)
 *    - A genuinely active, non-expired paid subscription (STARTER, PRO, AGENCY) or active trial
 *    - NOT a FREE plan
 */
export async function verifyPaidAccess(
  userId: string,
  workspaceId: string,
  now = new Date()
): Promise<PaidAccessVerificationResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      status: true,
      systemRole: true,
      workspaces: {
        where: { workspaceId },
        select: { role: true },
      },
    },
  });

  if (!user) {
    return { authorized: false, isOwner: false, reason: 'USER_NOT_FOUND', statusCode: 401 };
  }

  // 1. Canonical Owner Exemption: Permanent Full Access
  if (isOwnerEmail(user.email)) {
    return { authorized: true, isOwner: true, planTier: 'AGENCY' };
  }

  // 2. User Account Suspension Check
  if (user.status !== 'ACTIVE') {
    return { authorized: false, isOwner: false, reason: 'USER_SUSPENDED', statusCode: 403 };
  }

  // 3. Workspace Membership Check
  if (!user.workspaces || user.workspaces.length === 0) {
    return { authorized: false, isOwner: false, reason: 'WORKSPACE_MEMBERSHIP_REQUIRED', statusCode: 403 };
  }

  // 4. Demo / Seeded User Check (pro-user@socialos.dev must not gain real production access)
  const normalizedEmail = user.email.toLowerCase().trim();
  if (
    normalizedEmail === 'pro-user@socialos.dev' ||
    normalizedEmail.endsWith('@socialos.dev') ||
    normalizedEmail.endsWith('@demo.local')
  ) {
    return {
      authorized: false,
      isOwner: false,
      reason: 'DEMO_USER_BLOCKED_FROM_PRODUCTION',
      statusCode: 402,
    };
  }

  // 5. Workspace Status Check
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, status: true, suspendedReason: true },
  });

  if (!workspace) {
    return { authorized: false, isOwner: false, reason: 'WORKSPACE_NOT_FOUND', statusCode: 404 };
  }

  if (workspace.status !== 'ACTIVE') {
    return { authorized: false, isOwner: false, reason: 'WORKSPACE_SUSPENDED', statusCode: 403 };
  }

  // 6. Check Active Plan Overrides (must be unrevoked, unexpired, and non-FREE)
  const activeOverride = await prisma.planOverride.findFirst({
    where: {
      workspaceId,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ lifetime: true }, { expiresAt: null }, { expiresAt: { gte: now } }],
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  if (activeOverride?.plan && activeOverride.plan.code !== 'FREE') {
    return { authorized: true, isOwner: false, planTier: activeOverride.plan.code };
  }

  // 7. Check Subscriptions
  const subscriptions = await prisma.subscription.findMany({
    where: {
      workspaceId,
      status: { in: ['ACTIVE', 'TRIALING', 'MANUAL'] },
    },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  for (const sub of subscriptions) {
    const tier = sub.planTier || sub.plan?.code;
    if (!tier || tier === 'FREE') continue;

    // Reject demo or synthetic subscriptions
    if (sub.source === 'DEMO' || (sub as any).source === 'SYNTHETIC') continue;

    // Check trial
    if (sub.status === 'TRIALING') {
      if (sub.trialEndsAt && sub.trialEndsAt >= now) {
        return { authorized: true, isOwner: false, planTier: tier };
      }
      continue;
    }

    // Check active paid subscription
    if (['ACTIVE', 'MANUAL'].includes(sub.status)) {
      // Must not be expired
      if (sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
        continue; // Expired subscription
      }

      // If manual subscription, verify no synthetic payment marker
      if (sub.source === 'MANUAL') {
        const syntheticTx = await prisma.paymentTransaction.findFirst({
          where: {
            workspaceId,
            planId: sub.planId,
            provider: { in: ['SYNTHETIC', 'DEMO'] },
          },
        });
        if (syntheticTx) {
          continue; // Demo payment cannot grant production access
        }
      }

      return { authorized: true, isOwner: false, planTier: tier };
    }
  }

  // If we reach here, user is on FREE or has no valid paid subscription
  return {
    authorized: false,
    isOwner: false,
    reason: 'VALID_PAID_SUBSCRIPTION_REQUIRED',
    statusCode: 402,
  };
}

/**
 * Enforce paid subscription check on API routes.
 * Throws AccessControlError (status 402) if unauthorized.
 */
export async function assertPaidSubscription(
  sessionOrReq?: SessionPayload | null
): Promise<{ authorized: boolean; isOwner: boolean; planTier?: string }> {
  let session = sessionOrReq;
  if (!session) {
    session = await getSession();
  }

  if (!session) {
    throw new AccessControlError('Unauthorized', 401, 'UNAUTHORIZED', '/login');
  }

  // Permanent Owner bypass
  if (isOwnerEmail(session.email)) {
    return { authorized: true, isOwner: true, planTier: 'AGENCY' };
  }

  const result = await verifyPaidAccess(session.userId, session.workspaceId);

  if (!result.authorized) {
    throw new AccessControlError(
      'A valid paid subscription is required to access this feature.',
      result.statusCode || 402,
      'SUBSCRIPTION_REQUIRED',
      '/billing'
    );
  }

  return result;
}

/**
 * Server Component / Page guard.
 * Verifies that the current user has paid access. If not, redirects to /billing.
 * The Owner is NEVER redirected.
 */
export async function requirePaidAccessForPage() {
  const user = await getCurrentUser();
  if (!user || !user.activeWorkspace) {
    redirect('/login?session_invalid=1');
  }

  if (isOwnerUser(user)) {
    return user;
  }

  const access = await verifyPaidAccess(user.id, user.activeWorkspace.id);
  if (!access.authorized) {
    redirect('/billing?required=1');
  }

  return user;
}
