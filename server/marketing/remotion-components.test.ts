import { describe, expect, it } from "vitest";
import { parseStat, resolveSceneLayouts } from "./remotion/layout.ts";
import { captionWindow, parseSubtitleWords } from "./remotion/subtitles.ts";
import type { MarketingSceneSpec } from "./remotion/types.ts";

describe("remotion-components", () => {
  it("parses subtitle sentences into timed word tokens", () => {
    const text = "Muse gửi email tự động chỉ trong một giây";
    const tokens = parseSubtitleWords(text, 60);
    expect(tokens.length).toBe(9);
    expect(tokens[0].word).toBe("Muse");
    expect(tokens[tokens.length - 1].word).toBe("giây");
    expect(tokens[0].startFrame).toBe(0);
    expect(tokens[tokens.length - 1].endFrame).toBeLessThanOrEqual(60);
  });

  it("shows only the caption chunk being spoken", () => {
    const tokens = parseSubtitleWords("a b c d e f g h i j", 100);
    expect(captionWindow(tokens, 0, 4).map((t) => t.word)).toEqual(["a", "b", "c", "d"]);
    expect(captionWindow(tokens, 45, 4).map((t) => t.word)).toEqual(["e", "f", "g", "h"]);
    expect(captionWindow(tokens, 999, 4).map((t) => t.word)).toEqual(["i", "j"]);
  });

  it("never repeats a body layout in consecutive scenes", () => {
    const features = (bulletPoints: string[]): MarketingSceneSpec => ({ type: "features", title: "x", subtitle: "y", bulletPoints });
    const scenes: MarketingSceneSpec[] = [
      { type: "hook", title: "Hook" },
      features(["10x | Năng suất", "Giảm 40% chi phí"]),
      features(["Trước: thủ công", "Sau: tự động"]),
      features(["Một ý"]),
      features(["Hai", "Ba"]),
      { type: "cta", title: "Bắt đầu" },
    ];
    const layouts = resolveSceneLayouts(scenes);
    expect(layouts[0]).toBe("hero");
    expect(layouts[layouts.length - 1]).toBe("cta");
    for (let i = 1; i < layouts.length; i++) expect(layouts[i]).not.toBe(layouts[i - 1]);
    expect(new Set(layouts.slice(1, -1)).size).toBeGreaterThanOrEqual(3);
  });

  it("picks the stats layout for a repeated scene whose bullets are numbers", () => {
    const layouts = resolveSceneLayouts([
      { type: "features", title: "a", bulletPoints: ["Một", "Hai", "Ba"] },
      { type: "features", title: "b", bulletPoints: ["10x | Năng suất", "40% | Chi phí"] },
    ]);
    expect(layouts).toEqual(["cards", "stats"]);
  });

  it("keeps explicitly requested layouts", () => {
    const layouts = resolveSceneLayouts([
      { type: "problem", title: "p" },
      { type: "stats", title: "s", bulletPoints: ["10x"] },
      { type: "quote", title: "q", subtitle: "z" },
    ]);
    expect(layouts).toEqual(["problem", "stats", "quote"]);
  });

  it("reads numbers, units and labels from stat bullets", () => {
    expect(parseStat("10x | Năng suất")).toEqual({ value: 10, prefix: "", suffix: "x", label: "Năng suất" });
    expect(parseStat("Giảm 40% chi phí")).toEqual({ value: 40, prefix: "Giảm", suffix: "%", label: "chi phí" });
    expect(parseStat("Không có số")).toBeNull();
  });
});
