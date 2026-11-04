import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { getOrRefreshValidTikTokToken, refreshTikTokTokenWithLock, TikTokOAuthError } from '@/lib/tiktok-oauth';

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

    let accessToken = '';
    try {
      accessToken = await getOrRefreshValidTikTokToken(account.id);
    } catch (tokenErr: any) {
      const isReauth = tokenErr instanceof TikTokOAuthError && tokenErr.code === 'REAUTHORIZATION_REQUIRED';
      return NextResponse.json(
        {
          error: tokenErr.message || 'No valid access token available for TikTok account. Please reconnect.',
          code: isReauth ? 'REAUTHORIZATION_REQUIRED' : 'TOKEN_ERROR',
        },
        { status: 401 }
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

    // If API returned 401 despite pre-check, force atomic refresh with concurrency lock and retry once
    if (isTokenExpired) {
      try {
        console.log(`[TikTok Creator Info] 401 received. Attempting concurrency-locked refresh for @${account.username}...`);
        accessToken = await refreshTikTokTokenWithLock(account.id);
        const retry = await callCreatorInfoApi(accessToken);
        res = retry.res;
        data = retry.data;
      } catch (refreshErr: any) {
        console.error('[TikTok Creator Info] Atomic token refresh failed:', refreshErr);
        const isReauth = refreshErr instanceof TikTokOAuthError && refreshErr.code === 'REAUTHORIZATION_REQUIRED';
        return NextResponse.json(
          {
            error: refreshErr.message || 'TikTok authorization has expired. Please reconnect your TikTok account.',
            code: isReauth ? 'REAUTHORIZATION_REQUIRED' : 'TOKEN_EXPIRED',
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
