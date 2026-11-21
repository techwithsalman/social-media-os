import { NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/super-admin';

export async function POST(req: Request) {
  try {
    await requireSuperAdmin();

    return NextResponse.json({
      AUTO_DM_APP_ID: !!process.env.AUTO_DM_INSTAGRAM_APP_ID,
      AUTO_DM_APP_SECRET: !!process.env.AUTO_DM_INSTAGRAM_APP_SECRET,
      AUTO_DM_WEBHOOK_VERIFY_TOKEN: !!process.env.AUTO_DM_WEBHOOK_VERIFY_TOKEN,
      AUTO_DM_REDIRECT_URI: !!process.env.AUTO_DM_INSTAGRAM_REDIRECT_URI,
    });
  } catch (error) {
    return adminErrorResponse(error);
  }
}
