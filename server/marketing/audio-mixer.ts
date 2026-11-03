import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { probeAudioDurationMs } from "./speech-engine.ts";

export type BgmTheme = "tech" | "upbeat" | "chill" | "luxury";

export interface AudioMixInput {
  voicePath: string;
  outputPath: string;
  bgmTheme?: BgmTheme;
  customBgmPath?: string;
  voiceVolume?: number;
  bgmVolume?: number;
  enableDucking?: boolean;
  targetDurationMs?: number;
}

export interface AudioMixOutput {
  mixedAudioPath: string;
  durationMs: number;
  hasBgm: boolean;
}

export interface AudioMixerOptions {
  runner?: (spec: {
    voicePath: string;
    bgmPath: string;
    outputPath: string;
    voiceVolume: number;
    bgmVolume: number;
    enableDucking: boolean;
  }) => Promise<{ durationMs: number }>;
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const BGM_DIR = join(currentDir, "assets", "bgm");

export function getBgmThemePath(theme: BgmTheme): string {
  return join(BGM_DIR, `${theme}.mp3`);
}

export function resolveBgmPath(input: {
  bgmTheme?: BgmTheme;
  customBgmPath?: string;
}): string {
  if (input.customBgmPath) {
    return input.customBgmPath;
  }
  const theme = input.bgmTheme ?? "tech";
  return getBgmThemePath(theme);
}

export async function mixCampaignAudio(
  input: AudioMixInput,
  options?: AudioMixerOptions,
): Promise<AudioMixOutput> {
  if (!existsSync(input.voicePath)) {
    throw new Error(`Voice audio file not found: ${input.voicePath}`);
  }

  const outputDir = dirname(input.outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const bgmPath = resolveBgmPath(input);
  const hasBgm = existsSync(bgmPath);
  const voiceVolume = input.voiceVolume ?? 1.0;
  const bgmVolume = input.bgmVolume ?? 0.25;
  const enableDucking = input.enableDucking ?? true;

  if (options?.runner) {
    const res = await options.runner({
      voicePath: input.voicePath,
      bgmPath,
      outputPath: input.outputPath,
      voiceVolume,
      bgmVolume,
      enableDucking,
    });
    return {
      mixedAudioPath: input.outputPath,
      durationMs: res.durationMs,
      hasBgm,
    };
  }

  const voiceDurationMs = probeAudioDurationMs(input.voicePath);
  const desiredDurationMs = Math.max(voiceDurationMs, input.targetDurationMs ?? 0);
  const padSec = desiredDurationMs > 0 ? Math.max(1, Math.ceil(desiredDurationMs / 1000)) : 0;
  const padFilter = padSec > 0 ? `,apad=whole_dur=${padSec}` : "";

  if (!hasBgm) {
    const args = ["-y", "-i", input.voicePath];
    if (padSec > 0) {
      args.push("-af", `apad=whole_dur=${padSec}`);
    }
    args.push("-c:a", "libmp3lame", input.outputPath);
    execFileSync("ffmpeg", args, {
      timeout: 30_000,
      stdio: "pipe",
    });
  } else if (enableDucking) {
    const filterComplex =
      `[1:a]volume=${bgmVolume}[bgm_raw];` +
      `[0:a]volume=${voiceVolume}${padFilter},asplit=2[voice_mix][voice_sc];` +
      `[bgm_raw][voice_sc]sidechaincompress=threshold=0.08:ratio=6:attack=15:release=300[ducked_bgm];` +
      `[voice_mix][ducked_bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`;

    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input.voicePath,
        "-stream_loop",
        "-1",
        "-i",
        bgmPath,
        "-filter_complex",
        filterComplex,
        "-map",
        "[aout]",
        "-c:a",
        "libmp3lame",
        "-q:a",
        "3",
        input.outputPath,
      ],
      { timeout: 60_000, stdio: "pipe" },
    );
  } else {
    const filterComplex =
      `[1:a]volume=${bgmVolume}[bgm];` +
      `[0:a]volume=${voiceVolume}${padFilter}[voice];` +
      `[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]`;

    execFileSync(
      "ffmpeg",
      [
        "-y",
        "-i",
        input.voicePath,
        "-stream_loop",
        "-1",
        "-i",
        bgmPath,
        "-filter_complex",
        filterComplex,
        "-map",
        "[aout]",
        "-c:a",
        "libmp3lame",
        input.outputPath,
      ],
      { timeout: 60_000, stdio: "pipe" },
    );
  }

  const durationMs = probeAudioDurationMs(input.outputPath);

  return {
    mixedAudioPath: input.outputPath,
    durationMs,
    hasBgm,
  };
}
