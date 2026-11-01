# Marketing Studio & Hybrid Publishing Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and wire the Marketing Studio MCP server, multi-image Flux generator, draft persistence store, browser automation engine (`agent-browser`), and two-phase Preview & Confirm publishing workflow in OpenMausBot.

**Architecture:** A focused core library (`server/marketing/studio.ts`) handles parallel image generation from Pollinations.ai (`model=flux`), magic-byte image validation, and campaign draft persistence inside the bot's workspace root (`<workspaceDir>/marketing-assets/<campaignSlug>/`) so generated files pass OpenMausBot's `openMessageFile` and `uploadableFiles` security checks. A stdio MCP server (`server/marketing/mcp-server.ts`) exposes these capabilities to any chat turn, while `agent-browser` and Composio/Postiz handle hybrid publishing after user confirmation.

**Tech Stack:** TypeScript (Node `--experimental-strip-types`), Vitest, JSON-RPC 2.0 over stdio (MCP 2025-06-18), Pollinations.ai Flux HTTP API, `agent-browser`.

**Spec:** `docs/superpowers/specs/2026-10-31-marketing-studio-pipeline-design.md`

## Global Constraints

- Follow `AGENTS.md`: write comments only for public contracts or external vendor behavior; never narrate what the next line does.
- Generated images must be stored inside the bot's workspace root (`<workspaceDir>/marketing-assets/<campaignSlug>/`) so both `agents_attach_file`, inline Markdown image previews, and `agent-browser` file uploads are authorized by `messageFileRootsForThread`.
- Every downloaded image buffer must be validated for JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), or WEBP (`RIFF....WEBP`) magic bytes before saving to disk.
- No social post may be published without an explicit user confirmation turn after the preview turn.

---

### Task 1: Core Marketing Studio Library (Multi-Image Flux Generator & Draft Store)

**Files:**
- Create: `server/marketing/studio.ts`
- Test: `server/marketing/studio.test.ts`

**Interfaces:**
- Produces:
  - `generateMarketingImages(input: GenerateImagesInput, options?: GenerateImagesOptions): Promise<GenerateImagesOutput>`
  - `saveMarketingDraft(assetsRoot: string, input: SaveDraftInput): Promise<MarketingDraft>`
  - `getMarketingDraft(assetsRoot: string, campaignSlug: string): Promise<MarketingDraft>`
  - `markMarketingPublished(assetsRoot: string, input: MarkPublishedInput): Promise<MarketingDraft>`
  - `detectImageFormat(bytes: Uint8Array): "jpeg" | "png" | "webp" | null`

- [ ] **Step 1: Write the failing unit tests in `server/marketing/studio.test.ts`**

