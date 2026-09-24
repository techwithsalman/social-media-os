import { NextResponse } from 'next/server';
import { getAdminOverview } from '@/lib/admin-data';
import { adminErrorResponse, requireSuperAdmin } from '@/lib/super-admin';

export async function GET() {
  try {
    await requireSuperAdmin();
    const overview = await getAdminOverview();
    return NextResponse.json(overview);
  } catch (error) {
    return adminErrorResponse(error);
  }
}
