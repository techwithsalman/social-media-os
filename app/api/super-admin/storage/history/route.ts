import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/super-admin';
import { getR2CleanupHistory } from '@/lib/storage/r2-audit-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const history = await getR2CleanupHistory();

    return NextResponse.json(history);
  } catch (error: any) {
    return adminErrorResponse(error);
  }
}
