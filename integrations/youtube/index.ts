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
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      throw new Error(tokenData.error_description || tokenData.error || 'Failed to refresh YouTube token');
    }
    return { accessToken: tokenData.access_token, refreshToken: tokenData.refresh_token, expiresIn: tokenData.expires_in };
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
        status: 'PUBLISHED',
      };
    }

    try {
      if (!payload.mediaUrl) {
         return {
           success: false,
           errorCode: 'YOUTUBE_NO_MEDIA',
           errorMessage: 'Media is required for YouTube upload',
         };
      }

      let uploadUrl = payload.metadata?.youtubeUploadUrl;
      let totalSize = payload.metadata?.youtubeUploadTotalSize;
      
      // Step 1: Initialize Resumable Upload Session if it doesn't exist
      if (!uploadUrl) {
        // Find total size by making a HEAD request to R2
        const headRes = await fetch(payload.mediaUrl, { method: 'HEAD' });
        totalSize = parseInt(headRes.headers.get('content-length') || '0', 10);
        
        if (totalSize === 0) {
           return { success: false, errorCode: 'MEDIA_ERROR', errorMessage: 'Could not determine media size.' };
        }

        const videoTitle = payload.metadata?.youtubeTitle || payload.caption.slice(0, 100) || 'Untitled Video';
        const description = payload.caption;
        const tags = payload.hashtags ? payload.hashtags.split(/\s+/).map((t) => t.replace('#', '')) : [];
        const privacyStatus = (payload.visibility || 'public').toLowerCase();

        const initRes = await fetch(
          'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${payload.accessToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Length': totalSize.toString(),
              'X-Upload-Content-Type': payload.mediaType || 'video/mp4',
            },
            body: JSON.stringify({
              snippet: {
                title: videoTitle,
                description: description,
                tags: tags,
                categoryId: payload.metadata?.categoryId || '22',
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

        uploadUrl = initRes.headers.get('Location');
        if (!uploadUrl) {
           return {
              success: false,
              errorCode: 'YOUTUBE_NO_LOCATION',
              errorMessage: 'Upload location missing from initialization response',
           };
        }
      }

      // Step 2: Upload a chunk
      // Check current status of upload to find out where to resume
      const statusRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes */${totalSize}`,
        }
      });
      
      let nextByte = 0;
      if (statusRes.status === 308) {
         const range = statusRes.headers.get('range'); // e.g. "bytes=0-42"
         if (range) {
           nextByte = parseInt(range.split('-')[1], 10) + 1;
         }
      } else if (!statusRes.ok) {
         // Resumable session might be dead or upload finished
         const err = await statusRes.json().catch(() => ({}));
         return {
            success: false,
            errorCode: 'YOUTUBE_SESSION_ERROR',
            errorMessage: err?.error?.message || 'Resumable upload session invalid',
         };
      } else {
         // It's already completed?
         const videoData = await statusRes.json();
         return {
            success: true,
            status: 'PROCESSING',
            externalPostId: videoData.id,
            externalPostUrl: `https://www.youtube.com/watch?v=${videoData.id}`,
            publishedAt: new Date(),
            updatedMetadata: { youtubeUploadUrl: null }
         };
      }

      // We upload in chunks of 5MB
      const chunkSize = 5 * 1024 * 1024;
      const endByte = Math.min(nextByte + chunkSize - 1, totalSize - 1);
      const contentRange = `bytes ${nextByte}-${endByte}/${totalSize}`;

      const chunkRes = await fetch(payload.mediaUrl, {
         headers: { Range: `bytes=${nextByte}-${endByte}` }
      });

      if (!chunkRes.ok) {
         return {
            success: false,
            errorCode: 'YOUTUBE_MEDIA_READ_ERROR',
            errorMessage: 'Failed to read media chunk from storage',
         };
      }

      const chunkBuffer = Buffer.from(await chunkRes.arrayBuffer());

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': payload.mediaType || 'video/mp4',
          'Content-Length': chunkBuffer.length.toString(),
          'Content-Range': contentRange,
        },
        body: chunkBuffer,
      });

      if (uploadRes.status === 308) {
         // Upload incomplete, we need to schedule next chunk
         return {
            success: true,
            status: 'UPLOADING',
            updatedMetadata: { youtubeUploadUrl: uploadUrl, youtubeUploadTotalSize: totalSize }
         };
      } else if (uploadRes.ok) {
         // Upload complete
         const videoData = await uploadRes.json();
         return {
           success: true,
           status: 'PROCESSING',
           externalPostId: videoData.id,
           externalPostUrl: `https://www.youtube.com/watch?v=${videoData.id}`,
           publishedAt: new Date(),
           updatedMetadata: { youtubeUploadUrl: null }
         };
      } else {
         const uploadErr = await uploadRes.json().catch(() => ({}));
         return {
           success: false,
           errorCode: 'YOUTUBE_UPLOAD_FAILED',
           errorMessage: uploadErr?.error?.message || 'Failed to upload video chunk to YouTube',
         };
      }
    } catch (error: any) {
      return {
        success: false,
        errorCode: 'YOUTUBE_ERROR',
        errorMessage: error?.message || 'YouTube upload error',
      };
    }
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    try {
        const res = await fetch(`https://youtube.googleapis.com/youtube/v3/videos?part=status,statistics&id=${platformPostId}`, {
            headers: {
               Authorization: `Bearer ${accessToken}`,
            }
        });
        const data = await res.json();
        
        if (!res.ok || !data.items || data.items.length === 0) {
            return { status: 'FAILED' };
        }
        
        const video = data.items[0];
        const status = video.status.uploadStatus;
        
        if (status === 'processed') {
           return {
              status: 'PUBLISHED',
              views: parseInt(video.statistics?.viewCount || '0'),
              likes: parseInt(video.statistics?.likeCount || '0'),
              comments: parseInt(video.statistics?.commentCount || '0'),
           };
        } else if (status === 'rejected' || status === 'failed') {
           return { status: 'FAILED' };
        }
        
        return { status: 'PROCESSING' };
    } catch (e) {
        return { status: 'PROCESSING' };
    }
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
