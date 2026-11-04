import type {
  PublishCapability,
  PublishEvidence,
  PublisherAdapter,
  PublishPlatform,
} from "../publisher-gateway.ts";
import { FacebookPoster } from "./facebook-poster.ts";
import { InstagramPoster } from "./instagram-poster.ts";
import { LinkedInPoster } from "./linkedin-poster.ts";
import type { SocialPostResult } from "./types.ts";
import { XTwitterPoster } from "./x-twitter-poster.ts";

export class AgentDesktopPublisherAdapter implements PublisherAdapter {
  private readonly fb: FacebookPoster;
  private readonly x: XTwitterPoster;
  private readonly li: LinkedInPoster;
  private readonly ig: InstagramPoster;

  constructor(
    fb?: FacebookPoster,
    x?: XTwitterPoster,
    li?: LinkedInPoster,
    ig?: InstagramPoster,
  ) {
    this.fb = fb ?? new FacebookPoster();
    this.x = x ?? new XTwitterPoster();
    this.li = li ?? new LinkedInPoster();
    this.ig = ig ?? new InstagramPoster();
  }

  async capabilities(): Promise<PublishCapability[]> {
    return [
      { provider: "agent-desktop", platform: "facebook", accountId: "active-chrome-session" },
      { provider: "agent-desktop", platform: "x", accountId: "active-chrome-session" },
      { provider: "agent-desktop", platform: "linkedin", accountId: "active-chrome-session" },
      { provider: "agent-desktop", platform: "instagram", accountId: "active-chrome-session" },
    ];
  }

  async publish(input: {
    platform: PublishPlatform;
    videoPath?: string;
    imagePaths?: string[];
    caption: string;
    idempotencyKey: string;
  }): Promise<PublishEvidence> {
    const images = input.imagePaths ?? [];
    let res: SocialPostResult;

    if (input.platform === "facebook") {
      res = await this.fb.publish({ text: input.caption, images, campaignId: input.idempotencyKey });
    } else if (input.platform === "x") {
      res = await this.x.publish({ text: input.caption, images, campaignId: input.idempotencyKey });
    } else if (input.platform === "linkedin") {
      res = await this.li.publish({ text: input.caption, images, campaignId: input.idempotencyKey });
    } else if (input.platform === "instagram") {
      res = await this.ig.publish({ text: input.caption, images, campaignId: input.idempotencyKey });
    } else {
      throw new Error(`Unsupported platform for desktop publisher: ${input.platform}`);
    }

    if (!res.success) {
      throw new Error(`Failed to publish on ${input.platform}: ${res.error ?? "Unknown error"}`);
    }

    const domainUrls: Record<string, string> = {
      facebook: "https://www.facebook.com",
      x: "https://x.com",
      linkedin: "https://www.linkedin.com/feed",
      instagram: "https://www.instagram.com",
    };

    return {
      provider: "agent-desktop",
      platform: input.platform,
      accountId: "active-chrome-session",
      providerPostId: `desktop-${Date.now()}`,
      canonicalUrl: res.postUrl || `${domainUrls[input.platform] || "https://facebook.com"}/posted-${Date.now()}`,
      publishedAt: new Date().toISOString(),
    };
  }
}
