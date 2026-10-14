export const SUPPORTED_PLATFORM_IDS = [
  'INSTAGRAM',
  'FACEBOOK',
  'TIKTOK',
  'LINKEDIN',
  'YOUTUBE',
  'X',
  'PINTEREST',
  'SNAPCHAT',
] as const;

export type SupportedPlatformId = (typeof SUPPORTED_PLATFORM_IDS)[number];

export interface SupportedPlatformConfig {
  id: SupportedPlatformId;
  name: string;
  desc: string;
  dashboardName: string;
  dashboardDesc: string;
}

export const SUPPORTED_PLATFORM_CONFIGS: SupportedPlatformConfig[] = [
  {
    id: 'INSTAGRAM',
    name: 'Instagram Business',
    desc: 'Publish feed posts, carousels, and Instagram Reels directly.',
    dashboardName: 'Instagram Business',
    dashboardDesc: 'Feed & Reels',
  },
  {
    id: 'FACEBOOK',
    name: 'Facebook Pages',
    desc: 'Schedule and publish videos, page updates, and Facebook Reels.',
    dashboardName: 'Facebook Pages',
    dashboardDesc: 'Pages & Reels',
  },
  {
    id: 'TIKTOK',
    name: 'TikTok Direct Post',
    desc: 'Broadcast short-form video content to TikTok Creator accounts.',
    dashboardName: 'TikTok Creator',
    dashboardDesc: 'Direct Publishing',
  },
  {
    id: 'LINKEDIN',
    name: 'LinkedIn Organization',
    desc: 'Share thought leadership, company announcements, and rich media.',
    dashboardName: 'LinkedIn Organization',
    dashboardDesc: 'Posts & Articles',
  },
  {
    id: 'YOUTUBE',
    name: 'YouTube Shorts & Videos',
    desc: 'Upload high-definition videos and YouTube Shorts automatically.',
    dashboardName: 'YouTube Channel',
    dashboardDesc: 'Videos & Shorts',
  },
  {
    id: 'X',
    name: 'X',
    desc: 'Publish tweets, threads, and media updates with character safety.',
    dashboardName: 'X',
    dashboardDesc: 'Tweets & Media',
  },
  {
    id: 'PINTEREST',
    name: 'Pinterest',
    desc: 'Publish visual pins with board targeting, descriptions, and links.',
    dashboardName: 'Pinterest',
    dashboardDesc: 'Pins & Boards',
  },
  {
    id: 'SNAPCHAT',
    name: 'Snapchat',
    desc: 'Prepare story-style visual posts for Snapchat audiences.',
    dashboardName: 'Snapchat',
    dashboardDesc: 'Stories & Spotlight',
  },
];

export interface DemoSocialAccount {
  platform: SupportedPlatformId;
  platformAccountId: string;
  name: string;
  username: string;
  profileImageUrl: string;
  status: 'CONNECTED';
  scope: string;
}

export const DEMO_SOCIAL_ACCOUNTS: DemoSocialAccount[] = [
  {
    platform: 'INSTAGRAM',
    platformAccountId: 'ig_brandstudio',
    name: 'Brand Studio Official',
    username: 'brandstudio.io',
    profileImageUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'instagram_basic,instagram_content_publish',
  },
  {
    platform: 'FACEBOOK',
    platformAccountId: 'fb_brandone',
    name: 'Brand One Global',
    username: 'brandoneofficial',
    profileImageUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'pages_manage_posts,pages_read_engagement',
  },
  {
    platform: 'TIKTOK',
    platformAccountId: 'tt_alexrivera',
    name: 'Alex Rivera Studio',
    username: 'alexrivera_official',
    profileImageUrl:
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'user.info.basic,video.publish',
  },
  {
    platform: 'LINKEDIN',
    platformAccountId: 'li_alexrivera',
    name: 'Alex Rivera',
    username: 'alex-rivera-ceo',
    profileImageUrl:
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'w_member_social,openid,profile',
  },
  {
    platform: 'YOUTUBE',
    platformAccountId: 'yt_alexrivera',
    name: 'Alex Rivera Tech & Growth',
    username: 'AlexRiveraOfficial',
    profileImageUrl:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'https://www.googleapis.com/auth/youtube.upload',
  },
  {
    platform: 'X',
    platformAccountId: 'x_alexrivera',
    name: 'Alex Rivera',
    username: 'alexrivera_dev',
    profileImageUrl:
      'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'tweet.read tweet.write users.read offline.access',
  },
  {
    platform: 'PINTEREST',
    platformAccountId: 'pin_brandstudio',
    name: 'Brand Studio',
    username: 'brandstudio',
    profileImageUrl:
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'pins:read,pins:write,boards:read',
  },
  {
    platform: 'SNAPCHAT',
    platformAccountId: 'sc_brandstudio',
    name: 'Brand Studio',
    username: 'brandstudio',
    profileImageUrl:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    status: 'CONNECTED',
    scope: 'snapchat-marketing-api',
  },
];

