import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { mixCampaignAudio, type BgmTheme } from "./audio-mixer.ts";
import { generateMarketingSpeech } from "./speech-engine.ts";
import { renderMarketingVideo, type VideoRenderOutput } from "./video-compiler.ts";
import { type MarketingSceneSpec, type VideoRatio } from "./video-templates.ts";

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

const DEFAULT_BASE_URL = "https://black-forest-labs-flux-1-schnell.hf.space";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_RETRIES = 2;
const AISTUDIO_IMAGE_URL = "https://aistudio.google.com/prompts/new_chat?model=gemini-3.1-flash-lite-image";

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

function findRunningDaemonProxy(session: string): { proxy?: string; bypass?: string } {
  try {
    for (const entry of readdirSync("/proc")) {
      if (!/^\d+$/.test(entry)) continue;
      try {
        const comm = readFileSync(join("/proc", entry, "comm"), "utf8").trim();
        if (comm !== "agent-browser") continue;
        const rawEnv = readFileSync(join("/proc", entry, "environ"), "utf8");
        if (!rawEnv.includes("AGENT_BROWSER_DAEMON=1")) continue;
        if (!rawEnv.includes(`AGENT_BROWSER_SESSION=${session}`)) continue;
        let proxy: string | undefined;
        let bypass: string | undefined;
        for (const pair of rawEnv.split("\0")) {
          if (pair.startsWith("AGENT_BROWSER_PROXY=")) proxy = pair.slice("AGENT_BROWSER_PROXY=".length);
          if (pair.startsWith("AGENT_BROWSER_PROXY_BYPASS=")) bypass = pair.slice("AGENT_BROWSER_PROXY_BYPASS=".length);
        }
        return { proxy, bypass };
      } catch {
        continue;
      }
    }
  } catch {}
  return {};
}

function resolveAgentBrowserSetup(): { bin: string; env: NodeJS.ProcessEnv } | null {
  const home = homedir();
  const bin = join(home, ".openmausbot", "tools", "agent-browser", "0.37.0", "agent-browser");
  if (!existsSync(bin)) return null;
  const session =
    process.env.MARKETING_BROWSER_SESSION?.trim() ||
    "bot-a97732e7-d079-4c3b-baee-a95da5ab857d";

  const configPath = join(home, ".agent-browser", "omb-managed-config.json");
  const launcherPath = join(home, ".openmausbot", "browser", "chrome-launcher.sh");
  const profilesDir = join(home, ".openmausbot", "agent-browser-profiles");
  let profileDir = "";
  try {
    const first = readdirSync(profilesDir)[0];
    if (first) profileDir = join(profilesDir, first);
  } catch {}
  const { proxy, bypass } = findRunningDaemonProxy(session);

  return {
    bin,
    env: {
      ...process.env,
      AGENT_BROWSER_SESSION: session,
      AGENT_BROWSER_HEADLESS: "1",
      AGENT_BROWSER_HEADED: "0",
      AGENT_BROWSER_NO_WEBMCP: "1",
      AGENT_BROWSER_ARGS: "--disk-cache-size=67108864",
      ...(existsSync(configPath) ? { AGENT_BROWSER_CONFIG: configPath } : {}),
      ...(existsSync(launcherPath) ? { AGENT_BROWSER_EXECUTABLE_PATH: launcherPath } : {}),
      ...(profileDir ? { AGENT_BROWSER_PROFILE: profileDir } : {}),
      ...(proxy ? { AGENT_BROWSER_PROXY: proxy } : {}),
      ...(bypass ? { AGENT_BROWSER_PROXY_BYPASS: bypass } : {}),
    },
  };
}

function runAgentBrowser(setup: { bin: string; env: NodeJS.ProcessEnv }, args: string[], timeout = 30_000): string {
  return execFileSync(setup.bin, args, {
    env: setup.env,
    encoding: "utf8",
    timeout,
    maxBuffer: 25 * 1024 * 1024,
  });
}

function parseSnapshotRefs(snapshotText: string): {
  tempChatRef?: string;
  promptRef?: string;
  runRef?: string;
  cancelRef?: string;
} {
  const lines = snapshotText.split("\n");
  let tempChatRef: string | undefined;
  let promptRef: string | undefined;
  let runRef: string | undefined;
  let cancelRef: string | undefined;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!;
    const nextLine = lines[i + 1] ?? "";
    if (!tempChatRef && /- button \[ref=(e\d+)\]/.test(line) && nextLine.includes('button "New chat"')) {
      tempChatRef = /\[ref=(e\d+)\]/.exec(line)?.[1];
    }
    if (!promptRef && line.includes('textbox "Enter a prompt"')) {
      promptRef = /\[ref=(e\d+)\]/.exec(line)?.[1];
    }
    if (/- button "Run(?:\s+keyboard_return)?"/.test(line)) {
      runRef = /\[ref=(e\d+)\]/.exec(line)?.[1];
    }
    if (line.includes('button "Cancel"')) {
      cancelRef = /\[ref=(e\d+)\]/.exec(line)?.[1];
    }
  }
  return { tempChatRef, promptRef, runRef, cancelRef };
}

