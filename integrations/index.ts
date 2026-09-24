import { ISocialPlatformAdapter, SocialPlatformType, PlatformRequirementInfo } from './types';
import { InstagramAdapter } from './instagram';
import { FacebookAdapter } from './facebook';
import { TikTokAdapter } from './tiktok';
import { LinkedInAdapter } from './linkedin';
import { YouTubeAdapter } from './youtube';
import { XAdapter } from './x';
import { PinterestAdapter } from './pinterest';
import { SnapchatAdapter } from './snapchat';

export * from './types';

class PlatformRegistry {
  private adapters: Map<SocialPlatformType, ISocialPlatformAdapter> = new Map();

  constructor() {
    this.register(new InstagramAdapter());
    this.register(new FacebookAdapter());
    this.register(new TikTokAdapter());
    this.register(new LinkedInAdapter());
    this.register(new YouTubeAdapter());
    this.register(new XAdapter());
    this.register(new PinterestAdapter());
    this.register(new SnapchatAdapter());
  }

  register(adapter: ISocialPlatformAdapter) {
    this.adapters.set(adapter.platform, adapter);
  }

  get(platform: SocialPlatformType): ISocialPlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`Unsupported social platform: ${platform}`);
    }
    return adapter;
  }

  getAllPlatforms(): SocialPlatformType[] {
    return Array.from(this.adapters.keys());
  }

  getAllRequirements(): Record<SocialPlatformType, PlatformRequirementInfo> {
    const requirements: Partial<Record<SocialPlatformType, PlatformRequirementInfo>> = {};
    this.adapters.forEach((adapter, key) => {
      requirements[key] = adapter.getRequirements();
    });
    return requirements as Record<SocialPlatformType, PlatformRequirementInfo>;
  }
}

export const platformRegistry = new PlatformRegistry();
