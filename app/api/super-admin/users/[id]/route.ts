import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminUserDetail } from '@/lib/admin-data';
import { logActivity } from '@/lib/audit';
import {
  UsageCreditType,
  addUsageCredit,
  changeWorkspacePlan,
  grantPlanOverride,
  resetCurrentUsage,
  revokeActivePlanOverrides,
  setCurrentPostUsage,
} from '@/lib/billing';
import { adminErrorResponse, requireSuperAdmin } from '@/lib/super-admin';

function addDuration(duration: string) {
  const expiresAt = new Date();

  switch (duration) {
    case '7_DAYS':
      expiresAt.setDate(expiresAt.getDate() + 7);
      return expiresAt;
    case '30_DAYS':
      expiresAt.setDate(expiresAt.getDate() + 30);
      return expiresAt;
    case '3_MONTHS':
      expiresAt.setMonth(expiresAt.getMonth() + 3);
      return expiresAt;
    case '6_MONTHS':
      expiresAt.setMonth(expiresAt.getMonth() + 6);
      return expiresAt;
    case '1_YEAR':
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      return expiresAt;
    default:
      return null;
  }
}

function resolveExpiry(body: any) {
  if (body.lifetime || body.duration === 'LIFETIME') {
    return { lifetime: true, expiresAt: null };
  }

  if (body.duration === 'CUSTOM_DATE' && body.expiresAt) {
    const customExpiry = new Date(body.expiresAt);
    if (!Number.isNaN(customExpiry.getTime())) {
      return { lifetime: false, expiresAt: customExpiry };
    }
  }

  return { lifetime: false, expiresAt: addDuration(body.duration || '30_DAYS') };
}

async function getTarget(userId: string) {
  const detail = await getAdminUserDetail(userId);

  if (!detail || !detail.workspace) {
    return null;
  }

  return {
    detail,
    workspaceId: detail.workspace.id,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
    const detail = await getAdminUserDetail(params.id);

    if (!detail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const admin = await requireSuperAdmin();
    const body = await req.json();
    const target = await getTarget(params.id);

    if (!target) {
      return NextResponse.json({ error: 'User or workspace not found' }, { status: 404 });
    }

    const { workspaceId } = target;

    if (body.action === 'grant_complimentary_access') {
      const expiry = resolveExpiry(body);
      const override = await grantPlanOverride({
        workspaceId,
        planCode: body.planCode,
        reason: body.reason || 'Complimentary access granted by Super Admin.',
        expiresAt: expiry.expiresAt,
        lifetime: expiry.lifetime,
        adminUserId: admin.user.id,
      });

      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'COMPLIMENTARY_ACCESS_GRANTED',
        details: `${admin.user.email} granted ${override.plan.code} complimentary access.`,
        metadata: {
          planCode: override.plan.code,
          expiresAt: override.expiresAt?.toISOString() || null,
          lifetime: override.lifetime,
          reason: override.reason,
        },
      });
    } else if (body.action === 'revoke_override') {
      const effectivePlan = await revokeActivePlanOverrides(workspaceId);
      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'COMPLIMENTARY_ACCESS_REVOKED',
        details: `${admin.user.email} revoked complimentary access. Effective plan is now ${effectivePlan.plan.code}.`,
      });
    } else if (body.action === 'change_plan') {
      const result = await changeWorkspacePlan(workspaceId, body.planCode);
      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'PLAN_CHANGED',
        details: `${admin.user.email} changed plan to ${result.plan.code}.`,
        metadata: { planCode: result.plan.code, subscriptionId: result.subscription.id },
      });
    } else if (body.action === 'extend_trial') {
      const trialDays = Number(body.days || 7);
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + Math.max(1, trialDays));
      const planCode = body.planCode || 'STARTER';
      const plan = await prisma.plan.findUnique({ where: { code: planCode } });

      if (!plan) {
        return NextResponse.json({ error: 'Plan not found' }, { status: 400 });
      }

      await prisma.subscription.create({
        data: {
          workspaceId,
          planId: plan.id,
          planTier: plan.code,
          status: 'TRIALING',
          source: 'MANUAL',
          startedAt: new Date(),
          currentPeriodStart: new Date(),
          trialEndsAt,
          currentPeriodEnd: trialEndsAt,
        },
      });

      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { plan: plan.code },
      });

      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'TRIAL_EXTENDED',
        details: `${admin.user.email} extended a ${plan.code} trial by ${trialDays} day(s).`,
        metadata: { planCode: plan.code, trialEndsAt: trialEndsAt.toISOString() },
      });
    } else if (body.action === 'suspend') {
      await prisma.$transaction([
        prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            status: 'SUSPENDED',
            suspendedAt: new Date(),
            suspendedReason: body.reason || 'Suspended by Super Admin.',
          },
        }),
        prisma.user.update({
          where: { id: params.id },
          data: { status: 'SUSPENDED' },
        }),
      ]);

      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'ACCOUNT_SUSPENDED',
        details: body.reason || 'Account suspended by Super Admin.',
      });
    } else if (body.action === 'unsuspend') {
      await prisma.$transaction([
        prisma.workspace.update({
          where: { id: workspaceId },
          data: {
            status: 'ACTIVE',
            suspendedAt: null,
            suspendedReason: null,
          },
        }),
        prisma.user.update({
          where: { id: params.id },
          data: { status: 'ACTIVE' },
        }),
      ]);

      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'ACCOUNT_UNSUSPENDED',
        details: 'Account unsuspended by Super Admin.',
      });
    } else if (body.action === 'add_credits') {
      const credit = await addUsageCredit({
        workspaceId,
        type: body.creditType as UsageCreditType,
        amount: Number(body.amount || 0),
        reason: body.reason || 'Bonus credits added by Super Admin.',
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        adminUserId: admin.user.id,
      });

      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'CREDITS_ADDED',
        details: `Added ${credit.amount} ${credit.type} credits.`,
        metadata: { creditId: credit.id, type: credit.type, amount: credit.amount },
      });
    } else if (body.action === 'reset_usage') {
      await resetCurrentUsage(workspaceId);
      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'USAGE_RESET',
        details: 'Current usage period counters were reset.',
      });
    } else if (body.action === 'set_usage') {
      await setCurrentPostUsage(workspaceId, Number(body.postsThisMonth || 0));
      await logActivity({
        workspaceId,
        actorUserId: admin.user.id,
        targetUserId: params.id,
        action: 'USAGE_SET',
        details: `Current monthly post usage set to ${Number(body.postsThisMonth || 0)}.`,
      });
    } else {
      return NextResponse.json({ error: 'Unsupported admin action.' }, { status: 400 });
    }

    const refreshed = await getAdminUserDetail(params.id);
    return NextResponse.json({ success: true, detail: refreshed });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
