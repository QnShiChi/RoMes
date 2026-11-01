import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  buildMarketingVideoHtml,
  getDimensionsForRatio,
  type MarketingSceneSpec,
  type VideoRatio,
} from "./video-templates";

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

  const { width, height } = getDimensionsForRatio(spec.ratio);
  const fps = spec.fps ?? 24;
  const chromeBin = resolveChromeBinary(options?.chromePath);
  const ffmpegBin = options?.ffmpegPath || "ffmpeg";

  const outputDir = dirname(spec.outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

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
          `scale=${width}:${height},format=yuv420p`,
          "-c:v",
          "libx264",
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

    // Concatenate scene video clips and mux with campaign audio track
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
