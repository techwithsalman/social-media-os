import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/super-admin';
import { getSuperAdminUserUsageDetail } from '@/lib/usage-analytics';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'all';

    const detail = await getSuperAdminUserUsageDetail(params.id, range);

    if (!detail) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ detail });
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to fetch user usage details' },
      { status }
    );
  }
}
