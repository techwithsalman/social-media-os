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

export class PinterestAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'PINTEREST';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'Pinterest Content Publishing API',
      platform: 'PINTEREST',
      developerPortalUrl: 'https://developers.pinterest.com',
      requiredScopes: ['pins:read', 'pins:write', 'boards:read'],
      requiredCredentials: ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET'],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp'],
        supportedVideoTypes: ['video/mp4', 'video/quicktime'],
        maxImageSizeMb: 20,
        maxVideoSizeMb: 200,
        maxVideoDurationSeconds: 900,
        captionMaxLength: 500,
      },
      notes:
        'Currently wired for MOCK_API_MODE only. Real Pinterest OAuth and publishing can be added later.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.PINTEREST;

    return {
      platformAccountId: demo.platformAccountId,
      name: demo.name,
      username: demo.username,
      profileImageUrl: demo.profileImageUrl,
      accessToken: 'mock_pinterest_token_' + Math.random().toString(36).slice(2),
      refreshToken: 'mock_pinterest_refresh_' + Math.random().toString(36).slice(2),
      expiresIn: 5184000,
      scope: demo.scope,
      isMock: true,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    return { accessToken: 'mock_pinterest_refreshed_' + Date.now(), expiresIn: 5184000 };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    return true;
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    return { mediaContainerId: `pin_media_${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    const mockPinId = `pin_${Date.now()}`;

    return {
      success: true,
      externalPostId: mockPinId,
      externalPostUrl: `https://www.pinterest.com/pin/${mockPinId.slice(-12)}`,
      isMockSimulation: true,
      publishedAt: new Date(),
    };
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    return { status: 'PUBLISHED', views: 3200, likes: 280, comments: 18, shares: 96 };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
