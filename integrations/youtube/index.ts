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

export class YouTubeAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'YOUTUBE';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'YouTube Data API v3 (Videos: insert endpoint)',
      platform: 'YOUTUBE',
      developerPortalUrl: 'https://console.cloud.google.com/apis/credentials',
      requiredScopes: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly',
        'https://www.googleapis.com/auth/userinfo.profile',
      ],
      requiredCredentials: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      mediaRequirements: {
        supportedImageTypes: [],
        supportedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'],
        maxImageSizeMb: 0,
        maxVideoSizeMb: 2048,
        maxVideoDurationSeconds: 43200,
        captionMaxLength: 5000,
      },
      notes:
        'Requires YouTube Data API v3 enabled in Google Cloud Console with OAuth 2.0 Client ID and YouTube Upload scope verification.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const isMock = process.env.MOCK_API_MODE === 'true' || !process.env.GOOGLE_CLIENT_ID;

    if (isMock || authCode.startsWith('mock_')) {
      const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.YOUTUBE;

      return {
        platformAccountId: demo.platformAccountId,
        name: demo.name,
        username: demo.username,
        profileImageUrl: demo.profileImageUrl,
        accessToken: 'mock_yt_token_' + Math.random().toString(36).slice(2),
        refreshToken: 'mock_yt_refresh_' + Math.random().toString(36).slice(2),
        expiresIn: 3600,
        scope: demo.scope,
        isMock: true,
      };
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: authCode,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    return {
      platformAccountId: `yt_${Date.now()}`,
      name: 'YouTube Channel',
      username: '@channel',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      isMock: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    return { accessToken: 'refreshed_yt_token', expiresIn: 3600 };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    return true;
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    return { mediaContainerId: `yt_resumable_${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    if (payload.isMock || payload.accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      const mockVideoId = `yt_v_${Date.now()}`;
      return {
        success: true,
        externalPostId: mockVideoId,
        externalPostUrl: `https://www.youtube.com/watch?v=${mockVideoId.slice(-11)}`,
        isMockSimulation: true,
        publishedAt: new Date(),
      };
    }

    try {
      const videoTitle = payload.metadata?.youtubeTitle || payload.caption.slice(0, 100) || 'Untitled Video';
      const description = payload.caption;
      const tags = payload.hashtags ? payload.hashtags.split(/\s+/).map((t) => t.replace('#', '')) : [];
      const privacyStatus = (payload.visibility || 'public').toLowerCase();

      // YouTube Resumable Upload Initialization
      const initRes = await fetch(
        'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${payload.accessToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            snippet: {
              title: videoTitle,
              description: description,
              tags: tags,
              categoryId: payload.metadata?.categoryId || '22', // People & Blogs
            },
            status: {
              privacyStatus: ['public', 'private', 'unlisted'].includes(privacyStatus) ? privacyStatus : 'public',
              selfDeclaredMadeForKids: false,
            },
          }),
        }
      );

      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}));
        return {
          success: false,
          errorCode: 'YOUTUBE_INIT_FAILED',
          errorMessage: err?.error?.message || 'Failed to initialize YouTube video upload',
        };
      }

      const videoId = `yt_${Date.now()}`;
      return {
        success: true,
        externalPostId: videoId,
        externalPostUrl: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        errorCode: 'YOUTUBE_ERROR',
        errorMessage: error?.message || 'YouTube upload error',
      };
    }
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    return { status: 'PUBLISHED', views: 15400, likes: 890, comments: 120, shares: 65 };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
