import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import {
  CampaignStoreError,
  type CampaignArtifact,
  type CampaignStore,
  type MarketingCampaign,
} from "./campaign-store.ts";
import type { GenerateMarketingVideoInput, GenerateMarketingVideoOutput } from "./studio.ts";

export type CampaignRenderer = (input: GenerateMarketingVideoInput) => Promise<GenerateMarketingVideoOutput>;

export interface CampaignRenderResult extends GenerateMarketingVideoOutput {
  campaignId: string;
  artifactId: string;
  renderKey: string;
  reused: boolean;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonical(item)]),
  );
}

export function marketingRenderKey(
  campaign: MarketingCampaign,
  input: GenerateMarketingVideoInput & { targetDurationSeconds: number },
): string {
  return createHash("sha256").update(JSON.stringify(canonical({
    campaignId: campaign.id,
    revision: campaign.revision,
    input,
    sourceArtifacts: campaign.artifacts
      .filter((artifact) => artifact.type === "image" || artifact.type === "script")
      .map((artifact) => ({ id: artifact.id, sha256: artifact.sha256 })),
  }))).digest("hex");
}

function artifactOutput(
  campaign: MarketingCampaign,
  artifact: CampaignArtifact,
  renderKey: string,
  reused: boolean,
): CampaignRenderResult {
  const value = (key: string) => artifact.metadata[key];
  return {
    campaignId: campaign.id,
    artifactId: artifact.id,
    renderKey,
    reused,
    campaignSlug: String(value("campaignSlug") ?? campaign.slug),
    videoPath: artifact.path,
    mixedAudioPath: String(value("mixedAudioPath") ?? ""),
    speechAudioPath: String(value("speechAudioPath") ?? ""),
    width: Number(value("width") ?? 0),
    height: Number(value("height") ?? 0),
    durationSeconds: Number(value("durationSeconds") ?? 0),
    narrationSeconds: Number(value("narrationSeconds") ?? 0),
    bytes: artifact.bytes,
    ratio: value("ratio") === "16:9" ? "16:9" : "9:16",
    nextStepHint: String(value("nextStepHint") ?? "Reuse this ready video artifact."),
  };
}

export async function renderApprovedCampaign(
  store: CampaignStore,
  campaignId: string,
  input: GenerateMarketingVideoInput & { targetDurationSeconds: number },
  render: CampaignRenderer,
): Promise<CampaignRenderResult> {
  const campaign = store.get(campaignId);
  if (input.campaignSlug !== campaign.slug) {
    throw new CampaignStoreError(`Render campaign slug ${input.campaignSlug} does not match ${campaign.slug}`);
  }
  const renderKey = marketingRenderKey(campaign, input);
  const existing = store.findArtifactByOperation(campaign.id, renderKey);
  if (existing?.type === "video" && existsSync(existing.path)) {
    return artifactOutput(campaign, existing, renderKey, true);
  }
  if (campaign.status === "failed") {
    store.transition(campaign.id, "assets_ready");
  }
  if (campaign.status !== "assets_ready") {
    throw new CampaignStoreError(`Campaign must be assets_ready before rendering; current status is ${campaign.status}`);
  }

  store.beginOperation(campaign.id, renderKey, "render");
  store.transition(campaign.id, "rendering");
  try {
    const output = await render(input);
    const artifact = store.registerArtifact(campaign.id, {
      type: "video",
      path: output.videoPath,
      operationKey: renderKey,
      metadata: {
        campaignSlug: output.campaignSlug,
        mixedAudioPath: output.mixedAudioPath,
        speechAudioPath: output.speechAudioPath,
        width: output.width,
        height: output.height,
        durationSeconds: output.durationSeconds,
        narrationSeconds: output.narrationSeconds,
        ratio: output.ratio,
        nextStepHint: output.nextStepHint,
      },
    });
    store.finishOperation(campaign.id, renderKey, artifact.id);
    const ready = store.transition(campaign.id, "ready");
    return artifactOutput(ready, artifact, renderKey, false);
  } catch (error) {
    store.failOperation(campaign.id, renderKey);
    store.fail(campaign.id, "rendering");
    throw error;
  }
}
