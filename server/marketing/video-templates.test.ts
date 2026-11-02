import { describe, expect, it } from "vitest";

import {
  buildMarketingSceneHtml,
  buildMarketingVideoHtml,
  getDimensionsForRatio,
  type MarketingSceneSpec,
  type TemplateOptions,
} from "./video-templates.ts";

describe("video-templates", () => {
  it("computes standard resolutions for aspect ratios", () => {
    expect(getDimensionsForRatio("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(getDimensionsForRatio("16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("escapes unsafe HTML characters in scene text", () => {
    const scene: MarketingSceneSpec = {
      type: "hook",
      title: "RoMes & AI <Special> Deal",
      subtitle: 'Save "50%" today!',
      durationMs: 3000,
    };
    const html = buildMarketingSceneHtml(scene, {
      ratio: "9:16",
      width: 1080,
      height: 1920,
    });

    expect(html).toContain("RoMes &amp; AI &lt;Special&gt; Deal");
    expect(html).toContain("Save &quot;50%&quot; today!");
    expect(html).not.toContain("<Special>");
  });

  it("renders Ken Burns animation and image tag for product scenes", () => {
    const scene: MarketingSceneSpec = {
      type: "product",
      title: "Automate Everything",
      imagePath: "/tmp/product-preview.png",
      durationMs: 4000,
    };
    const html = buildMarketingSceneHtml(scene, {
      ratio: "16:9",
      width: 1920,
      height: 1080,
    });

    expect(html).toContain("ken-burns");
    expect(html).toContain("/tmp/product-preview.png");
    expect(html).toContain("Automate Everything");
  });

  it("assembles complete multi-scene marketing HTML with seek/timeline controller", () => {
    const scenes: MarketingSceneSpec[] = [
      {
        type: "hook",
        title: "Bí quyết tăng tốc marketing 10x",
        subtitle: "Không cần thuê ngoài",
        durationMs: 3000,
        subtitles: ["Bí quyết tăng tốc marketing 10x"],
      },
      {
        type: "product",
        title: "Hệ thống đa đại lý AI RoMes",
        imagePath: "/tmp/romes-shot.jpg",
        durationMs: 4000,
      },
      {
        type: "cta",
        title: "Thử ngay hôm nay",
        subtitle: "Link tại bio",
        durationMs: 3000,
      },
    ];

    const options: TemplateOptions = {
      ratio: "9:16",
      width: 1080,
      height: 1920,
      brandName: "RoMes AI",
    };

    const doc = buildMarketingVideoHtml(scenes, options);

    expect(doc).toContain("<!DOCTYPE html>");
    expect(doc).toContain("window.__seekToMs");
    expect(doc).toContain("RoMes AI");
    expect(doc).toContain("Bí quyết tăng tốc marketing 10x");
    expect(doc).toContain("Hệ thống đa đại lý AI RoMes");
    expect(doc).toContain("Thử ngay hôm nay");
    expect(doc).toContain("1080px");
    expect(doc).toContain("1920px");
  });

  it("supports dynamic scenes with animationType and floatingTags", () => {
    const scene: MarketingSceneSpec = {
      type: "features",
      title: "Tự động gửi email",
      subtitle: "Chỉ với 1 câu lệnh",
      animationType: "email",
      floatingTags: ["Tiết kiệm 2h", "100% tự động"],
      durationMs: 3000,
    };
    expect(scene.animationType).toBe("email");
    expect(scene.floatingTags?.length).toBe(2);
  });
});
