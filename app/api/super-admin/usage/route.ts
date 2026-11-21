import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/super-admin';
import { getSuperAdminUsageSummary, getSuperAdminUserUsageList } from '@/lib/usage-analytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'storage';
    const order = (searchParams.get('order') as 'asc' | 'desc') || 'desc';

    const [summary, users] = await Promise.all([
      getSuperAdminUsageSummary(),
      getSuperAdminUserUsageList({ search, sortBy, order }),
    ]);

    return NextResponse.json({
      summary,
      users,
      count: users.length,
    });
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to fetch usage analytics' },
      { status }
    );
  }
}