```ts
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectImageFormat,
  generateMarketingImages,
  getMarketingDraft,
  markMarketingPublished,
  saveMarketingDraft,
} from "./studio.ts";

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe("marketing studio core", () => {
  const dirs: string[] = [];
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-marketing-studio-"));
    dirs.push(dir);
    return dir;
  };

  it("detects valid JPEG, PNG, and WEBP magic bytes and rejects HTML/text", () => {
    expect(detectImageFormat(VALID_JPEG)).toBe("jpeg");
    expect(detectImageFormat(VALID_PNG)).toBe("png");
    expect(detectImageFormat(Buffer.from("<html>error</html>"))).toBeNull();
  });

  it("generates multiple images in parallel, retries transient 502 errors, and saves files to disk", async () => {
    const root = makeTempDir();
    let calls = 0;
    server = createServer((req, res) => {
      calls += 1;
      if (req.url?.includes("flaky") && calls === 1) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end("Bad gateway");
        return;
      }
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(VALID_JPEG);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;

    const result = await generateMarketingImages(
      {
        campaignSlug: "Sony XM6 Launch!",
        prompts: [
          { prompt: "studio shot of headphones on marble desk", label: "Studio Shot" },
          { prompt: "flaky lifestyle shot in coffee shop", label: "Lifestyle Shot" },
        ],
      },
      { assetsRoot: root, baseUrl: `http://127.0.0.1:${port}/prompt`, timeoutMs: 5_000 },
    );

    expect(result.campaignSlug).toBe("sony-xm6-launch");
    expect(result.images).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(readFileSync(result.images[0]!.filePath)).toEqual(VALID_JPEG);
    expect(readFileSync(result.images[1]!.filePath)).toEqual(VALID_JPEG);
    expect(result.images[0]!.label).toBe("Studio Shot");
  });

  it("persists, retrieves, and updates campaign draft state", async () => {
    const root = makeTempDir();
    const saved = await saveMarketingDraft(root, {
      campaignSlug: "iphone-duo",
      productName: "iPhone Duo",
      targetPlatforms: ["facebook", "x"],
      posts: [
        {
          platform: "facebook",
          title: "Siêu phẩm gập đôi iPhone Duo",
          body: "Trải nghiệm công nghệ tương lai ngay hôm nay.",
          hashtags: ["#iPhoneDuo", "#Tech"],
          imagePaths: [join(root, "iphone-duo", "image-1.jpg")],
        },
      ],
    });

    expect(saved.status).toBe("pending_approval");
    const loaded = await getMarketingDraft(root, "iphone-duo");
    expect(loaded.productName).toBe("iPhone Duo");
    expect(loaded.posts[0]!.platform).toBe("facebook");

    const published = await markMarketingPublished(root, {
      campaignSlug: "iphone-duo",
      results: [{ platform: "facebook", status: "published", url: "https://facebook.com/posts/123" }],
    });
    expect(published.status).toBe("published");
    expect(published.publishedResults?.[0]?.url).toBe("https://facebook.com/posts/123");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run server/marketing/studio.test.ts`
Expected: FAIL with `Cannot find module './studio.ts'`

- [ ] **Step 3: Implement `server/marketing/studio.ts`**

```ts
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ImagePromptSpec {
  prompt: string;
  label?: string;
  width?: number;
  height?: number;
}

export interface GenerateImagesInput {
  campaignSlug: string;
  prompts: ImagePromptSpec[];
}

export interface GeneratedMarketingImage {
  index: number;
  label: string;
  prompt: string;
  filePath: string;
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  bytes: number;
}

export interface GenerateImagesOutput {
  campaignSlug: string;
  campaignDir: string;
  images: GeneratedMarketingImage[];
  failed: Array<{ index: number; prompt: string; error: string }>;
}

export interface GenerateImagesOptions {
  assetsRoot: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface MarketingPostDraft {
  platform: string;
  title?: string;
  body: string;
  hashtags?: string[];
  imagePaths: string[];
}

export interface PublishedPlatformResult {
  platform: string;
  status: "published" | "failed";
  url?: string;
  note?: string;
}

export interface MarketingDraft {
  campaignSlug: string;
  productName: string;
  targetPlatforms: string[];
  status: "pending_approval" | "published";
  createdAt: string;
  updatedAt: string;
  posts: MarketingPostDraft[];
  publishedResults?: PublishedPlatformResult[];
}

export interface SaveDraftInput {
  campaignSlug: string;
  productName: string;
  targetPlatforms: string[];
  posts: MarketingPostDraft[];
}

export interface MarkPublishedInput {
  campaignSlug: string;
  results: PublishedPlatformResult[];
}

const DEFAULT_BASE_URL = "https://image.pollinations.ai/prompt";
const DEFAULT_TIMEOUT_MS = 35_000;
const DEFAULT_RETRIES = 2;

export function normalizeCampaignSlug(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return cleaned || `campaign-${Date.now()}`;
}

export function detectImageFormat(bytes: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "webp";
  }
  return null;
}

async function fetchSingleImage(
  spec: ImagePromptSpec,
  index: number,
  campaignDir: string,
  options: Required<Pick<GenerateImagesOptions, "baseUrl" | "timeoutMs" | "maxRetries">>,
): Promise<GeneratedMarketingImage> {
  const width = Math.min(Math.max(spec.width ?? 1024, 256), 2048);
  const height = Math.min(Math.max(spec.height ?? 1024, 256), 2048);
  let lastError = "unknown error";

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const seed = Math.floor(Math.random() * 1_000_000) + index * 100 + attempt;
    const encoded = encodeURIComponent(spec.prompt.trim());
    const url = `${options.baseUrl.replace(/\/+$/, "")}/${encoded}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;
    try {
      const response = await fetch(url, {
        headers: { accept: "image/jpeg,image/png,image/webp,*/*" },
        signal: AbortSignal.timeout(options.timeoutMs),
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      const format = detectImageFormat(buffer);
      if (!format) {
        lastError = "upstream response is not a valid image";
        continue;
      }
      const ext = format === "jpeg" ? "jpg" : format;
      const mimeType = format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
      const filePath = join(campaignDir, `image-${index + 1}.${ext}`);
      writeFileSync(filePath, buffer);
      return {
        index: index + 1,
        label: spec.label?.trim() || `Image ${index + 1}`,
        prompt: spec.prompt.trim(),
        filePath,
        url,
        mimeType,
        width,
        height,
        bytes: buffer.byteLength,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  throw new Error(lastError);
}

export async function generateMarketingImages(
  input: GenerateImagesInput,
  options: GenerateImagesOptions,
): Promise<GenerateImagesOutput> {
  const campaignSlug = normalizeCampaignSlug(input.campaignSlug);
  const campaignDir = join(options.assetsRoot, campaignSlug);
  mkdirSync(campaignDir, { recursive: true });

  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;

  const prompts = input.prompts.slice(0, 6);
  const settled = await Promise.allSettled(
    prompts.map((spec, idx) =>
      fetchSingleImage(spec, idx, campaignDir, { baseUrl, timeoutMs, maxRetries }),
    ),
  );

  const images: GeneratedMarketingImage[] = [];
  const failed: Array<{ index: number; prompt: string; error: string }> = [];

  settled.forEach((item, idx) => {
    if (item.status === "fulfilled") {
      images.push(item.value);
    } else {
      failed.push({
        index: idx + 1,
        prompt: prompts[idx]?.prompt ?? "",
        error: item.reason instanceof Error ? item.reason.message : String(item.reason),
      });
    }
  });

  return { campaignSlug, campaignDir, images, failed };
}

export async function saveMarketingDraft(
  assetsRoot: string,
  input: SaveDraftInput,
): Promise<MarketingDraft> {
  const campaignSlug = normalizeCampaignSlug(input.campaignSlug);
  const campaignDir = join(assetsRoot, campaignSlug);
  mkdirSync(campaignDir, { recursive: true });
  const now = new Date().toISOString();
  const draft: MarketingDraft = {
    campaignSlug,
    productName: input.productName.trim(),
    targetPlatforms: input.targetPlatforms.map((p) => p.trim().toLowerCase()),
    status: "pending_approval",
    createdAt: now,
    updatedAt: now,
    posts: input.posts,
  };
  writeFileSync(join(campaignDir, "draft.json"), JSON.stringify(draft, null, 2), "utf8");
  return draft;
}

export async function getMarketingDraft(
  assetsRoot: string,
  campaignSlug: string,
): Promise<MarketingDraft> {
  const slug = normalizeCampaignSlug(campaignSlug);
  const draftPath = join(assetsRoot, slug, "draft.json");
  const raw = readFileSync(draftPath, "utf8");
  return JSON.parse(raw) as MarketingDraft;
}

export async function markMarketingPublished(
  assetsRoot: string,
  input: MarkPublishedInput,
): Promise<MarketingDraft> {
  const draft = await getMarketingDraft(assetsRoot, input.campaignSlug);
  const updated: MarketingDraft = {
    ...draft,
    status: "published",
    updatedAt: new Date().toISOString(),
    publishedResults: input.results,
  };
  const draftPath = join(assetsRoot, draft.campaignSlug, "draft.json");
  writeFileSync(draftPath, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}
```

- [ ] **Step 4: Run the unit tests to verify they pass**

Run: `pnpm exec vitest run server/marketing/studio.test.ts`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit Task 1**

```bash
git add server/marketing/studio.ts server/marketing/studio.test.ts
git commit -m "feat(marketing): add Flux multi-image generator and campaign draft store"
```

---

### Task 2: Marketing Studio Stdio MCP Server

**Files:**
- Create: `server/marketing/mcp-server.ts`
- Test: `server/marketing/mcp-server.test.ts`

**Interfaces:**
- Consumes: `generateMarketingImages`, `saveMarketingDraft`, `getMarketingDraft`, `markMarketingPublished` from `server/marketing/studio.ts`
- Produces: JSON-RPC 2.0 stdio MCP server exposing:
  - `generate_marketing_images`
  - `save_marketing_draft`
  - `get_marketing_draft`
  - `mark_marketing_published`

- [ ] **Step 1: Write the failing MCP server test in `server/marketing/mcp-server.test.ts`**

```ts
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createInterface } from "node:readline";
import { afterEach, describe, expect, it } from "vitest";

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("marketing studio MCP server", () => {
  let child: ChildProcessWithoutNullStreams | undefined;
  let server: Server | undefined;
  const dirs: string[] = [];

  afterEach(async () => {
    child?.kill();
    child = undefined;
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("answers initialize, tools/list, and executes generate_marketing_images and draft tools", async () => {
    const assetsRoot = mkdtempSync(join(tmpdir(), "omb-mcp-marketing-"));
    dirs.push(assetsRoot);

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(VALID_JPEG);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;

    const script = join(import.meta.dirname, "mcp-server.ts");
    child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", script], {
      stdio: "pipe",
      env: {
        ...process.env,
        OMB_MARKETING_ASSETS_ROOT: assetsRoot,
        OMB_POLLINATIONS_BASE_URL: `http://127.0.0.1:${port}/prompt`,
      },
    });

    const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    const rpc = async (id: number, method: string, params?: unknown) => {
      child!.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
      const next = await lines.next();
      return JSON.parse(next.value as string) as { id: number; result?: any; error?: any };
    };

    const init = await rpc(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    });
    expect(init.result.serverInfo.name).toBe("marketing_studio");

    const listed = await rpc(2, "tools/list", {});
    expect(listed.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "generate_marketing_images",
      "save_marketing_draft",
      "get_marketing_draft",
      "mark_marketing_published",
    ]);

    const generated = await rpc(3, "tools/call", {
      name: "generate_marketing_images",
      arguments: {
        campaignSlug: "keychron-q1",
        prompts: [{ prompt: "mechanical keyboard studio lighting", label: "Hero Banner" }],
      },
    });
    expect(generated.result.isError).toBeUndefined();
    const parsedGen = JSON.parse(generated.result.content[0].text);
    expect(parsedGen.images).toHaveLength(1);
    expect(parsedGen.images[0].filePath).toContain("keychron-q1");

    const saved = await rpc(4, "tools/call", {
      name: "save_marketing_draft",
      arguments: {
        campaignSlug: "keychron-q1",
        productName: "Keychron Q1 Pro",
        targetPlatforms: ["facebook"],
        posts: [
          {
            platform: "facebook",
            body: "Bàn phím cơ custom đỉnh cao Keychron Q1 Pro!",
            imagePaths: [parsedGen.images[0].filePath],
          },
        ],
      },
    });
    expect(saved.result.isError).toBeUndefined();

    const loaded = await rpc(5, "tools/call", {
      name: "get_marketing_draft",
      arguments: { campaignSlug: "keychron-q1" },
    });
    expect(JSON.parse(loaded.result.content[0].text).productName).toBe("Keychron Q1 Pro");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run server/marketing/mcp-server.test.ts`
Expected: FAIL with exit / missing `mcp-server.ts`

- [ ] **Step 3: Implement `server/marketing/mcp-server.ts`**

```ts
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
  process.env.OMB_MARKETING_ASSETS_ROOT?.trim() ||
  join(homedir(), ".openmausbot", "workspaces", "default", "marketing-assets");