export const DEMO_SOCIAL_ACCOUNT_BY_PLATFORM = DEMO_SOCIAL_ACCOUNTS.reduce(
  (acc, account) => {
    acc[account.platform] = account;
    return acc;
  },
  {} as Record<SupportedPlatformId, DemoSocialAccount>
);

const PLATFORM_SORT_INDEX = SUPPORTED_PLATFORM_IDS.reduce((acc, platform, index) => {
  acc[platform] = index;
  return acc;
}, {} as Record<string, number>);

const LEGACY_DEMO_MATCHES: Record<
  SupportedPlatformId,
  { names: string[]; usernames: string[] }
> = {
  INSTAGRAM: {
    names: ['Brand Studio Official'],
    usernames: ['brandstudio.io'],
  },
  FACEBOOK: {
    names: ['Brand One Global', 'Brand One Global Page'],
    usernames: ['brandoneofficial'],
  },
  TIKTOK: {
    names: ['Alex Rivera Studio'],
    usernames: ['alexrivera_official'],
  },
  LINKEDIN: {
    names: ['Alex Rivera', 'Alex Rivera (Founder & CEO)'],
    usernames: ['alex-rivera-ceo'],
  },
  YOUTUBE: {
    names: ['Alex Rivera Tech & Growth'],
    usernames: ['AlexRiveraOfficial', '@AlexRiveraOfficial'],
  },
  X: {
    names: ['Alex Rivera'],
    usernames: ['alexrivera_dev'],
  },
  PINTEREST: {
    names: ['Brand Studio'],
    usernames: ['brandstudio'],
  },
  SNAPCHAT: {
    names: ['Brand Studio'],
    usernames: ['brandstudio'],
  },
};

const normalizeUsername = (username: string) =>
  username.trim().replace(/^@+/, '').toLowerCase();

export const getPlatformSortIndex = (platform: string) =>
  PLATFORM_SORT_INDEX[platform] ?? SUPPORTED_PLATFORM_IDS.length;

export const getPlatformDisplayName = (platform: string) =>
  SUPPORTED_PLATFORM_CONFIGS.find((config) => config.id === platform)?.name || platform;

export const sortBySupportedPlatformOrder = <T extends { platform: string; createdAt?: Date }>(
  items: T[]
) =>
  [...items].sort((a, b) => {
    const platformOrder = getPlatformSortIndex(a.platform) - getPlatformSortIndex(b.platform);
    if (platformOrder !== 0) return platformOrder;

    return (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0);
  });

export const isObsoleteDemoSocialAccount = (account: {
  platform: string;
  platformAccountId: string;
  name: string;
  username: string;
  isMock: boolean;
}) => {
  if (!account.isMock || !SUPPORTED_PLATFORM_IDS.includes(account.platform as SupportedPlatformId)) {
    return false;
  }

  const platform = account.platform as SupportedPlatformId;
  const canonical = DEMO_SOCIAL_ACCOUNT_BY_PLATFORM[platform];
  if (account.platformAccountId === canonical.platformAccountId) {
    return false;
  }

  const legacy = LEGACY_DEMO_MATCHES[platform];
  const username = normalizeUsername(account.username);
  const legacyUsernames = legacy.usernames.map(normalizeUsername);

  return legacy.names.includes(account.name) || legacyUsernames.includes(username);
};
