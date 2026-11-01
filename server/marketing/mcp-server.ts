import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import {
  generateMarketingImages,
  getMarketingDraft,
  markMarketingPublished,
  saveMarketingDraft,
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
