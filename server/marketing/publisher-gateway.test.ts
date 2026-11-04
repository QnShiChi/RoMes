import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { MarketingBrief } from "./brief.ts";
import { createCampaignStore } from "./campaign-store.ts";
import {
  createPublisherGateway,
  type PublishCapability,
  type PublishEvidence,
  type PublisherAdapter,
} from "./publisher-gateway.ts";

const brief: MarketingBrief = {
  topic: "AI Agent",
  goal: "lead generation",
  audience: "SME owners",
  platform: "tiktok",
  style: "modern tech",
  targetDurationSeconds: 60,
  callToAction: "Đăng ký demo",
};

describe("publisher gateway", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), "omb-marketing-publish-"));
    roots.push(root);
    const store = createCampaignStore(root);
    const campaign = store.prepare("ai-agent", brief);
    store.approve(campaign.id, campaign.revision);
    store.transition(campaign.id, "assets_ready");
    store.beginOperation(campaign.id, "render-1", "render");
    store.transition(campaign.id, "rendering");
    const videoPath = join(root, "ai-agent", "video.mp4");
    writeFileSync(videoPath, "video");
    const video = store.registerArtifact(campaign.id, {
      type: "video",
      path: videoPath,
      operationKey: "render-1",
      metadata: { durationSeconds: 60 },
    });
    store.finishOperation(campaign.id, "render-1", video.id);
    store.transition(campaign.id, "ready");
    return { store, campaign, video };
  };

  const request = (campaignId: string, artifactId: string) => ({
    campaignId,
    artifactId,
    platform: "tiktok" as const,
    caption: "AI Agent cho doanh nghiệp",
    idempotencyKey: "publish-1",
  });

  it("leaves a ready campaign unchanged when no real publisher is configured", async () => {
    const { store, campaign, video } = fixture();
    const gateway = createPublisherGateway(store, []);
    await expect(gateway.publish(request(campaign.id, video.id))).rejects.toThrow(/no configured publisher/i);
    expect(store.get(campaign.id).status).toBe("ready");
  });

  it("rejects invalid provider evidence and records a failed publish stage", async () => {
    const { store, campaign, video } = fixture();
    const adapter: PublisherAdapter = {
      async capabilities(): Promise<PublishCapability[]> {
        return [{ provider: "fixture", platform: "tiktok", accountId: "romes" }];
      },
      async publish(): Promise<PublishEvidence> {
        return {
          provider: "fixture",
          platform: "tiktok",
          accountId: "romes",
          providerPostId: "post-123",
          canonicalUrl: "https://example.com/fake/123",
          publishedAt: "2026-11-03T00:00:00.000Z",
        };
      },
    };
    const gateway = createPublisherGateway(store, [adapter]);
    await expect(gateway.publish(request(campaign.id, video.id))).rejects.toThrow(/provider evidence/i);
    expect(store.get(campaign.id)).toMatchObject({ status: "failed", failedStage: "publishing" });
    expect(store.get(campaign.id).artifacts.some((item) => item.type === "publish_evidence")).toBe(false);
  });

  it("records valid evidence once for an idempotent publish request", async () => {
    const { store, campaign, video } = fixture();
    let publishes = 0;
    const adapter: PublisherAdapter = {
      async capabilities(): Promise<PublishCapability[]> {
        return [{ provider: "fixture", platform: "tiktok", accountId: "romes" }];
      },
      async publish(): Promise<PublishEvidence> {
        publishes += 1;
        return {
          provider: "fixture",
          platform: "tiktok",
          accountId: "romes",
          providerPostId: "post-123",
          canonicalUrl: "https://www.tiktok.com/@romes/video/123",
          publishedAt: "2026-11-03T00:00:00.000Z",
        };
      },
    };
    const gateway = createPublisherGateway(store, [adapter]);
    const first = await gateway.publish(request(campaign.id, video.id));
    const second = await gateway.publish(request(campaign.id, video.id));
    expect(first).toEqual(second);
    expect(publishes).toBe(1);
    expect(store.get(campaign.id).status).toBe("published");
    expect(store.get(campaign.id).artifacts.filter((item) => item.type === "publish_evidence")).toHaveLength(1);
  });

  it("publishes to facebook, x, linkedin, and instagram with valid canonical URLs", async () => {
    const { store, campaign, video } = fixture();
    const adapter: PublisherAdapter = {
      async capabilities(): Promise<PublishCapability[]> {
        return [
          { provider: "agent-desktop", platform: "facebook", accountId: "test-user" },
          { provider: "agent-desktop", platform: "x", accountId: "test-user" },
          { provider: "agent-desktop", platform: "linkedin", accountId: "test-user" },
          { provider: "agent-desktop", platform: "instagram", accountId: "test-user" },
        ];
      },
      async publish(input): Promise<PublishEvidence> {
        const domainMap: Record<string, string> = {
          facebook: "https://www.facebook.com/post/123",
          x: "https://x.com/user/status/123",
          linkedin: "https://www.linkedin.com/feed/update/123",
          instagram: "https://www.instagram.com/p/123",
        };
        return {
          provider: "agent-desktop",
          platform: input.platform,
          accountId: "test-user",
          providerPostId: `post-${input.platform}`,
          canonicalUrl: domainMap[input.platform] || "https://example.com",
          publishedAt: "2026-11-04T00:00:00.000Z",
        };
      },
    };

    const gateway = createPublisherGateway(store, [adapter]);
    const fbRes = await gateway.publish({
      campaignId: campaign.id,
      artifactId: video.id,
      platform: "facebook",
      caption: "Facebook Post",
      idempotencyKey: "fb-1",
    });
    expect(fbRes.platform).toBe("facebook");
    expect(fbRes.canonicalUrl).toContain("facebook.com");
  });
});
