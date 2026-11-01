import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  generateMarketingSpeech,
  probeAudioDurationMs,
  type SpeechGenerationInput,
} from "./speech-engine.ts";

describe("speech-engine", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romes-speech-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("rejects empty or whitespace-only script", async () => {
    const input: SpeechGenerationInput = {
      script: "   ",
      campaignSlug: "test-campaign",
      outputDir: tempDir,
    };
    await expect(generateMarketingSpeech(input)).rejects.toThrow(/script cannot be empty/i);
  });

  it("creates outputDir if it does not exist and saves speech file", async () => {
    const targetDir = join(tempDir, "nested", "voice");
    const fakeAudio = Buffer.from("RIFF....WAVEfmt ....data....fake audio bytes");

    const result = await generateMarketingSpeech(
      {
        script: "Xin chào, đây là video marketing của RoMes!",
        campaignSlug: "demo-campaign",
        outputDir: targetDir,
        voice: "Puck",
      },
      {
        synthesizer: async () => fakeAudio,
        probeAudioDuration: () => 3500,
      },
    );

    expect(existsSync(result.audioPath)).toBe(true);
    expect(result.durationMs).toBe(3500);
    expect(result.format).toBe("wav");
    expect(result.bytes).toBe(fakeAudio.byteLength);
    expect(result.model).toBe("gemini-3.8-flash-tts");
    expect(readFileSync(result.audioPath)).toEqual(fakeAudio);
  });

  it("handles custom language, voice, and audio formats", async () => {
    const fakeMp3 = Buffer.from([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00]);

    const result = await generateMarketingSpeech(
      {
        script: "Revolutionize your team workflow with RoMes AI agents.",
        campaignSlug: "en-campaign",
        outputDir: tempDir,
        language: "en-US",
        voice: "Aoede",
      },
      {
        synthesizer: async () => fakeMp3,
        probeAudioDuration: () => 4200,
      },
    );

    expect(result.audioPath.endsWith(".mp3")).toBe(true);
    expect(result.format).toBe("mp3");
    expect(result.durationMs).toBe(4200);
  });

  it("probes audio duration accurately using probeAudioDurationMs with fallback", () => {
    // Non-existent or empty file returns 0 without crashing
    const missing = join(tempDir, "missing.wav");
    expect(probeAudioDurationMs(missing)).toBe(0);

    // Creates a dummy file and tests safe fallback
    const dummy = join(tempDir, "dummy.txt");
    writeFileSync(dummy, "not audio");
    expect(probeAudioDurationMs(dummy)).toBe(0);
  });
});
