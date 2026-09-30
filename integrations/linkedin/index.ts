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

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string, platformAccountId?: string): Promise<PlatformMediaUploadResult> {
    const isMock = accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true';
    if (isMock) {
      return { mediaContainerId: `urn:li:image:${Date.now()}` };
    }

    try {
      // 1. Fetch media
      const mediaRes = await fetch(mediaUrl);
      if (!mediaRes.ok) {
        throw new Error('Failed to fetch media from URL');
      }
      const mediaBuffer = await mediaRes.arrayBuffer();

      let authorUrn = '';
      if (platformAccountId) {
        authorUrn = platformAccountId.startsWith('urn:') ? platformAccountId : `urn:li:person:${platformAccountId}`;
      } else {
        const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        const profile = await profileRes.json();
        authorUrn = `urn:li:person:${profile.sub}`;
      }

      if (mediaType === 'VIDEO') {
        const initRes = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Linkedin-Version': '202401',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            initializeUploadRequest: {
              owner: authorUrn,
              fileSizeBytes: mediaBuffer.byteLength,
              uploadCaptions: false,
              uploadThumbnail: false
            }
          })
        });
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error(initData.message || 'Failed to initialize video upload');

        const uploadUrl = initData.value.uploadInstructions[0].uploadUrl;
        const videoUrn = initData.value.video;

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: mediaBuffer
        });

        if (!uploadRes.ok) throw new Error('Failed to upload video bytes');
        return { mediaContainerId: videoUrn };
      } else {
        const initRes = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Linkedin-Version': '202401',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            initializeUploadRequest: { owner: authorUrn }
          })
        });
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error(initData.message || 'Failed to initialize image upload');

        const uploadUrl = initData.value.uploadUrl;
        const imageUrn = initData.value.image;

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: mediaBuffer
        });

        if (!uploadRes.ok) throw new Error('Failed to upload image bytes');
        return { mediaContainerId: imageUrn };
      }

    } catch (error: any) {
      console.error('[LinkedIn Upload Error]', error);
      throw new Error(error.message || 'LinkedIn media upload failed');
    }
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
      const authorUrn = payload.platformAccountId.startsWith('urn:') ? payload.platformAccountId : `urn:li:person:${payload.platformAccountId}`;

      let mediaContainerId = undefined;
      if (payload.mediaUrl) {
         const mediaUploadResult = await this.uploadMedia(payload.mediaUrl, payload.mediaType || 'IMAGE', payload.accessToken, authorUrn);
         mediaContainerId = mediaUploadResult.mediaContainerId;
      }

      const postBody: any = {
        author: authorUrn,
        commentary: `${payload.caption} ${payload.hashtags || ''}`.trim(),
        visibility: payload.visibility === 'CONNECTIONS_ONLY' ? 'CONNECTIONS' : 'PUBLIC',
        distribution: {
          feedDistribution: "MAIN_FEED",
          targetEntities: [],
          thirdPartyDistributionChannels: []
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false
      };

      if (mediaContainerId) {
        postBody.content = {
           media: {
              id: mediaContainerId
           }
        };
      }

      const res = await fetch('https://api.linkedin.com/rest/posts', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Linkedin-Version': '202401',
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(postBody),
      });

      let data: any = {};
      const resText = await res.text();
      if (resText) {
         try {
            data = JSON.parse(resText);
         } catch(e) {}
      }

      const locationHeader = res.headers.get('x-restli-id') || res.headers.get('x-linkedin-id');
      const postId = locationHeader || data?.id;

      if (!res.ok || !postId) {
        return {
          success: false,
          errorCode: 'LINKEDIN_SHARE_FAILED',
          errorMessage: data?.message || data?.errorDetailType || 'Failed to publish to LinkedIn',
        };
      }

      return {
        success: true,
        externalPostId: postId,
        externalPostUrl: `https://www.linkedin.com/feed/update/${postId}`,
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
