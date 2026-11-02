import { describe, expect, it } from "vitest";
import { parseSubtitleWords } from "./remotion/subtitles.ts";

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
});
