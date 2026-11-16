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

let cachedEncoder: { codec: string; presetArgs: string[] } | null = null;

function getHardwareVideoEncoder(): { codec: string; presetArgs: string[] } {
  if (cachedEncoder) return cachedEncoder;
  try {
    const encoders = execFileSync("ffmpeg", ["-encoders"], { encoding: "utf8", timeout: 3000, stdio: "pipe" });
    if (encoders.includes("h264_nvenc")) {
      // Verify NVENC actually works (libcuda.so.1 and an NVIDIA GPU are present)
      execFileSync(
        "ffmpeg",
        ["-loglevel", "error", "-f", "lavfi", "-i", "color=c=black:s=256x256:d=0.1", "-c:v", "h264_nvenc", "-f", "null", "-"],
        { timeout: 3000, stdio: "pipe" },
      );
      cachedEncoder = { codec: "h264_nvenc", presetArgs: ["-preset", "p4"] };
      return cachedEncoder;
    }
  } catch {
    // fallback to CPU libx264 when NVENC is compiled in but no GPU/CUDA is available
  }
  cachedEncoder = { codec: "libx264", presetArgs: ["-preset", "veryfast"] };
  return cachedEncoder;
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
    const encoder = getHardwareVideoEncoder();

    const totalBeats = Math.max(1, input.manifest.beats.length);
    const targetSec = Math.max(2, input.manifest.targetDurationSeconds || 30);
    const transDur = totalBeats > 1 ? 0.35 : 0;

    // Distribute target duration across beats proportionally or evenly
    const rawWeights = input.manifest.beats.map((b) =>
      Number.isFinite(b.durationEstimateMs) && Number(b.durationEstimateMs) > 0
        ? Number(b.durationEstimateMs)
        : 1,
    );
    const sumWeight = rawWeights.reduce((a, b) => a + b, 0) || totalBeats;
    const netDur = rawWeights.map((w) => (w / sumWeight) * targetSec);

    // Compute raw render duration for each segment (compensating for xfade overlap on non-last segments)
    const renderDur = netDur.map((d, i) => (i < totalBeats - 1 ? d + transDur : d));

    let elapsedMs = 0;
    for (let i = 0; i < totalBeats; i++) {
      const beat = input.manifest.beats[i];
      const startMs = Math.round(elapsedMs);
      const endMs = i === totalBeats - 1 ? Math.round(targetSec * 1000) : Math.round(elapsedMs + netDur[i] * 1000);
      elapsedMs += netDur[i] * 1000;

      cues.push({
        startMs,
        endMs,
        text: beat.narration,
        keywordHighlight: beat.keywordHighlight,
      });

      const durationSec = renderDur[i];
      const frames = Math.max(fps * 2, Math.round(durationSec * fps));

      const candidateVideo = beat.videoPath || (beat.imagePath && /\.(mp4|mov|webm|mkv)$/i.test(beat.imagePath) ? beat.imagePath : "");
      const isVideoAsset = Boolean(candidateVideo && existsSync(candidateVideo) && statSync(candidateVideo).size > 1000);

      const segmentMp4 = join(tempDir, `beat-${i}.mp4`);

      if (isVideoAsset) {
        // Smart scale and crop real video footage to fill exact dimensions with aspect ratio preserved
        const videoFilter = `scale=w=${width}:h=${height}:force_original_aspect_ratio=increase,crop=${width}:${height},format=yuv420p`;
        execFileSync("ffmpeg", [
          "-loglevel", "error",
          "-y",
          "-stream_loop", "-1",
          "-i", candidateVideo,
          "-t", durationSec.toString(),
          "-vf", videoFilter,
          "-an",
          "-c:v", encoder.codec,
          ...encoder.presetArgs,
          "-r", fps.toString(),
          segmentMp4,
        ], { timeout: 60_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });
      } else {
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

        const filter = buildBeatMotionFilter(beat.cameraMotion, { frames, width, height, fps });

        execFileSync("ffmpeg", [
          "-loglevel", "error",
          "-y",
          "-loop", "1",
          "-i", imgPath,
          "-t", durationSec.toString(),
          "-vf", filter,
          "-c:v", encoder.codec,
          ...encoder.presetArgs,
          "-r", fps.toString(),
          segmentMp4,
        ], { timeout: 60_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });
      }

      concatEntries.push(`file '${segmentMp4}'`);
    }

    const silentVideo = join(tempDir, "silent.mp4");
    let usedXfade = false;

    if (concatEntries.length > 1) {
      try {
        const transList = ["smoothleft", "fade", "dissolve", "circlecrop", "wipeleft"];
        const transDur = 0.35;
        const inputs: string[] = [];
        for (let i = 0; i < input.manifest.beats.length; i++) {
          inputs.push("-i", join(tempDir, `beat-${i}.mp4`));
        }

        let filterComplex = "";
        let prevNode = "[0:v]";
        let currentOffset = 0;

        for (let i = 0; i < totalBeats - 1; i++) {
          currentOffset += netDur[i];
          const nextInput = `[${i + 1}:v]`;
          const outNode = i === totalBeats - 2 ? "[v_final]" : `[v${i + 1}]`;
          const transition = transList[i % transList.length];
          filterComplex += `${prevNode}${nextInput}xfade=transition=${transition}:duration=${transDur}:offset=${currentOffset.toFixed(2)}${outNode};`;
          prevNode = outNode;
        }

        filterComplex = filterComplex.replace(/;$/, "");

        execFileSync("ffmpeg", [
          "-loglevel", "error",
          "-y",
          ...inputs,
          "-filter_complex", filterComplex,
          "-map", "[v_final]",
          "-c:v", encoder.codec,
          ...encoder.presetArgs,
          silentVideo,
        ], { timeout: 120_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });

        usedXfade = true;
      } catch {
        usedXfade = false;
      }
    }

    if (!usedXfade) {
      const concatTxt = join(tempDir, "concat.txt");
      writeFileSync(concatTxt, concatEntries.join("\n"), "utf8");

      execFileSync("ffmpeg", [
        "-loglevel", "error",
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", concatTxt,
        "-c", "copy",
        silentVideo,
      ], { timeout: 60_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });
    }

    const outDir = dirname(input.outputPath);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    execFileSync("ffmpeg", [
      "-loglevel", "error",
      "-y",
      "-i", silentVideo,
      "-i", input.audioPath,
      "-c:v", encoder.codec,
      ...encoder.presetArgs,
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "192k",
      "-t", targetSec.toFixed(2),
      "-shortest",
      input.outputPath,
    ], { timeout: 120_000, maxBuffer: 50 * 1024 * 1024, stdio: "pipe" });

    const stats = statSync(input.outputPath);
    return {
      videoPath: input.outputPath,
      width,
      height,
      durationSeconds: Math.round(targetSec),
      bytes: stats.size,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
