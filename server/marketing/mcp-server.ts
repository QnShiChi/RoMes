import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { publishPostHeadless, type PublishPlatform } from "./publisher.ts";
import {
  generateMarketingImages,
  generateMarketingVideoWorkflow,
  getMarketingDraft,
  markMarketingPublished,
  saveMarketingDraft,
  type GenerateMarketingVideoInput,
  type ImagePromptSpec,
  type MarketingPostDraft,
  type PublishedPlatformResult,
} from "./studio.ts";

const ASSETS_ROOT =
  process.env.MARKETING_ASSETS_ROOT?.trim() ||
  process.env.OMB_MARKETING_ASSETS_ROOT?.trim() ||
  join(homedir(), ".openmausbot", "workspaces", "default", "marketing-assets");

const BASE_URL =
  process.env.POLLINATIONS_BASE_URL?.trim() ||
  process.env.OMB_POLLINATIONS_BASE_URL?.trim() ||
  undefined;

const TOOLS = [
  {
    name: "generate_marketing_images",
    description:
      "Generate 1 to 4 high-quality 1408x768 product or lifestyle marketing images using Google AI Studio (Nano Banana 2 Lite / gemini-3.1-flash-lite-image, with multi-turn product consistency) and save them as local .jpg files for chat preview and social upload.",
    inputSchema: {
      type: "object",
      properties: {
        campaignSlug: {
          type: "string",
          description: "Short slug for the campaign (e.g. 'iphone-duo-launch').",
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
      required: ["campaignSlug", "prompts"],
    },
  },
  {
    name: "generate_marketing_video",
    description:
      "Generate a high-converting HTML-based marketing video (9:16 portrait or 16:9 landscape) powered by Google AI Studio Speech, royalty-free BGM with audio ducking, Ken Burns photo zoom, and kinetic animated scenes.",
    inputSchema: {
      type: "object",
      properties: {
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
          description: "List of animated scenes (hook, product, features, cta).",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["hook", "product", "features", "cta"],
                description: "Scene type.",
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
      },
      required: ["campaignSlug", "script", "scenes"],
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
  {
    name: "mark_marketing_published",
    description: "Record the final publishing status and post URLs for a marketing campaign.",
    inputSchema: {
      type: "object",
      properties: {
        campaignSlug: { type: "string" },
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              platform: { type: "string" },
              status: { type: "string", enum: ["published", "failed"] },
              url: { type: "string" },
              note: { type: "string" },
            },
            required: ["platform", "status"],
          },
        },
      },
      required: ["campaignSlug", "results"],
    },
  },
  {
    name: "publish_post",
    description:
      "Publish marketing content (video, image gallery, or text copy) headlessly to TikTok or Facebook without interactive browser steps.",
    inputSchema: {
      type: "object",
      properties: {
        platform: {
          type: "string",
          enum: ["tiktok", "facebook"],
          description: "Target social media platform.",
        },
        videoPath: {
          type: "string",
          description: "Optional absolute local path to the rendered .mp4 video.",
        },
        imagePaths: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of local image paths for photo posts.",
        },
        caption: {
          type: "string",
          description: "Post caption text.",
        },
        hashtags: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of hashtags.",
        },
      },
      required: ["platform", "caption"],
    },
  },
];

function send(message: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function handleCall(name: string, args: Record<string, unknown>) {
  if (name === "generate_marketing_images") {
    const campaignSlug = String(args.campaignSlug ?? "campaign");
    const prompts = (Array.isArray(args.prompts) ? args.prompts : []) as ImagePromptSpec[];
    const output = await generateMarketingImages(
      { campaignSlug, prompts },
      { assetsRoot: ASSETS_ROOT, ...(BASE_URL ? { baseUrl: BASE_URL } : {}) },
    );
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...output,
              nextStepHint:
                'Call agents_attach_file with {"path": filePath} (pass ONLY "path", do NOT pass "caption") for each image so the user sees the image gallery directly in chat, then present the copy and wait for confirmation before publishing.',
            },
            null,
            2,
          ),
        },
      ],
    };
  }

  if (name === "generate_marketing_video") {
    const output = await generateMarketingVideoWorkflow(
      ASSETS_ROOT,
      args as unknown as GenerateMarketingVideoInput,
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

  if (name === "mark_marketing_published") {
    const draft = await markMarketingPublished(ASSETS_ROOT, {
      campaignSlug: String(args.campaignSlug ?? ""),
      results: (Array.isArray(args.results) ? args.results : []) as PublishedPlatformResult[],
    });
    return {
      content: [{ type: "text", text: JSON.stringify(draft, null, 2) }],
    };
  }

  if (name === "publish_post" || name === "marketing_studio_publish_post") {
    const platform = (args.platform === "facebook" ? "facebook" : "tiktok") as PublishPlatform;
    const videoPath = args.videoPath ? String(args.videoPath) : undefined;
    const imagePaths = Array.isArray(args.imagePaths) ? args.imagePaths.map(String) : undefined;
    const caption = String(args.caption ?? "");
    const hashtags = Array.isArray(args.hashtags) ? args.hashtags.map(String) : undefined;
    const output = await publishPostHeadless({ platform, videoPath, imagePaths, caption, hashtags });
    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
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
