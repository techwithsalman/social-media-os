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

export class FacebookProfileManualAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'FACEBOOK_PROFILE';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'Facebook Personal Profile (Manual Publishing)',
      platform: 'FACEBOOK_PROFILE',
      developerPortalUrl: 'https://www.facebook.com',
      requiredScopes: [],
      requiredCredentials: [],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        supportedVideoTypes: ['video/mp4', 'video/quicktime'],
        maxImageSizeMb: 50,
        maxVideoSizeMb: 1000,
        maxVideoDurationSeconds: 7200,
        captionMaxLength: 63206,
      },
      notes:
        'Manual Publishing Workflow: Meta Graph API does not support automated posting to personal Facebook profiles. Social Media OS prepares media assets, copyable formatted captions, and profile link shortcuts for manual sharing and scheduled reminders.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    throw new Error('OAuth is not supported for Personal Profiles. Use manual account setup.');
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    return { accessToken: '', expiresIn: 0 };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    return true;
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    return { platformMediaUrl: mediaUrl };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    // Crucial requirement: NEVER return status 'PUBLISHED' automatically.
    // Return status 'MANUAL_READY' to clearly distinguish content preparation from completed Facebook publishing.
    const profileUrl = payload.platformAccountId?.startsWith('http')
      ? payload.platformAccountId
      : `https://www.facebook.com/${payload.platformAccountId || ''}`;

    return {
      success: true,
      status: 'MANUAL_READY',
      statusMessage:
        'Content and media prepared for manual posting to your personal Facebook profile. Awaiting your confirmation after posting on Facebook.',
      externalPostUrl: profileUrl,
      isMockSimulation: false,
    };
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    return { status: 'UNKNOWN' };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
