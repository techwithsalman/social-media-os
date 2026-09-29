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
      errorMessage: sanitizeMetaErrorMessage(data?.error?.message || 'Failed to post to Facebook Page'),
    };
  }

  return { ok: true, data };
}

export class FacebookAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'FACEBOOK';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'Facebook Pages API',
      platform: 'FACEBOOK',
      developerPortalUrl: 'https://developers.facebook.com/apps',
      requiredScopes: [
        'pages_manage_posts',
        'pages_read_engagement',
        'pages_show_list',
        'publish_video',
      ],
      requiredCredentials: ['META_APP_ID', 'META_APP_SECRET', 'META_LOGIN_CONFIG_ID', 'META_REDIRECT_URI'],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
        supportedVideoTypes: ['video/mp4', 'video/quicktime'],
        maxImageSizeMb: 10,
        maxVideoSizeMb: 500,
        maxVideoDurationSeconds: 1200,
        captionMaxLength: 63206,
      },
      notes: 'Requires Page Admin role on the Facebook Page and Meta App Review for production access.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const isMock = process.env.MOCK_API_MODE === 'true' || !process.env.META_APP_ID;

    if (isMock || authCode.startsWith('mock_')) {
      const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.FACEBOOK;

      return {
        platformAccountId: demo.platformAccountId,
        name: demo.name,
        username: demo.username,
        profileImageUrl: demo.profileImageUrl,
        accessToken: 'mock_fb_access_token_' + Math.random().toString(36).slice(2),
        refreshToken: 'mock_fb_refresh_token_' + Math.random().toString(36).slice(2),
        expiresIn: 5184000,
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
    if (!data.access_token) {
      throw new Error('Failed to exchange Facebook OAuth token.');
    }

    return {
      platformAccountId: `fb_page_${Date.now()}`,
      name: 'Facebook Page',
      username: 'fbpage',
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      isMock: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    if (refreshToken.startsWith('mock_')) {
      return { accessToken: 'mock_fb_refreshed_' + Date.now(), expiresIn: 5184000 };
    }

    throw new Error('Meta does not provide refresh tokens for this flow. Reconnect the Facebook Page.');
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
    return { mediaContainerId: `fb_media_${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    if (payload.isMock || payload.accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      const mockId = `fb_post_${Date.now()}`;
      return {
        success: true,
        externalPostId: mockId,
        externalPostUrl: `https://facebook.com/posts/${mockId.slice(-8)}`,
        isMockSimulation: true,
        publishedAt: new Date(),
      };
    }

    const logMetaError = async (stage: string, errorData: any) => {
      console.error(`\n[FB PUBLISH ERROR] FAILED STAGE: ${stage}`);
      console.error(`PAGE ID: ${payload.platformAccountId}`);

      // Diagnostic token check
      try {
        const debugRes = await fetch(buildMetaGraphUrl('/debug_token') + `?input_token=${payload.accessToken}&access_token=${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`).then(r => r.json());
        const tokenData = debugRes?.data || {};
        console.error(`TOKEN TYPE: ${tokenData.type || 'UNKNOWN'}`);
        console.error(`GRANTED SCOPES: ${(tokenData.scopes || []).join(', ')}`);
        console.error(`IS VALID: ${tokenData.is_valid}`);
        
        const missing = [];
        if (!tokenData.scopes?.includes('pages_manage_posts')) missing.push('pages_manage_posts');
        if (!tokenData.scopes?.includes('pages_read_engagement')) missing.push('pages_read_engagement');
        if (missing.length > 0) {
          console.error(`MISSING SCOPES: ${missing.join(', ')}`);
          console.error(`RECONNECT REQUIRED: YES`);
        }
      } catch (e) {
        console.error(`Failed to diagnose token scopes`);
      }

      if (errorData?.error) {
        const err = errorData.error;
        console.error(`Meta Error [${err.code}:${err.error_subcode || 'N/A'}]: ${err.message}`);
        console.error(`Type: ${err.type}`);
        if (err.error_user_title) console.error(`User Title: ${err.error_user_title}`);
        if (err.error_user_msg) console.error(`User Msg: ${err.error_user_msg}`);
        if (err.fbtrace_id) console.error(`FBTrace ID: ${err.fbtrace_id}`);
      } else {
        console.error('Unknown Meta error:', errorData);
      }
    };

    try {
      const mediaUrl = buildPublicMediaUrl(payload.mediaUrl);
      const caption = `${payload.caption} ${payload.hashtags || ''}`.trim();

      if (payload.mediaType === 'IMAGE' && mediaUrl) {
        const result = await postToMeta(`/${payload.platformAccountId}/photos`, {
          access_token: payload.accessToken,
          caption,
          url: mediaUrl,
          published: 'true',
        });

        if (!result.ok) {
          await logMetaError('PHOTO PUBLISH', result.data);
          return {
            success: false,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          };
        }

        return {
          success: true,
          externalPostId: result.data.post_id || result.data.id,
          externalPostUrl: `https://facebook.com/${result.data.post_id || result.data.id}`,
          publishedAt: new Date(),
        };
      }

      if (payload.mediaType === 'VIDEO' && mediaUrl) {
        console.log(`[FB PUBLISH] VIDEO REQUEST to /${payload.platformAccountId}/videos`);
        console.log(`description: ${caption}`);
        console.log(`file_url: ${mediaUrl}`);

        const result = await postToMeta(`/${payload.platformAccountId}/videos`, {
          access_token: payload.accessToken,
          description: caption,
          file_url: mediaUrl,
        });

        if (!result.ok) {
          await logMetaError('VIDEO PUBLISH', result.data);
          return {
            success: false,
            errorCode: result.errorCode,
            errorMessage: result.errorMessage,
          };
        }

        return {
          success: true,
          externalPostId: result.data.id,
          externalPostUrl: `https://facebook.com/${result.data.id}`,
          publishedAt: new Date(),
        };
      }

      const result = await postToMeta(`/${payload.platformAccountId}/feed`, {
        message: caption,
        access_token: payload.accessToken,
      });

      if (!result.ok || !result.data.id) {
        await logMetaError('FEED PUBLISH', result.data);
        return {
          success: false,
          errorCode: result.ok ? 'FB_PUBLISH_FAILED' : result.errorCode,
          errorMessage: result.ok ? 'Failed to post to Facebook Page' : result.errorMessage,
        };
      }

      return {
        success: true,
        externalPostId: result.data.id,
        externalPostUrl: `https://facebook.com/${result.data.id}`,
        publishedAt: new Date(),
      };
    } catch (error: any) {
      console.error(`[FB PUBLISH ERROR] UNEXPECTED:`, error);
      return {
        success: false,
        errorCode: 'FB_API_ERROR',
        errorMessage: sanitizeMetaErrorMessage(error?.message || 'Unexpected Facebook API error'),
      };
    }
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    return { status: 'PUBLISHED', views: 1200, likes: 85, comments: 12, shares: 7 };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
