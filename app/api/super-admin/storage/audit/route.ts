import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/super-admin';
import { auditR2Storage } from '@/lib/storage/r2-audit-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const audit = await auditR2Storage();

    return NextResponse.json(audit);
  } catch (error: any) {
    return adminErrorResponse(error);
  }
}
