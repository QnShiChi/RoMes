import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { assessMarketingBrief, type MarketingBriefInput } from "./brief.ts";
import { CampaignStoreError, createCampaignStore } from "./campaign-store.ts";
import { renderApprovedCampaign } from "./campaign-workflow.ts";
import { routeMarketingIntent } from "./intent.ts";
import { createPublisherGateway, type PublishPlatform } from "./publisher-gateway.ts";
import { AgentDesktopPublisherAdapter } from "./social-scripts/publisher-adapter.ts";
import {
  latestMarketingPostArtifact,
  readMarketingPostArtifact,
  saveMarketingPostArtifact,
  type MarketingPostInput,
} from "./social-post-artifact.ts";
import {
  generateMarketingImages,
  generateMarketingVideoWorkflow,
  getMarketingDraft,
  saveMarketingDraft,
  type GenerateMarketingVideoInput,
  type ImagePromptSpec,
  type MarketingPostDraft,
} from "./studio.ts";

const ASSETS_ROOT =
  process.env.MARKETING_ASSETS_ROOT?.trim() ||
  process.env.OMB_MARKETING_ASSETS_ROOT?.trim() ||
  join(homedir(), ".openmausbot", "workspaces", "default", "marketing-assets");

const BASE_URL =
  process.env.POLLINATIONS_BASE_URL?.trim() ||
  process.env.OMB_POLLINATIONS_BASE_URL?.trim() ||
  undefined;

const CAMPAIGNS = createCampaignStore(ASSETS_ROOT);
const DESKTOP_ADAPTERS =
  process.env.OMB_ENABLE_DESKTOP_PUBLISHER === "1" || process.env.NODE_ENV !== "test"
    ? [new AgentDesktopPublisherAdapter()]
    : [];
const PUBLISHER = createPublisherGateway(CAMPAIGNS, DESKTOP_ADAPTERS);

