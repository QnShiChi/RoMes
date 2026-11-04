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
});
