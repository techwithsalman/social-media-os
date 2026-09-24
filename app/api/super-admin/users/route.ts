import { NextResponse } from 'next/server';
import { getAdminUserRows } from '@/lib/admin-data';
import { adminErrorResponse, requireSuperAdmin } from '@/lib/super-admin';

export async function GET() {
  try {
    await requireSuperAdmin();
    const users = await getAdminUserRows();
    return NextResponse.json({ users });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
