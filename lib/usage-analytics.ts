import prisma from './prisma';
import { getEffectivePlan } from './billing';
import { getStorageMetrics, formatBytes, StorageMetrics } from './storage/r2-storage-monitor';

export interface UserUsageItem {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  status: string;
  systemRole: string;
  createdAt: string;
  lastActiveAt: string | null;
  workspace: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  plan: {
    code: string;
    name: string;
    storageLimitMB: number | null;
    monthlyPostLimit: number | null;
  };
  posts: {
    total: number;
    published: number;
    scheduled: number;
    failed: number;
    draft: number;
  };
  storage: {
    totalFiles: number;
    videoFiles: number;
    imageFiles: number;
    activeBytes: number;
    activeMB: number;
    activeGB: number;
    totalUploadedBytes: number;
    archivedFiles: number;
    archivedBytes: number;
    storageLimitMB: number | null;
    percentageUsed: number | null;
  };
  platforms: Record<string, {
    total: number;
    published: number;
    scheduled: number;
    failed: number;
  }>;
  connectedAccountsCount: number;
}

export interface SuperAdminUsageSummary {
  totalUsers: number;
  activeUsers: number;
  totalPosts: number;
  totalPublishedPosts: number;
  totalVideosUploaded: number;
  totalMediaFiles: number;
  totalStorageBytes: number;
  totalStorageMB: number;
  totalStorageGB: number;
  totalScheduledPosts: number;
  totalFailedPosts: number;
  storageWarningLevel: string;
  storagePercentageUsed: number;
  storageSavedArchivedGB: number;
}

export interface UserUsageDetail {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    systemRole: string;
    status: string;
    createdAt: string;
    lastActiveAt: string | null;
  };
  workspace: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    timezone: string;
    createdAt: string;
  } | null;
  plan: {
    code: string;
    name: string;
    storageLimitMB: number | null;
    monthlyPostLimit: number | null;
    source: string;
  };
  dateRange: string;
  summary: {
    postsCreated: number;
    postsPublished: number;
    postsScheduled: number;
    postsFailed: number;
    postsDraft: number;
    platformAttempts: number;
    platformPublished: number;
    platformFailed: number;
    videosUploaded: number;
    imagesUploaded: number;
    totalFilesUploaded: number;
    activeStorageBytes: number;
    activeStorageMB: number;
    activeStorageGB: number;
    storagePercentageUsed: number | null;
  };
  platformBreakdown: Record<string, {
    total: number;
    published: number;
    scheduled: number;
    failed: number;
    successRate: number;
  }>;
  connectedAccounts: Array<{
    id: string;
    platform: string;
    name: string;
    username: string;
    profileImageUrl: string | null;
    status: string;
    isMock: boolean;
    createdAt: string;
  }>;
  recentPosts: Array<{
    id: string;
    title: string | null;
    masterCaption: string;
    status: string;
    scheduledFor: string | null;
    publishedAt: string | null;
    createdAt: string;
    mediaAsset: {
      id: string;
      filename: string;
      mimeType: string;
      size: number;
      url: string;
    } | null;
    platformPosts: Array<{
      id: string;
      platform: string;
      status: string;
      externalPostUrl: string | null;
      errorMessage: string | null;
    }>;
  }>;
  scheduledPosts: Array<{
    id: string;
    title: string | null;
    masterCaption: string;
    status: string;
    scheduledFor: string | null;
    createdAt: string;
    platformPosts: Array<{
      id: string;
      platform: string;
      status: string;
    }>;
  }>;
  failedJobs: Array<{
    id: string;
    contentPostId: string;
    platform: string;
    errorMessage: string | null;
    postTitle: string | null;
    caption: string;
    createdAt: string;
    updatedAt: string;
  }>;
  uploadHistory: Array<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    sizeFormatted: string;
    url: string;
    isArchived: boolean;
    createdAt: string;
  }>;
}

export interface GlobalStorageOverview {
  metrics: StorageMetrics;
  topWorkspacesByStorage: Array<{
    workspaceId: string;
    workspaceName: string;
    userEmail: string;
    userName: string;
    activeBytes: number;
    activeMB: number;
    activeGB: number;
    filesCount: number;
    videoCount: number;
    imageCount: number;
  }>;
  recentUploads: Array<{
    id: string;
    workspaceId: string;
    workspaceName: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    sizeFormatted: string;
    url: string;
    isArchived: boolean;
    createdAt: string;
  }>;
}

