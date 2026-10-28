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

function getYouTubeMimeType(payload: any) {
  if (payload.metadata?.mediaMimeType && payload.metadata.mediaMimeType !== 'VIDEO' && payload.metadata.mediaMimeType !== 'IMAGE') {
    return payload.metadata.mediaMimeType;
  }
  
  const filename = (payload.metadata?.mediaFilename || payload.mediaUrl || '').toLowerCase();
  if (filename.includes('.mp4')) return 'video/mp4';
  if (filename.includes('.webm')) return 'video/webm';
  if (filename.includes('.mov')) return 'video/quicktime';
  if (filename.includes('.m4v')) return 'video/x-m4v';
  
  return 'video/mp4';
}

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

      // Idempotency: Check if video was already uploaded or has externalPostId
      const existingVideoId = payload.metadata?.youtubeVideoId || payload.metadata?.externalPostId;
      if (existingVideoId) {
        try {
          console.log(`[YOUTUBE] Idempotency: Checking existing video ID: ${existingVideoId}...`);
          const statusRes = await this.getPostStatus(existingVideoId, payload.accessToken);
          if (statusRes.status === 'PUBLISHED' || statusRes.status === 'PROCESSING') {
            return {
              success: true,
              status: statusRes.status,
              externalPostId: existingVideoId,
              externalPostUrl: `https://www.youtube.com/watch?v=${existingVideoId}`,
              publishedAt: new Date(),
            };
          }
        } catch (err) {
          console.warn(`[YOUTUBE] Error verifying existing video ${existingVideoId}:`, err);
        }
      }

      const resolvedMimeType = getYouTubeMimeType(payload);

      let uploadUrl = payload.metadata?.youtubeUploadUrl;
      let totalSize = payload.metadata?.youtubeUploadTotalSize || payload.metadata?.mediaSize || 0;

      // Find exact total size robustly: DB metadata -> HEAD -> error
      if (!totalSize) {
        try {
          const headRes = await fetch(payload.mediaUrl, { method: 'HEAD' });
          totalSize = parseInt(headRes.headers.get('content-length') || '0', 10);
        } catch (err) {
          console.error('[YOUTUBE] HEAD request failed:', err);
        }
      }

      console.log(`[YOUTUBE] Uploading video: mime=${resolvedMimeType}, size=${totalSize} bytes`);

      if (!totalSize || isNaN(totalSize) || totalSize === 0) {
        return {
          success: false,
          errorCode: 'MEDIA_ERROR',
          errorMessage: 'Could not determine media size for YouTube upload.',
        };
      }

      let nextByte = 0;

      // Step 1: Initialize or check existing Resumable Upload Session
      if (uploadUrl) {
        try {
          // Check current status of upload to find out where to resume
          const statusRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
              'Content-Range': `bytes */${totalSize}`,
            },
          });

          if (statusRes.status === 308) {
            const range = statusRes.headers.get('range');
            if (range) {
              nextByte = parseInt(range.split('-')[1], 10) + 1;
            }
          } else if (statusRes.ok) {
            const videoData = await statusRes.json();
            return {
              success: true,
              status: 'PROCESSING',
              externalPostId: videoData.id,
              externalPostUrl: `https://www.youtube.com/watch?v=${videoData.id}`,
              publishedAt: new Date(),
              updatedMetadata: { youtubeUploadUrl: null, youtubeVideoId: videoData.id },
            };
          } else {
            // Existing upload URL is invalid or expired; reset and re-initialize
            uploadUrl = null;
          }
        } catch {
          uploadUrl = null;
        }
      }

      if (!uploadUrl) {
        const rawCaption = payload.caption || 'Untitled Video';
        const videoTitle =
          payload.metadata?.youtubeTitle ||
          rawCaption.split('\n')[0].replace(/[#@][\w-]+/g, '').trim().slice(0, 100) ||
          'Untitled Video';
        const description = rawCaption;
        const tags = payload.hashtags
          ? payload.hashtags.split(/\s+/).map((t) => t.replace('#', '')).filter(Boolean)
          : [];
        const privacyStatus = (payload.visibility || 'public').toLowerCase();

        const initRes = await fetch(
          'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${payload.accessToken}`,
              'Content-Type': 'application/json; charset=UTF-8',
              'X-Upload-Content-Length': totalSize.toString(),
              'X-Upload-Content-Type': resolvedMimeType,
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
          const errMsg = err?.error?.message || `YouTube initialization failed (HTTP ${initRes.status})`;
          console.error('[YOUTUBE] Init Error:', errMsg, err);
          return {
            success: false,
            errorCode: 'YOUTUBE_INIT_FAILED',
            errorMessage: errMsg,
          };
        }

        uploadUrl = initRes.headers.get('Location');
        if (!uploadUrl) {
          return {
            success: false,
            errorCode: 'YOUTUBE_NO_LOCATION',
            errorMessage: 'Upload session location URL missing from YouTube initialization response.',
          };
        }
        nextByte = 0;
      }

      // Step 2: Upload all chunks sequentially until 100% complete
      // Google requires chunk sizes to be multiples of 256KB (except the last chunk)
      // 10MB chunk = 10 * 1024 * 1024 = 10,485,760 bytes (exactly 40 * 256KB)
      const chunkSize = 10 * 1024 * 1024;
      let uploadFinished = false;
      let finalVideoData: any = null;

      while (!uploadFinished && nextByte < totalSize) {
        const endByte = Math.min(nextByte + chunkSize - 1, totalSize - 1);
        const currentChunkLength = endByte - nextByte + 1;
        const contentRange = `bytes ${nextByte}-${endByte}/${totalSize}`;

        console.log(`[YOUTUBE] Fetching chunk from R2: bytes=${nextByte}-${endByte}`);
        const chunkRes = await fetch(payload.mediaUrl, {
          headers: { Range: `bytes=${nextByte}-${endByte}` },
        });

        if (!chunkRes.ok) {
          return {
            success: false,
            errorCode: 'YOUTUBE_MEDIA_READ_ERROR',
            errorMessage: `Failed to read media chunk (${nextByte}-${endByte}) from Cloudflare R2 storage.`,
          };
        }

        const chunkBuffer = Buffer.from(await chunkRes.arrayBuffer());

        console.log(`[YOUTUBE] Uploading chunk to YouTube: ${contentRange} (${chunkBuffer.length} bytes)`);
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': resolvedMimeType,
            'Content-Length': chunkBuffer.length.toString(),
            'Content-Range': contentRange,
          },
          body: chunkBuffer,
        });

        if (uploadRes.status === 308) {
          const range = uploadRes.headers.get('range');
          if (range) {
            nextByte = parseInt(range.split('-')[1], 10) + 1;
          } else {
            nextByte = endByte + 1;
          }
          console.log(`[YOUTUBE] Chunk progress: ${nextByte} / ${totalSize} bytes (${Math.round((nextByte / totalSize) * 100)}%)`);
        } else if (uploadRes.ok) {
          uploadFinished = true;
          finalVideoData = await uploadRes.json();
          console.log(`[YOUTUBE] Upload complete! Video ID: ${finalVideoData.id}`);
          break;
        } else {
          const uploadErr = await uploadRes.json().catch(() => ({}));
          const errMsg = uploadErr?.error?.message || `YouTube chunk upload failed with HTTP ${uploadRes.status}`;
          console.error('[YOUTUBE] Chunk Upload Error:', errMsg);
          return {
            success: false,
            errorCode: 'YOUTUBE_UPLOAD_FAILED',
            errorMessage: errMsg,
            updatedMetadata: { youtubeUploadUrl: null },
          };
        }
      }

      if (!finalVideoData || !finalVideoData.id) {
        return {
          success: false,
          errorCode: 'YOUTUBE_INCOMPLETE_UPLOAD',
          errorMessage: 'YouTube upload finished without video ID confirmation.',
          updatedMetadata: { youtubeUploadUrl: null },
        };
      }

      return {
        success: true,
        status: 'PROCESSING',
        externalPostId: finalVideoData.id,
        externalPostUrl: `https://www.youtube.com/watch?v=${finalVideoData.id}`,
        publishedAt: new Date(),
        updatedMetadata: { youtubeUploadUrl: null, youtubeVideoId: finalVideoData.id },
      };
    } catch (error: any) {
      console.error('[YOUTUBE] Unexpected exception during upload:', error);
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
        },
      });
      const data = await res.json();
      
      if (!res.ok || !data.items || data.items.length === 0) {
        const errDetail = data?.error?.message || 'Video not found or deleted on YouTube';
        return { status: 'FAILED', errorMessage: errDetail };
      }
      
      const video = data.items[0];
      const status = video.status?.uploadStatus;
      
      if (status === 'processed' || status === 'uploaded') {
        return {
          status: 'PUBLISHED',
          views: parseInt(video.statistics?.viewCount || '0', 10),
          likes: parseInt(video.statistics?.likeCount || '0', 10),
          comments: parseInt(video.statistics?.commentCount || '0', 10),
        };
      } else if (status === 'rejected' || status === 'failed') {
        return {
          status: 'FAILED',
          errorMessage: video.status?.failureReason || `YouTube video rejected (${status})`,
        };
      }
      
      return { status: 'PROCESSING' };
    } catch (e: any) {
      return { status: 'PROCESSING', errorMessage: e?.message };
    }
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