const BASE_URL = process.env.OMB_POLLINATIONS_BASE_URL?.trim() || undefined;

const TOOLS = [
  {
    name: "generate_marketing_images",
    description:
      "Generate 1 to 4 high-quality product or lifestyle marketing images in parallel using the free Flux model (Pollinations.ai) and save them as local .jpg files for chat preview and social upload.",
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
                "Call agents_attach_file for each image filePath so the user sees the image gallery directly in chat, then present the copy and wait for confirmation before publishing.",
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
```

- [ ] **Step 4: Run the MCP server tests to verify they pass**

Run: `pnpm exec vitest run server/marketing/mcp-server.test.ts`
Expected: PASS (1 passed)

- [ ] **Step 5: Commit Task 2**

```bash
git add server/marketing/mcp-server.ts server/marketing/mcp-server.test.ts
git commit -m "feat(marketing): add stdio MCP server for marketing studio tools"
```

---

### Task 3: Install Browser Engine (`agent-browser`) & Mount Marketing Studio on MausBot

**Files:**
- Modify: Live OpenMausBot configuration via API (`POST /api/mcp/servers`, `PATCH /api/bots/:id`)

**Interfaces:**
- Consumes: `server/marketing/mcp-server.ts`
- Produces: Active `marketing_studio` MCP integration, ready `agent-browser` binary, and configured two-phase Marketing Director soul on MausBot.

- [ ] **Step 1: Install `agent-browser` so browser automation tools are ready**

Run: `node --experimental-strip-types server/cli.ts browser install`
Expected: Downloads and verifies the pinned `agent-browser` binary and prints `agent-browser is ready`.

- [ ] **Step 2: Register and enable `marketing_studio` MCP server via `/api/mcp/servers`**

Run:
```bash
curl -s -X POST "http://127.0.0.1:8799/api/mcp/servers" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "marketing_studio",
    "command": "node",
    "args": ["--experimental-strip-types", "--no-warnings", "/home/phan-duong-quoc-nhat/workspace/RoMes/server/marketing/mcp-server.ts"],
    "env": {
      "OMB_MARKETING_ASSETS_ROOT": "/home/phan-duong-quoc-nhat/.openmausbot/workspaces/a97732e7-d079-4c3b-baee-a95da5ab857d/marketing-assets"
    },
    "enabled": true
  }' | jq .
```
Expected: HTTP 201 and `POST /api/mcp/servers/marketing_studio/test` returns `{"ok": true}`.

- [ ] **Step 3: Configure MausBot's Marketing & Sales Soul (`PATCH /api/bots/:id`)**

Update MausBot's `soul` with the two-phase Marketing & Hybrid Publishing instructions so it automatically drafts copy, generates multiple Flux images, attaches them to the chat via `agents_attach_file`, saves the draft, and waits for confirmation before publishing via Composio/Postiz or `agent-browser`.

- [ ] **Step 4: Run full unit test suite for `server/marketing/`**

Run: `pnpm exec vitest run server/marketing/`
Expected: All tests pass.
