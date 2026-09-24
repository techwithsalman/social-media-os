import fs from 'fs';
import path from 'path';
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
import { refreshTikTokToken } from '../../lib/tiktok-oauth';

export interface TikTokCreatorInfo {
  creatorUsername?: string;
  creatorNickname?: string;
  creatorAvatarUrl?: string;
  privacyLevelOptions?: string[];
  commentDisabled?: boolean;
  duetDisabled?: boolean;
  stitchDisabled?: boolean;
  maxVideoPostDurationSec?: number;
}

export class TikTokAdapter implements ISocialPlatformAdapter {
  readonly platform: SocialPlatformType = 'TIKTOK';

  getRequirements(): PlatformRequirementInfo {
    return {
      name: 'TikTok Content Posting API (Direct Post & Creator Inbox)',
      platform: 'TIKTOK',
      developerPortalUrl: 'https://developers.tiktok.com',
      requiredScopes: ['user.info.basic', 'video.upload', 'video.publish'],
      requiredCredentials: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
      mediaRequirements: {
        supportedImageTypes: ['image/jpeg', 'image/png'],
        supportedVideoTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
        maxImageSizeMb: 10,
        maxVideoSizeMb: 500,
        maxVideoDurationSeconds: 600,
        captionMaxLength: 4000,
      },
      notes:
        'Requires approved TikTok Developer app with video.publish & video.upload scopes. Supports Direct Post and Creator Inbox draft workflows.',
    };
  }