function listCurrentBlobUrls(setup: { bin: string; env: NodeJS.ProcessEnv }): string[] {
  const raw = runAgentBrowser(setup, [
    "eval",
    'JSON.stringify(Array.from(document.querySelectorAll("img")).filter(i => i.src.startsWith("blob:") && i.naturalWidth >= 256).map(i => i.src))',
  ]);
  const lastLine = raw.trim().split("\n").pop() ?? "[]";
  const inner = JSON.parse(lastLine) as string;
  return JSON.parse(inner) as string[];
}

function extractBlobImageAsJpeg(
  setup: { bin: string; env: NodeJS.ProcessEnv },
  targetBlobUrl: string,
): { buffer: Buffer; width: number; height: number } | null {
  const script = `(() => {
    const imgs = Array.from(document.querySelectorAll("img")).filter(i => i.src === ${JSON.stringify(targetBlobUrl)} && i.naturalWidth >= 256);
    const img = imgs[imgs.length - 1];
    if (!img) return "";
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d").drawImage(img, 0, 0);
    return JSON.stringify({ width: c.width, height: c.height, dataUrl: c.toDataURL("image/jpeg", 0.92) });
  })()`;
  const raw = runAgentBrowser(setup, ["eval", script]);
  const lastLine = raw.trim().split("\n").pop() ?? '""';
  const jsonStr = JSON.parse(lastLine) as string;
  if (!jsonStr) return null;
  const parsed = JSON.parse(jsonStr) as { width: number; height: number; dataUrl: string };
  const base64 = parsed.dataUrl.replace(/^data:image\/jpeg;base64,/, "");
  return {
    buffer: Buffer.from(base64, "base64"),
    width: parsed.width,
    height: parsed.height,
  };
}

