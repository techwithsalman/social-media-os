import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin, adminErrorResponse } from '@/lib/super-admin';
import { executeR2Cleanup } from '@/lib/storage/r2-audit-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSuperAdmin();

    const body = await req.json().catch(() => ({}));
    const { confirmToken, dryRun, selectedKeys } = body;

    if (confirmToken !== 'CONFIRM_CLEANUP') {
      return NextResponse.json(
        {
          error:
            "Safety validation failed: You must provide confirmToken: 'CONFIRM_CLEANUP' to execute R2 cleanup.",
        },
        { status: 400 }
      );
    }

    const result = await executeR2Cleanup({
      confirmToken,
      actorUserId: user.id,
      dryRun: !!dryRun,
      selectedKeys,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return adminErrorResponse(error);
  }
}