const SUPPORTED_PLATFORMS = [
  'YOUTUBE',
  'TIKTOK',
  'FACEBOOK',
  'INSTAGRAM',
  'LINKEDIN',
  'X',
  'PINTEREST',
  'SNAPCHAT',
] as const;

export function getDateRangeStart(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case 'today':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case 'all':
    default:
      return null;
  }
}

/**
 * Fetch top-level summary cards for Super Admin
 */
export async function getSuperAdminUsageSummary(): Promise<SuperAdminUsageSummary> {
  const [
    totalUsers,
    activeUsers,
    totalPosts,
    totalPublishedPosts,
    totalScheduledPosts,
    totalFailedPosts,
    totalVideosUploaded,
    totalMediaFiles,
    storageMetrics,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.contentPost.count(),
    prisma.contentPost.count({
      where: { status: { in: ['PUBLISHED', 'PARTIALLY_FAILED'] } },
    }),
    prisma.contentPost.count({ where: { status: 'SCHEDULED' } }),
    prisma.contentPost.count({ where: { status: 'FAILED' } }),
    prisma.mediaAsset.count({
      where: { mimeType: { startsWith: 'video/' } },
    }),
    prisma.mediaAsset.count(),
    getStorageMetrics(),
  ]);

  return {
    totalUsers,
    activeUsers,
    totalPosts,
    totalPublishedPosts,
    totalVideosUploaded,
    totalMediaFiles,
    totalStorageBytes: storageMetrics.activeStorageBytes,
    totalStorageMB: storageMetrics.activeStorageMB,
    totalStorageGB: storageMetrics.activeStorageGB,
    totalScheduledPosts,
    totalFailedPosts,
    storageWarningLevel: storageMetrics.warningLevel,
    storagePercentageUsed: storageMetrics.percentageUsed,
    storageSavedArchivedGB: storageMetrics.savedArchivedGB,
  };
}

/**
 * Get user usage list with full publishing and storage statistics
 */
