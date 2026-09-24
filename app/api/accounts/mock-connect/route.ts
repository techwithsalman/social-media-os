import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { platformRegistry, SocialPlatformType } from '@/integrations';
import { encryptToken } from '@/lib/crypto';
import { DEMO_SOCIAL_ACCOUNT_BY_PLATFORM, SupportedPlatformId } from '@/lib/platforms';
import { EntitlementError, assertCanConnectSocialAccount } from '@/lib/billing';
import { isMetaPlatform, isRealApiMode } from '@/lib/meta-token-service';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { platform } = await req.json();

    if (!platform) {
      return NextResponse.json({ error: 'Platform is required' }, { status: 400 });
    }

    const platformId = platform as SocialPlatformType;
    if (isRealApiMode() && isMetaPlatform(platformId)) {
      return NextResponse.json({ error: 'Use Meta OAuth to connect Facebook and Instagram in real API mode.' }, { status: 400 });
    }

    const adapter = platformRegistry.get(platformId);
    const mockAuthResult = await adapter.connectAccount(`mock_code_${Date.now()}`, 'http://localhost:3000/callback');
    const demoAccount = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM[platform as SupportedPlatformId];
    const accountIdentity = demoAccount
      ? {
          platformAccountId: demoAccount.platformAccountId,
          name: demoAccount.name,
          username: demoAccount.username,
          profileImageUrl: demoAccount.profileImageUrl,
          scope: demoAccount.scope,
        }
      : mockAuthResult;

    const tokenData = {
      accessToken: encryptToken(mockAuthResult.accessToken),
      refreshToken: mockAuthResult.refreshToken ? encryptToken(mockAuthResult.refreshToken) : null,
      scope: accountIdentity.scope,
      expiresAt: new Date(Date.now() + (mockAuthResult.expiresIn || 5184000) * 1000),
    };

    // Create or update social account
    const existing = await prisma.socialAccount.findFirst({
      where: {
        workspaceId: session.workspaceId,
        platform: platform,
        platformAccountId: accountIdentity.platformAccountId,
      },
    });

    let account;
    if (existing) {
      account = await prisma.socialAccount.update({
        where: { id: existing.id },
        data: {
          name: accountIdentity.name,
          username: accountIdentity.username,
          profileImageUrl: accountIdentity.profileImageUrl,
          status: 'CONNECTED',
          isMock: true,
          token: {
            upsert: {
              create: tokenData,
              update: tokenData,
            },
          },
        },
      });
    } else {
      await assertCanConnectSocialAccount(session.workspaceId);

      account = await prisma.socialAccount.create({
        data: {
          workspaceId: session.workspaceId,
          platform: platform,
          platformAccountId: accountIdentity.platformAccountId,
          name: accountIdentity.name,
          username: accountIdentity.username,
          profileImageUrl: accountIdentity.profileImageUrl,
          status: 'CONNECTED',
          isMock: true,
          token: {
            create: tokenData,
          },
        },
      });
    }

    await prisma.activityLog.create({
      data: {
        workspaceId: session.workspaceId,
        userId: session.userId,
        action: 'ACCOUNT_CONNECTED',
        details: `Connected ${platform} account (${accountIdentity.username}) in Development Simulation Mode`,
      },
    });

    return NextResponse.json({
      success: true,
      account,
    });
  } catch (error: any) {
    console.error('Mock connect error:', error);
    if (error instanceof EntitlementError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: error.message || 'Failed to connect mock account' }, { status: 500 });
  }
}
