import { z } from "zod";

export const cameraMotionSchema = z.enum([
  "slow_zoom_in",
  "slow_zoom_out",
  "punch_in",
  "pan_left",
  "pan_right",
  "static_drift",
]);
export type CameraMotion = z.infer<typeof cameraMotionSchema>;

export const collageStyleThemeSchema = z.enum([
  "retro_tech_newspaper",
  "modern_cyber_editorial",
  "bold_flat_pop",
]);
export type CollageStyleTheme = z.infer<typeof collageStyleThemeSchema>;

export const narrativeBeatSchema = z.object({
  beatIndex: z.number().int().positive(),
  durationEstimateMs: z.number().int().positive(),
  narration: z.string().min(1),
  visualPrompt: z.string().min(1),
  cameraMotion: cameraMotionSchema.default("slow_zoom_in"),
  keywordHighlight: z.string().optional(),
  imagePath: z.string().optional(),
});
export type NarrativeBeat = z.infer<typeof narrativeBeatSchema>;

export const campaignBeatManifestSchema = z.object({
  campaignSlug: z.string().min(1),
  targetDurationSeconds: z.number().positive().default(60),
  styleTheme: collageStyleThemeSchema.default("retro_tech_newspaper"),
  beats: z.array(narrativeBeatSchema).min(1),
});
export type CampaignBeatManifest = z.infer<typeof campaignBeatManifestSchema>;

export function parseBeatManifest(input: unknown): CampaignBeatManifest {
  return campaignBeatManifestSchema.parse(input);
}

export function legacyScenesToBeatManifest(
  campaignSlug: string,
  scenes: Array<Record<string, unknown>>,
  _script = "",
): CampaignBeatManifest {
  const motions: CameraMotion[] = ["slow_zoom_in", "punch_in", "pan_left", "slow_zoom_out", "pan_right"];
  const beats: NarrativeBeat[] = scenes.map((s, idx) => {
    const title = String(s.title || `Beat ${idx + 1}`);
    const subtitle = s.subtitle ? String(s.subtitle) : "";
    const prompt = String(s.visualPrompt || `${title}. ${subtitle}`.trim());
    const subtitles = Array.isArray(s.subtitles) && s.subtitles.length > 0 ? String(s.subtitles[0]) : "";
    return {
      beatIndex: idx + 1,
      durationEstimateMs: Math.max(2000, Number(s.durationMs) || 4000),
      narration: subtitles || title,
      visualPrompt: prompt,
      cameraMotion: motions[idx % motions.length],
      keywordHighlight: title.split(/\s+/).slice(0, 2).join(" "),
      imagePath: typeof s.imagePath === "string" ? s.imagePath : undefined,
    };
  });

  return {
    campaignSlug,
    targetDurationSeconds: Math.round(beats.reduce((acc, b) => acc + b.durationEstimateMs, 0) / 1000),
    styleTheme: "retro_tech_newspaper",
    beats,
  };
}
