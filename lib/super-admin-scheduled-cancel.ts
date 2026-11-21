import prisma from './prisma';

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

/**
 * Complete read-only audit of all scheduled posts across the entire platform
 */
export async function auditScheduledPosts(): Promise<ScheduledAuditReport> {
  const posts = await prisma.contentPost.findMany({
    where: {
      OR: [
        { status: 'SCHEDULED' },
        { platformPosts: { some: { status: { in: ['SCHEDULED', 'QUEUED'] } } } },
      ],
    },
    include: {
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          members: {
            take: 1,
            select: {
              user: {
                select: {
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
      },
      platformPosts: {
        include: {
          socialAccount: {
            select: {
              id: true,
              platform: true,
              name: true,
              username: true,
              platformAccountId: true,
            },
          },
        },
      },
      mediaAsset: {
        select: { id: true },
      },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  const platformBreakdown: Record<string, { total: number; protected: number; toCancel: number }> = {};
  const workspaceMap = new Map<
    string,
    {
      workspaceId: string;
      workspaceName: string;
      userEmail: string;
      totalScheduled: number;
      protected: number;
      toCancel: number;
    }
  >();

  let protectedExclusivePosts = 0;
  let protectedPartialPosts = 0;
  let cancelCandidatePosts = 0;
  let inFlightPosts = 0;
  let manualReviewPosts = 0;
  let totalCancelledTargets = 0;
  let totalPreservedTargets = 0;
  let totalPlatformTargets = 0;

  const items: ScheduledPostAuditItem[] = [];

  for (const post of posts) {
    const owner = post.workspace.members[0]?.user;
    const userEmail = owner?.email || 'N/A';
    const userName = `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || 'N/A';

    // In-flight safety check
    const isInFlight = post.status === 'PROCESSING' || post.status === 'UPLOADING';

    const targets: ScheduledTargetAudit[] = [];
    let postProtectedTargets = 0;
    let postCancelTargets = 0;
    let hasAmbiguous = false;

    if (!post.platformPosts || post.platformPosts.length === 0) {
      hasAmbiguous = true;
    }

    for (const pp of post.platformPosts) {
      totalPlatformTargets++;
      const platKey = pp.platform?.toUpperCase() || 'OTHER';
      if (!platformBreakdown[platKey]) {
        platformBreakdown[platKey] = { total: 0, protected: 0, toCancel: 0 };
      }
      platformBreakdown[platKey].total++;

      const match = matchProtectedYouTubeChannel(pp.socialAccount);

      if (match.isProtected) {
        postProtectedTargets++;
        totalPreservedTargets++;
        platformBreakdown[platKey].protected++;
      } else {
        postCancelTargets++;
        totalCancelledTargets++;
        platformBreakdown[platKey].toCancel++;
      }

      targets.push({
        platformPostId: pp.id,
        platform: pp.platform,
        status: pp.status,
        socialAccountId: pp.socialAccountId,
        accountName: pp.socialAccount?.name || 'Unknown',
        accountUsername: pp.socialAccount?.username || 'Unknown',
        channelId: pp.socialAccount?.platformAccountId || '',
        isProtected: match.isProtected,
        matchedChannelName: match.channel?.displayName,
        matchReason: match.matchReason,
      });
    }

    // Determine post classification
    let classification: ScheduledPostAuditItem['classification'] = 'CANCEL_CANDIDATE';
    if (isInFlight) {
      classification = 'IN_FLIGHT';
      inFlightPosts++;
    } else if (hasAmbiguous) {
      classification = 'MANUAL_REVIEW';
      manualReviewPosts++;
    } else if (postProtectedTargets > 0 && postCancelTargets === 0) {
      classification = 'PROTECTED_EXCLUSIVE';
      protectedExclusivePosts++;
    } else if (postProtectedTargets > 0 && postCancelTargets > 0) {
      classification = 'PROTECTED_PARTIAL';
      protectedPartialPosts++;
    } else {
      classification = 'CANCEL_CANDIDATE';
      cancelCandidatePosts++;
    }

    // Workspace aggregator
    if (!workspaceMap.has(post.workspaceId)) {
      workspaceMap.set(post.workspaceId, {
        workspaceId: post.workspaceId,
        workspaceName: post.workspace.name,
        userEmail,
        totalScheduled: 0,
        protected: 0,
        toCancel: 0,
      });
    }
    const wsStats = workspaceMap.get(post.workspaceId)!;
    wsStats.totalScheduled++;
    if (postProtectedTargets > 0) {
      wsStats.protected += postProtectedTargets;
    }
    wsStats.toCancel += postCancelTargets;

    items.push({
      id: post.id,
      workspaceId: post.workspaceId,
      workspaceName: post.workspace.name,
      workspaceSlug: post.workspace.slug,
      userEmail,
      userName,
      title: post.title,
      masterCaption: post.masterCaption,
      scheduledFor: post.scheduledFor ? post.scheduledFor.toISOString() : null,
      status: post.status,
      hasMedia: !!post.mediaAsset,
      classification,
      targets,
      protectedTargetsCount: postProtectedTargets,
      cancelTargetsCount: postCancelTargets,
    });
  }

  return {
    timestamp: new Date().toISOString(),
    totalScheduledPosts: posts.length,
    totalPlatformTargets,
    counts: {
      protectedExclusivePosts,
      protectedPartialPosts,
      cancelCandidatePosts,
      inFlightPosts,
      manualReviewPosts,
      totalCancelledTargets,
      totalPreservedTargets,
    },
    platformBreakdown,
    workspaceBreakdown: Array.from(workspaceMap.values()).sort((a, b) => b.totalScheduled - a.totalScheduled),
    approvedChannels: APPROVED_YOUTUBE_CHANNELS,
    items,
  };
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

/**
 * Execute safe bulk cancellation of non-whitelisted scheduled posts
 */
export async function executeBulkCancelScheduledPosts(options: {
  confirmToken: string;
  actorUserId?: string;
  selectedPostIds?: string[];
  dryRun?: boolean;
}): Promise<BulkCancelResult> {
  if (options.confirmToken !== 'CONFIRM_CANCEL') {
    throw new Error("Invalid confirmation token. You must pass confirmToken: 'CONFIRM_CANCEL' to execute.");
  }

  const audit = await auditScheduledPosts();

  const selectedSet = options.selectedPostIds && options.selectedPostIds.length > 0
    ? new Set(options.selectedPostIds)
    : null;

  const eligibleItems = audit.items.filter((item) => {
    if (selectedSet && !selectedSet.has(item.id)) return false;
    // Never cancel purely protected posts or in-flight posts
    if (item.classification === 'PROTECTED_EXCLUSIVE' || item.classification === 'IN_FLIGHT') return false;
    return true;
  });

  const cancelledPosts: BulkCancelResult['cancelledPosts'] = [];
  const recoverySnapshot: BulkCancelResult['recoveryLog']['snapshot'] = [];

  let cancelledPostsCount = 0;
  let cancelledTargetsCount = 0;
  let preservedProtectedPostsCount = audit.counts.protectedExclusivePosts + audit.counts.protectedPartialPosts;
  let skippedInFlightCount = audit.counts.inFlightPosts;
  let skippedManualReviewCount = 0;

  if (options.dryRun) {
    for (const item of eligibleItems) {
      const cancelledTargetIds = item.targets.filter((t) => !t.isProtected).map((t) => t.platformPostId);
      const preservedTargetIds = item.targets.filter((t) => t.isProtected).map((t) => t.platformPostId);

      cancelledTargetsCount += cancelledTargetIds.length;
      if (item.classification === 'CANCEL_CANDIDATE') {
        cancelledPostsCount++;
      }

      cancelledPosts.push({
        postId: item.id,
        workspaceId: item.workspaceId,
        caption: (item.masterCaption || '').slice(0, 60),
        action: item.classification === 'CANCEL_CANDIDATE' ? 'POST_CANCELLED' : 'TARGETS_CANCELLED',
        cancelledTargets: cancelledTargetIds,
        preservedTargets: preservedTargetIds,
      });

      recoverySnapshot.push({
        postId: item.id,
        originalStatus: item.status,
        scheduledFor: item.scheduledFor,
        cancelledPlatformPostIds: cancelledTargetIds,
      });
    }

    return {
      success: true,
      dryRun: true,
      cancelledPostsCount,
      cancelledTargetsCount,
      preservedProtectedPostsCount,
      skippedInFlightCount,
      skippedManualReviewCount,
      cancelledPosts,
      recoveryLog: {
        timestamp: new Date().toISOString(),
        snapshot: recoverySnapshot,
      },
    };
  }

  // Live Transactional Execution
  for (const item of eligibleItems) {
    if (item.classification === 'MANUAL_REVIEW') {
      skippedManualReviewCount++;
      continue;
    }

    const nonProtectedPlatformPosts = item.targets.filter((t) => !t.isProtected);
    const protectedPlatformPosts = item.targets.filter((t) => t.isProtected);

    const nonProtectedIds = nonProtectedPlatformPosts.map((t) => t.platformPostId);
    const protectedIds = protectedPlatformPosts.map((t) => t.platformPostId);

    if (nonProtectedIds.length === 0) continue;

    // 1. Cancel the non-whitelisted PlatformPosts
    await prisma.platformPost.updateMany({
      where: { id: { in: nonProtectedIds } },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Bulk-cancelled by Super Admin (non-whitelisted schedule)',
      },
    });

    // 2. Cancel associated PublishingJobs
    await prisma.publishingJob.updateMany({
      where: {
        platformPostId: { in: nonProtectedIds },
        status: { in: ['QUEUED', 'SCHEDULED', 'RETRYING'] },
      },
      data: {
        status: 'CANCELLED',
        errorMessage: 'Bulk-cancelled by Super Admin',
      },
    });

    cancelledTargetsCount += nonProtectedIds.length;

    // 3. Handle Parent ContentPost
    if (protectedIds.length > 0) {
      // Post still has active whitelisted YouTube targets! Keep ContentPost as SCHEDULED
      cancelledPosts.push({
        postId: item.id,
        workspaceId: item.workspaceId,
        caption: (item.masterCaption || '').slice(0, 60),
        action: 'TARGETS_CANCELLED',
        cancelledTargets: nonProtectedIds,
        preservedTargets: protectedIds,
      });
    } else {
      // Entire post has only non-whitelisted targets: Cancel parent ContentPost
      await prisma.contentPost.update({
        where: { id: item.id },
        data: { status: 'CANCELLED' },
      });
      cancelledPostsCount++;

      cancelledPosts.push({
        postId: item.id,
        workspaceId: item.workspaceId,
        caption: (item.masterCaption || '').slice(0, 60),
        action: 'POST_CANCELLED',
        cancelledTargets: nonProtectedIds,
        preservedTargets: [],
      });
    }

    recoverySnapshot.push({
      postId: item.id,
      originalStatus: item.status,
      scheduledFor: item.scheduledFor,
      cancelledPlatformPostIds: nonProtectedIds,
    });
  }

  // 4. Create Audit Log Entry
  const auditLog = await prisma.activityLog.create({
    data: {
      action: 'SUPER_ADMIN_BULK_CANCEL_SCHEDULED',
      actorUserId: options.actorUserId || 'super_admin_owner',
      details: `Bulk cancelled ${cancelledPostsCount} post(s) and ${cancelledTargetsCount} platform target(s). Preserved ${preservedProtectedPostsCount} protected YouTube schedule(s).`,
      metadata: JSON.stringify({
        timestamp: new Date().toISOString(),
        actor: options.actorUserId || 'owner',
        cancelledPostsCount,
        cancelledTargetsCount,
        preservedProtectedPostsCount,
        recoverySnapshot,
      }),
    },
  });

  return {
    success: true,
    dryRun: false,
    cancelledPostsCount,
    cancelledTargetsCount,
    preservedProtectedPostsCount,
    skippedInFlightCount,
    skippedManualReviewCount,
    cancelledPosts,
    recoveryLog: {
      auditLogId: auditLog.id,
      timestamp: auditLog.createdAt.toISOString(),
      snapshot: recoverySnapshot,
    },
  };
}
