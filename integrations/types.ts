export type SocialPlatformType =
  | 'INSTAGRAM'
  | 'FACEBOOK'
  | 'TIKTOK'
  | 'LINKEDIN'
  | 'YOUTUBE'
  | 'X'
  | 'PINTEREST'
  | 'SNAPCHAT';

export interface AccountAuthResult {
  platformAccountId: string;
  name: string;
  username: string;
  profileImageUrl?: string;
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  isMock?: boolean;
}

export interface TokenRefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface PlatformMediaUploadResult {
  mediaContainerId?: string;
  platformMediaUrl?: string;
}

export interface PublishPayload {
  caption: string;
  mediaUrl?: string;
  mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL' | 'TEXT';
  hashtags?: string;
  contentType?: string; // 'POST' | 'REEL' | 'VIDEO' | 'SHORT' | 'CAROUSEL'
  visibility?: string; // 'PUBLIC' | 'PRIVATE' | 'UNLISTED'
  metadata?: Record<string, any>;
  accessToken: string;
  platformAccountId: string;
  isMock?: boolean;
}

export interface PublishResult {
  success: boolean;
  status?: string;
  statusMessage?: string;
  externalPostId?: string;
  externalPostUrl?: string;
  errorMessage?: string;
  errorCode?: string;
  isMockSimulation?: boolean;
  publishedAt?: Date;
}

export interface PlatformPostStatusResult {
  status: 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'UNKNOWN';
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  errorMessage?: string;
}

export interface PlatformRequirementInfo {
  name: string;
  platform: SocialPlatformType;
  developerPortalUrl: string;
  requiredScopes: string[];
  requiredCredentials: string[];
  mediaRequirements: {
    supportedImageTypes: string[];
    supportedVideoTypes: string[];
    maxImageSizeMb: number;
    maxVideoSizeMb: number;
    maxVideoDurationSeconds: number;
    captionMaxLength: number;
  };
  notes: string;
}

export interface ISocialPlatformAdapter {
  readonly platform: SocialPlatformType;
  getRequirements(): PlatformRequirementInfo;
  connectAccount(authCode: string, redirectUri: string): Promise<AccountAuthResult>;
  refreshToken(refreshToken: string): Promise<TokenRefreshResult>;
  validateConnection(accessToken: string): Promise<boolean>;
  uploadMedia(mediaUrl: string, mediaType: string, accessToken: string): Promise<PlatformMediaUploadResult>;
  publishPost(payload: PublishPayload): Promise<PublishResult>;
  getPostStatus(platformPostId: string, accessToken: string): Promise<PlatformPostStatusResult>;
  deleteConnection(platformAccountId: string, accessToken: string): Promise<boolean>;
}
