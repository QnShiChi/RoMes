import { existsSync, statSync } from "node:fs";

export interface ImageReviewInput {
  filePath: string;
  width?: number;
  height?: number;
  bytes?: number;
  prompt: string;
  targetAspectRatio?: "16:9" | "9:16" | "1:1";
  minBytes?: number;
  minWidth?: number;
  minHeight?: number;
}

export interface ImageReviewResult {
  passed: boolean;
  score: number; // 0 - 100
  reasons: string[];
  suggestedPromptRefinement?: string;
}

const DEFAULT_MIN_BYTES = 35_000; // 35 KB
const DEFAULT_MIN_WIDTH = 600;
const DEFAULT_MIN_HEIGHT = 400;

const COMMERCIAL_ENHANCEMENTS = [
  "commercial studio product photography, 8k resolution, Hasselblad H6D-100c, 100mm macro f/2.8 lens",
  "softbox diffused three-point lighting, crisp cinematic rim light, professional color grading",
  "ultra-clean premium aesthetic, hyper-detailed texture, depth of field, photorealistic realism",
];

const NEGATIVE_EXCLUSIONS = "no watermark, no cartoon, no blurry artifacts, no distorted text, no bad geometry, no extra limbs, no paper collage, no low resolution";

export class ImageReviewer {
  /**
   * Reviews a candidate or generated image against quality, resolution, file integrity, and aspect ratio standards.
   */
  reviewImage(input: ImageReviewInput): ImageReviewResult {
    const reasons: string[] = [];
    let score = 100;

    const minBytes = input.minBytes ?? DEFAULT_MIN_BYTES;
    const minWidth = input.minWidth ?? DEFAULT_MIN_WIDTH;
    const minHeight = input.minHeight ?? DEFAULT_MIN_HEIGHT;

    // 1. File existence & size check
    if (!input.filePath || !existsSync(input.filePath)) {
      return {
        passed: false,
        score: 0,
        reasons: ["Image file does not exist on disk."],
        suggestedPromptRefinement: this.refinePrompt(input.prompt, 1),
      };
    }

    let actualBytes = input.bytes;
    if (!actualBytes || actualBytes <= 0) {
      try {
        actualBytes = statSync(input.filePath).size;
      } catch {
        actualBytes = 0;
      }
    }

    if (actualBytes < minBytes) {
      score -= 50;
      reasons.push(`Image file size too small (${Math.round(actualBytes / 1024)}KB < ${Math.round(minBytes / 1024)}KB), likely placeholder or low quality.`);
    }

    // 2. Dimensions check
    const width = input.width ?? 0;
    const height = input.height ?? 0;

    if (width > 0 && width < minWidth) {
      score -= 25;
      reasons.push(`Image width (${width}px) is below minimum threshold of ${minWidth}px.`);
    }

    if (height > 0 && height < minHeight) {
      score -= 25;
      reasons.push(`Image height (${height}px) is below minimum threshold of ${minHeight}px.`);
    }

    // 3. Aspect Ratio verification
    if (input.targetAspectRatio && width > 0 && height > 0) {
      if (input.targetAspectRatio === "9:16" && width >= height) {
        score -= 20;
        reasons.push(`Target aspect ratio is 9:16 (vertical for Shorts/Reels/TikTok), but image is horizontal or square (${width}x${height}).`);
      } else if (input.targetAspectRatio === "16:9" && height >= width) {
        score -= 20;
        reasons.push(`Target aspect ratio is 16:9 (horizontal), but image is vertical or square (${width}x${height}).`);
      } else if (input.targetAspectRatio === "1:1") {
        const ratio = width / height;
        if (ratio < 0.85 || ratio > 1.15) {
          score -= 15;
          reasons.push(`Target aspect ratio is 1:1, but image ratio is ${ratio.toFixed(2)}.`);
        }
      }
    }

    const passed = score >= 70 && reasons.length === 0;

    return {
      passed,
      score: Math.max(0, score),
      reasons,
      ...(passed ? {} : { suggestedPromptRefinement: this.refinePrompt(input.prompt, 1, { targetAspectRatio: input.targetAspectRatio }) }),
    };
  }

  /**
   * Refines and standardizes a prompt into a 5-layer commercial prompt.
   * If an attempt failed, strengthens camera angle, lighting, and negative exclusions.
   */
  refinePrompt(
    originalPrompt: string,
    attempt: number = 1,
    context?: { topic?: string; targetAspectRatio?: "16:9" | "9:16" | "1:1" }
  ): string {
    const clean = originalPrompt
      .replace(/[;"'[\]{}()]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Already 5-layer enriched?
    if (clean.includes("Hasselblad") && clean.includes("lighting") && clean.includes("no watermark")) {
      // Re-roll angle or lighting emphasis on retries
      if (attempt > 1) {
        const angleModifier = attempt === 2
          ? "dynamic 45-degree isometric macro angle, dramatic rim lighting"
          : "straight-on eye-level commercial hero shot, soft ambient light";
        return `${clean}, ${angleModifier}`;
      }
      return clean;
    }

    const layers: string[] = [clean];

    // Layer 2 & 3: Lighting & Camera equipment
    const enhancementIndex = Math.min(attempt - 1, COMMERCIAL_ENHANCEMENTS.length - 1);
    layers.push(COMMERCIAL_ENHANCEMENTS[enhancementIndex] || COMMERCIAL_ENHANCEMENTS[0]!);

    // Layer 4: Aspect ratio hint
    if (context?.targetAspectRatio === "9:16") {
      layers.push("vertical portrait orientation, 9:16 aspect ratio, mobile video screen composition");
    } else if (context?.targetAspectRatio === "16:9") {
      layers.push("horizontal widescreen cinematic orientation, 16:9 aspect ratio");
    }

    // Layer 5: Strict negative exclusions
    layers.push(`negative prompt: ${NEGATIVE_EXCLUSIONS}`);

    return layers.filter(Boolean).join(", ");
  }
}
