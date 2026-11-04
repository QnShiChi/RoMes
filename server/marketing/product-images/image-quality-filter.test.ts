import { describe, expect, it } from "vitest";
import { filterCandidates } from "./image-quality-filter.ts";
import type { ProductImageCandidate } from "./types.ts";

describe("ImageQualityFilter", () => {
  it("filters out low-resolution images, watermarked domains, and duplicates", () => {
    const raw: ProductImageCandidate[] = [
      { url: "https://shutterstock.com/image-photo/preview-123.jpg", title: "Watermarked preview", width: 1200, height: 800 },
      { url: "https://cdn.example.com/tiny-icon.jpg", title: "Tiny icon", width: 150, height: 150 },
      { url: "https://cdn.meta.com/muse-launch.jpg", title: "Meta Muse Launch", width: 1920, height: 1080 },
      { url: "https://cdn.meta.com/muse-launch.jpg", title: "Duplicate image", width: 1920, height: 1080 },
      { url: "https://press.meta.com/interface.png", title: "Meta Muse UI", width: 1080, height: 720 },
    ];

    const clean = filterCandidates(raw);
    expect(clean).toHaveLength(2);
    expect(clean[0]!.url).toBe("https://cdn.meta.com/muse-launch.jpg");
    expect(clean[1]!.url).toBe("https://press.meta.com/interface.png");
  });

  it("filters out non-https or empty URLs", () => {
    const raw: ProductImageCandidate[] = [
      { url: "http://insecure.com/photo.jpg", title: "Insecure" },
      { url: "", title: "Empty" },
      { url: "https://valid.com/photo.webp", title: "Valid" },
    ];

    const clean = filterCandidates(raw);
    expect(clean).toHaveLength(1);
    expect(clean[0]!.url).toBe("https://valid.com/photo.webp");
  });
});
