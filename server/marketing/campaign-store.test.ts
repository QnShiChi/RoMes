import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { MarketingBrief } from "./brief.ts";
import { CampaignStoreError, createCampaignStore } from "./campaign-store.ts";

const completeBrief: MarketingBrief = {
  topic: "AI Agent",
  goal: "lead generation",
  audience: "SME owners",
  platform: "tiktok",
  style: "modern tech",
  targetDurationSeconds: 60,
  callToAction: "Đăng ký demo",
};

describe("campaign store", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), "omb-marketing-campaign-"));
    roots.push(root);
    return { root, store: createCampaignStore(root, () => "2026-11-03T00:00:00.000Z") };
  };

  it("persists approval and refuses an invalid state transition", () => {
    const { root, store } = fixture();
    const created = store.prepare("AI Agent", completeBrief);
    expect(created).toMatchObject({ id: "ai-agent", slug: "ai-agent", revision: 1, status: "needs_brief" });
    expect(store.approve(created.id, created.revision).status).toBe("approved");
    expect(() => store.transition(created.id, "published")).toThrow(/cannot transition/i);
    expect(JSON.parse(readFileSync(join(root, "ai-agent", "campaign.json"), "utf8"))).toMatchObject({
      schemaVersion: 1,
      id: "ai-agent",
      status: "approved",
    });
  });

  it("registers a ready video once for the same operation", () => {
    const { root, store } = fixture();
    const campaign = store.prepare("ai-agent", completeBrief);
    store.approve(campaign.id, campaign.revision);
    store.transition(campaign.id, "assets_ready");
    store.beginOperation(campaign.id, "render-1", "render");
    store.transition(campaign.id, "rendering");
    const videoPath = join(root, "ai-agent", "video.mp4");
    writeFileSync(videoPath, "video");
    const input = {
      type: "video" as const,
      path: videoPath,
      operationKey: "render-1",
      metadata: { durationSeconds: 60, width: 1080, height: 1920 },
    };
    const artifact = store.registerArtifact(campaign.id, input);
    store.finishOperation(campaign.id, "render-1", artifact.id);
    store.transition(campaign.id, "ready");
    expect(store.resolveLatestReadyVideo(campaign.id)?.id).toBe(artifact.id);
    expect(store.registerArtifact(campaign.id, input).id).toBe(artifact.id);
    expect(store.get(campaign.id).artifacts).toHaveLength(1);
  });

  it("refuses artifacts outside the campaign directory", () => {
    const { root, store } = fixture();
    const campaign = store.prepare("ai-agent", completeBrief);
    const outside = join(root, "outside.mp4");
    writeFileSync(outside, "video");
    expect(() => store.registerArtifact(campaign.id, {
      type: "video",
      path: outside,
      operationKey: "render-1",
      metadata: {},
    })).toThrow(/campaign directory/i);
  });

  it("records the failed stage and permits an explicit safe resume", () => {
    const { store } = fixture();
    const campaign = store.prepare("ai-agent", completeBrief);
    store.approve(campaign.id, campaign.revision);
    store.transition(campaign.id, "assets_ready");
    store.beginOperation(campaign.id, "render-1", "render");
    store.transition(campaign.id, "rendering");
    store.failOperation(campaign.id, "render-1");
    expect(store.fail(campaign.id, "rendering")).toMatchObject({
      status: "failed",
      failedStage: "rendering",
      lastValidStatus: "assets_ready",
    });
    expect(store.transition(campaign.id, "assets_ready").status).toBe("assets_ready");
  });

  it("throws a named error for a corrupt manifest", () => {
    const { root, store } = fixture();
    const campaign = store.prepare("ai-agent", completeBrief);
    writeFileSync(join(root, campaign.slug, "campaign.json"), "{broken", "utf8");
    expect(() => store.get(campaign.id)).toThrow(CampaignStoreError);
  });

  it("increments the revision and resets artifacts when a brief changes", () => {
    const { store } = fixture();
    const first = store.prepare("ai-agent", completeBrief);
    store.approve(first.id, first.revision);
    const second = store.prepare("ai-agent", { ...completeBrief, style: "expert editorial" });
    expect(second).toMatchObject({ revision: 2, status: "needs_brief", artifacts: [], operations: {} });
  });
});
