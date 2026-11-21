export interface ProtectedChannelDef {
  id: string;
  displayName: string;
  handle: string;
  normalizedKeys: string[];
  knownAccountIds: string[];
}

export const APPROVED_YOUTUBE_CHANNELS: ProtectedChannelDef[] = [
  {
    id: 'tech_with_salman',
    displayName: 'Tech With Salman',
    handle: '@Tech With Salman',
    normalizedKeys: ['techwithsalman', 'techwithsalmanonline'],
    knownAccountIds: [],
  },
  {
    id: 'beyond_history',
    displayName: 'Beyond History',
    handle: '@Beyond History',
    normalizedKeys: ['beyondhistory'],
    knownAccountIds: [],
  },
  {
    id: 'sheru_bhai_official',
    displayName: 'Sheru Bhai Official',
    handle: '@Sheru Bhai Official',
    normalizedKeys: ['sherubhaiofficial', 'sherubhai'],
    knownAccountIds: [],
  },
  {
    id: 'vexora',
    displayName: 'VEXORA',
    handle: '@VEXORA',
    normalizedKeys: ['vexora'],
    knownAccountIds: [],
  },
];

export function normalizeKey(str?: string | null): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[@\s_\-\.]/g, '').trim();
}

/**
 * Accurately identify if a connected social account matches one of the 4 protected YouTube channels
 */
export function matchProtectedYouTubeChannel(account?: {
  platform?: string | null;
  name?: string | null;
  username?: string | null;
  platformAccountId?: string | null;
} | null): { isProtected: boolean; channel?: ProtectedChannelDef; matchReason?: string } {
  if (!account || !account.platform) {
    return { isProtected: false };
  }

  // Must be YouTube platform
  if (account.platform.toUpperCase() !== 'YOUTUBE') {
    return { isProtected: false };
  }

  const normName = normalizeKey(account.name);
  const normUser = normalizeKey(account.username);
  const accountId = (account.platformAccountId || '').trim();

  for (const channel of APPROVED_YOUTUBE_CHANNELS) {
    // 1. Match by known Account/Channel ID if configured
    if (accountId && channel.knownAccountIds.includes(accountId)) {
      return { isProtected: true, channel, matchReason: `Matched Channel ID: ${accountId}` };
    }

    // 2. Match by normalized name or handle
    for (const key of channel.normalizedKeys) {
      if (normName === key || normUser === key) {
        return { isProtected: true, channel, matchReason: `Matched handle/key: ${key}` };
      }
      if (normName.includes(key) || normUser.includes(key)) {
        return { isProtected: true, channel, matchReason: `Contains channel key: ${key}` };
      }
    }
  }

  return { isProtected: false };
}

export interface ScheduledTargetAudit {
  platformPostId: string;
  platform: string;
  status: string;
  socialAccountId: string;
  accountName: string;
  accountUsername: string;
  channelId: string;
  isProtected: boolean;
  matchedChannelName?: string;
  matchReason?: string;
}

export interface MediaCleanupAuditItem {
  mediaAssetId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  sizeFormatted: string;
  objectKey: string;
  status:
    | 'ELIGIBLE_FOR_R2_DELETE'
    | 'RETAINED_PROTECTED_CHANNEL'
    | 'RETAINED_PUBLISHED'
    | 'RETAINED_SHARED_SCHEDULED'
    | 'RETAINED_DRAFT'
    | 'RETAINED_IN_FLIGHT'
    | 'ALREADY_CLEANED'
    | 'SKIPPED_UNCERTAIN';
  reason: string;
  isShared: boolean;
  sharedWithPostsCount: number;
}

export interface ScheduledPostAuditItem {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspaceSlug: string;
  userEmail: string;
  userName: string;
  title: string | null;
  masterCaption: string;
  scheduledFor: string | null;
  status: string;
  hasMedia: boolean;
  classification: 'PROTECTED_EXCLUSIVE' | 'PROTECTED_PARTIAL' | 'CANCEL_CANDIDATE' | 'IN_FLIGHT' | 'MANUAL_REVIEW';
  targets: ScheduledTargetAudit[];
  protectedTargetsCount: number;
  cancelTargetsCount: number;
  mediaAudit?: MediaCleanupAuditItem | null;
}

export interface ScheduledAuditReport {
  timestamp: string;
  totalScheduledPosts: number;
  totalPlatformTargets: number;
  counts: {
    protectedExclusivePosts: number;
    protectedPartialPosts: number;
    cancelCandidatePosts: number;
    inFlightPosts: number;
    manualReviewPosts: number;
    totalCancelledTargets: number;
    totalPreservedTargets: number;
  };
  mediaSummary: {
    totalAttachedMedia: number;
    expectedDeletedMediaCount: number;
    expectedFreedStorageBytes: number;
    expectedFreedStorageMB: number;
    expectedFreedStorageGB: number;
    sharedMediaRetainedCount: number;
    protectedChannelMediaRetainedCount: number;
    skippedMediaCount: number;
  };
  platformBreakdown: Record<string, { total: number; protected: number; toCancel: number }>;
  workspaceBreakdown: Array<{
    workspaceId: string;
    workspaceName: string;
    userEmail: string;
    totalScheduled: number;
    protected: number;
    toCancel: number;
  }>;
  approvedChannels: typeof APPROVED_YOUTUBE_CHANNELS;
  items: ScheduledPostAuditItem[];
}

export interface BulkCancelResult {
  success: boolean;
  dryRun: boolean;
  cancelledPostsCount: number;
  cancelledTargetsCount: number;
  preservedProtectedPostsCount: number;
  skippedInFlightCount: number;
  skippedManualReviewCount: number;
  cancelledPosts: Array<{
    postId: string;
    workspaceId: string;
    caption: string;
    action: 'POST_CANCELLED' | 'TARGETS_CANCELLED';
    cancelledTargets: string[];
    preservedTargets: string[];
  }>;
  mediaCleanupResult: {
    attemptedCount: number;
    deletedR2Count: number;
    retainedSharedCount: number;
    retainedProtectedChannelCount: number;
    failedRetryCount: number;
    freedBytes: number;
    freedMB: number;
    freedGB: number;
    deletedMediaAssets: Array<{
      mediaAssetId: string;
      objectKey: string;
      workspaceId: string;
      postId: string;
      sizeFormatted: string;
      status: 'DELETED' | 'FAILED_RETRY' | 'SKIPPED';
      reason?: string;
    }>;
  };
  recoveryLog: {
    auditLogId?: string;
    timestamp: string;
    snapshot: Array<{
      postId: string;
      originalStatus: string;
      scheduledFor: string | null;
      cancelledPlatformPostIds: string[];
    }>;
  };
}
