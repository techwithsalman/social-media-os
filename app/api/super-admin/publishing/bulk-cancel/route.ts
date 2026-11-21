import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/super-admin';
import {
  auditScheduledPosts,
  executeBulkCancelScheduledPosts,
} from '@/lib/super-admin-scheduled-cancel';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireSuperAdmin();

    const audit = await auditScheduledPosts();

    return NextResponse.json(audit);
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to audit scheduled posts' },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSuperAdmin();

    const body = await req.json().catch(() => ({}));
    const { confirmToken, selectedPostIds, dryRun } = body;

    if (confirmToken !== 'CONFIRM_CANCEL') {
      return NextResponse.json(
        {
          error:
            "Safety validation failed: You must provide confirmToken: 'CONFIRM_CANCEL' to execute bulk cancellation.",
        },
        { status: 400 }
      );
    }

    const result = await executeBulkCancelScheduledPosts({
      confirmToken,
      actorUserId: user.id,
      selectedPostIds,
      dryRun: !!dryRun,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    const status = error.status || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to execute bulk cancellation' },
      { status }
    );
  }
}
