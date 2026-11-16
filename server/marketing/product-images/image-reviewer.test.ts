import { describe, expect, it } from "vitest";
import { ImageReviewer } from "./image-reviewer.ts";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("ImageReviewer", () => {
  const reviewer = new ImageReviewer();

  it("passes high-quality image meeting size and dimension thresholds", () => {
    const testFile = join(tmpdir(), "test_valid_image.jpg");
    // Create dummy buffer > 40KB
    writeFileSync(testFile, Buffer.alloc(50_000, 0xff));

    const result = reviewer.reviewImage({
      filePath: testFile,
      width: 1200,
      height: 800,
      bytes: 50_000,
      prompt: "Aluminum mechanical keyboard on walnut desk",
      targetAspectRatio: "16:9",
    });

    unlinkSync(testFile);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.reasons).toHaveLength(0);
  });

  it("fails image with low file size or tiny resolution and suggests prompt refinement", () => {
    const testFile = join(tmpdir(), "test_tiny_image.jpg");
    writeFileSync(testFile, Buffer.alloc(15_000, 0x00)); // only 15KB

    const result = reviewer.reviewImage({
      filePath: testFile,
      width: 400,
      height: 300,
      bytes: 15_000,
      prompt: "keyboard",
      targetAspectRatio: "16:9",
    });

    unlinkSync(testFile);

    expect(result.passed).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.suggestedPromptRefinement).toContain("Hasselblad");
    expect(result.suggestedPromptRefinement).toContain("no watermark");
  });

  it("detects aspect ratio mismatches for vertical video (9:16)", () => {
    const testFile = join(tmpdir(), "test_ratio_image.jpg");
    writeFileSync(testFile, Buffer.alloc(60_000, 0xff));

    const result = reviewer.reviewImage({
      filePath: testFile,
      width: 1920,
      height: 1080, // horizontal 16:9 when 9:16 requested
      bytes: 60_000,
      prompt: "Vertical video shot",
      targetAspectRatio: "9:16",
    });

    unlinkSync(testFile);

    expect(result.passed).toBe(false);
    expect(result.reasons[0]).toContain("9:16");
  });

  it("refines basic prompts into 5-layer commercial prompts", () => {
    const refined = reviewer.refinePrompt("Monsgeek M1 mechanical keyboard", 1, { targetAspectRatio: "9:16" });
    expect(refined).toContain("Monsgeek M1 mechanical keyboard");
    expect(refined).toContain("commercial studio product photography");
    expect(refined).toContain("9:16 aspect ratio");
    expect(refined).toContain("negative prompt: no watermark");
  });
});
