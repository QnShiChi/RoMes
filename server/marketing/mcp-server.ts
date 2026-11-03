import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { assessMarketingBrief, type MarketingBriefInput } from "./brief.ts";
import { createCampaignStore } from "./campaign-store.ts";
import { renderApprovedCampaign } from "./campaign-workflow.ts";
import { routeMarketingIntent } from "./intent.ts";
import { createPublisherGateway, type PublishPlatform } from "./publisher-gateway.ts";
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
const PUBLISHER = createPublisherGateway(CAMPAIGNS, []);

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
    description: "Validate the marketing brief. Missing decisions return consultation questions and create no campaign.",
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
      },
      required: ["campaignSlug"],
    },
  },
  {
    name: "approve_marketing_campaign",
    description: "Approve exactly the reviewed campaign revision before production starts.",
    inputSchema: {
      type: "object",
      properties: { campaignId: { type: "string" }, revision: { type: "number" } },
      required: ["campaignId", "revision"],
    },
  },
  {
    name: "get_marketing_campaign",
    description: "Read the exact campaign lifecycle and artifact manifest by ID.",
    inputSchema: {
      type: "object",
      properties: { campaignId: { type: "string" } },
      required: ["campaignId"],
    },
  },
  {
    name: "generate_marketing_images",
    description:
      "Generate 1 to 4 high-quality 1408x768 product or lifestyle marketing images using Google AI Studio (Nano Banana 2 Lite / gemini-3.1-flash-lite-image, with multi-turn product consistency) and save them as local .jpg files for chat preview and social upload.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          description: "Approved campaign ID.",
        },
        prompts: {
          type: "array",
          description: "List of 1 to 4 detailed English visual prompts for Flux image generation.",
          items: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "Detailed English description of the scene, product, lighting, and style.",
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
      "Generate a high-converting HTML-based marketing video (9:16 portrait or 16:9 landscape) powered by Google AI Studio Speech, royalty-free BGM with audio ducking, Ken Burns photo zoom, and kinetic animated scenes.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: {
          type: "string",
          description: "Approved campaign ID whose assets are ready.",
        },
        campaignSlug: {
          type: "string",
          description: "Short slug for the campaign (e.g. 'keychron-q1-launch').",
        },
        script: {
          type: "string",
          description: "Full voiceover narration script for Google AI Studio Speech synthesis.",
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
      required: ["campaignId", "campaignSlug", "script", "scenes", "targetDurationSeconds"],
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
    description: "Publish one ready video through a configured provider. Success requires provider evidence.",
    inputSchema: {
      type: "object",
      properties: {
        campaignId: { type: "string" },
        artifactId: { type: "string" },
        platform: { type: "string", enum: ["tiktok", "facebook"] },
        caption: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["campaignId", "artifactId", "platform", "caption", "idempotencyKey"],
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

async function handleCall(name: string, args: Record<string, unknown>) {
  if (name === "route_marketing_request") {
    return {
      content: [{ type: "text", text: JSON.stringify(routeMarketingIntent(String(args.message ?? "")), null, 2) }],
    };
  }

  if (name === "prepare_marketing_campaign") {
    const assessment = assessMarketingBrief(args as MarketingBriefInput);
    if (!assessment.complete) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ needsConsultation: true, ...assessment }, null, 2),
        }],
      };
    }
    const campaign = CAMPAIGNS.prepare(String(args.campaignSlug ?? ""), assessment.brief);
    return { content: [{ type: "text", text: JSON.stringify(campaign, null, 2) }] };
  }

  if (name === "approve_marketing_campaign") {
    const campaign = CAMPAIGNS.approve(String(args.campaignId ?? ""), Number(args.revision));
    return { content: [{ type: "text", text: JSON.stringify(campaign, null, 2) }] };
  }

  if (name === "get_marketing_campaign") {
    const campaign = CAMPAIGNS.get(String(args.campaignId ?? ""));
    return { content: [{ type: "text", text: JSON.stringify(campaign, null, 2) }] };
  }

  if (name === "generate_marketing_images") {
    const campaign = CAMPAIGNS.get(String(args.campaignId ?? ""));
    if (campaign.status !== "approved" && campaign.status !== "scripting" && campaign.status !== "assets_ready") {
      throw new Error(`Campaign must be approved before image generation; current status is ${campaign.status}`);
    }
    const prompts = (Array.isArray(args.prompts) ? args.prompts : []) as ImagePromptSpec[];
    if (prompts.length === 0) throw new Error("At least one image prompt is required");
    const batchKey = `images:${createHash("sha256").update(JSON.stringify(prompts)).digest("hex")}`;
    const current = CAMPAIGNS.get(campaign.id);
    const reusable = current.artifacts.filter((artifact) => artifact.type === "image" && artifact.operationKey.startsWith(`${batchKey}:`) && existsSync(artifact.path));
    if (reusable.length === prompts.length) {
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
    if (CAMPAIGNS.get(campaign.id).status === "scripting") CAMPAIGNS.transition(campaign.id, "assets_ready");
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
    const campaignId = String(args.campaignId ?? "");
    const targetDurationSeconds = Number(args.targetDurationSeconds);
    if (!Number.isFinite(targetDurationSeconds) || targetDurationSeconds <= 0) {
      throw new Error("targetDurationSeconds must be a positive number");
    }
    const input = {
      ...(args as unknown as GenerateMarketingVideoInput),
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
    const campaign = CAMPAIGNS.get(String(args.campaignId ?? ""));
    const type = String(args.type ?? "");
    const artifact = type === "video"
      ? CAMPAIGNS.resolveLatestReadyVideo(campaign.id)
      : campaign.artifacts.findLast((candidate) => candidate.type === type && existsSync(candidate.path)) ?? null;
    if (!artifact) throw new Error(`No ready ${type} artifact exists for campaign ${campaign.id}`);
    return { content: [{ type: "text", text: JSON.stringify(artifact, null, 2) }] };
  }

  if (name === "get_marketing_publish_capabilities") {
    const capabilities = await PUBLISHER.capabilities();
    return { content: [{ type: "text", text: JSON.stringify({ capabilities }, null, 2) }] };
  }

  if (name === "publish_marketing_artifact") {
    const campaign = CAMPAIGNS.get(String(args.campaignId ?? ""));
    const artifactId = String(args.artifactId ?? "");
    const artifact = campaign.artifacts.find((candidate) => candidate.id === artifactId && candidate.type === "video");
    if (!artifact || !existsSync(artifact.path)) throw new Error(`Ready video artifact not found: ${artifactId}`);
    const platform = String(args.platform ?? "") as PublishPlatform;
    const capabilities = await PUBLISHER.capabilities();
    if (!capabilities.some((capability) => capability.platform === platform)) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            published: false,
            reason: "no_configured_publisher",
            message: `No real ${platform} publisher is configured. Reuse the ready video artifact for manual upload.`,
            artifact: { id: artifact.id, path: artifact.path },
          }, null, 2),
        }],
      };
    }
    const evidence = await PUBLISHER.publish({
      campaignId: campaign.id,
      artifactId,
      platform,
      caption: String(args.caption ?? ""),
      idempotencyKey: String(args.idempotencyKey ?? ""),
    });
    return { content: [{ type: "text", text: JSON.stringify({ published: true, evidence }, null, 2) }] };
  }

  if (name === "save_marketing_draft") {
    const draft = await saveMarketingDraft(ASSETS_ROOT, {
      campaignSlug: String(args.campaignSlug ?? "campaign"),
      productName: String(args.productName ?? ""),
      targetPlatforms: Array.isArray(args.targetPlatforms) ? args.targetPlatforms.map(String) : [],
      posts: (Array.isArray(args.posts) ? args.posts : []) as MarketingPostDraft[],
    });
    return {
      content: [{ type: "text", text: JSON.stringify(draft, null, 2) }],
    };
  }

  if (name === "get_marketing_draft") {
    const draft = await getMarketingDraft(ASSETS_ROOT, String(args.campaignSlug ?? ""));
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