async function generateViaGoogleAiStudioBrowser(
  prompts: ImagePromptSpec[],
  campaignDir: string,
): Promise<{
  images: GeneratedMarketingImage[];
  failed: Array<{ index: number; prompt: string; error: string }>;
} | null> {
  const setup = resolveAgentBrowserSetup();
  if (!setup) return null;

  try {
    const tabListRaw = runAgentBrowser(setup, ["tab", "list", "--json"]);
    const tabJsonLine = tabListRaw.trim().split("\n").pop() ?? "{}";
    const tabData = JSON.parse(tabJsonLine) as {
      data?: { tabs?: Array<{ tabId: string; url: string }> };
    };
    const tabs = tabData.data?.tabs ?? [];
    const aiStudioTab = tabs.find((t) => t.url.includes("aistudio.google.com"));
    const blankTab = tabs.find((t) => !t.url || t.url === "about:blank");
    const hasOtherSiteTab = tabs.some(
      (t) => t.url && t.url !== "about:blank" && !t.url.includes("aistudio.google.com"),
    );
    if (aiStudioTab) {
      runAgentBrowser(setup, ["tab", aiStudioTab.tabId]);
    } else if (hasOtherSiteTab && blankTab) {
      runAgentBrowser(setup, ["tab", blankTab.tabId]);
    } else if (hasOtherSiteTab) {
      runAgentBrowser(setup, ["tab", "new"]);
    }

    const images: GeneratedMarketingImage[] = [];
    const failed: Array<{ index: number; prompt: string; error: string }> = [];

    for (let idx = 0; idx < prompts.length; idx += 1) {
      const spec = prompts[idx]!;
      try {
        runAgentBrowser(setup, ["open", AISTUDIO_IMAGE_URL], 35_000);

        let snap = "";
        let refs: ReturnType<typeof parseSnapshotRefs> = {};
        const readyDeadline = Date.now() + 25_000;
        while (Date.now() < readyDeadline) {
          runAgentBrowser(setup, ["wait", "2000"]);
          snap = runAgentBrowser(setup, ["snapshot", "-i"]);
          if (snap.includes("(no interactive elements)")) {
            runAgentBrowser(setup, ["open", AISTUDIO_IMAGE_URL], 35_000);
            continue;
          }
          refs = parseSnapshotRefs(snap);
          if (refs.promptRef && snap.includes("Nano Banana 2 Lite")) break;
        }

        if (!snap.includes('link "data use policy"') && refs.tempChatRef) {
          runAgentBrowser(setup, ["click", `@${refs.tempChatRef}`]);
          runAgentBrowser(setup, ["wait", "500"]);
        }

        const beforeBlobs = new Set(listCurrentBlobUrls(setup));
        const baseAnchor = prompts[0]?.prompt.trim() ?? "";
        const promptText =
          idx === 0
            ? spec.prompt.trim()
            : `${spec.prompt.trim()} (Maintain consistent visual identity with: ${baseAnchor})`;

        let submitted = false;
        for (let attempt = 0; attempt < 3; attempt += 1) {
          snap = runAgentBrowser(setup, ["snapshot", "-i"]);
          refs = parseSnapshotRefs(snap);
          if (refs.cancelRef) {
            runAgentBrowser(setup, ["click", `@${refs.cancelRef}`]);
            snap = runAgentBrowser(setup, ["snapshot", "-i"]);
            refs = parseSnapshotRefs(snap);
          }
          if (!refs.promptRef) {
            runAgentBrowser(setup, ["wait", "1000"]);
            continue;
          }
          runAgentBrowser(setup, ["fill", `@${refs.promptRef}`, promptText]);
          runAgentBrowser(setup, ["wait", "600"]);
          const clickRes = runAgentBrowser(setup, [
            "eval",
            '(() => { const b = Array.from(document.querySelectorAll("button")).find(el => /^Run\\b/.test(el.innerText.trim())); if (b && !b.disabled && b.getAttribute("aria-disabled") !== "true") { b.click(); return "clicked"; } return "disabled"; })()',
          ]);
          if (clickRes.includes("clicked")) {
            submitted = true;
            break;
          }
          runAgentBrowser(setup, ["wait", "1000"]);
        }
        if (!submitted) {
          throw new Error("Google AI Studio Run button remained disabled after filling prompt");
        }

        let newBlobUrl = "";
        const deadline = Date.now() + 35_000;
        while (Date.now() < deadline) {
          runAgentBrowser(setup, ["wait", "1500"]);
          const currentBlobs = listCurrentBlobUrls(setup);
          const added = currentBlobs.find((u) => !beforeBlobs.has(u));
          if (added) {
            newBlobUrl = added;
            break;
          }
        }

        if (!newBlobUrl) {
          throw new Error("Timed out waiting for Nano Banana 2 Lite image in Google AI Studio");
        }

        const extracted = extractBlobImageAsJpeg(setup, newBlobUrl);
        if (!extracted) {
          throw new Error("Could not extract generated blob image from Google AI Studio canvas");
        }

        const filePath = join(campaignDir, `image-${idx + 1}.jpg`);
        writeFileSync(filePath, extracted.buffer);
        images.push({
          index: idx + 1,
          label: spec.label?.trim() || `Image ${idx + 1}`,
          prompt: spec.prompt.trim(),
          filePath,
          url: newBlobUrl,
          mimeType: "image/jpeg",
          width: extracted.width,
          height: extracted.height,
          bytes: extracted.buffer.byteLength,
        });
      } catch (error) {
        failed.push({
          index: idx + 1,
          prompt: spec.prompt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { images, failed };
  } catch {
    return null;
  }
}

function isGradioSpaceUrl(baseUrl: string): boolean {
  return baseUrl.includes(".hf.space") || baseUrl.includes("/gradio_api");
}

function convertWebpToJpegIfPossible(webpPath: string, jpgPath: string): boolean {
  try {
    execFileSync(
      "python3",
      [
        "-c",
        "import sys; from PIL import Image; Image.open(sys.argv[1]).convert('RGB').save(sys.argv[2], 'JPEG', quality=95)",
        webpPath,
        jpgPath,
      ],
      { timeout: 10_000, stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
}

async function fetchFromGradioFluxSpace(
  spaceOrigin: string,
  prompt: string,
  width: number,
  height: number,
  seed: number,
  timeoutMs: number,
): Promise<{ buffer: Buffer; url: string }> {
  const origin = spaceOrigin.replace(/\/gradio_api.*$/, "").replace(/\/+$/, "");
  const callRes = await fetch(`${origin}/gradio_api/call/infer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      data: [prompt, seed, false, width, height, 4],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!callRes.ok) {
    throw new Error(`Gradio call HTTP ${callRes.status}`);
  }
  const callJson = (await callRes.json()) as { event_id?: string };
  if (!callJson.event_id) {
    throw new Error("Gradio response missing event_id");
  }

  const streamRes = await fetch(`${origin}/gradio_api/call/infer/${callJson.event_id}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!streamRes.ok) {
    throw new Error(`Gradio stream HTTP ${streamRes.status}`);
  }
  const sseText = await streamRes.text();
  const dataLines = sseText
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6).trim());

  let imageUrl = "";
  for (const rawData of dataLines.reverse()) {
    try {
      const parsed = JSON.parse(rawData) as Array<{ url?: string; path?: string }>;
      const first = Array.isArray(parsed) ? parsed[0] : undefined;
      if (first?.url) {
        imageUrl = first.url;
        break;
      }
      if (first?.path) {
        imageUrl = `${origin}/gradio_api/file=${first.path}`;
        break;
      }
    } catch {
      continue;
    }
  }
  if (!imageUrl) {
    throw new Error(`Gradio stream did not yield an image URL: ${sseText.slice(0, 200)}`);
  }

  const imgRes = await fetch(imageUrl, {
    headers: { accept: "image/webp,image/jpeg,image/png,*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!imgRes.ok) {
    throw new Error(`Gradio file HTTP ${imgRes.status}`);
  }
  return {
    buffer: Buffer.from(await imgRes.arrayBuffer()),
    url: imageUrl,
  };
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
    try {
      let buffer: Buffer;
      let url: string;
      if (isGradioSpaceUrl(options.baseUrl)) {
        const out = await fetchFromGradioFluxSpace(
          options.baseUrl,
          spec.prompt.trim(),
          width,
          height,
          seed,
          options.timeoutMs,
        );
        buffer = out.buffer;
        url = out.url;
      } else {
        const encoded = encodeURIComponent(spec.prompt.trim());
        url = `${options.baseUrl.replace(/\/+$/, "")}/${encoded}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;
        const response = await fetch(url, {
          headers: { accept: "image/jpeg,image/png,image/webp,*/*" },
          signal: AbortSignal.timeout(options.timeoutMs),
        });
        if (!response.ok) {
          lastError = `HTTP ${response.status}`;
          continue;
        }
        buffer = Buffer.from(await response.arrayBuffer());
      }

      const format = detectImageFormat(buffer);
      if (!format) {
        lastError = "upstream response is not a valid image";
        continue;
      }

      const ext = format === "jpeg" ? "jpg" : format;
      let finalPath = join(campaignDir, `image-${index + 1}.${ext}`);
      let finalMime: "image/jpeg" | "image/png" | "image/webp" =
        format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : "image/webp";
      writeFileSync(finalPath, buffer);

      if (format === "webp" && isGradioSpaceUrl(options.baseUrl)) {
        const jpgPath = join(campaignDir, `image-${index + 1}.jpg`);
        if (convertWebpToJpegIfPossible(finalPath, jpgPath)) {
          finalPath = jpgPath;
          finalMime = "image/jpeg";
          buffer = readFileSync(jpgPath);
        }
      }

      return {
        index: index + 1,
        label: spec.label?.trim() || `Image ${index + 1}`,
        prompt: spec.prompt.trim(),
        filePath: finalPath,
        url,
        mimeType: finalMime,
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

  const prompts = input.prompts.slice(0, 6);

  if (!options.baseUrl) {
    const aiStudioResult = await generateViaGoogleAiStudioBrowser(prompts, campaignDir);
    if (aiStudioResult && aiStudioResult.images.length > 0) {
      return {
        campaignSlug,
        campaignDir,
        images: aiStudioResult.images,
        failed: aiStudioResult.failed,
      };
    }
  }

  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;

  const images: GeneratedMarketingImage[] = [];
  const failed: Array<{ index: number; prompt: string; error: string }> = [];

  if (isGradioSpaceUrl(baseUrl)) {
    for (let idx = 0; idx < prompts.length; idx += 1) {
      const spec = prompts[idx]!;
      try {
        const img = await fetchSingleImage(spec, idx, campaignDir, { baseUrl, timeoutMs, maxRetries });
        images.push(img);
      } catch (error) {
        console.error("AIStudio item error:", error instanceof Error ? error.message : String(error));
        failed.push({
          index: idx + 1,
          prompt: spec.prompt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return { campaignSlug, campaignDir, images, failed };
  }

  const settled = await Promise.allSettled(
    prompts.map((spec, idx) =>
      fetchSingleImage(spec, idx, campaignDir, { baseUrl, timeoutMs, maxRetries }),
    ),
  );

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

function findLatestDraftPath(assetsRoot: string): string | null {
  try {
    const entries = readdirSync(assetsRoot, { withFileTypes: true });
    let bestPath: string | null = null;
    let bestMtime = -1;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = join(assetsRoot, entry.name, "draft.json");
      if (!existsSync(candidate)) continue;
      const mtime = statSync(candidate).mtimeMs;
      if (mtime > bestMtime) {
        bestMtime = mtime;
        bestPath = candidate;
      }
    }
    return bestPath;
  } catch {
    return null;
  }
}

export async function getMarketingDraft(
  assetsRoot: string,
  campaignSlug: string,
): Promise<MarketingDraft> {
  const slug = normalizeCampaignSlug(campaignSlug);
  const directPath = join(assetsRoot, slug, "draft.json");
  if (existsSync(directPath)) {
    return JSON.parse(readFileSync(directPath, "utf8")) as MarketingDraft;
  }
  const fallbackPath = findLatestDraftPath(assetsRoot);
  if (fallbackPath) {
    return JSON.parse(readFileSync(fallbackPath, "utf8")) as MarketingDraft;
  }
  const now = new Date().toISOString();
  return {
    campaignSlug: slug,
    productName: slug,
    targetPlatforms: ["facebook"],
    status: "pending_approval",
    createdAt: now,
    updatedAt: now,
    posts: [],
  };
}

export async function markMarketingPublished(
  assetsRoot: string,
  input: MarkPublishedInput,
): Promise<MarketingDraft> {
  const draft = await getMarketingDraft(assetsRoot, input.campaignSlug);
  const campaignDir = join(assetsRoot, draft.campaignSlug);
  mkdirSync(campaignDir, { recursive: true });
  const updated: MarketingDraft = {
    ...draft,
    status: "published",
    updatedAt: new Date().toISOString(),
    publishedResults: input.results,
  };
  const draftPath = join(campaignDir, "draft.json");
  writeFileSync(draftPath, JSON.stringify(updated, null, 2), "utf8");
  return updated;
}

export interface GenerateMarketingVideoInput {
  campaignSlug: string;
  script: string;
  scenes: MarketingSceneSpec[];
  ratio?: VideoRatio;
  bgmTheme?: BgmTheme;
  voice?: string;
  brandName?: string;
}

export interface GenerateMarketingVideoOutput {
  campaignSlug: string;
  videoPath: string;
  mixedAudioPath: string;
  speechAudioPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
  ratio: VideoRatio;
  nextStepHint: string;
}

export async function generateMarketingVideoWorkflow(
  assetsRoot: string,
  input: GenerateMarketingVideoInput,
): Promise<GenerateMarketingVideoOutput> {
  const campaignSlug = normalizeCampaignSlug(input.campaignSlug);
  const campaignDir = join(assetsRoot, campaignSlug);
  mkdirSync(campaignDir, { recursive: true });

  const ratio = input.ratio || "9:16";
  const bgmTheme = input.bgmTheme || "tech";
  const brandName = input.brandName || "RoMes AI";

  const speechOutput = await generateMarketingSpeech({
    script: input.script,
    campaignSlug,
    outputDir: campaignDir,
    voice: input.voice,
  });

  const mixedAudioPath = join(campaignDir, `${campaignSlug}-audio.mp3`);
  const mixedAudio = await mixCampaignAudio({
    voicePath: speechOutput.audioPath,
    bgmTheme,
    outputPath: mixedAudioPath,
  });

  const totalAudioMs = Math.max(mixedAudio.durationMs, speechOutput.durationMs, 1000);
  const rawSceneDuration = input.scenes.reduce((acc, s) => acc + (s.durationMs || 3000), 0);
  const scaleFactor = rawSceneDuration > 0 ? totalAudioMs / rawSceneDuration : 1;

  const adjustedScenes = input.scenes.map((s) => ({
    ...s,
    durationMs: Math.max(500, Math.round((s.durationMs || 3000) * scaleFactor)),
  }));

  const videoOutputPath = join(campaignDir, `${campaignSlug}-video.mp4`);
  const renderOutput: VideoRenderOutput = await renderMarketingVideo({
    campaignSlug,
    scenes: adjustedScenes,
    audioPath: mixedAudio.mixedAudioPath,
    ratio,
    outputPath: videoOutputPath,
    brandName,
  });

  return {
    campaignSlug,
    videoPath: renderOutput.videoPath,
    mixedAudioPath: mixedAudio.mixedAudioPath,
    speechAudioPath: speechOutput.audioPath,
    width: renderOutput.width,
    height: renderOutput.height,
    durationSeconds: renderOutput.durationSeconds,
    bytes: renderOutput.bytes,
    ratio,
    nextStepHint:
      'Video rendering complete! Call agents_attach_file with {"path": videoPath} to preview the video in chat, then present the copy and draft for user review before publishing.',
  };
}

