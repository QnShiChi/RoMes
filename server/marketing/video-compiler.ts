import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildMarketingVideoHtml,
  getDimensionsForRatio,
  resolveImageSource,
  type MarketingSceneSpec,
  type VideoRatio,
} from "./video-templates.ts";

export interface VideoRenderSpec {
  campaignSlug: string;
  scenes: MarketingSceneSpec[];
  audioPath: string;
  ratio: VideoRatio;
  outputPath: string;
  fps?: number;
  brandName?: string;
}

export interface VideoRenderOutput {
  videoPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
  fps: number;
}

export interface VideoCompilerOptions {
  chromePath?: string;
  ffmpegPath?: string;
  engine?: "remotion" | "html-ffmpeg";
}

let cachedRemotionBundle: Promise<string> | null = null;

async function getRemotionBundle(): Promise<string> {
  if (!cachedRemotionBundle) {
    const { bundle } = await import("@remotion/bundler");
    const currentDir = dirname(fileURLToPath(import.meta.url));
    const entryPoint = join(currentDir, "remotion", "Root.tsx");
    cachedRemotionBundle = bundle({ entryPoint });
  }
  return cachedRemotionBundle;
}

function resolveChromeBinary(override?: string): string {
  if (override && existsSync(override)) return override;
  const candidates = [
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  return "google-chrome";
}

function probeVideoDurationSeconds(filePath: string): number {
  try {
    const raw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { timeout: 5000, encoding: "utf-8" },
    );
    const secs = Number.parseFloat(raw.trim());
    return Number.isFinite(secs) ? secs : 0;
  } catch {
    return 0;
  }
}

export async function renderWithRemotion(
  spec: VideoRenderSpec,
  options?: VideoCompilerOptions,
): Promise<VideoRenderOutput> {
  const { selectComposition, renderMedia } = await import("@remotion/renderer");
  const serveUrl = await getRemotionBundle();

  const resolvedScenes = spec.scenes.map((s) => ({
    ...s,
    imageUrl: s.imagePath
      ? resolveImageSource(s.imagePath)
      : (s as { imageUrl?: string }).imageUrl
        ? resolveImageSource((s as { imageUrl?: string }).imageUrl)
        : undefined,
  }));

  const inputProps = {
    scenes: resolvedScenes,
    brandName: spec.brandName || "RoMes AI",
    ratio: spec.ratio || "9:16",
  };

  const composition = await selectComposition({
    serveUrl,
    id: "MarketingVideo",
    inputProps,
  });

  const tempDir = mkdtempSync(join(tmpdir(), "romes-remotion-render-"));
  const tempVideoPath = join(tempDir, "silent-video.mp4");

  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: tempVideoPath,
      inputProps,
      chromiumOptions: {
        enableMultiProcessOnLinux: true,
      },
    });

    const ffmpegBin = options?.ffmpegPath || "ffmpeg";
    execFileSync(
      ffmpegBin,
      [
        "-y",
        "-i",
        tempVideoPath,
        "-i",
        spec.audioPath,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        spec.outputPath,
      ],
      { timeout: 60_000, stdio: "pipe" },
    );

    const durationSeconds = probeVideoDurationSeconds(spec.outputPath);
    const bytes = statSync(spec.outputPath).size;

    return {
      videoPath: spec.outputPath,
      width: composition.width,
      height: composition.height,
      durationSeconds,
      bytes,
      fps: composition.fps,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function renderWithHtmlFfmpeg(
  spec: VideoRenderSpec,
  options?: VideoCompilerOptions,
): Promise<VideoRenderOutput> {
  const { width, height } = getDimensionsForRatio(spec.ratio);
  const fps = spec.fps ?? 24;
  const chromeBin = resolveChromeBinary(options?.chromePath);
  const ffmpegBin = options?.ffmpegPath || "ffmpeg";

  const tempDir = mkdtempSync(join(tmpdir(), "romes-video-render-"));

  try {
    const concatEntries: string[] = [];

    for (let i = 0; i < spec.scenes.length; i++) {
      const scene = spec.scenes[i];
      const durationSec = Math.max(1, (scene.durationMs || 3000) / 1000);
      const sceneHtml = buildMarketingVideoHtml([scene], {
        ratio: spec.ratio,
        width,
        height,
        brandName: spec.brandName,
      });

      const htmlPath = join(tempDir, `scene-${i}.html`);
      const pngPath = join(tempDir, `scene-${i}.png`);
      const mp4Path = join(tempDir, `scene-${i}.mp4`);

      writeFileSync(htmlPath, sceneHtml, "utf-8");

      execFileSync(
        chromeBin,
        [
          "--headless=new",
          "--disable-gpu",
          "--no-sandbox",
          `--window-size=${width},${height}`,
          `--screenshot=${pngPath}`,
          `file://${htmlPath}`,
        ],
        { timeout: 15_000, stdio: "pipe" },
      );

      const totalFrames = Math.max(24, Math.round(durationSec * fps));
      const fadeDuration = Math.min(0.3, durationSec / 4);
      const fadeOutStart = Math.max(0.1, durationSec - fadeDuration);

      const vfFilter = [
        `zoompan=z='min(zoom+0.0012,1.15)':d=${totalFrames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${height}:fps=${fps}`,
        `fade=t=in:st=0:d=${fadeDuration}`,
        `fade=t=out:st=${fadeOutStart}:d=${fadeDuration}`,
        "format=yuv420p",
      ].join(",");

      execFileSync(
        ffmpegBin,
        [
          "-y",
          "-loop",
          "1",
          "-i",
          pngPath,
          "-t",
          durationSec.toString(),
          "-vf",
          vfFilter,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-r",
          fps.toString(),
          mp4Path,
        ],
        { timeout: 30_000, stdio: "pipe" },
      );

      concatEntries.push(`file '${mp4Path}'`);
    }

    const concatFilePath = join(tempDir, "concat.txt");
    writeFileSync(concatFilePath, concatEntries.join("\n"), "utf-8");

    execFileSync(
      ffmpegBin,
      [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatFilePath,
        "-i",
        spec.audioPath,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        spec.outputPath,
      ],
      { timeout: 60_000, stdio: "pipe" },
    );

    const durationSeconds = probeVideoDurationSeconds(spec.outputPath);
    const bytes = statSync(spec.outputPath).size;

    return {
      videoPath: spec.outputPath,
      width,
      height,
      durationSeconds,
      bytes,
      fps,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export async function renderMarketingVideo(
  spec: VideoRenderSpec,
  options?: VideoCompilerOptions,
): Promise<VideoRenderOutput> {
  if (!spec.scenes || spec.scenes.length === 0) {
    throw new Error("Scenes array cannot be empty");
  }

  if (!existsSync(spec.audioPath)) {
    throw new Error(`Audio file not found: ${spec.audioPath}`);
  }

  const outputDir = dirname(spec.outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  if (options?.engine === "html-ffmpeg") {
    return renderWithHtmlFfmpeg(spec, options);
  }

  try {
    return await renderWithRemotion(spec, options);
  } catch {
    return await renderWithHtmlFfmpeg(spec, options);
  }
}
