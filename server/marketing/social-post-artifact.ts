import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { z } from "zod";

import { CampaignStoreError, type CampaignArtifact, type CampaignStore } from "./campaign-store.ts";

const visualPromptSchema = z.object({
  index: z.number().int().positive(),
  label: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(500),
  context: z.string().trim().min(1).max(500),
  action: z.string().trim().min(1).max(500),
  requiredTerms: z.array(z.string().trim().min(1).max(100)).min(1).max(12),
  excludedTerms: z.array(z.string().trim().min(1).max(100)).max(20),
  aspectRatio: z.enum(["1:1", "4:5", "16:9"]),
}).strict();

const marketingPostSchema = z.object({
  campaignId: z.string().trim().min(1),
  revision: z.number().int().positive(),
  platform: z.string().trim().min(1),
  headline: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  callToAction: z.string().trim().min(1).max(1_000),
  hashtags: z.array(z.string().trim().regex(/^#[\p{L}\p{N}_]+$/u)).max(20),
  caption: z.string().trim().min(1).max(25_000),
  visualPrompts: z.array(visualPromptSchema).min(1).max(12),
}).strict();

export type MarketingPostInput = z.infer<typeof marketingPostSchema>;
export type VisualPrompt = z.infer<typeof visualPromptSchema>;

export interface SavedMarketingPost {
  post: MarketingPostInput;
  artifact: CampaignArtifact;
}

function atomicWriteJson(path: string, value: unknown): void {
  const temporary = `${path}.tmp`;
  const descriptor = openSync(temporary, "w", 0o600);
  try {
    writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, undefined, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, path);
}

export function saveMarketingPostArtifact(
  store: CampaignStore,
  assetsRoot: string,
  raw: MarketingPostInput,
): SavedMarketingPost {
  const post = marketingPostSchema.parse(raw);
  let campaign = store.get(post.campaignId);
  if (campaign.revision !== post.revision) {
    throw new CampaignStoreError(`Campaign revision changed from ${post.revision} to ${campaign.revision}`);
  }
  if (campaign.brief.contentType !== "social_post") {
    throw new CampaignStoreError("A social post artifact requires a social_post campaign");
  }
  if (campaign.status !== "approved" && campaign.status !== "scripting") {
    throw new CampaignStoreError(`Campaign must be approved before saving copy; current status is ${campaign.status}`);
  }
  if (post.visualPrompts.length !== campaign.brief.imageCount) {
    throw new CampaignStoreError(`Expected exactly ${campaign.brief.imageCount} visual prompts`);
  }
  post.visualPrompts.forEach((prompt, index) => {
    if (prompt.index !== index + 1) {
      throw new CampaignStoreError("Visual prompt indexes must be consecutive from 1");
    }
  });

  const root = resolve(assetsRoot);
  const campaignDirectory = resolve(root, campaign.slug);
  const relativeDirectory = relative(root, campaignDirectory);
  if (!relativeDirectory || relativeDirectory.startsWith("..") || isAbsolute(relativeDirectory)) {
    throw new CampaignStoreError("Campaign artifact directory is invalid");
  }
  const serialized = `${JSON.stringify(post, null, 2)}\n`;
  const digest = createHash("sha256").update(serialized).digest("hex");
  const path = join(campaignDirectory, `post-r${post.revision}-${digest.slice(0, 16)}.json`);
  if (!existsSync(path)) atomicWriteJson(path, post);
  if (campaign.status === "approved") campaign = store.transition(campaign.id, "scripting");
  const artifact = store.registerArtifact(campaign.id, {
    type: "script",
    path,
    operationKey: `post:${post.revision}:${digest}`,
    metadata: {
      kind: "social_post",
      revision: post.revision,
      platform: post.platform,
      imageCount: post.visualPrompts.length,
    },
  });
  return { post, artifact };
}

export function readMarketingPostArtifact(
  store: CampaignStore,
  campaignId: string,
  artifactId: string,
): SavedMarketingPost {
  const campaign = store.get(campaignId);
  const artifact = campaign.artifacts.find((candidate) =>
    candidate.id === artifactId && candidate.type === "script" && candidate.metadata.kind === "social_post");
  if (!artifact || !existsSync(artifact.path)) {
    throw new CampaignStoreError(`Social post artifact not found: ${artifactId}`);
  }
  try {
    const post = marketingPostSchema.parse(JSON.parse(readFileSync(artifact.path, "utf8")));
    if (post.campaignId !== campaign.id || post.revision !== campaign.revision) {
      throw new Error("artifact campaign or revision does not match");
    }
    return { post, artifact };
  } catch (error) {
    throw new CampaignStoreError(
      `Invalid social post artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function latestMarketingPostArtifact(store: CampaignStore, campaignId: string): CampaignArtifact | null {
  const campaign = store.get(campaignId);
  return campaign.artifacts.findLast((candidate) =>
    candidate.type === "script" &&
    candidate.metadata.kind === "social_post" &&
    candidate.metadata.revision === campaign.revision &&
    existsSync(candidate.path)) ?? null;
}
