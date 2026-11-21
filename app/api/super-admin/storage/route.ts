import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/super-admin';
import { getSuperAdminGlobalStorageOverview } from '@/lib/usage-analytics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const overview = await getSuperAdminGlobalStorageOverview();

    return NextResponse.json(overview);
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to fetch global storage overview' },
      { status }
    );
  }
}