const TOOLS = [
  {
    name: "route_marketing_request",
    description: "Classify a marketing request before choosing any production or publishing action.",
    inputSchema: {
      type: "object",
      properties: { message: { type: "string" } },
      required: ["message"],
    },
  },
  {
    name: "prepare_marketing_campaign",
    description: "Validate the marketing brief. A complete brief remains blocked until the exact nextAction approval tool call succeeds; do not delegate production before approval.",
    inputSchema: {
      type: "object",
      properties: {
        campaignSlug: { type: "string" },
        topic: { type: "string" },
        goal: { type: "string" },
        audience: { type: "string" },
        platform: { type: "string" },
        style: { type: "string" },
        targetDurationSeconds: { type: "number" },
        callToAction: { type: "string" },
        contentType: {
          type: "string",
          enum: ["social_post", "video_campaign"],
          description: "Use 'social_post' for Facebook, LinkedIn, Instagram written articles; use 'video_campaign' for video clips.",
        },
        imageCount: {
          type: "number",
          description: "Exact number of commercial images to generate (e.g. 1 cover, 3 or 4 carousel images).",
        },
        fieldSources: {
          type: "object",
          description: "For every supplied brief field, mark whether it came from the user's words or is a proposed default.",
          properties: Object.fromEntries([
            "topic",
            "goal",
            "audience",
            "platform",
            "style",
            "targetDurationSeconds",
            "callToAction",
            "contentType",
            "imageCount",
          ].map((field) => [field, { type: "string", enum: ["user", "proposed_default"] }])),
        },
      },
      required: ["campaignSlug", "fieldSources"],
    },
  },
  {
    name: "approve_marketing_campaign",
    description: "Approve exactly the reviewed campaign revision before production starts. Use the campaignId and revision returned by prepare_marketing_campaign, never an assignment, request, or thread ID.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          description: "Campaign slug ID returned by prepare_marketing_campaign (e.g. 'keychron-q1'). Never an assignment, request, or thread ID.",
        },
        revision: { type: "number" },
      },
      required: ["campaignId", "revision"],
    },
  },
  {
    name: "get_marketing_campaign",
    description: "Read the exact campaign lifecycle and artifact manifest by campaign slug ID (e.g. 'keychron-q1'). Returns found: false if the campaign does not exist. Never pass a request ID, thread ID, or UUID.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          description: "Campaign slug ID returned by prepare_marketing_campaign (e.g. 'keychron-q1'). Must not be a UUID, thread ID, or request ID.",
        },
      },
      required: ["campaignId"],
    },
  },
  {
    name: "save_marketing_post",
    description: "Validate and persist Poppy's exact social post and visual directions for one approved campaign revision before Finch starts.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        revision: { type: "number" },
        platform: { type: "string" },
        headline: { type: "string" },
        body: { type: "string" },
        callToAction: { type: "string" },
        hashtags: { type: "array", items: { type: "string" } },
        caption: { type: "string" },
        visualPrompts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              index: { type: "number" },
              label: { type: "string" },
              subject: { type: "string" },
              context: { type: "string" },
              action: { type: "string" },
              requiredTerms: { type: "array", items: { type: "string" } },
              excludedTerms: { type: "array", items: { type: "string" } },
              aspectRatio: { type: "string", enum: ["1:1", "4:5", "16:9"] },
            },
            required: ["index", "label", "subject", "context", "action", "requiredTerms", "excludedTerms", "aspectRatio"],
          },
        },
      },
      required: ["campaignId", "revision", "platform", "headline", "body", "callToAction", "hashtags", "caption", "visualPrompts"],
    },
  },
  {
    name: "get_marketing_post",
    description: "Load one exact persisted social-post artifact by campaign and artifact ID (or latest if omitted).",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        artifactId: { type: "string" },
      },
      required: ["campaignId"],
    },
  },
  {
    name: "generate_marketing_images",
    description:
      "Search for 1 to 12 relevant real marketing images, validate and save them locally for chat preview and social upload.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          description: "Approved campaign slug ID (e.g. 'keychron-q1'). Must not be a UUID, thread ID, or request ID.",
        },
        prompts: {
          type: "array",
          description: "List of 1 to 12 precise English search descriptions corresponding to the persisted visual directions.",
          items: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Specific search description including subject, context, action, required terms, and exclusions.",
              },
              label: {
                type: "string",
                description: "Short caption or angle name (e.g. 'Ảnh 1: Studio Shot').",
              },
              width: { type: "number", description: "Width in pixels (default 1024)." },
              height: { type: "number", description: "Height in pixels (default 1024)." },
            },
            required: ["prompt"],
          },
        },
      },
      required: ["campaignId", "prompts"],
    },
  },
  {
    name: "generate_marketing_video",
    description:
      "Generate a high-converting marketing video (9:16 portrait or 16:9 landscape) powered by Google AI Studio Speech, royalty-free BGM with audio ducking, native 2.5D camera motion, and kinetic ASS subtitles.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          description: "Approved campaign slug ID (e.g. 'keychron-q1') whose assets are ready. Must not be a UUID, thread ID, or request ID.",
        },
        campaignSlug: {
          type: "string",
          description: "Short slug for the campaign (e.g. 'keychron-q1-launch').",
        },
        script: {
          type: "string",
          description: "Full voiceover narration script for Google AI Studio Speech synthesis.",
        },
        beats: {
          type: "array",
          description: "List of 8 to 12 narrative beats (3 to 5 seconds each) with voiceover narration, visualPrompt, and cameraMotion.",
          items: {
            type: "object",
            properties: {
              beatIndex: { type: "number" },
              durationEstimateMs: { type: "number" },
              narration: { type: "string" },
              visualPrompt: { type: "string" },
              cameraMotion: {
                type: "string",
                enum: ["slow_zoom_in", "slow_zoom_out", "punch_in", "pan_left", "pan_right", "static_drift"],
              },
              keywordHighlight: { type: "string" },
              imagePath: { type: "string" },
            },
            required: ["beatIndex", "narration", "visualPrompt"],
          },
        },
        scenes: {
          type: "array",
          description:
            "Animated scenes. Each scene type has its own layout; vary them so consecutive scenes look different.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["hook", "problem", "split", "stats", "features", "product", "quote", "cta"],
                description:
                  "hook: full-bleed hero. problem: dark warning card. split: before/after comparison (first 2 bulletPoints are the two sides). stats: big animated numbers (bulletPoints like '10x | Năng suất'). features: staggered cards. product: device mockup. quote: key insight quote. cta: action button.",
              },
              title: { type: "string", description: "Main headline for this scene." },
              subtitle: { type: "string", description: "Supporting subtitle." },
              imagePath: { type: "string", description: "Local path to product image." },
              bulletPoints: { type: "array", items: { type: "string" } },
              durationMs: { type: "number", description: "Duration in ms (e.g. 3000)." },
              subtitles: { type: "array", items: { type: "string" } },
            },
            required: ["type", "title"],
          },
        },
        ratio: {
          type: "string",
          enum: ["9:16", "16:9"],
          description: "Video aspect ratio (default '9:16' for Reels/Shorts/TikTok).",
        },
        bgmTheme: {
          type: "string",
          enum: ["tech", "upbeat", "chill", "luxury"],
          description: "BGM music vibe.",
        },
        voice: {
          type: "string",
          description: "Google AI Studio voice name (e.g. 'Puck', 'Charon', 'Aoede').",
        },
        brandName: { type: "string", description: "Brand name watermark/badge." },
        targetDurationSeconds: {
          type: "number",
          description:
            "Video length the user asked for, in seconds. The video is never shorter than this; write about 2.3 Vietnamese words per second of script to fill it with narration.",
        },
      },
      required: ["campaignId", "campaignSlug", "script"],
    },
  },
  {
    name: "resolve_marketing_artifact",
    description: "Resolve an existing campaign artifact for preview, download, or publishing without regenerating it.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        type: { type: "string", enum: ["script", "image", "speech", "mixed_audio", "video", "publish_evidence"] },
      },
      required: ["campaignId", "type"],
    },
  },
  {
    name: "get_marketing_publish_capabilities",
    description: "List real configured social publishing accounts. An empty list means automatic publishing is unavailable.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "publish_marketing_artifact",
    description:
      "Automated social media publisher. Directly publishes the ready post (with full text copy and all generated images) to the user's Facebook profile/wall, X, LinkedIn, or Instagram via the active browser session. Call this tool immediately whenever the user asks to post to Facebook/FB or publish to social media. No external API credentials required.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        artifactId: { type: "string", description: "Optional artifact ID. If omitted, automatically resolves ready campaign video or images." },
        platform: { type: "string", enum: ["tiktok", "facebook", "x", "linkedin", "instagram"] },
        caption: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["campaignId", "platform", "caption", "idempotencyKey"],
    },
  },
  {
    name: "save_marketing_draft",
    description:
      "Save the drafted marketing copy and generated image file paths for user preview and confirmation before publishing.",
    inputSchema: {
      type: "object",
      properties: {
        campaignSlug: { type: "string" },
        productName: { type: "string" },
        targetPlatforms: { type: "array", items: { type: "string" } },
        posts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              platform: { type: "string" },
              title: { type: "string" },
              body: { type: "string" },
              hashtags: { type: "array", items: { type: "string" } },
              imagePaths: { type: "array", items: { type: "string" } },
            },
            required: ["platform", "body", "imagePaths"],
          },
        },
      },
      required: ["campaignSlug", "productName", "targetPlatforms", "posts"],
    },
  },
  {
    name: "get_marketing_draft",
    description:
      "Load a previously saved marketing draft (including exact post copy and local image paths) once the user confirms publishing.",
    inputSchema: {
      type: "object",
      properties: {
        campaignSlug: { type: "string" },
      },
      required: ["campaignSlug"],
    },
  },
];

