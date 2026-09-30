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
import crypto from 'crypto';

export class XAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'X';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'X (Twitter) Developer API v2 (Tweets & Media Endpoints)',
      platform: 'X',
      developerPortalUrl: 'https://developer.x.com/en/portal/dashboard',
      requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],
      requiredCredentials: ['X_CLIENT_ID', 'X_CLIENT_SECRET', 'X_API_KEY', 'X_API_SECRET'],
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

  // We added codeVerifier and tokenData to params to handle it through lib/x-oauth
  async connectAccount(authCode: string, redirectUri: string, codeVerifier?: string, tokenData?: any): Promise<AccountAuthResult> {
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

    // Token should ideally be provided by caller who exchanged it, but just in case:
    let accessToken = tokenData?.accessToken;
    let refreshToken = tokenData?.refreshToken;
    let expiresIn = tokenData?.expiresIn;

    if (!accessToken) {
       // fallback exchange if tokenData not provided
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
           code_verifier: codeVerifier || 'challenge',
         }),
       });
   
       const data = await res.json();
       if (!res.ok) {
           throw new Error(`Failed to get X token: ${data.error_description || data.error}`);
       }
       accessToken = data.access_token;
       refreshToken = data.refresh_token;
       expiresIn = data.expires_in;
    }

    // Get User info
    const userRes = await fetch('https://api.twitter.com/2/users/me?user.fields=profile_image_url', {
        headers: {
            Authorization: `Bearer ${accessToken}`
        }
    });

    const userData = await userRes.json();
    if (!userRes.ok || !userData.data) {
        throw new Error('Failed to fetch X user profile');
    }

    return {
      platformAccountId: userData.data.id,
      name: userData.data.name,
      username: userData.data.username,
      profileImageUrl: userData.data.profile_image_url,
      accessToken: accessToken,
      refreshToken: refreshToken,
      expiresIn: expiresIn,
      isMock: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
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
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error('Failed to refresh X token');
    }

    return { accessToken: data.access_token, expiresIn: data.expires_in, refreshToken: data.refresh_token };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    try {
        const res = await fetch('https://api.twitter.com/2/users/me', {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        return res.ok;
    } catch {
        return false;
    }
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    // X v2 API requires media upload via v1.1.
    // However, v1.1 requires User Context (OAuth 1.0a) if using user-auth, or OAuth 2.0 PKCE.
    // Twitter v1.1 media/upload endpoint SUPPORTS OAuth 2.0 User Context tokens!
    
    // Fetch media from URL
    const mediaRes = await fetch(mediaUrl);
    if (!mediaRes.ok) throw new Error('Failed to fetch media for X upload');
    const mediaBuffer = await mediaRes.arrayBuffer();

    // Init upload
    const initRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            command: 'INIT',
            total_bytes: mediaBuffer.byteLength.toString(),
            media_type: mediaType
        })
    });
    
    const initData = await initRes.json();
    if (!initRes.ok) throw new Error(initData.error || 'Failed to INIT media upload to X');
    const mediaId = initData.media_id_string;

    // Append upload (using FormData for multipart/form-data)
    const formData = new FormData();
    formData.append('command', 'APPEND');
    formData.append('media_id', mediaId);
    formData.append('segment_index', '0');
    formData.append('media', new Blob([mediaBuffer], { type: mediaType }));

    const appendRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`
        },
        body: formData
    });

    if (!appendRes.ok) {
        const appendData = await appendRes.text();
        throw new Error(`Failed to APPEND media to X: ${appendData}`);
    }

    // Finalize upload
    const finalizeRes = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            command: 'FINALIZE',
            media_id: mediaId
        })
    });

    const finalizeData = await finalizeRes.json();
    if (!finalizeRes.ok) throw new Error(finalizeData.error || 'Failed to FINALIZE media upload to X');

    return { mediaContainerId: mediaId };
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
      
      const body: any = { text: tweetText };

      // Add media if uploaded
      if (payload.mediaUrl) {
          const mediaType = payload.mediaType === 'VIDEO' ? 'video/mp4' : 'image/jpeg';
          const uploadRes = await this.uploadMedia(payload.mediaUrl, mediaType, payload.accessToken);
          if (uploadRes.mediaContainerId) {
              body.media = {
                  media_ids: [uploadRes.mediaContainerId]
              };
          }
      }

      const res = await fetch('https://api.twitter.com/2/tweets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
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
    try {
        const res = await fetch(`https://api.twitter.com/2/tweets?ids=${platformPostId}&tweet.fields=public_metrics`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const data = await res.json();
        if (res.ok && data.data && data.data.length > 0) {
            const metrics = data.data[0].public_metrics;
            return { 
                status: 'PUBLISHED', 
                views: metrics.impression_count || 0, 
                likes: metrics.like_count || 0, 
                comments: metrics.reply_count || 0, 
                shares: metrics.retweet_count || 0 
            };
        }
        return { status: 'PUBLISHED' };
    } catch {
        return { status: 'PUBLISHED' };
    }
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