export async function getSuperAdminUserUsageList(options?: {
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}): Promise<UserUsageItem[]> {
  const search = options?.search?.trim()?.toLowerCase();
  const sortBy = options?.sortBy || 'storage';
  const order = options?.order || 'desc';

  // Fetch users with their workspaces and workspace members
  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      status: true,
      systemRole: true,
      createdAt: true,
      lastActiveAt: true,
      workspaces: {
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              plan: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const workspaceIds = Array.from(
    new Set(
      users
        .flatMap((u) => u.workspaces.map((w) => w.workspace.id))
        .filter(Boolean)
    )
  );

  // Batch query posts grouped by workspace and status
  const posts = await prisma.contentPost.findMany({
    where: { workspaceId: { in: workspaceIds } },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      platformPosts: {
        select: {
          platform: true,
          status: true,
        },
      },
    },
  });

  // Batch query media assets by workspace
  const mediaAssets = await prisma.mediaAsset.findMany({
    where: { workspaceId: { in: workspaceIds } },
    select: {
      id: true,
      workspaceId: true,
      mimeType: true,
      size: true,
      url: true,
    },
  });

  // Batch query connected social accounts
  const socialAccounts = await prisma.socialAccount.findMany({
    where: { workspaceId: { in: workspaceIds } },
    select: {
      id: true,
      workspaceId: true,
      status: true,
    },
  });

  // Pre-aggregate posts per workspace
  const postsByWorkspace = new Map<
    string,
    {
      total: number;
      published: number;
      scheduled: number;
      failed: number;
      draft: number;
      platforms: Record<string, { total: number; published: number; scheduled: number; failed: number }>;
    }
  >();

  for (const post of posts) {
    if (!postsByWorkspace.has(post.workspaceId)) {
      const initialPlatforms: Record<string, { total: number; published: number; scheduled: number; failed: number }> = {};
      for (const p of SUPPORTED_PLATFORMS) {
        initialPlatforms[p] = { total: 0, published: 0, scheduled: 0, failed: 0 };
      }
      postsByWorkspace.set(post.workspaceId, {
        total: 0,
        published: 0,
        scheduled: 0,
        failed: 0,
        draft: 0,
        platforms: initialPlatforms,
      });
    }

    const current = postsByWorkspace.get(post.workspaceId)!;
    current.total++;

    if (post.status === 'PUBLISHED' || post.status === 'PARTIALLY_FAILED') {
      current.published++;
    } else if (post.status === 'SCHEDULED') {
      current.scheduled++;
    } else if (post.status === 'FAILED') {
      current.failed++;
    } else if (post.status === 'DRAFT') {
      current.draft++;
    }

    // Platform-specific breakdowns
    for (const pp of post.platformPosts) {
      const platKey = pp.platform?.toUpperCase() || 'OTHER';
      if (!current.platforms[platKey]) {
        current.platforms[platKey] = { total: 0, published: 0, scheduled: 0, failed: 0 };
      }
      current.platforms[platKey].total++;
      if (pp.status === 'PUBLISHED') {
        current.platforms[platKey].published++;
      } else if (pp.status === 'SCHEDULED' || pp.status === 'QUEUED' || pp.status === 'PROCESSING') {
        current.platforms[platKey].scheduled++;
      } else if (pp.status === 'FAILED') {
        current.platforms[platKey].failed++;
      }
    }
  }

  // Pre-aggregate media per workspace
  const mediaByWorkspace = new Map<
    string,
    {
      totalFiles: number;
      videoFiles: number;
      imageFiles: number;
      activeBytes: number;
      totalUploadedBytes: number;
      archivedFiles: number;
      archivedBytes: number;
    }
  >();

  for (const asset of mediaAssets) {
    if (!mediaByWorkspace.has(asset.workspaceId)) {
      mediaByWorkspace.set(asset.workspaceId, {
        totalFiles: 0,
        videoFiles: 0,
        imageFiles: 0,
        activeBytes: 0,
        totalUploadedBytes: 0,
        archivedFiles: 0,
        archivedBytes: 0,
      });
    }

    const current = mediaByWorkspace.get(asset.workspaceId)!;
    current.totalFiles++;
    current.totalUploadedBytes += asset.size || 0;

    const isArchived = asset.url.startsWith('archived://') || asset.url.startsWith('archived_retry://');
    if (isArchived) {
      current.archivedFiles++;
      current.archivedBytes += asset.size || 0;
    } else {
      current.activeBytes += asset.size || 0;
      if (asset.mimeType?.startsWith('video/')) {
        current.videoFiles++;
      } else if (asset.mimeType?.startsWith('image/')) {
        current.imageFiles++;
      }
    }
  }

  // Pre-aggregate connected accounts
  const accountsByWorkspace = new Map<string, number>();
  for (const sa of socialAccounts) {
    if (sa.status === 'CONNECTED') {
      accountsByWorkspace.set(sa.workspaceId, (accountsByWorkspace.get(sa.workspaceId) || 0) + 1);
    }
  }

  // Map each user to a UserUsageItem
  const items: UserUsageItem[] = await Promise.all(
    users.map(async (user) => {
      const workspace = user.workspaces[0]?.workspace || null;
      const workspaceId = workspace?.id || '';

      const postStats = postsByWorkspace.get(workspaceId) || {
        total: 0,
        published: 0,
        scheduled: 0,
        failed: 0,
        draft: 0,
        platforms: Object.fromEntries(
          SUPPORTED_PLATFORMS.map((p) => [p, { total: 0, published: 0, scheduled: 0, failed: 0 }])
        ),
      };

      const mediaStats = mediaByWorkspace.get(workspaceId) || {
        totalFiles: 0,
        videoFiles: 0,
        imageFiles: 0,
        activeBytes: 0,
        totalUploadedBytes: 0,
        archivedFiles: 0,
        archivedBytes: 0,
      };

      const accountsCount = accountsByWorkspace.get(workspaceId) || 0;

      // Plan resolution
      let planCode = workspace?.plan || 'FREE';
      let planName = workspace?.plan || 'Free';
      let storageLimitMB: number | null = 1000;
      let monthlyPostLimit: number | null = 30;

      if (workspace) {
        try {
          const effective = await getEffectivePlan(workspace.id);
          planCode = effective.plan.code;
          planName = effective.plan.name;
          storageLimitMB = effective.plan.storageLimitMB;
          monthlyPostLimit = effective.plan.monthlyPostLimit;
        } catch {
          // fallback to DB fields if offline/mock
        }
      }

      const activeMB = Number((mediaStats.activeBytes / (1024 * 1024)).toFixed(2));
      const activeGB = Number((mediaStats.activeBytes / (1024 * 1024 * 1024)).toFixed(3));

      let percentageUsed: number | null = null;
      if (storageLimitMB && storageLimitMB > 0) {
        const limitBytes = storageLimitMB * 1024 * 1024;
        percentageUsed = Math.min(100, Number(((mediaStats.activeBytes / limitBytes) * 100).toFixed(1)));
      }

      return {
        id: user.id,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        email: user.email,
        avatarUrl: user.avatarUrl,
        status: user.status,
        systemRole: user.systemRole,
        createdAt: user.createdAt.toISOString(),
        lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
        workspace: workspace
          ? {
              id: workspace.id,
              name: workspace.name,
              slug: workspace.slug,
              status: workspace.status,
            }
          : null,
        plan: {
          code: planCode,
          name: planName,
          storageLimitMB,
          monthlyPostLimit,
        },
        posts: {
          total: postStats.total,
          published: postStats.published,
          scheduled: postStats.scheduled,
          failed: postStats.failed,
          draft: postStats.draft,
        },
        storage: {
          totalFiles: mediaStats.totalFiles,
          videoFiles: mediaStats.videoFiles,
          imageFiles: mediaStats.imageFiles,
          activeBytes: mediaStats.activeBytes,
          activeMB,
          activeGB,
          totalUploadedBytes: mediaStats.totalUploadedBytes,
          archivedFiles: mediaStats.archivedFiles,
          archivedBytes: mediaStats.archivedBytes,
          storageLimitMB,
          percentageUsed,
        },
        platforms: postStats.platforms,
        connectedAccountsCount: accountsCount,
      };
    })
  );

  // Sorting
  items.sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'storage':
        comparison = a.storage.activeBytes - b.storage.activeBytes;
        break;
      case 'posts':
        comparison = a.posts.total - b.posts.total;
        break;
      case 'published':
        comparison = a.posts.published - b.posts.published;
        break;
      case 'scheduled':
        comparison = a.posts.scheduled - b.posts.scheduled;
        break;
      case 'videos':
        comparison = a.storage.videoFiles - b.storage.videoFiles;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      default:
        comparison = a.storage.activeBytes - b.storage.activeBytes;
    }
    return order === 'desc' ? -comparison : comparison;
  });

  return items;
}

