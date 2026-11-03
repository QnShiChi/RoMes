import { describe, expect, it } from "vitest";
import { generateAssSubtitles } from "./kinetic-subtitles.ts";

describe("kinetic-subtitles", () => {
  it("generates valid ASS subtitle headers and dialogue events", () => {
    const cues = [
      {
        startMs: 0,
        endMs: 3500,
        text: "Trải nghiệm sức mạnh của AI Agent",
        keywordHighlight: "AI Agent",
      },
    ];
    const ass = generateAssSubtitles(cues, { width: 1080, height: 1920 });
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("PlayResX: 1080");
    expect(ass).toContain("PlayResY: 1920");
    expect(ass).toContain("Dialogue: 0,0:00:00.00,0:00:03.50");
    expect(ass).toContain("{\\c&H00E5FF&}AI Agent{\\r}");
  });
});
