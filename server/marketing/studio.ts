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

const DEFAULT_BASE_URL = "https://image.pollinations.ai/prompt";
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_RETRIES = 1;

const CURATED_TECH_IMAGES = [
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1080&h=1920&fit=crop&q=80",
  "https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=1080&h=1920&fit=crop&q=80",
  "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1080&h=1920&fit=crop&q=80",
  "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1080&h=1920&fit=crop&q=80",
  "https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1080&h=1920&fit=crop&q=80",
  "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1080&h=1920&fit=crop&q=80",
];

function generateFallbackGradientImage(outputPath: string, width: number, height: number, index: number): boolean {
  try {
    const script = `
from PIL import Image, ImageDraw
import sys

w, h = int(sys.argv[1]), int(sys.argv[2])
idx = int(sys.argv[3])
out = sys.argv[4]

palettes = [
    ((15, 23, 42), (40, 20, 80), (99, 102, 241), (168, 85, 247)),
    ((10, 15, 29), (16, 40, 60), (6, 182, 212), (59, 130, 246)),
    ((20, 10, 30), (50, 15, 60), (236, 72, 153), (168, 85, 247)),
    ((5, 15, 25), (10, 45, 40), (16, 185, 129), (6, 182, 212)),
]
pal = palettes[idx % len(palettes)]

img = Image.new("RGB", (w, h), pal[0])
draw = ImageDraw.Draw(img)
for y in range(h):
    r = int(pal[0][0] + (pal[1][0] - pal[0][0]) * (y / h))
    g = int(pal[0][1] + (pal[1][1] - pal[0][1]) * (y / h))
    b = int(pal[0][2] + (pal[1][2] - pal[0][2]) * (y / h))
    draw.line([(0, y), (w, y)], fill=(r, g, b))

overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
draw_ol = ImageDraw.Draw(overlay)
draw_ol.ellipse([w*0.15, h*0.2, w*0.85, h*0.55], fill=(*pal[2], 55))
draw_ol.ellipse([w*0.05, h*0.45, w*0.95, h*0.85], fill=(*pal[3], 45))

img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
img.save(out, "JPEG", quality=95)
`;
    execFileSync("python3", ["-c", script, String(width), String(height), String(index), outputPath], {
      timeout: 10_000,
      stdio: "ignore",
    });
    return existsSync(outputPath);
  } catch {
    return false;
  }
}

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

export function resolveUnsplashKey(explicitKey?: string): string {
  if (explicitKey?.trim()) return explicitKey.trim();
  if (process.env.UNSPLASH_ACCESS_KEY?.trim()) return process.env.UNSPLASH_ACCESS_KEY.trim();
  try {
    const configPath = join(homedir(), ".openmausbot", "config.json");
    if (existsSync(configPath)) {
      const parsed = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
      const unsplashObj = parsed.unsplash as { accessKey?: string } | undefined;
      if (typeof unsplashObj?.accessKey === "string" && unsplashObj.accessKey.trim()) {
        return unsplashObj.accessKey.trim();
      }
      if (typeof parsed.unsplashAccessKey === "string" && parsed.unsplashAccessKey.trim()) {
        return parsed.unsplashAccessKey.trim();
      }
    }
  } catch {
    // Config read error or missing file
  }
  return "";
}

export function extractKeywordsForSearch(prompt: string): string {
  const cleaned = prompt
    .toLowerCase()
    .replace(
      /\b(photorealistic|ultra realistic|high quality|8k|hyper-detailed|cinematic|detailed|portrait 9:16|vertical 9:16|commercial|studio lighting|4k|octane render|unreal engine)\b/gi,
      "",
    )
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(" ").filter((w) => w.length > 2);
  if (tokens.length === 0) return "technology artificial intelligence";
  return tokens.slice(0, 5).join(" ");
}

