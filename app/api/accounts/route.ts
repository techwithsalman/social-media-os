import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { platformRegistry } from '@/integrations';
import { sortBySupportedPlatformOrder } from '@/lib/platforms';
import {
  isMetaOAuthConfigured,
  isRealApiMode,
  syncMetaAccountTokenStatuses,
} from '@/lib/meta-token-service';

import { isRealTikTokConfigured, getTikTokEnvironmentInfo } from '@/lib/tiktok-oauth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await syncMetaAccountTokenStatuses(session.workspaceId);

            // Global one-time cleanup of ALL mock social accounts from production DB
    await prisma.socialAccount.deleteMany({
      where: {
        workspaceId: session.workspaceId,
        isMock: true,
      }
    });

    // Global one-time cleanup of seeded mock posts and notifications
    await prisma.contentPost.deleteMany({
      where: {
        workspaceId: session.workspaceId,
        title: {
          in: [
            'Q3 Product Announcement & Roadmap',
            'Creator Workflow Deep Dive',
            'Official Social Media OS Launch Announcement',
            '5 Posts Scheduled for this week',
          ],
        },
      },
    });

    

const accounts = await prisma.socialAccount.findMany({
      where: { workspaceId: session.workspaceId, isMock: false },
      include: {
        token: {
          select: {
            expiresAt: true,
            scope: true,
            autoDmAccessToken: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const platformRequirements = platformRegistry.getAllRequirements();
    const mappedAccounts = accounts.map(acc => ({ ...acc, hasAutoDmToken: !!acc.token?.autoDmAccessToken, token: acc.token ? { expiresAt: acc.token.expiresAt, scope: acc.token.scope } : null }));
    const sortedAccounts = sortBySupportedPlatformOrder(mappedAccounts);

    return NextResponse.json({
      accounts: sortedAccounts,
      platformRequirements,
      mode: {
        realApiMode: isRealApiMode(),
        mockApiMode: !isRealApiMode(),
        metaOAuthConfigured: isMetaOAuthConfigured(),
        realTikTokConfigured: isRealTikTokConfigured(),
        tiktokEnvironment: getTikTokEnvironmentInfo(),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch accounts' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    await prisma.socialAccount.delete({
      where: { id: accountId, workspaceId: session.workspaceId },
    });

    return NextResponse.json({ success: true, message: 'Account disconnected successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to disconnect account' }, { status: 500 });
  }
}



