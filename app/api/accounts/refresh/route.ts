import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { fetchTikTokUserInfo, refreshTikTokTokenWithLock, TikTokOAuthError } from '@/lib/tiktok-oauth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: session.workspaceId,
      },
      include: {
        token: true,
      },
    });

    if (!account) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    if (account.isMock) {
      const updated = await prisma.socialAccount.update({
        where: { id: account.id },
        data: { status: 'CONNECTED', updatedAt: new Date() },
      });
      return NextResponse.json({ success: true, account: updated, isMock: true });
    }

    if (account.platform === 'TIKTOK') {
      if (!account.token) {
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: { status: 'NEEDS_RECONNECTION' },
        });
        return NextResponse.json(
          { success: false, reauthRequired: true, error: 'No OAuth token found for TikTok account' },
          { status: 400 }
        );
      }

      let accessToken = '';
      try {
        accessToken = await refreshTikTokTokenWithLock(account.id);
      } catch (refreshErr: any) {
        console.error('[TikTok Refresh Route] Token refresh failed:', refreshErr?.message || refreshErr);
        await prisma.socialAccount.update({
          where: { id: account.id },
          data: { status: 'EXPIRED' },
        });
        return NextResponse.json({
          success: false,
          reauthRequired: true,
          error: refreshErr?.message || 'Refresh token expired. Reauthorization required.',
        });
      }

      let userInfo = null;
      try {
        userInfo = await fetchTikTokUserInfo(accessToken, account.platformAccountId);
      } catch (err: any) {
        console.warn('[TikTok Refresh Route] fetchTikTokUserInfo failed:', err?.message || err);
        userInfo = {
          openId: account.platformAccountId,
          displayName: account.name,
          username: account.username,
          avatarUrl: account.profileImageUrl,
        };
      }

      const updateData: any = {
        status: 'CONNECTED',
        updatedAt: new Date(),
      };

      if (userInfo.displayName && userInfo.displayName !== 'TikTok Creator') {
        updateData.name = userInfo.displayName;
      } else if (!account.name || account.name === 'TikTok Creator') {
        updateData.name = userInfo.displayName;
      }

      if (userInfo.username && userInfo.username !== 'tiktok_creator') {
        updateData.username = userInfo.username;
      } else if (!account.username || account.username === 'tiktok_creator') {
        updateData.username = userInfo.username;
      }

      if (userInfo.avatarUrl) {
        updateData.profileImageUrl = userInfo.avatarUrl;
      }

      const updatedAccount = await prisma.socialAccount.update({
        where: { id: account.id },
        data: updateData,
        include: {
          token: {
            select: {
              expiresAt: true,
              scope: true,
            },
          },
        },
      });

      return NextResponse.json({
        success: true,
        account: updatedAccount,
        profileReturned: {
          displayName: userInfo.displayName,
          username: userInfo.username,
          hasAvatar: Boolean(userInfo.avatarUrl),
        },
      });
    }

    const updated = await prisma.socialAccount.update({
      where: { id: account.id },
      data: { status: 'CONNECTED', updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, account: updated });
  } catch (error: any) {
    console.error('[Account Refresh API Exception]:', error);
    return NextResponse.json({ error: error.message || 'Failed to refresh account' }, { status: 500 });
  }
}
