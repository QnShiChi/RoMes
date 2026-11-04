import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { MarketingBrief, MarketingBriefSources } from "./brief.ts";
import { createCampaignStore } from "./campaign-store.ts";
import {
  readMarketingPostArtifact,
  saveMarketingPostArtifact,
  type MarketingPostInput,
} from "./social-post-artifact.ts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const post: MarketingPostInput = {
  campaignId: "ai-race",
  revision: 1,
  platform: "facebook",
  headline: "Cuộc đua AI của Big Tech",
  body: "AI đang trở thành năng lực vận hành cốt lõi.",
  callToAction: "Bạn đánh giá lợi thế nào quan trọng nhất?",
  hashtags: ["#AI", "#BigTech"],
  caption: "Cuộc đua AI của Big Tech\n\nAI đang trở thành năng lực vận hành cốt lõi.\n\nBạn đánh giá lợi thế nào quan trọng nhất?\n\n#AI #BigTech",
  visualPrompts: [{
    index: 1,
    label: "Hạ tầng AI",
    subject: "hyperscale AI data center",
    context: "enterprise computing infrastructure",
    action: "engineers monitoring GPU clusters",
    requiredTerms: ["AI", "data center", "GPU"],
    excludedTerms: ["illustration", "cartoon", "watermark"],
    aspectRatio: "1:1",
  }],
};

function setupApprovedCampaign(targets: string[], overrides: Partial<MarketingBrief> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "omb-marketing-post-"));
  targets.push(root);
  const store = createCampaignStore(root);
  const brief: MarketingBrief = {
    topic: "Cuộc đua AI",
    goal: "Tăng tương tác",
    audience: "Kỹ sư và sinh viên IT",
    platform: "facebook",
    style: "Phân tích dễ hiểu",
    callToAction: "Bình luận quan điểm của bạn",
    contentType: "social_post",
    imageCount: 1,
    ...overrides,
  };
  const sources = Object.fromEntries(
    Object.keys(brief).map((field) => [field, "user"]),
  ) as MarketingBriefSources;
  const campaign = store.prepare("ai-race", brief, sources);
  store.approve(campaign.id, campaign.revision);
  return root;
}

describe("social post artifact", () => {
  it("persists and reuses the exact approved revision", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    const first = saveMarketingPostArtifact(store, root, post);
    const second = saveMarketingPostArtifact(store, root, post);

    expect(second.artifact.id).toBe(first.artifact.id);
    expect(readMarketingPostArtifact(store, post.campaignId, first.artifact.id).post).toEqual(post);
    expect(readMarketingPostArtifact(store, post.campaignId).post).toEqual(post);
    expect(readMarketingPostArtifact(store, post.campaignId, "latest").post).toEqual(post);
    expect(store.get(post.campaignId).status).toBe("scripting");
  });

  it("requires exactly the campaign image count", () => {
    const root = setupApprovedCampaign(roots, { imageCount: 2 });
    const store = createCampaignStore(root);
    expect(() => saveMarketingPostArtifact(store, root, post)).toThrow(/exactly 2 visual prompts/i);
  });

  it("rejects a stale revision", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    expect(() => saveMarketingPostArtifact(store, root, { ...post, revision: 99 })).toThrow(/revision changed/i);
  });

  it("rejects a corrupt registered post file", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    const saved = saveMarketingPostArtifact(store, root, post);
    writeFileSync(saved.artifact.path, "{broken");
    expect(() => readMarketingPostArtifact(store, post.campaignId, saved.artifact.id)).toThrow(/invalid social post artifact/i);
  });

  it("accepts visual prompts with empty requiredTerms or excludedTerms", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    const postWithEmptyTerms: MarketingPostInput = {
      ...post,
      visualPrompts: [{
        ...post.visualPrompts[0],
        requiredTerms: [],
        excludedTerms: [],
      }],
    };
    const saved = saveMarketingPostArtifact(store, root, postWithEmptyTerms);
    expect(saved.post.visualPrompts[0].requiredTerms).toEqual([]);
    expect(readMarketingPostArtifact(store, post.campaignId).post.visualPrompts[0].requiredTerms).toEqual([]);
  });

  it("accepts post with empty callToAction", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    const postWithEmptyCta: MarketingPostInput = {
      ...post,
      callToAction: "",
    };
    const saved = saveMarketingPostArtifact(store, root, postWithEmptyCta);
    expect(saved.post.callToAction).toBe("");
  });
});