  async connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult> {
    const isMock = process.env.MOCK_API_MODE === 'true' || !process.env.TIKTOK_CLIENT_KEY;

    if (isMock || authCode.startsWith('mock_')) {
      const demo = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM.TIKTOK;
      return {
        platformAccountId: demo.platformAccountId,
        name: demo.name,
        username: demo.username,
        profileImageUrl: demo.profileImageUrl,
        accessToken: 'mock_tt_token_' + Math.random().toString(36).slice(2),
        refreshToken: 'mock_tt_refresh_' + Math.random().toString(36).slice(2),
        expiresIn: 86400,
        scope: demo.scope,
        isMock: true,
      };
    }

    const tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY || '',
        client_secret: process.env.TIKTOK_CLIENT_SECRET || '',
        code: authCode,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    const data = await res.json();
    return {
      platformAccountId: data.open_id || `tt_${Date.now()}`,
      name: 'TikTok Creator',
      username: 'tiktok_creator',
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      isMock: false,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenRefreshResult> {
    if (refreshToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      return { accessToken: 'mock_refreshed_tt_token', expiresIn: 86400 };
    }
    const result = await refreshTikTokToken(refreshToken);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  async validateConnection(accessToken: string): Promise<boolean> {
    if (accessToken.startsWith('mock_')) return true;
    try {
      const res = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo | null> {
    if (accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      return {
        creatorUsername: 'alexrivera_official',
        creatorNickname: 'Alex Rivera',
        privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
        maxVideoPostDurationSec: 600,
      };
    }

    try {
      const res = await fetch('https://open.tiktokapis.com/v2/post/publish/creator_info/query/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok || data.error?.code !== 'ok') {
        console.warn('[TikTok Creator Info Error]:', data.error);
        return null;
      }

      const info = data.data || {};
      return {
        creatorUsername: info.creator_username,
        creatorNickname: info.creator_nickname,
        creatorAvatarUrl: info.creator_avatar_url,
        privacyLevelOptions: info.privacy_level_options || ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
        commentDisabled: info.comment_disabled,
        duetDisabled: info.duet_disabled,
        stitchDisabled: info.stitch_disabled,
        maxVideoPostDurationSec: info.max_video_post_duration_sec || 600,
      };
    } catch (e) {
      console.error('[TikTok Creator Info Exception]:', e);
      return null;
    }
  }

  async uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult> {
    return { mediaContainerId: `tt_upload_${Date.now()}` };
  }

  async publishPost(payload: PublishPayload): Promise<PublishResult> {
    if (payload.isMock || payload.accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      const mockId = `tt_v_${Date.now()}`;
      return {
        success: true,
        externalPostId: mockId,
        externalPostUrl: `https://www.tiktok.com/@creator/video/${mockId.slice(-9)}`,
        isMockSimulation: true,
        publishedAt: new Date(),
      };
    }

    try {
      // Extract media URL hostname for diagnostics
      let mediaHost = 'unknown';
      if (payload.mediaUrl) {
        try {
          mediaHost = new URL(payload.mediaUrl).hostname;
        } catch {
          mediaHost = 'local_relative';
        }
      }

      console.log(
        `[TikTok Direct Post] Initiating publish. Host: ${mediaHost}, Account: Real OAuth, ContentType: ${payload.contentType || 'POST'}`
      );

      // 1. Query creator info
      const creatorInfo = await this.queryCreatorInfo(payload.accessToken);

      const isInboxDraft =
        payload.contentType === 'INBOX_DRAFT' ||
        payload.metadata?.postMode === 'INBOX' ||
        payload.metadata?.publishMode === 'INBOX';

      // 2. Resolve video source & buffer (Local file vs Remote R2 / Presigned URL)
      let localFilePath: string | null = null;
      let fileSize = 0;
      let videoBuffer: Buffer | null = null;

      if (payload.mediaUrl) {
        let cleanPath = payload.mediaUrl;
        if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
          try {
            cleanPath = new URL(cleanPath).pathname;
          } catch {
            // ignore
          }
        }
        cleanPath = cleanPath.replace(/^\//, '');
        const candidate1 = path.join(process.cwd(), 'public', cleanPath);
        const candidate2 = path.join(process.cwd(), cleanPath);

        if (fs.existsSync(candidate1)) {
          localFilePath = candidate1;
        } else if (fs.existsSync(candidate2)) {
          localFilePath = candidate2;
        }
      }

      if (localFilePath) {
        fileSize = fs.statSync(localFilePath).size;
        videoBuffer = fs.readFileSync(localFilePath);
      } else if (payload.mediaUrl && (payload.mediaUrl.startsWith('http://') || payload.mediaUrl.startsWith('https://'))) {
        // Fetch remote R2 / HTTP video buffer for FILE_UPLOAD flow
        try {
          const fetchRes = await fetch(payload.mediaUrl);
          if (fetchRes.ok) {
            const arrayBuffer = await fetchRes.arrayBuffer();
            videoBuffer = Buffer.from(arrayBuffer);
            fileSize = videoBuffer.length;
            console.log(`[TikTok Direct Post] Successfully fetched remote media buffer (${fileSize} bytes) from host '${mediaHost}'`);
          }
        } catch (fetchErr: any) {
          console.warn(`[TikTok Direct Post Warning] Failed to fetch remote media buffer from ${mediaHost}:`, fetchErr?.message);
        }
      }

      // Step 3: Execute FILE_UPLOAD initialization (or PULL_FROM_URL fallback if buffer fetch was unavailable)
      let initEndpoint = isInboxDraft
        ? 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/'
        : 'https://open.tiktokapis.com/v2/post/publish/video/init/';

      let sourceInfo: any;
      if (videoBuffer && fileSize > 0) {
        sourceInfo = {
          source: 'FILE_UPLOAD',
          video_size: fileSize,
          chunk_size: fileSize,
          total_chunk_count: 1,
        };
      } else {
        sourceInfo = {
          source: 'PULL_FROM_URL',
          video_url: payload.mediaUrl,
        };
      }

      console.log(`[TikTok Direct Post] Using transfer method: ${sourceInfo.source} for media host '${mediaHost}'`);

      let requestBody: any = isInboxDraft
        ? { source_info: sourceInfo }
        : {
            post_info: {
              title: `${payload.caption} ${payload.hashtags || ''}`.trim(),
              privacy_level: payload.visibility || creatorInfo?.privacyLevelOptions?.[0] || 'PUBLIC_TO_EVERYONE',
              disable_comment: !(payload.metadata?.allowComments ?? true),
              disable_duet: !(payload.metadata?.allowDuet ?? true),
              disable_stitch: !(payload.metadata?.allowStitch ?? true),
            },
            source_info: sourceInfo,
          };

      let res = await fetch(initEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${payload.accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify(requestBody),
      });

      let data = await res.json();

      if (!res.ok || (data.error && data.error.code !== 'ok')) {
        const errorCode = data.error?.code || 'TIKTOK_PUBLISH_INIT_FAILED';
        let rawMessage = data.error?.message || 'TikTok API returned error during publishing initialization';
        const logId = data.error?.log_id || 'N/A';
        const stepName = isInboxDraft ? 'POST /v2/post/publish/inbox/video/init/' : 'POST /v2/post/publish/video/init/';

        // Redact any tokens/secrets from error message
        rawMessage = rawMessage.replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]');

        // Format exact diagnostic error message with failing step, code, and log_id
        let diagnosticMsg = `TikTok Error [Step: Video Init (${stepName})] (Code: ${errorCode}, HTTP ${res.status}): ${rawMessage} (Log ID: ${logId})`;

        if (
          rawMessage.includes('content-sharing-guidelines') ||
          rawMessage.includes('guidelines') ||
          errorCode.includes('unaudited') ||
          errorCode.includes('scope_insufficient')
        ) {
          diagnosticMsg =
            `TikTok Direct Post Error [Step: Video Init (${stepName})] (Code: ${errorCode}, HTTP ${res.status}): ` +
            `${rawMessage}. ` +
            `Cause: Direct Post requires TikTok App Review approval for production publishing, or the TikTok user account must be registered as an App Admin/Developer while in Development Mode. ` +
            `Review guidelines: https://developers.tiktok.com/doc/content-sharing-guidelines/ (Log ID: ${logId})`;
        } else if (
          sourceInfo.source === 'PULL_FROM_URL' &&
          (errorCode.includes('url') ||
            errorCode.includes('domain') ||
            rawMessage.toLowerCase().includes('url') ||
            rawMessage.toLowerCase().includes('domain') ||
            rawMessage.toLowerCase().includes('verification') ||
            rawMessage.toLowerCase().includes('ownership'))
        ) {
          diagnosticMsg =
            `TikTok Direct Post Error [Step: Video Init (${stepName})] (Code: ${errorCode}, HTTP ${res.status}): ` +
            `TikTok rejected media URL host '${mediaHost}' because domain ownership is not verified. ` +
            `To resolve, add '${mediaHost}' under Target Web Domains / URL Prefixes in TikTok Developer Console (App Settings), ` +
            `or ensure media is uploaded via FILE_UPLOAD flow. Original API message: ${rawMessage} (Log ID: ${logId})`;
        }

        console.error(`[TikTok Direct Post Init Error] Code: ${errorCode}, Step: ${stepName}, Host: ${mediaHost}, Message: ${diagnosticMsg}`);

        return {
          success: false,
          errorCode,
          errorMessage: diagnosticMsg,
        };
      }

      const publishId = data.data?.publish_id;
      const uploadUrl = data.data?.upload_url;

      // Step 4: Binary chunk upload to TikTok's upload_url for FILE_UPLOAD
      if (sourceInfo.source === 'FILE_UPLOAD') {
        if (!uploadUrl || !videoBuffer) {
          return {
            success: false,
            errorCode: 'TIKTOK_NO_UPLOAD_URL',
            errorMessage: 'TikTok Error [Step: Binary Transfer]: TikTok API did not return an upload_url for binary file upload.',
          };
        }

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes 0-${fileSize - 1}/${fileSize}`,
            'Content-Length': String(fileSize),
          },
          body: new Uint8Array(videoBuffer),
        });

        if (uploadRes.status !== 200 && uploadRes.status !== 201) {
          const uploadErrText = await uploadRes.text().catch(() => '');
          const sanitizedErrText = uploadErrText.replace(/sig=[^&]+/g, 'sig=[REDACTED]');
          const binaryErrMsg = `TikTok Error [Step: Binary Transfer (PUT upload_url)] (HTTP ${uploadRes.status}): ${sanitizedErrText || 'Binary transfer failed'}`;
          console.error(`[TikTok Direct Post Binary Error] ${binaryErrMsg}`);
          return {
            success: false,
            errorCode: 'TIKTOK_BINARY_UPLOAD_FAILED',
            errorMessage: binaryErrMsg,
          };
        }
      }

      // Step 5: Poll Publish Status until confirmed by TikTok API
      let pollStatus = 'PROCESSING';
      let publicPostId = null;
      let failReason = null;

      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${payload.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ publish_id: publishId }),
        });

        const statusData = await statusRes.json();
        if (statusRes.ok && statusData.data) {
          pollStatus = statusData.data.status;
          publicPostId = statusData.data.public_post_id || statusData.data.video_id;
          failReason = statusData.data.fail_reason;

          if (
            pollStatus === 'SUCCESS' ||
            pollStatus === 'PUBLISHED' ||
            pollStatus === 'SEND_TO_USER_INBOX' ||
            pollStatus === 'PROCESSING_UPLOAD' ||
            pollStatus === 'FAILED'
          ) {
            break;
          }
        }
      }

      if (pollStatus === 'FAILED') {
        const pollErrMsg = `TikTok Error [Step: Publish Processing (POST /v2/post/publish/status/fetch/)] (Status: FAILED): ${failReason || 'TikTok publishing failed during server processing.'}`;
        console.error(`[TikTok Direct Post Poll Error] ${pollErrMsg}`);
        return {
          success: false,
          status: 'FAILED',
          errorCode: 'TIKTOK_PUBLISH_FAILED',
          errorMessage: pollErrMsg,
        };
      }

      const isPubliclyPublished = pollStatus === 'SUCCESS' || pollStatus === 'PUBLISHED';
      const isInboxDraftStatus = pollStatus === 'SEND_TO_USER_INBOX' || isInboxDraft;

      const finalStatus = isPubliclyPublished
        ? 'PUBLISHED'
        : isInboxDraftStatus
        ? 'INBOX_DRAFT'
        : 'PROCESSING';

      const statusMessage = isPubliclyPublished
        ? 'Publicly published on TikTok'
        : isInboxDraftStatus
        ? 'Sent to TikTok Creator Inbox (Draft upload)'
        : `TikTok Status: ${pollStatus}`;

      return {
        success: true,
        status: finalStatus,
        statusMessage,
        externalPostId: publishId,
        externalPostUrl: publicPostId
          ? `https://www.tiktok.com/@creator/video/${publicPostId}`
          : `https://www.tiktok.com/`,
        publishedAt: isPubliclyPublished ? new Date() : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'TIKTOK_NETWORK_ERROR',
        errorMessage: error?.message || 'TikTok API network exception',
      };
    }
  }

  async getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult> {
    if (accessToken.startsWith('mock_') || process.env.MOCK_API_MODE === 'true') {
      return { status: 'PUBLISHED', views: 8900, likes: 1420, comments: 88, shares: 140 };
    }

    try {
      const statusRes = await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ publish_id: platformPostId }),
      });

      const statusData = await statusRes.json();
      const status = statusData.data?.status || 'UNKNOWN';

      if (status === 'SUCCESS' || status === 'PUBLISHED') {
        return { status: 'PUBLISHED' };
      } else if (status === 'FAILED') {
        return { status: 'FAILED', errorMessage: statusData.data?.fail_reason || 'TikTok publish failed' };
      } else {
        return {
          status: 'PROCESSING',
          errorMessage: status === 'SEND_TO_USER_INBOX'
            ? 'Sent to TikTok Creator Inbox (Draft upload)'
            : `TikTok processing status: ${status}`,
        };
      }
    } catch (err: any) {
      return { status: 'PROCESSING', errorMessage: err?.message };
    }
  }

  async deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean> {
    return true;
  }
}
