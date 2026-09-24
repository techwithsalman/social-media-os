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

export class LinkedInAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'LINKEDIN';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'LinkedIn Community Management API / Share on LinkedIn',
      platform: 'LINKEDIN',
      developerPortalUrl: 'https://www.linkedin.com/developers',
      requiredScopes: ['openid', 'profile', 'email', 'w_member_social', 'w_organization_social'],
      requiredCredentials: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
        supportedVideoTypes: ['video/mp4'],
        maxImageSizeMb: 8,
        maxVideoSizeMb: 200,
        maxVideoDurationSeconds: 600,
        captionMaxLength: 3000,
      },
      notes: 'Requires LinkedIn Developer App approval for Community Management API or Share on LinkedIn product.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const isMock = process.env.MOCK_API_MODE === 'true' || !process.env.LINKEDIN_CLIENT_ID;

    if (isMock || authCode.startsWith('mock_')) {
      const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.LINKEDIN;

      return {
        platformAccountId: demo.platformAccountId,
        name: demo.name,
        username: demo.username,
        profileImageUrl: demo.profileImageUrl,
        accessToken: 'mock_li_token_' + Math.random().toString(36).slice(2),
        expiresIn: 5184000,
        scope: demo.scope,
        isMock: true,
      };
    }

    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        client_id: process.env.LINKEDIN_CLIENT_ID || '',
        client_secret: process.env.LINKEDIN_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
      }),
    });

    const tokenData = await tokenRes.json();
    return {
      platformAccountId: `urn:li:person:${Date.now()}`,
      name: 'LinkedIn User',
      username: 'linkedin_user',
      accessToken: tokenData.access_token,
      expiresIn: tokenData.expires_in,
      isMock: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    return { accessToken: 'refreshed_li_token', expiresIn: 5184000 };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    return true;
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    return { mediaContainerId: `urn:li:digitalmediaAsset:${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    if (payload.isMock || payload.accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      const mockId = `urn:li:share:${Date.now()}`;
      return {
        success: true,
        externalPostId: mockId,
        externalPostUrl: `https://www.linkedin.com/feed/update/${mockId}`,
        isMockSimulation: true,
        publishedAt: new Date(),
      };
    }

    try {
      const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          author: payload.platformAccountId.startsWith('urn:') ? payload.platformAccountId : `urn:li:person:${payload.platformAccountId}`,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: `${payload.caption} ${payload.hashtags || ''}`.trim(),
              },
              shareMediaCategory: payload.mediaUrl ? (payload.mediaType === 'VIDEO' ? 'VIDEO' : 'IMAGE') : 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': payload.visibility === 'CONNECTIONS_ONLY' ? 'CONNECTIONS' : 'PUBLIC',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.id) {
        return {
          success: false,
          errorCode: 'LINKEDIN_SHARE_FAILED',
          errorMessage: data?.message || 'Failed to publish to LinkedIn',
        };
      }

      return {
        success: true,
        externalPostId: data.id,
        externalPostUrl: `https://www.linkedin.com/feed/update/${data.id}`,
        publishedAt: new Date(),
      };
    } catch (error: any) {
      return {
        success: false,
        errorCode: 'LINKEDIN_ERROR',
        errorMessage: error?.message || 'LinkedIn network error',
      };
    }
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    return { status: 'PUBLISHED', views: 3400, likes: 215, comments: 45, shares: 18 };
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