export async function fetchFromUnsplash(
  query: string,
  width: number,
  height: number,
  accessKey: string,
  index: number,
  timeoutMs = 10_000,
): Promise<{ buffer: Buffer; url: string } | null> {
  const searchUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10`;
  const res = await fetch(searchUrl, {
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { results?: Array<{ urls?: { raw?: string; regular?: string } }> };
  if (!data.results || data.results.length === 0) return null;

  const chosen = data.results[index % data.results.length];
  const rawUrl = chosen?.urls?.raw || chosen?.urls?.regular;
  if (!rawUrl) return null;

  const downloadUrl = `${rawUrl}&w=${width}&h=${height}&fit=crop&q=85&auto=format`;
  const dlRes = await fetch(downloadUrl, {
    headers: { Accept: "image/jpeg,image/png,*/*" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!dlRes.ok) return null;
  const buffer = Buffer.from(await dlRes.arrayBuffer());
  return { buffer, url: downloadUrl };
}

async function fetchSingleImage(
  spec: ImagePromptSpec,
  index: number,
  campaignDir: string,
  options: Required<Pick<GenerateImagesOptions, "baseUrl" | "timeoutMs" | "maxRetries">>,
): Promise<GeneratedMarketingImage> {
  const width = Math.min(Math.max(spec.width ?? 1080, 256), 2048);
  const height = Math.min(Math.max(spec.height ?? 1920, 256), 2048);
  let lastError = "unknown error";

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    const seed = Math.floor(Math.random() * 1_000_000) + index * 100 + attempt;
    try {
      let buffer: Buffer | null = null;
      let url = "";

      if (!options.baseUrl.includes("127.0.0.1") && !options.baseUrl.includes("localhost")) {
        const unsplashKey = resolveUnsplashKey();
        if (unsplashKey) {
          try {
            const query = extractKeywordsForSearch(spec.prompt);
            const unsplashOut = await fetchFromUnsplash(
              query,
              width,
              height,
              unsplashKey,
              index,
              options.timeoutMs,
            );
            if (unsplashOut) {
              buffer = unsplashOut.buffer;
              url = unsplashOut.url;
            }
          } catch {
            // Unsplash query or download failed; proceed to next provider
          }
        }
      }

      if (!buffer) {
        if (isGradioSpaceUrl(options.baseUrl)) {
          try {
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
          } catch (gradioErr) {
            lastError = gradioErr instanceof Error ? gradioErr.message : String(gradioErr);
          }
        } else {
          const encoded = encodeURIComponent(spec.prompt.trim());
          url = `${options.baseUrl.replace(/\/+$/, "")}/${encoded}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=true`;
          const response = await fetch(url, {
            headers: {
              accept: "image/jpeg,image/png,image/webp,*/*",
              referer: "https://pollinations.ai",
            },
            signal: AbortSignal.timeout(options.timeoutMs),
          });
          if (response.ok) {
            buffer = Buffer.from(await response.arrayBuffer());
          } else {
            lastError = `HTTP ${response.status}`;
          }
        }
      }

      let format = buffer ? detectImageFormat(buffer) : null;

      if (!buffer || !format) {
        if (options.baseUrl.includes("127.0.0.1") || options.baseUrl.includes("localhost")) {
          if (attempt < options.maxRetries) {
            continue;
          }
        } else {
          const fallbackUrl = CURATED_TECH_IMAGES[index % CURATED_TECH_IMAGES.length]!;
          try {
            const fbRes = await fetch(fallbackUrl, {
              headers: { accept: "image/jpeg,image/png,*/*" },
              signal: AbortSignal.timeout(8_000),
            });
            if (fbRes.ok) {
              const fbBuf = Buffer.from(await fbRes.arrayBuffer());
              const fbFmt = detectImageFormat(fbBuf);
              if (fbFmt) {
                buffer = fbBuf;
                format = fbFmt;
                url = fallbackUrl;
              }
            }
          } catch {
            // Network fallback failed, proceed to local generation
          }

          if (!buffer || !format) {
            const localJpg = join(campaignDir, `image-${index + 1}.jpg`);
            if (generateFallbackGradientImage(localJpg, width, height, index)) {
              buffer = readFileSync(localJpg);
              format = "jpeg";
              url = `local://synthesized-gradient-${index + 1}.jpg`;
            }
          }
        }
      }

      if (!buffer || !format) {
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

  const fallbackPath = join(campaignDir, `image-${index + 1}.jpg`);
  if (generateFallbackGradientImage(fallbackPath, width, height, index)) {
    const buf = readFileSync(fallbackPath);
    return {
      index: index + 1,
      label: spec.label?.trim() || `Image ${index + 1}`,
      prompt: spec.prompt.trim(),
      filePath: fallbackPath,
      url: `local://fallback-${index + 1}.jpg`,
      mimeType: "image/jpeg",
      width,
      height,
      bytes: buf.byteLength,
    };
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

  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_RETRIES;

  const images: GeneratedMarketingImage[] = [];
  const failed: Array<{ index: number; prompt: string; error: string }> = [];

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

  const adjustedScenes = input.scenes.map((s, idx) => {
    let imgPath = s.imagePath;
    if (!imgPath || !existsSync(imgPath)) {
      const candidates = [
        join(campaignDir, `image-${idx + 1}.jpg`),
        join(campaignDir, `image-${idx + 1}.png`),
        join(campaignDir, `image-${idx + 1}.webp`),
        join(campaignDir, "image-1.jpg"),
      ];
      for (const cand of candidates) {
        if (existsSync(cand)) {
          imgPath = cand;
          break;
        }
      }
    }
    return {
      ...s,
      imagePath: imgPath,
      durationMs: Math.max(500, Math.round((s.durationMs || 3000) * scaleFactor)),
    };
  });

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

