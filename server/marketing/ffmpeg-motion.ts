import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CameraMotion, CampaignBeatManifest } from "./beat-schema.ts";
import { generateAssSubtitles, type SubtitleCue } from "./kinetic-subtitles.ts";

export interface BeatMotionFilterOptions {
  frames: number;
  width: number;
  height: number;
  fps: number;
}

export function buildBeatMotionFilter(motion: CameraMotion, opt: BeatMotionFilterOptions): string {
  const { frames, width, height, fps } = opt;
  let zoomExpr = "min(zoom+0.0012,1.15)";
  let xExpr = "'iw/2-(iw/zoom/2)'";
  let yExpr = "'ih/2-(ih/zoom/2)'";

  switch (motion) {
    case "slow_zoom_out":
      zoomExpr = "max(1.15-0.0012*on,1.0)";
      break;
    case "punch_in":
      zoomExpr = "if(lte(on,10),1.0+on*0.02,1.20)";
      break;
    case "pan_left":
      zoomExpr = "1.12";
      xExpr = `'(1-on/${frames})*(iw-iw/zoom)'`;
      break;
    case "pan_right":
      zoomExpr = "1.12";
      xExpr = `'(on/${frames})*(iw-iw/zoom)'`;
      break;
    case "static_drift":
      zoomExpr = "min(zoom+0.0004,1.05)";
      break;
    case "slow_zoom_in":
    default:
      zoomExpr = "min(zoom+0.0012,1.15)";
      break;
  }

  return `scale=${width * 2}:${height * 2},zoompan=z='${zoomExpr}':x=${xExpr}:y=${yExpr}:d=${frames}:s=${width}x${height}:fps=${fps},format=yuv420p`;
}

export interface RenderMotionVideoInput {
  manifest: CampaignBeatManifest;
  audioPath: string;
  outputPath: string;
  fps?: number;
  width?: number;
  height?: number;
}

export async function renderBeatMotionVideo(input: RenderMotionVideoInput): Promise<{
  videoPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
}> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1920;
  const fps = input.fps ?? 30;
  const tempDir = mkdtempSync(join(tmpdir(), "romes-motion-render-"));

  try {
    const concatEntries: string[] = [];
    const cues: SubtitleCue[] = [];
    let currentMs = 0;

    const totalBeats = Math.max(1, input.manifest.beats.length);
    const targetMs = (input.manifest.targetDurationSeconds || 60) * 1000;
    const defaultBeatMs = Math.max(2000, Math.round(targetMs / totalBeats));

    for (let i = 0; i < input.manifest.beats.length; i++) {
      const beat = input.manifest.beats[i];
      const estimateMs = Number.isFinite(beat.durationEstimateMs) && Number(beat.durationEstimateMs) > 0
        ? Number(beat.durationEstimateMs)
        : defaultBeatMs;
      const durationSec = Math.max(1.5, Math.round(estimateMs) / 1000);
      const frames = Math.max(fps * 2, Math.round(durationSec * fps));
      const endMs = currentMs + Math.round(durationSec * 1000);

      cues.push({
        startMs: currentMs,
        endMs,
        text: beat.narration,
        keywordHighlight: beat.keywordHighlight,
      });
      currentMs = endMs;

      let imgPath = beat.imagePath && existsSync(beat.imagePath) && statSync(beat.imagePath).size > 100
        ? beat.imagePath
        : "";

      if (!imgPath) {
        imgPath = join(tempDir, `placeholder-${i}.png`);
        execFileSync("ffmpeg", [
          "-loglevel", "error",
          "-y", "-f", "lavfi", "-i", `color=c=0x111625:s=${width}x${height}`,
          "-frames:v", "1", imgPath,
        ], { timeout: 30_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });
      }

      const segmentMp4 = join(tempDir, `beat-${i}.mp4`);
      const filter = buildBeatMotionFilter(beat.cameraMotion, { frames, width, height, fps });

      execFileSync("ffmpeg", [
        "-loglevel", "error",
        "-y",
        "-loop", "1",
        "-i", imgPath,
        "-t", durationSec.toString(),
        "-vf", filter,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-r", fps.toString(),
        segmentMp4,
      ], { timeout: 60_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });

      concatEntries.push(`file '${segmentMp4}'`);
    }

    const concatTxt = join(tempDir, "concat.txt");
    writeFileSync(concatTxt, concatEntries.join("\n"), "utf8");

    const silentVideo = join(tempDir, "silent.mp4");
    execFileSync("ffmpeg", [
      "-loglevel", "error",
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatTxt,
      "-c", "copy",
      silentVideo,
    ], { timeout: 60_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });

    const assFile = join(tempDir, "subtitles.ass");
    writeFileSync(assFile, generateAssSubtitles(cues, { width, height }), "utf8");

    const outDir = dirname(input.outputPath);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    execFileSync("ffmpeg", [
      "-loglevel", "error",
      "-y",
      "-i", silentVideo,
      "-i", input.audioPath,
      "-vf", `ass=${assFile}`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      input.outputPath,
    ], { timeout: 120_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });

    const stats = statSync(input.outputPath);
    return {
      videoPath: input.outputPath,
      width,
      height,
      durationSeconds: Math.round(currentMs / 1000),
      bytes: stats.size,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
