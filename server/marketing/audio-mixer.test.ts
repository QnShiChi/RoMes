import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getBgmThemePath,
  mixCampaignAudio,
  resolveBgmPath,
  type AudioMixInput,
} from "./audio-mixer.ts";

describe("audio-mixer", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romes-mixer-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws error if voice audio file does not exist", async () => {
    const input: AudioMixInput = {
      voicePath: join(tempDir, "non-existent-voice.wav"),
      outputPath: join(tempDir, "output.mp3"),
    };

    await expect(mixCampaignAudio(input)).rejects.toThrow(/voice audio file not found/i);
  });

  it("resolves built-in theme BGM paths and fallback correctly", () => {
    const techPath = getBgmThemePath("tech");
    expect(techPath.endsWith("tech.mp3")).toBe(true);

    const upbeatPath = getBgmThemePath("upbeat");
    expect(upbeatPath.endsWith("upbeat.mp3")).toBe(true);

    const custom = join(tempDir, "custom.mp3");
    expect(resolveBgmPath({ customBgmPath: custom })).toBe(custom);

    const fallback = resolveBgmPath({});
    expect(fallback.endsWith("tech.mp3")).toBe(true);
  });

  it("mixes voice audio with background music using sidechain ducking", async () => {
    // Generate a quick 2-second voice sine wave
    const voiceFile = join(tempDir, "voice.wav");
    const bgmFile = join(tempDir, "custom-bgm.mp3");
    const outputFile = join(tempDir, "mixed-output.mp3");

    // Create minimal mock audio files using ffmpeg if available or test with custom runner
    writeFileSync(voiceFile, "mock-voice-content");
    writeFileSync(bgmFile, "mock-bgm-content");

    const result = await mixCampaignAudio(
      {
        voicePath: voiceFile,
        customBgmPath: bgmFile,
        outputPath: outputFile,
      },
      {
        runner: async ({ outputPath }: { outputPath: string }) => {
          writeFileSync(outputPath, Buffer.from("mock-mixed-audio-output"));
          return { durationMs: 2500 };
        },
      },
    );

    expect(existsSync(result.mixedAudioPath)).toBe(true);
    expect(result.durationMs).toBe(2500);
    expect(result.hasBgm).toBe(true);
  });

  it("mixes real voice audio and built-in BGM with FFmpeg end-to-end", async () => {
    const voiceFile = join(tempDir, "real-voice.wav");
    const outputFile = join(tempDir, "real-mixed.mp3");

    // Generate real 1-second sine audio via ffmpeg
    const { execFileSync } = await import("node:child_process");
    execFileSync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=1",
      voiceFile,
    ]);

    const result = await mixCampaignAudio({
      voicePath: voiceFile,
      bgmTheme: "tech",
      outputPath: outputFile,
    });

    expect(existsSync(result.mixedAudioPath)).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(900);
    expect(result.hasBgm).toBe(true);
  });
});