function send(message: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function findLatestCampaign(assetsRoot: string): string | null {
  try {
    if (!existsSync(assetsRoot)) return null;
    const entries = readdirSync(assetsRoot, { withFileTypes: true });
    let latest: { id: string; mtime: number } | null = null;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifest = join(assetsRoot, entry.name, "campaign.json");
      if (!existsSync(manifest)) continue;
      try {
        const stat = statSync(manifest);
        const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { id?: string };
        if (parsed.id && (!latest || stat.mtimeMs > latest.mtime)) {
          latest = { id: parsed.id, mtime: stat.mtimeMs };
        }
      } catch {
        continue;
      }
    }
    return latest?.id ?? null;
  } catch {
    return null;
  }
}

function resolveCampaignId(assetsRoot: string, rawId: string): string {
  let trimmed = rawId.trim();
  if (trimmed.startsWith("CAMPAIGN_ID:")) {
    trimmed = trimmed.slice("CAMPAIGN_ID:".length).trim();
  }
  trimmed = trimmed.replace(/^[:\s<]+|[:\s>]+$/g, "");
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
  const isPlaceholder = !trimmed || trimmed === "campaign.id" || trimmed === "campaign-id" || trimmed === "id" || trimmed === "undefined" || trimmed === "null";
  if (isUuid || isPlaceholder) {
    const latest = findLatestCampaign(assetsRoot);
    if (latest) return latest;
  }
  if (existsSync(join(assetsRoot, trimmed, "campaign.json"))) {
    return trimmed;
  }
  try {
    const dirs = readdirSync(assetsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(assetsRoot, d.name, "campaign.json")))
      .map((d) => d.name);
    const prefixMatch = dirs.find((d) => d === trimmed || d.startsWith(trimmed) || trimmed.startsWith(d));
    if (prefixMatch) return prefixMatch;
  } catch {}
  return trimmed;
}

