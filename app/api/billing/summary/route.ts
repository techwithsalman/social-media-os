import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getPlans, getWorkspaceEntitlements, serializeEntitlements } from '@/lib/billing';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [plans, entitlements] = await Promise.all([
      getPlans(),
      getWorkspaceEntitlements(session.workspaceId),
    ]);

    return NextResponse.json({
      plans: plans.filter((plan) => plan.active).map((plan) => ({
        ...plan,
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
      })),
      entitlements: serializeEntitlements(entitlements),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to load billing summary' }, { status: 500 });
  }
}
