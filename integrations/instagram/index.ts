import {
  ISocialPlatformAdapter,
  SocialPlatformType,
  AccountAuthResult,
  TokenRefreshResult,
  PlatformMediaUploadResult,
  PublishPayload,
  PublishResult,
  PlatformPostStatusResult,
  PlatformRequirementInfo,
} from '../types';
import { DEMO_SOCIAL_ACCOUNT_BY_PLATFORM } from '../../lib/platforms';
import {
  buildMetaGraphUrl,
  buildPublicMediaUrl,
  sanitizeMetaErrorMessage,
} from '../../lib/meta-token-service';

async function postToMeta(path: string, params: Record<string, string>) {
  const res = await fetch(buildMetaGraphUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      data,
      errorCode: data?.error?.code ? `META_${data.error.code}` : 'META_API_ERROR',
      errorMessage: sanitizeMetaErrorMessage(data?.error?.message || 'Instagram API request failed'),
    };
  }

  return { ok: true, data };
}

async function getFromMeta(path: string, params: Record<string, string>) {
  const url = new URL(buildMetaGraphUrl(path));
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    return {
      ok: false,
      data,
      errorCode: data?.error?.code ? `META_${data.error.code}` : 'META_API_ERROR',
      errorMessage: sanitizeMetaErrorMessage(data?.error?.message || 'Instagram API request failed'),
    };
  }

  return { ok: true, data };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class InstagramAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'INSTAGRAM';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'Instagram Graph API / Content Publishing API',
      platform: 'INSTAGRAM',
      developerPortalUrl: 'https://developers.facebook.com/apps',
      requiredScopes: [
        'instagram_basic',
        'instagram_content_publish',
        'pages_show_list',
        'pages_read_engagement',
        'business_management',
      ],
      requiredCredentials: ['META_APP_ID', 'META_APP_SECRET', 'META_LOGIN_CONFIG_ID', 'META_REDIRECT_URI'],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png'],
        supportedVideoTypes: ['video/mp4', 'video/quicktime'],
        maxImageSizeMb: 8,
        maxVideoSizeMb: 100,
        maxVideoDurationSeconds: 60,
        captionMaxLength: 2200,
      },
      notes:
        'Requires an Instagram Business or Creator account connected to a Facebook Page, and App Review approval for live production posting.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const isMock = process.env.MOCK_API_MODE === 'true' || !process.env.META_APP_ID;

    if (isMock || authCode.startsWith('mock_')) {
      const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.INSTAGRAM;

      return {
        platformAccountId: demo.platformAccountId,
        name: demo.name,
        username: demo.username,
        profileImageUrl: demo.profileImageUrl,
        accessToken: 'mock_ig_access_token_' + Math.random().toString(36).slice(2),
        refreshToken: 'mock_ig_refresh_token_' + Math.random().toString(36).slice(2),
        expiresIn: 5184000, // 60 days
        scope: demo.scope,
        isMock: true,
      };
    }

    // Legacy server-side exchange path. New connections use /api/oauth/meta/connect.
    const tokenResult = await postToMeta('/oauth/access_token', {
      client_id: process.env.META_APP_ID || '',
      redirect_uri: redirectUri,
      client_secret: process.env.META_APP_SECRET || '',
      code: authCode,
    });

    if (!tokenResult.ok) {
      throw new Error(tokenResult.errorMessage);
    }

    const data = tokenResult.data as { access_token?: string; expires_in?: number };
    const shortLivedToken = data.access_token;
    if (!shortLivedToken) {
      throw new Error('Failed to exchange Instagram OAuth token.');
    }

    // Exchange for long-lived token (60 days)
    const longLivedResult = await postToMeta('/oauth/access_token', {
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID || '',
      client_secret: process.env.META_APP_SECRET || '',
      fb_exchange_token: shortLivedToken,
    });
    const longLivedData = (longLivedResult.ok ? longLivedResult.data : {}) as {
      access_token?: string;
      expires_in?: number;
    };
    const accessToken = longLivedData.access_token || shortLivedToken;

    // Fetch user account details
    const pagesResult = await getFromMeta('/me/accounts', {
      fields: 'name,instagram_business_account',
      access_token: accessToken,
    });
    const pagesData = (pagesResult.ok ? pagesResult.data : {}) as {
      data?: Array<{ id: string; name?: string; instagram_business_account?: { id: string; username?: string } }>;
    };
    const page = pagesData.data?.[0];
    const instagramAccount = page?.instagram_business_account;

    return {
      platformAccountId: instagramAccount?.id || page?.id || 'ig_unknown',
      name: instagramAccount?.username || page?.name || 'Instagram User',
      username: instagramAccount?.username || page?.name?.toLowerCase().replace(/\s+/g, '') || 'instagram_user',
      accessToken,
      expiresIn: longLivedData.expires_in,
      isMock: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    if (refreshToken.startsWith('mock_')) {
      return {
        accessToken: 'mock_ig_refreshed_' + Date.now(),
        expiresIn: 5184000,
      };
    }

    throw new Error('Meta does not provide refresh tokens for this flow. Reconnect the Instagram account.');
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith('mock_')) return true;
    try {
      const res = await fetch(`${buildMetaGraphUrl('/me')}?access_token=${encodeURIComponent(accessToken)}`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    if (accessToken.startsWith('mock_')) {
      return { mediaContainerId: `ig_container_${Date.now()}` };
    }
    return { mediaContainerId: `ig_container_${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    if (payload.isMock || payload.accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      const mockPostId = `ig_post_${Date.now()}`;
      return {
        success: true,
        externalPostId: mockPostId,
        externalPostUrl: `https://instagram.com/p/${mockPostId.slice(-8)}`,
        isMockSimulation: true,
        publishedAt: new Date(),
      };
    }

    try {
      const isVideo = payload.mediaType === 'VIDEO' || payload.contentType === 'REEL';
      const mediaUrl = buildPublicMediaUrl(payload.mediaUrl);

      if (!mediaUrl) {
        return {
          success: false,
          errorCode: 'IG_MEDIA_REQUIRED',
          errorMessage: 'Instagram publishing requires an image or video URL.',
        };
      }

      const params: Record<string, string> = {
        access_token: payload.accessToken,
        caption: `${payload.caption} ${payload.hashtags || ''}`.trim(),
      };

      if (isVideo) {
        params.media_type = payload.contentType === 'REEL' ? 'REELS' : 'VIDEO';
        params.video_url = mediaUrl;
      } else {
        params.image_url = mediaUrl;
      }

      const container = await postToMeta(`/${payload.platformAccountId}/media`, params);

      if (!container.ok || !container.data.id) {
        return {
          success: false,
          errorCode: container.ok ? 'IG_CONTAINER_FAILED' : container.errorCode,
          errorMessage: container.ok ? 'Failed to create Instagram media container' : container.errorMessage,
        };
      }

      if (isVideo) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const status = await getFromMeta(`/${container.data.id}`, {
            fields: 'status_code',
            access_token: payload.accessToken,
          });

          if (!status.ok) {
            return {
              success: false,
              errorCode: status.errorCode,
              errorMessage: status.errorMessage,
            };
          }

          if (status.data.status_code === 'FINISHED' || status.data.status_code === 'PUBLISHED') {
            break;
          }

          if (status.data.status_code === 'ERROR' || status.data.status_code === 'EXPIRED') {
            return {
              success: false,
              errorCode: 'IG_CONTAINER_NOT_READY',
              errorMessage: `Instagram media container status is ${status.data.status_code}.`,
            };
          }

          await delay(2000);
        }
      }

      const publish = await postToMeta(`/${payload.platformAccountId}/media_publish`, {
          creation_id: container.data.id,
          access_token: payload.accessToken,
      });

      if (!publish.ok || !publish.data.id) {
        return {
          success: false,
          errorCode: publish.ok ? 'IG_PUBLISH_FAILED' : publish.errorCode,
          errorMessage: publish.ok ? 'Failed to publish Instagram media container' : publish.errorMessage,
        };
      }

      return {
        success: true,
        externalPostId: publish.data.id,
        externalPostUrl: `https://instagram.com/p/${publish.data.id}`,
        publishedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        errorCode: 'IG_API_ERROR',
        errorMessage: sanitizeMetaErrorMessage(error?.message || 'Unexpected error publishing to Instagram'),
      };
    }
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    if (accessToken.startsWith('mock_')) {
      return {
        status: 'PUBLISHED',
        views: Math.floor(Math.random() * 5000) + 200,
        likes: Math.floor(Math.random() * 450) + 30,
        comments: Math.floor(Math.random() * 40) + 2,
      };
    }
    return { status: 'PUBLISHED' };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