async function handleCall(name: string, args: Record<string, unknown>) {
  if (name === "route_marketing_request") {
    return {
      content: [{ type: "text", text: JSON.stringify(routeMarketingIntent(String(args.message ?? "")), null, 2) }],
    };
  }

  if (name === "prepare_marketing_campaign") {
    const rawArgs = { ...(args as MarketingBriefInput & { campaignSlug?: string }) };
    if (!rawArgs.campaignSlug && typeof rawArgs.topic === "string") {
      rawArgs.campaignSlug = rawArgs.topic
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50) || "marketing-campaign";
    }
    if (rawArgs.topic && rawArgs.goal && !rawArgs.callToAction) {
      rawArgs.callToAction = "Chia sẻ cảm nghĩ của bạn bên dưới bài viết";
      rawArgs.fieldSources = {
        ...rawArgs.fieldSources,
        callToAction: "proposed_default",
      };
    }
    const assessment = assessMarketingBrief(rawArgs);
    if (!assessment.complete) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ needsConsultation: true, ...assessment }, null, 2),
        }],
      };
    }
    const campaign = CAMPAIGNS.prepare(
      String(rawArgs.campaignSlug ?? "marketing-campaign"),
      assessment.brief,
      assessment.sources,
    );
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          ...campaign,
          approvalRequired: true,
          productionBlocked: true,
          nextAction: {
            tool: "approve_marketing_campaign",
            arguments: { campaignId: campaign.id, revision: campaign.revision },
          },
        }, null, 2),
      }],
    };
  }

  if (name === "approve_marketing_campaign") {
    const rawId = String(args.campaignId ?? "").trim();
    const campaignId = resolveCampaignId(ASSETS_ROOT, rawId);
    let existing;
    try {
      existing = CAMPAIGNS.get(campaignId);
    } catch {
      const latest = findLatestCampaign(ASSETS_ROOT);
      if (latest) {
        existing = CAMPAIGNS.get(latest);
      } else {
        throw new Error(`Marketing campaign not found: ${rawId}`);
      }
    }
    if (existing.status === "approved" || existing.status === "scripting" || existing.status === "assets_ready" || existing.status === "ready") {
      return { content: [{ type: "text", text: JSON.stringify(existing, null, 2) }] };
    }
    const revision = Number.isFinite(Number(args.revision)) ? Number(args.revision) : existing.revision;
    const campaign = CAMPAIGNS.approve(existing.id, revision);
    return { content: [{ type: "text", text: JSON.stringify(campaign, null, 2) }] };
  }

  if (name === "get_marketing_campaign") {
    const rawId = String(args.campaignId ?? "").trim();
    const campaignId = resolveCampaignId(ASSETS_ROOT, rawId);
    try {
      const campaign = CAMPAIGNS.get(campaignId);
      return { content: [{ type: "text", text: JSON.stringify({ found: true, ...campaign }, null, 2) }] };
    } catch (error) {
      if (error instanceof CampaignStoreError) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  found: false,
                  campaignId,
                  message: error.message,
                },
                null,
                2,
              ),
            },
          ],
        };
      }
      throw error;
    }
  }

  if (name === "save_marketing_post") {
    const rawId = String(args.campaignId ?? "").trim();
    const campaignId = resolveCampaignId(ASSETS_ROOT, rawId);
    let campaign;
    try {
      campaign = CAMPAIGNS.get(campaignId);
    } catch {
      const latest = findLatestCampaign(ASSETS_ROOT);
      if (latest) campaign = CAMPAIGNS.get(latest);
      else throw new Error(`Marketing campaign not found: ${rawId}`);
    }
    const revision = Number.isFinite(Number(args.revision)) ? Number(args.revision) : campaign.revision;
    const rawPrompts = Array.isArray(args.visualPrompts) ? args.visualPrompts : [];
    const normalizedPrompts = rawPrompts.map((vp: any, idx: number) => ({
      ...vp,
      index: idx + 1,
    }));
    if (normalizedPrompts.length > 0 && campaign.brief.imageCount !== normalizedPrompts.length) {
      campaign.brief.imageCount = normalizedPrompts.length;
    }
    const saved = saveMarketingPostArtifact(CAMPAIGNS, ASSETS_ROOT, {
      ...(args as unknown as MarketingPostInput),
      campaignId: campaign.id,
      revision,
      visualPrompts: normalizedPrompts.length > 0 ? normalizedPrompts : (args.visualPrompts as any),
    });
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          campaignId: campaign.id,
          revision: saved.post.revision,
          artifactId: saved.artifact.id,
          path: saved.artifact.path,
        }, null, 2),
      }],
    };
  }

  if (name === "get_marketing_post") {
    const campaignId = resolveCampaignId(ASSETS_ROOT, String(args.campaignId ?? ""));
    const rawArtifactId = typeof args.artifactId === "string" && args.artifactId.trim() ? args.artifactId.trim() : undefined;
    let saved;
    try {
      saved = readMarketingPostArtifact(CAMPAIGNS, campaignId, rawArtifactId);
    } catch (err) {
      const latestCamp = findLatestCampaign(ASSETS_ROOT);
      if (latestCamp && latestCamp !== campaignId) {
        saved = readMarketingPostArtifact(CAMPAIGNS, latestCamp, rawArtifactId);
      } else {
        throw err;
      }
    }
    return { content: [{ type: "text", text: JSON.stringify(saved, null, 2) }] };
  }

  if (name === "generate_marketing_images") {
    const rawId = String(args.campaignId ?? "").trim();
    const campaignId = resolveCampaignId(ASSETS_ROOT, rawId);
    let campaign;
    try {
      campaign = CAMPAIGNS.get(campaignId);
    } catch {
      const latest = findLatestCampaign(ASSETS_ROOT);
      if (latest) {
        campaign = CAMPAIGNS.get(latest);
      } else {
        throw new Error(`Marketing campaign not found: ${rawId}`);
      }
    }
    if (campaign.status !== "approved" && campaign.status !== "scripting" && campaign.status !== "assets_ready") {
      throw new Error(`Campaign must be approved before image generation; current status is ${campaign.status}`);
    }
    if (campaign.brief.contentType === "social_post" && !latestMarketingPostArtifact(CAMPAIGNS, campaign.id)) {
      throw new Error(`Campaign ${campaign.id} has no persisted social post artifact for revision ${campaign.revision}`);
    }
    let prompts = (Array.isArray(args.prompts) ? args.prompts : []) as ImagePromptSpec[];
    if (prompts.length === 0) {
      const postArt = latestMarketingPostArtifact(CAMPAIGNS, campaign.id);
      if (postArt && existsSync(postArt.path)) {
        try {
          const parsed = JSON.parse(readFileSync(postArt.path, "utf8"));
          if (Array.isArray(parsed.visualPrompts) && parsed.visualPrompts.length > 0) {
            prompts = parsed.visualPrompts.map((vp: any, idx: number) => ({
              prompt: `${vp.subject || ""}. ${vp.context || ""}. ${vp.action || ""}`.trim() || `Professional commercial photo for ${campaign.brief.topic}`,
              label: vp.label || `Image ${idx + 1}`,
            }));
          }
        } catch {}
      }
    }
    if (prompts.length === 0) {
      const count = campaign.brief.imageCount || 3;
      prompts = Array.from({ length: count }, (_, i) => ({
        prompt: `Commercial realistic professional photo representing ${campaign.brief.topic}, high detail, 8k, aspect ratio 1:1, angle ${i + 1}`,
        label: `Image ${i + 1}`,
      }));
    }
    const batchKey = `images:${createHash("sha256").update(JSON.stringify(prompts)).digest("hex")}`;
    const current = CAMPAIGNS.get(campaign.id);
    const reusable = current.artifacts.filter((artifact) => artifact.type === "image" && artifact.operationKey.startsWith(`${batchKey}:`) && existsSync(artifact.path));
    if (reusable.length === prompts.length) {
      const curStatus = CAMPAIGNS.get(campaign.id).status;
      if (curStatus === "scripting" || curStatus === "approved") {
        CAMPAIGNS.transition(campaign.id, "assets_ready");
      }
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            campaignSlug: campaign.slug,
            campaignDir: join(ASSETS_ROOT, campaign.slug),
            images: reusable.map((artifact, index) => ({
              index,
              label: String(artifact.metadata.label ?? `Image ${index + 1}`),
              prompt: String(artifact.metadata.prompt ?? prompts[index]?.prompt ?? ""),
              filePath: artifact.path,
              url: String(artifact.metadata.url ?? ""),
              mimeType: String(artifact.metadata.mimeType ?? "image/jpeg"),
              width: Number(artifact.metadata.width ?? 0),
              height: Number(artifact.metadata.height ?? 0),
              bytes: artifact.bytes,
            })),
            failed: [],
            reused: true,
          }, null, 2),
        }],
      };
    }
    CAMPAIGNS.beginOperation(campaign.id, batchKey, "images");
    if (campaign.status === "approved") CAMPAIGNS.transition(campaign.id, "scripting");
    const output = await generateMarketingImages(
      { campaignSlug: campaign.slug, prompts },
      { assetsRoot: ASSETS_ROOT, ...(BASE_URL ? { baseUrl: BASE_URL } : {}) },
    );
    if (output.images.length === 0) {
      CAMPAIGNS.failOperation(campaign.id, batchKey);
      CAMPAIGNS.fail(campaign.id, "scripting");
      throw new Error("Image generation produced no usable campaign assets");
    }
    const artifacts = output.images.map((image, index) => CAMPAIGNS.registerArtifact(campaign.id, {
      type: "image",
      path: image.filePath,
      operationKey: `${batchKey}:${index}`,
      metadata: {
        label: image.label,
        prompt: image.prompt,
        url: image.url,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
      },
    }));
    CAMPAIGNS.finishOperation(campaign.id, batchKey, artifacts[0]!.id);
    const postStatus = CAMPAIGNS.get(campaign.id).status;
    if (postStatus === "scripting" || postStatus === "approved") {
      CAMPAIGNS.transition(campaign.id, "assets_ready");
      if (campaign.brief.contentType === "social_post") {
        CAMPAIGNS.transition(campaign.id, "ready");
      }
    } else if (postStatus === "assets_ready" && campaign.brief.contentType === "social_post") {
      CAMPAIGNS.transition(campaign.id, "ready");
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...output,
              campaignId: campaign.id,
              artifactIds: artifacts.map((artifact) => artifact.id),
              reused: false,
              nextStepHint:
                "Images generated successfully. Return the list of file paths to RoMes and Momo.",
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (name === "generate_marketing_video") {
    const rawId = String(args.campaignId ?? "").trim();
    const campaignId = resolveCampaignId(ASSETS_ROOT, rawId);
    const targetDurationSeconds = Number(args.targetDurationSeconds);
    if (!Number.isFinite(targetDurationSeconds) || targetDurationSeconds <= 0) {
      throw new Error("targetDurationSeconds must be a positive number");
    }
    const campaign = CAMPAIGNS.get(campaignId);
    const input = {
      ...(args as unknown as GenerateMarketingVideoInput),
      campaignId,
      campaignSlug: campaign.slug,
      targetDurationSeconds,
    };
    const output = await renderApprovedCampaign(
      CAMPAIGNS,
      campaignId,
      input,
      (renderInput) => generateMarketingVideoWorkflow(ASSETS_ROOT, renderInput),
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(output, null, 2),
        },
      ],
    };
  }

  if (name === "resolve_marketing_artifact") {
    const rawId = String(args.campaignId ?? "").trim();
    const campaignId = resolveCampaignId(ASSETS_ROOT, rawId);
    const campaign = CAMPAIGNS.get(campaignId);
    const type = String(args.type ?? "");
    const artifact = type === "video"
      ? CAMPAIGNS.resolveLatestReadyVideo(campaign.id)
      : campaign.artifacts.findLast((candidate) => candidate.type === type && existsSync(candidate.path)) ?? null;
    if (!artifact) {
      if (campaign.brief.contentType === "social_post" && (type === "video" || type === "mixed_audio" || type === "speech")) {
        throw new Error(
          `Campaign ${campaign.id} is a social_post campaign (articles and images). It does not produce ${type} artifacts. Use image artifacts or publish directly.`
        );
      }
      throw new Error(`No ready ${type} artifact exists for campaign ${campaign.id}`);
    }
    return { content: [{ type: "text", text: JSON.stringify(artifact, null, 2) }] };
  }

  if (name === "get_marketing_publish_capabilities") {
    const capabilities = await PUBLISHER.capabilities();
    return { content: [{ type: "text", text: JSON.stringify({ capabilities }, null, 2) }] };
  }

  if (name === "publish_marketing_artifact") {
    const rawId = String(args.campaignId ?? "").trim();
    const campaignId = resolveCampaignId(ASSETS_ROOT, rawId);
    let campaign;
    try {
      campaign = CAMPAIGNS.get(campaignId);
    } catch {
      const latest = findLatestCampaign(ASSETS_ROOT);
      if (latest) campaign = CAMPAIGNS.get(latest);
      else throw new Error(`Ready artifact not found for campaign: ${rawId}`);
    }
    let artifactId = typeof args.artifactId === "string" ? args.artifactId.trim() : "";
    let artifact = campaign.artifacts.find((candidate) => candidate.id === artifactId && existsSync(candidate.path));
    if (!artifact) {
      if (campaign.brief.contentType === "social_post") {
        artifact = campaign.artifacts.find((candidate) => candidate.type === "image" && existsSync(candidate.path));
      } else {
        artifact = CAMPAIGNS.resolveLatestReadyVideo(campaign.id) ?? undefined;
      }
      if (!artifact) {
        artifact = campaign.artifacts.findLast((candidate) => existsSync(candidate.path));
      }
    }
    if (!artifact || !existsSync(artifact.path)) {
      throw new Error(`Ready artifact not found for campaign: ${campaignId}`);
    }
    const rawPlatform = String(args.platform ?? "").toLowerCase();
    const platform = (/fb|facebook/i.test(rawPlatform) ? "facebook" : (rawPlatform || "facebook")) as PublishPlatform;
    const capabilities = await PUBLISHER.capabilities();
    if (!capabilities.some((capability) => capability.platform === platform)) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            published: false,
            reason: "no_configured_publisher",
            message: `No real ${platform} publisher is configured. Reuse the ready ${artifact.type === "video" ? "video" : "post"} artifact for manual upload.`,
            artifact: { id: artifact.id, path: artifact.path },
          }, null, 2),
        }],
      };
    }
    let caption = typeof args.caption === "string" && args.caption.trim() ? args.caption.trim() : "";
    if (!caption) {
      const postArt = latestMarketingPostArtifact(CAMPAIGNS, campaign.id);
      if (postArt && existsSync(postArt.path)) {
        try {
          const parsed = JSON.parse(readFileSync(postArt.path, "utf8"));
          caption = String(parsed.caption || parsed.body || "");
        } catch {}
      }
    }
    const evidence = await PUBLISHER.publish({
      campaignId: campaign.id,
      artifactId: artifact.id,
      platform,
      caption,
      idempotencyKey: String(args.idempotencyKey || `pub-${campaign.id}-${Date.now()}`),
    });
    return { content: [{ type: "text", text: JSON.stringify({ published: true, evidence }, null, 2) }] };
  }

  if (name === "save_marketing_draft") {
    const rawSlug = String(args.campaignSlug ?? "").trim();
    const campaignSlug = resolveCampaignId(ASSETS_ROOT, rawSlug) || "campaign";
    const draft = await saveMarketingDraft(ASSETS_ROOT, {
      campaignSlug,
      productName: String(args.productName ?? ""),
      targetPlatforms: Array.isArray(args.targetPlatforms) ? args.targetPlatforms.map(String) : [],
      posts: (Array.isArray(args.posts) ? args.posts : []) as MarketingPostDraft[],
    });
    return {
      content: [{ type: "text", text: JSON.stringify(draft, null, 2) }],
    };
  }

  if (name === "get_marketing_draft") {
    const rawSlug = String(args.campaignSlug ?? "").trim();
    const campaignSlug = resolveCampaignId(ASSETS_ROOT, rawSlug);
    const draft = await getMarketingDraft(ASSETS_ROOT, campaignSlug);
    return {
      content: [{ type: "text", text: JSON.stringify(draft, null, 2) }],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  let frame: { id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    frame = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (frame.id === undefined) return;

  try {
    if (frame.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: frame.id,
        result: {
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "marketing_studio", version: "1.0.0" },
        },
      });
      return;
    }

    if (frame.method === "tools/list") {
      send({
        jsonrpc: "2.0",
        id: frame.id,
        result: { tools: TOOLS },
      });
      return;
    }

    if (frame.method === "resources/list") {
      send({
        jsonrpc: "2.0",
        id: frame.id,
        result: { resources: [] },
      });
      return;
    }

    if (frame.method === "prompts/list") {
      send({
        jsonrpc: "2.0",
        id: frame.id,
        result: { prompts: [] },
      });
      return;
    }

    if (frame.method === "ping") {
      send({
        jsonrpc: "2.0",
        id: frame.id,
        result: {},
      });
      return;
    }

    if (frame.method === "tools/call") {
      const name = String(frame.params?.name ?? "");
      const args = (frame.params?.arguments ?? {}) as Record<string, unknown>;
      const result = await handleCall(name, args);
      send({ jsonrpc: "2.0", id: frame.id, result });
      return;
    }

    send({
      jsonrpc: "2.0",
      id: frame.id,
      error: { code: -32601, message: `Method not found: ${String(frame.method)}` },
    });
  } catch (error) {
    send({
      jsonrpc: "2.0",
      id: frame.id,
      result: {
        isError: true,
        content: [
          {
            type: "text",
            text: error instanceof Error ? error.message : String(error),
          },
        ],
      },
    });
  }
});
