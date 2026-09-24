import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { logActivity } from '@/lib/audit';
import { ensureDefaultPlans, getPlans } from '@/lib/billing';
import { adminErrorResponse, requireSuperAdmin } from '@/lib/super-admin';

const editableFields = [
  'name',
  'description',
  'monthlyPrice',
  'yearlyPrice',
  'currency',
  'maxSocialAccounts',
  'monthlyPostLimit',
  'maxTeamMembers',
  'storageLimitMB',
  'bulkUploadEnabled',
  'analyticsEnabled',
  'advancedAnalyticsEnabled',
  'schedulingEnabled',
  'customCaptionsEnabled',
  'prioritySupportEnabled',
  'active',
  'sortOrder',
] as const;

export async function GET() {
  try {
    await requireSuperAdmin();
    const plans = await getPlans();
    return NextResponse.json({
      plans: plans.map((plan) => ({
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireSuperAdmin();
    await ensureDefaultPlans();

    const body = await req.json();
    const { planId: explicitPlanId, id, ...updates } = body;
    const planId = explicitPlanId || id;

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required.' }, { status: 400 });
    }

    const data: Record<string, any> = {};
    editableFields.forEach((field) => {
      if (field in updates) {
        data[field] = updates[field];
      }
    });

    const plan = await prisma.plan.update({
      where: { id: planId },
      data,
    });

    await logActivity({
      actorUserId: admin.user.id,
      action: 'PLAN_SETTINGS_CHANGED',
      details: `${admin.user.email} updated ${plan.code} plan settings.`,
      metadata: { planId: plan.id, fields: Object.keys(data) },
    });

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      },
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
