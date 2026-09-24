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

export class SnapchatAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'SNAPCHAT';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'Snapchat Marketing API',
      platform: 'SNAPCHAT',
      developerPortalUrl: 'https://developers.snap.com',
      requiredScopes: ['snapchat-marketing-api'],
      requiredCredentials: ['SNAPCHAT_CLIENT_ID', 'SNAPCHAT_CLIENT_SECRET'],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png'],
        supportedVideoTypes: ['video/mp4', 'video/quicktime'],
        maxImageSizeMb: 10,
        maxVideoSizeMb: 100,
        maxVideoDurationSeconds: 180,
        captionMaxLength: 250,
      },
      notes:
        'Currently wired for MOCK_API_MODE only. Real Snapchat OAuth and publishing can be added later.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.SNAPCHAT;

    return {
      platformAccountId: demo.platformAccountId,
      name: demo.name,
      username: demo.username,
      profileImageUrl: demo.profileImageUrl,
      accessToken: 'mock_snapchat_token_' + Math.random().toString(36).slice(2),
      refreshToken: 'mock_snapchat_refresh_' + Math.random().toString(36).slice(2),
      expiresIn: 5184000,
      scope: demo.scope,
      isMock: true,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    return { accessToken: 'mock_snapchat_refreshed_' + Date.now(), expiresIn: 5184000 };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    return true;
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    return { mediaContainerId: `sc_media_${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    const mockStoryId = `sc_story_${Date.now()}`;

    return {
      success: true,
      externalPostId: mockStoryId,
      externalPostUrl: `https://www.snapchat.com/add/brandstudio/${mockStoryId.slice(-10)}`,
      isMockSimulation: true,
      publishedAt: new Date(),
    };
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    return { status: 'PUBLISHED', views: 2800, likes: 210, comments: 12, shares: 44 };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