/**
 * Fetch detailed usage and storage statistics for a single user with date filtering
 */
export async function getSuperAdminUserUsageDetail(
  userId: string,
  dateRange = 'all'
): Promise<UserUsageDetail | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      avatarUrl: true,
      systemRole: true,
      status: true,
      createdAt: true,
      lastActiveAt: true,
      workspaces: {
        select: {
          role: true,
          workspace: {
            select: {
              id: true,
              name: true,
              slug: true,
              plan: true,
              status: true,
              timezone: true,
              createdAt: true,
            },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!user) return null;

  const workspace = user.workspaces[0]?.workspace || null;
  const workspaceId = workspace?.id || '';

  const startDate = getDateRangeStart(dateRange);

  // Plan info
  let planInfo = {
    code: workspace?.plan || 'FREE',
    name: workspace?.plan || 'Free',
    storageLimitMB: 1000 as number | null,
    monthlyPostLimit: 30 as number | null,
    source: 'DEFAULT',
  };

  if (workspaceId) {
    try {
      const effective = await getEffectivePlan(workspaceId);
      planInfo = {
        code: effective.plan.code,
        name: effective.plan.name,
        storageLimitMB: effective.plan.storageLimitMB,
        monthlyPostLimit: effective.plan.monthlyPostLimit,
        source: effective.source,
      };
    } catch {
      // fallback
    }
  }

  // Query filtered content posts
  const postDateFilter = startDate ? { createdAt: { gte: startDate } } : undefined;

  const [posts, mediaAssets, connectedAccounts, failedJobsList] = await Promise.all([
    workspaceId
      ? prisma.contentPost.findMany({
          where: {
            workspaceId,
            ...postDateFilter,
          },
          include: {
            mediaAsset: {
              select: {
                id: true,
                filename: true,
                mimeType: true,
                size: true,
                url: true,
              },
            },
            platformPosts: {
              select: {
                id: true,
                platform: true,
                status: true,
                externalPostUrl: true,
                errorMessage: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [],
    workspaceId
      ? prisma.mediaAsset.findMany({
          where: {
            workspaceId,
            ...postDateFilter,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : [],
    workspaceId
      ? prisma.socialAccount.findMany({
          where: { workspaceId },
          select: {
            id: true,
            platform: true,
            name: true,
            username: true,
            profileImageUrl: true,
            status: true,
            isMock: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        })
      : [],
    workspaceId
      ? prisma.platformPost.findMany({
          where: {
            status: 'FAILED',
            contentPost: {
              workspaceId,
              ...postDateFilter,
            },
          },
          select: {
            id: true,
            contentPostId: true,
            platform: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
            contentPost: {
              select: {
                title: true,
                masterCaption: true,
              },
            },
          },
          orderBy: { updatedAt: 'desc' },
          take: 20,
        })
      : [],
  ]);

  // Aggregate post metrics
  let postsCreated = 0;
  let postsPublished = 0;
  let postsScheduled = 0;
  let postsFailed = 0;
  let postsDraft = 0;
  let platformAttempts = 0;
  let platformPublished = 0;
  let platformFailed = 0;

  const platformBreakdown: Record<
    string,
    { total: number; published: number; scheduled: number; failed: number; successRate: number }
  > = {};
  for (const plat of SUPPORTED_PLATFORMS) {
    platformBreakdown[plat] = { total: 0, published: 0, scheduled: 0, failed: 0, successRate: 0 };
  }

  for (const post of posts) {
    postsCreated++;
    if (post.status === 'PUBLISHED' || post.status === 'PARTIALLY_FAILED') {
      postsPublished++;
    } else if (post.status === 'SCHEDULED') {
      postsScheduled++;
    } else if (post.status === 'FAILED') {
      postsFailed++;
    } else if (post.status === 'DRAFT') {
      postsDraft++;
    }

    for (const pp of post.platformPosts) {
      platformAttempts++;
      const platKey = pp.platform?.toUpperCase() || 'OTHER';
      if (!platformBreakdown[platKey]) {
        platformBreakdown[platKey] = { total: 0, published: 0, scheduled: 0, failed: 0, successRate: 0 };
      }
      platformBreakdown[platKey].total++;

      if (pp.status === 'PUBLISHED') {
        platformPublished++;
        platformBreakdown[platKey].published++;
      } else if (pp.status === 'SCHEDULED' || pp.status === 'QUEUED' || pp.status === 'PROCESSING') {
        platformBreakdown[platKey].scheduled++;
      } else if (pp.status === 'FAILED') {
        platformFailed++;
        platformBreakdown[platKey].failed++;
      }
    }
  }

  // Calculate success rates
  for (const platKey of Object.keys(platformBreakdown)) {
    const item = platformBreakdown[platKey];
    item.successRate = item.total > 0 ? Number(((item.published / item.total) * 100).toFixed(1)) : 0;
  }

  // Aggregate media metrics
  let videosUploaded = 0;
  let imagesUploaded = 0;
  let activeStorageBytes = 0;

  for (const asset of mediaAssets) {
    const isArchived = asset.url.startsWith('archived://') || asset.url.startsWith('archived_retry://');
    if (!isArchived) {
      activeStorageBytes += asset.size || 0;
      if (asset.mimeType?.startsWith('video/')) {
        videosUploaded++;
      } else if (asset.mimeType?.startsWith('image/')) {
        imagesUploaded++;
      }
    }
  }

  const activeStorageMB = Number((activeStorageBytes / (1024 * 1024)).toFixed(2));
  const activeStorageGB = Number((activeStorageBytes / (1024 * 1024 * 1024)).toFixed(3));

  let storagePercentageUsed: number | null = null;
  if (planInfo.storageLimitMB && planInfo.storageLimitMB > 0) {
    const limitBytes = planInfo.storageLimitMB * 1024 * 1024;
    storagePercentageUsed = Math.min(100, Number(((activeStorageBytes / limitBytes) * 100).toFixed(1)));
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      systemRole: user.systemRole,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
    },
    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
          plan: workspace.plan,
          status: workspace.status,
          timezone: workspace.timezone,
          createdAt: workspace.createdAt.toISOString(),
        }
      : null,
    plan: planInfo,
    dateRange,
    summary: {
      postsCreated,
      postsPublished,
      postsScheduled,
      postsFailed,
      postsDraft,
      platformAttempts,
      platformPublished,
      platformFailed,
      videosUploaded,
      imagesUploaded,
      totalFilesUploaded: mediaAssets.length,
      activeStorageBytes,
      activeStorageMB,
      activeStorageGB,
      storagePercentageUsed,
    },
    platformBreakdown,
    connectedAccounts: connectedAccounts.map((ca) => ({
      ...ca,
      createdAt: ca.createdAt.toISOString(),
    })),
    recentPosts: posts.slice(0, 15).map((p) => ({
      id: p.id,
      title: p.title,
      masterCaption: p.masterCaption,
      status: p.status,
      scheduledFor: p.scheduledFor ? p.scheduledFor.toISOString() : null,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      mediaAsset: p.mediaAsset,
      platformPosts: p.platformPosts,
    })),
    scheduledPosts: posts
      .filter((p) => p.status === 'SCHEDULED')
      .slice(0, 15)
      .map((p) => ({
        id: p.id,
        title: p.title,
        masterCaption: p.masterCaption,
        status: p.status,
        scheduledFor: p.scheduledFor ? p.scheduledFor.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        platformPosts: p.platformPosts.map((pp) => ({
          id: pp.id,
          platform: pp.platform,
          status: pp.status,
        })),
      })),
    failedJobs: failedJobsList.map((fj) => ({
      id: fj.id,
      contentPostId: fj.contentPostId,
      platform: fj.platform,
      errorMessage: fj.errorMessage,
      postTitle: fj.contentPost?.title || null,
      caption: fj.contentPost?.masterCaption || '',
      createdAt: fj.createdAt.toISOString(),
      updatedAt: fj.updatedAt.toISOString(),
    })),
    uploadHistory: mediaAssets.slice(0, 20).map((ma) => {
      const isArchived = ma.url.startsWith('archived://') || ma.url.startsWith('archived_retry://');
      return {
        id: ma.id,
        filename: ma.filename,
        originalName: ma.originalName,
        mimeType: ma.mimeType,
        size: ma.size,
        sizeFormatted: formatBytes(ma.size),
        url: ma.url,
        isArchived,
        createdAt: ma.createdAt.toISOString(),
      };
    }),
  };
}

/**
 * Fetch global storage overview for Cloudflare R2 monitoring
 */
export async function getSuperAdminGlobalStorageOverview(): Promise<GlobalStorageOverview> {
  const [metrics, workspaces, recentMedia] = await Promise.all([
    getStorageMetrics(),
    prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
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
        mediaAssets: {
          select: {
            id: true,
            mimeType: true,
            size: true,
            url: true,
          },
        },
      },
    }),
    prisma.mediaAsset.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
  ]);

  const topWorkspaces = workspaces
    .map((ws) => {
      let activeBytes = 0;
      let filesCount = 0;
      let videoCount = 0;
      let imageCount = 0;

      for (const asset of ws.mediaAssets) {
        const isArchived = asset.url.startsWith('archived://') || asset.url.startsWith('archived_retry://');
        if (!isArchived) {
          activeBytes += asset.size || 0;
          filesCount++;
          if (asset.mimeType?.startsWith('video/')) videoCount++;
          if (asset.mimeType?.startsWith('image/')) imageCount++;
        }
      }

      const activeMB = Number((activeBytes / (1024 * 1024)).toFixed(2));
      const activeGB = Number((activeBytes / (1024 * 1024 * 1024)).toFixed(3));
      const owner = ws.members[0]?.user;

      return {
        workspaceId: ws.id,
        workspaceName: ws.name,
        userEmail: owner?.email || 'N/A',
        userName: `${owner?.firstName || ''} ${owner?.lastName || ''}`.trim() || 'N/A',
        activeBytes,
        activeMB,
        activeGB,
        filesCount,
        videoCount,
        imageCount,
      };
    })
    .sort((a, b) => b.activeBytes - a.activeBytes)
    .slice(0, 10);

  const formattedRecent = recentMedia.map((m) => {
    const isArchived = m.url.startsWith('archived://') || m.url.startsWith('archived_retry://');
    return {
      id: m.id,
      workspaceId: m.workspaceId,
      workspaceName: m.workspace.name,
      filename: m.filename,
      originalName: m.originalName,
      mimeType: m.mimeType,
      size: m.size,
      sizeFormatted: formatBytes(m.size),
      url: m.url,
      isArchived,
      createdAt: m.createdAt.toISOString(),
    };
  });

  return {
    metrics,
    topWorkspacesByStorage: topWorkspaces,
    recentUploads: formattedRecent,
  };
}
