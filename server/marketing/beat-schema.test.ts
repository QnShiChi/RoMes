import { describe, expect, it } from "vitest";
import { parseBeatManifest, legacyScenesToBeatManifest } from "./beat-schema.ts";

describe("beat-schema", () => {
  it("validates a compliant beat manifest", () => {
    const valid = {
      campaignSlug: "ai-agent-vs-chatgpt",
      targetDurationSeconds: 60,
      styleTheme: "retro_tech_newspaper",
      beats: [
        {
          beatIndex: 1,
          durationEstimateMs: 4000,
          narration: "Khi nói đến AI, ai cũng nghĩ đến ChatGPT.",
          visualPrompt: "A torn paper collage of ChatGPT interface",
          cameraMotion: "slow_zoom_in",
          keywordHighlight: "ChatGPT",
        },
      ],
    };
    const parsed = parseBeatManifest(valid);
    expect(parsed.beats).toHaveLength(1);
    expect(parsed.beats[0].cameraMotion).toBe("slow_zoom_in");
  });

  it("converts legacy scenes array to beat manifest smoothly", () => {
    const legacyScenes = [
      { type: "split", title: "So sánh", bulletPoints: ["A", "B"], durationMs: 5000 },
      { type: "cta", title: "Đăng ký", durationMs: 4000 },
    ];
    const converted = legacyScenesToBeatManifest("test-campaign", legacyScenes, "Lời thoại đầy đủ cho video");
    expect(converted.beats).toHaveLength(2);
    expect(converted.beats[0].durationEstimateMs).toBe(5000);
    expect(converted.beats[0].cameraMotion).toBeDefined();
  });
});
