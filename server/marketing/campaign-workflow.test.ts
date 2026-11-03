import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { MarketingBrief } from "./brief.ts";
import { createCampaignStore } from "./campaign-store.ts";
import { renderApprovedCampaign } from "./campaign-workflow.ts";
import type { GenerateMarketingVideoInput, GenerateMarketingVideoOutput } from "./studio.ts";

const brief: MarketingBrief = {
  topic: "AI Agent",
  goal: "lead generation",
  audience: "SME owners",
  platform: "tiktok",
  style: "modern tech",
  targetDurationSeconds: 60,
  callToAction: "Đăng ký demo",
};

const input: GenerateMarketingVideoInput & { targetDurationSeconds: number } = {
  campaignSlug: "ai-agent",
  script: "AI Agent giúp doanh nghiệp vận hành hiệu quả hơn.",
  scenes: [
    { type: "hook", title: "AI Agent", durationMs: 30_000 },
    { type: "cta", title: "Đăng ký demo", durationMs: 30_000 },
  ],
  ratio: "9:16",
  targetDurationSeconds: 60,
};

describe("approved campaign rendering", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
  });

  const fixture = (status: "needs_brief" | "approved" | "assets_ready" = "assets_ready") => {
    const root = mkdtempSync(join(tmpdir(), "omb-marketing-render-"));
    roots.push(root);
    const store = createCampaignStore(root);
    const campaign = store.prepare("ai-agent", brief);
    if (status !== "needs_brief") store.approve(campaign.id, campaign.revision);
    if (status === "assets_ready") store.transition(campaign.id, "assets_ready");
    return { root, store, campaign };
  };

  it("renders once and reuses the ready artifact", async () => {
    const { root, store, campaign } = fixture();
    const videoPath = join(root, "ai-agent", "ai-agent-video.mp4");
    let renders = 0;
    const render = async (): Promise<GenerateMarketingVideoOutput> => {
      renders += 1;
      writeFileSync(videoPath, "video-bytes");
      return {
        campaignSlug: "ai-agent",
        videoPath,
        mixedAudioPath: join(root, "ai-agent", "audio.mp3"),
        speechAudioPath: join(root, "ai-agent", "speech.wav"),
        width: 1080,
        height: 1920,
        durationSeconds: 60,
        narrationSeconds: 59,
        bytes: 11,
        ratio: "9:16",
        nextStepHint: "ready",
      };
    };
    const first = await renderApprovedCampaign(store, campaign.id, input, render);
    const second = await renderApprovedCampaign(store, campaign.id, input, render);
    expect(renders).toBe(1);
    expect(first.reused).toBe(false);
    expect(second).toMatchObject({ reused: true, artifactId: first.artifactId, videoPath });
    expect(store.get(campaign.id).status).toBe("ready");
  });

  it.each(["needs_brief", "approved"] as const)("refuses a campaign in %s", async (status) => {
    const { store, campaign } = fixture(status);
    await expect(renderApprovedCampaign(store, campaign.id, input, async () => {
      throw new Error("renderer must not run");
    })).rejects.toThrow(/assets_ready/i);
  });

  it("records a renderer failure without a ready artifact", async () => {
    const { store, campaign } = fixture();
    await expect(renderApprovedCampaign(store, campaign.id, input, async () => {
      throw new Error("render exploded");
    })).rejects.toThrow("render exploded");
    expect(store.get(campaign.id)).toMatchObject({ status: "failed", failedStage: "rendering" });
    expect(store.resolveLatestReadyVideo(campaign.id)).toBeNull();
  });
});
