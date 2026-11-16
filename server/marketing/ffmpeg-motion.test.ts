import { describe, expect, it } from "vitest";
import { buildBeatMotionFilter } from "./ffmpeg-motion.ts";

describe("ffmpeg-motion", () => {
  it("builds correct 2.5D zoompan filter for slow_zoom_in", () => {
    const filter = buildBeatMotionFilter("slow_zoom_in", { frames: 120, width: 1080, height: 1920, fps: 30 });
    expect(filter).toContain("zoompan=");
    expect(filter).toContain("min(zoom+0.0012,1.15)");
    expect(filter).toContain("s=1080x1920");
  });

  it("builds correct 2.5D filter for punch_in", () => {
    const filter = buildBeatMotionFilter("punch_in", { frames: 90, width: 1080, height: 1920, fps: 30 });
    expect(filter).toContain("zoompan=");
    expect(filter).toContain("if(lte(on,10)");
  });

  it("builds correct 2.5D filter for pan_left and pan_right with numeric frame count", () => {
    const left = buildBeatMotionFilter("pan_left", { frames: 90, width: 1080, height: 1920, fps: 30 });
    expect(left).toContain("(1-on/90)");
    expect(left).not.toContain("on/d");

    const right = buildBeatMotionFilter("pan_right", { frames: 120, width: 1080, height: 1920, fps: 30 });
    expect(right).toContain("(on/120)");
    expect(right).not.toContain("on/d");
  });

  it("renders a beat motion video end-to-end with multiple beats and xfade", async () => {
    const { mkdtempSync, rmSync, existsSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");
    const { renderBeatMotionVideo } = await import("./ffmpeg-motion.ts");

    const tempDir = mkdtempSync(join(tmpdir(), "motion-test-"));
    try {
      const audioPath = join(tempDir, "audio.mp3");
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=4", "-c:a", "libmp3lame", audioPath]);

      // Create a dummy video clip
      const sampleVideo = join(tempDir, "sample.mp4");
      execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc=size=320x240:rate=30", "-t", "2", "-c:v", "libx264", sampleVideo]);

      const outputPath = join(tempDir, "final.mp4");
      const result = await renderBeatMotionVideo({
        manifest: {
          campaignSlug: "test-campaign",
          targetDurationSeconds: 4,
          styleTheme: "retro_tech_newspaper",
          beats: [
            { beatIndex: 1, durationEstimateMs: 2000, narration: "Beat One", visualPrompt: "Scene 1", cameraMotion: "slow_zoom_in", videoPath: sampleVideo },
            { beatIndex: 2, durationEstimateMs: 2000, narration: "Beat Two", visualPrompt: "Scene 2", cameraMotion: "pan_right" },
          ],
        },
        audioPath,
        outputPath,
        width: 720,
        height: 1280,
      });

      expect(existsSync(result.videoPath)).toBe(true);
      expect(result.durationSeconds).toBeGreaterThanOrEqual(3);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
