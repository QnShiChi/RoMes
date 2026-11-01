import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { MarketingSceneSpec } from "./video-templates";
import {
  renderMarketingVideo,
  type VideoRenderSpec,
} from "./video-compiler";

describe("video-compiler", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "romes-compiler-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("throws error if scenes array is empty", async () => {
    const audioPath = join(tempDir, "audio.mp3");
    writeFileSync(audioPath, "dummy");

    const spec: VideoRenderSpec = {
      campaignSlug: "test",
      scenes: [],
      audioPath,
      ratio: "9:16",
      outputPath: join(tempDir, "out.mp4"),
    };

    await expect(renderMarketingVideo(spec)).rejects.toThrow(/scenes array cannot be empty/i);
  });

  it("throws error if audio file does not exist", async () => {
    const spec: VideoRenderSpec = {
      campaignSlug: "test",
      scenes: [
        {
          type: "hook",
          title: "Test Hook",
          durationMs: 2000,
        },
      ],
      audioPath: join(tempDir, "missing-audio.mp3"),
      ratio: "9:16",
      outputPath: join(tempDir, "out.mp4"),
    };

    await expect(renderMarketingVideo(spec)).rejects.toThrow(/audio file not found/i);
  });

  it("renders a marketing video end-to-end with Chrome headless and FFmpeg", async () => {
    const audioPath = join(tempDir, "audio.mp3");
    const outputPath = join(tempDir, "final-video.mp4");

    // Generate a quick 2-second audio file using ffmpeg
    const { execFileSync } = await import("node:child_process");
    execFileSync("ffmpeg", [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-c:a",
      "libmp3lame",
      audioPath,
    ]);

    const scenes: MarketingSceneSpec[] = [
      {
        type: "hook",
        title: "RoMes AI Engine",
        subtitle: "Tự động hóa video",
        durationMs: 1500,
      },
      {
        type: "cta",
        title: "Bắt đầu ngay hôm nay",
        durationMs: 1500,
      },
    ];

    const result = await renderMarketingVideo({
      campaignSlug: "romes-launch",
      scenes,
      audioPath,
      ratio: "16:9",
      outputPath,
      fps: 24,
    });

    expect(existsSync(result.videoPath)).toBe(true);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1080);
    expect(result.durationSeconds).toBeGreaterThan(0);
    expect(statSync(result.videoPath).size).toBeGreaterThan(1000);
  });
});
