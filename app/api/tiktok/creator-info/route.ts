import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { refreshTikTokToken } from '@/lib/tiktok-oauth';

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.workspaceId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    // Verify workspace ownership of the TikTok account
    const account = await prisma.socialAccount.findFirst({
      where: {
        id: accountId,
        workspaceId: session.workspaceId,
        platform: 'TIKTOK',
      },
      include: {
        token: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { error: 'TikTok account not found in this workspace' },
        { status: 404 }
      );
    }

    // Support mock mode if enabled or account is marked as mock
    if (account.isMock || process.env.MOCK_API_MODE === 'true') {
      return NextResponse.json({
        creatorUsername: account.username || 'mock_tiktok_creator',
        creatorNickname: account.name || 'Mock Creator',
        creatorAvatarUrl: account.profileImageUrl || null,
        privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        maxVideoPostDurationSec: 600,
      });
    }

    const rawAccessToken = account.token?.accessToken || '';
    const rawRefreshToken = account.token?.refreshToken || '';
    let accessToken = decryptToken(rawAccessToken);
    const refreshToken = decryptToken(rawRefreshToken);

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token available for this TikTok account. Please reconnect in Social Accounts.' },
        { status: 400 }
      );
    }

    const callCreatorInfoApi = async (token: string) => {
      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      return { res, data };
    };

    let { res, data } = await callCreatorInfoApi(accessToken);

    const isTokenExpired =
      res.status === 401 ||
      data.error?.code === 'access_token_invalid' ||
      data.error?.code === 'token_expired';

    // If expired and we have a refresh token, auto-refresh and retry once
    if (isTokenExpired && refreshToken) {
      try {
        console.log(`[TikTok Creator Info] Refreshing token for @${account.username}...`);
        const refreshRes = await refreshTikTokToken(refreshToken);
        if (refreshRes && refreshRes.accessToken) {
          accessToken = refreshRes.accessToken;
          const newEncryptedAccess = encryptToken(refreshRes.accessToken);
          const newEncryptedRefresh = refreshRes.refreshToken
            ? encryptToken(refreshRes.refreshToken)
            : rawRefreshToken;
          const newExpiresAt = new Date(Date.now() + (refreshRes.expiresIn || 86400) * 1000);

          if (account.token?.id) {
            await prisma.oAuthToken.update({
              where: { id: account.token.id },
              data: {
                accessToken: newEncryptedAccess,
                refreshToken: newEncryptedRefresh,
                expiresAt: newExpiresAt,
              },
            });
          }

          const retry = await callCreatorInfoApi(accessToken);
          res = retry.res;
          data = retry.data;
        }
      } catch (refreshErr: any) {
        console.error('[TikTok Creator Info] Token refresh failed:', refreshErr);
        return NextResponse.json(
          {
            error: 'TikTok authorization has expired and could not be refreshed. Please reconnect your TikTok account.',
            code: 'TOKEN_EXPIRED',
          },
          { status: 401 }
        );
      }
    }

    if (!res.ok || data.error?.code !== 'ok') {
      const errCode = data.error?.code || 'TIKTOK_CREATOR_INFO_FAILED';
      const errMsg = data.error?.message || 'Failed to query TikTok creator information';
      const logId = data.error?.log_id;
      console.warn(`[TikTok Creator Info Query Error] Code: ${errCode}, Log ID: ${logId}, Message: ${errMsg}`);
      return NextResponse.json(
        {
          error: errMsg,
          code: errCode,
          logId,
        },
        { status: res.status >= 400 && res.status < 500 ? res.status : 502 }
      );
    }

    const info = data.data || {};
    const privacyLevelOptions: string[] = Array.isArray(info.privacy_level_options)
      ? info.privacy_level_options
      : [];

    return NextResponse.json({
      creatorUsername: info.creator_username || account.username,
      creatorNickname: info.creator_nickname || account.name,
      creatorAvatarUrl: info.creator_avatar_url || account.profileImageUrl,
      privacyLevelOptions,
      commentDisabled: Boolean(info.comment_disabled),
      duetDisabled: Boolean(info.duet_disabled),
      stitchDisabled: Boolean(info.stitch_disabled),
      maxVideoPostDurationSec: typeof info.max_video_post_duration_sec === 'number'
        ? info.max_video_post_duration_sec
        : 600,
    });
  } catch (error: any) {
    console.error('[TikTok Creator Info API Exception]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error fetching TikTok creator info' },
      { status: 500 }
    );
  }
}
