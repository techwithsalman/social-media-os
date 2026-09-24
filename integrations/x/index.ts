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

export class XAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'X';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'X (Twitter) Developer API v2 (Tweets & Media Endpoints)',
      platform: 'X',
      developerPortalUrl: 'https://developer.x.com/en/portal/dashboard',
      requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      requiredCredentials: ['X_CLIENT_ID', 'X_CLIENT_SECRET'],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        supportedVideoTypes: ['video/mp4', 'video/quicktime'],
        maxImageSizeMb: 5,
        maxVideoSizeMb: 512,
        maxVideoDurationSeconds: 140,
        captionMaxLength: 280,
      },
      notes: 'Requires OAuth 2.0 PKCE User Context with tweet.write scope. Standard free/basic tier limits apply.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const isMock = process.env.MOCK_API_MODE === 'true' || !process.env.X_CLIENT_ID;

    if (isMock || authCode.startsWith('mock_')) {
      const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.X;

      return {
        platformAccountId: demo.platformAccountId,
        name: demo.name,
        username: demo.username,
        profileImageUrl: demo.profileImageUrl,
        accessToken: 'mock_x_token_' + Math.random().toString(36).slice(2),
        refreshToken: 'mock_x_refresh_' + Math.random().toString(36).slice(2),
        expiresIn: 7200,
        scope: demo.scope,
        isMock: true,
      };
    }

    const credentials = Buffer.from(
      `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
    ).toString('base64');

    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: 'challenge',
      }),
    });

    const data = await res.json();
    return {
      platformAccountId: `x_${Date.now()}`,
      name: 'X Account',
      username: 'x_account',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      isMock: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    return { accessToken: 'refreshed_x_token', expiresIn: 7200 };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    return true;
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    return { mediaContainerId: `x_media_${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    if (payload.isMock || payload.accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      const mockId = `x_tweet_${Date.now()}`;
      return {
        success: true,
        externalPostId: mockId,
        externalPostUrl: `https://x.com/user/status/${mockId.slice(-10)}`,
        isMockSimulation: true,
        publishedAt: new Date(),
      };
    }

    try {
      const tweetText = `${payload.caption} ${payload.hashtags || ''}`.trim().slice(0, 280);

      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: tweetText,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.data?.id) {
        return {
          success: false,
          errorCode: 'X_TWEET_FAILED',
          errorMessage: data?.detail || data?.title || 'Failed to post Tweet on X',
        };
      }

      return {
        success: true,
        externalPostId: data.data.id,
        externalPostUrl: `https://x.com/i/status/${data.data.id}`,
        publishedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        errorCode: 'X_API_ERROR',
        errorMessage: error?.message || 'X API error',
      };
    }
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    return { status: 'PUBLISHED', views: 4200, likes: 310, comments: 28, shares: 72 };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
