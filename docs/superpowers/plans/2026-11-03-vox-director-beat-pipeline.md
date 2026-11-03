# Vox-Director Beat Pipeline & 2.5D Kinetic Motion Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the video generation pipeline into a rapid beat-driven Vox-style paper-collage explainer engine using native FFmpeg 2.5D camera motion and kinetic `.ass` subtitles, removing the fragile Chrome headless screenshot dependency.

**Architecture:** Poppy structures voiceover into 8–12 structured beats (`beats.json`), Finch batch-generates unique 5-layer collage keyframes per beat, and Momo invokes a native FFmpeg 2.5D compositor that applies camera motion filters, burns word-highlighted ASS subtitles, and masters audio ducking.

**Tech Stack:** TypeScript, Node.js, Zod, FFmpeg, ASS Subtitles, Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-03-vox-director-beat-pipeline-design.md`](docs/superpowers/specs/2026-11-03-vox-director-beat-pipeline-design.md)

## Global Constraints

- Do not use Chrome headless or Puppeteer screenshotting for video frames.
- Follow `AGENTS.md` comment rules: write comments only for what the code cannot say.
- Maintain full backwards compatibility with existing `scenes` array schema in `generateMarketingVideoWorkflow`.
- Output video must be 1080x1920 (9:16) 30 FPS with AAC audio.

---

### Task 1: Beat Schema & Manifest Validator

**Files:**
- Create: `server/marketing/beat-schema.ts`
- Test: `server/marketing/beat-schema.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CameraMotion = "slow_zoom_in" | "slow_zoom_out" | "punch_in" | "pan_left" | "pan_right" | "static_drift";
  export type CollageStyleTheme = "retro_tech_newspaper" | "modern_cyber_editorial" | "bold_flat_pop";
  export interface NarrativeBeat {
    beatIndex: number;
    durationEstimateMs: number;
    narration: string;
    visualPrompt: string;
    cameraMotion: CameraMotion;
    keywordHighlight?: string;
    imagePath?: string;
  }
  export interface CampaignBeatManifest {
    campaignSlug: string;
    targetDurationSeconds: number;
    styleTheme: CollageStyleTheme;
    beats: NarrativeBeat[];
  }
  export function parseBeatManifest(input: unknown): CampaignBeatManifest;
  export function legacyScenesToBeatManifest(campaignSlug: string, scenes: unknown[], script?: string): CampaignBeatManifest;
  ```

- [ ] **Step 1: Write failing tests for beat schema validation and legacy migration**

```ts
// server/marketing/beat-schema.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run server/marketing/beat-schema.test.ts`  
Expected: FAIL (module `beat-schema.ts` not found)

- [ ] **Step 3: Implement `server/marketing/beat-schema.ts`**

```ts
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
  script = "",
): CampaignBeatManifest {
  const motions: CameraMotion[] = ["slow_zoom_in", "punch_in", "pan_left", "slow_zoom_out", "pan_right"];
  const beats: NarrativeBeat[] = scenes.map((s, idx) => {
    const title = String(s.title || `Beat ${idx + 1}`);
    const subtitle = s.subtitle ? String(s.subtitle) : "";
    const prompt = String(s.visualPrompt || `${title}. ${subtitle}`.trim());
    return {
      beatIndex: idx + 1,
      durationEstimateMs: Math.max(2000, Number(s.durationMs) || 4000),
      narration: String(s.subtitles?.[0] || title),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run server/marketing/beat-schema.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/beat-schema.ts server/marketing/beat-schema.test.ts
git commit -m "feat(marketing): add beat schema and legacy scene converter"
```

---

### Task 2: Kinetic ASS Subtitle Generator

**Files:**
- Create: `server/marketing/kinetic-subtitles.ts`
- Test: `server/marketing/kinetic-subtitles.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface SubtitleCue {
    startMs: number;
    endMs: number;
    text: string;
    keywordHighlight?: string;
  }
  export function generateAssSubtitles(cues: SubtitleCue[], options?: { width?: number; height?: number }): string;
  ```

- [ ] **Step 1: Write failing tests for `.ass` subtitle generator**

```ts
// server/marketing/kinetic-subtitles.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run server/marketing/kinetic-subtitles.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `server/marketing/kinetic-subtitles.ts`**

```ts
export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
  keywordHighlight?: string;
}

function formatAssTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((totalSeconds % 1) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export function generateAssSubtitles(
  cues: SubtitleCue[],
  options: { width?: number; height?: number } = {},
): string {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kinetic,Arial,58,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,5,3,2,60,60,340,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = cues.map((cue) => {
    let formattedText = cue.text.trim();
    if (cue.keywordHighlight && formattedText.includes(cue.keywordHighlight)) {
      formattedText = formattedText.replaceAll(
        cue.keywordHighlight,
        `{\\c&H00E5FF&}${cue.keywordHighlight}{\\r}`,
      );
    }
    const start = formatAssTimestamp(cue.startMs);
    const end = formatAssTimestamp(cue.endMs);
    return `Dialogue: 0,${start},${end},Kinetic,,0,0,0,,${formattedText}`;
  });

  return `${header}${lines.join("\n")}\n`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run server/marketing/kinetic-subtitles.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/kinetic-subtitles.ts server/marketing/kinetic-subtitles.test.ts
git commit -m "feat(marketing): add kinetic ASS subtitle generator"
```

---

### Task 3: Native FFmpeg 2.5D Motion Engine

**Files:**
- Create: `server/marketing/ffmpeg-motion.ts`
- Test: `server/marketing/ffmpeg-motion.test.ts`

**Interfaces:**
- Consumes: `CampaignBeatManifest` from Task 1, `generateAssSubtitles` from Task 2.
- Produces:
  ```ts
  export interface RenderMotionVideoInput {
    manifest: CampaignBeatManifest;
    audioPath: string;
    outputPath: string;
    fps?: number;
    width?: number;
    height?: number;
  }
  export async function renderBeatMotionVideo(input: RenderMotionVideoInput): Promise<{
    videoPath: string;
    width: number;
    height: number;
    durationSeconds: number;
    bytes: number;
  }>;
  ```

- [ ] **Step 1: Write failing tests for 2.5D motion filter and concat command assembly**

```ts
// server/marketing/ffmpeg-motion.test.ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run server/marketing/ffmpeg-motion.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `server/marketing/ffmpeg-motion.ts`**

```ts
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { CameraMotion, CampaignBeatManifest } from "./beat-schema.ts";
import { generateAssSubtitles, type SubtitleCue } from "./kinetic-subtitles.ts";

export interface BeatMotionFilterOptions {
  frames: number;
  width: number;
  height: number;
  fps: number;
}

export function buildBeatMotionFilter(motion: CameraMotion, opt: BeatMotionFilterOptions): string {
  const { frames, width, height, fps } = opt;
  let zoomExpr = "min(zoom+0.0012,1.15)";
  let xExpr = "'iw/2-(iw/zoom/2)'";
  let yExpr = "'ih/2-(ih/zoom/2)'";

  switch (motion) {
    case "slow_zoom_out":
      zoomExpr = "max(1.15-0.0012*on,1.0)";
      break;
    case "punch_in":
      zoomExpr = "if(lte(on,10),1.0+on*0.02,1.20)";
      break;
    case "pan_left":
      zoomExpr = "1.12";
      xExpr = "'(1-on/d)*(iw-iw/zoom)'";
      break;
    case "pan_right":
      zoomExpr = "1.12";
      xExpr = "'(on/d)*(iw-iw/zoom)'";
      break;
    case "static_drift":
      zoomExpr = "min(zoom+0.0004,1.05)";
      break;
    case "slow_zoom_in":
    default:
      zoomExpr = "min(zoom+0.0012,1.15)";
      break;
  }

  return `scale=${width * 2}:${height * 2},zoompan=z='${zoomExpr}':x=${xExpr}:y=${yExpr}:d=${frames}:s=${width}x${height}:fps=${fps},format=yuv420p`;
}

export interface RenderMotionVideoInput {
  manifest: CampaignBeatManifest;
  audioPath: string;
  outputPath: string;
  fps?: number;
  width?: number;
  height?: number;
}

export async function renderBeatMotionVideo(input: RenderMotionVideoInput): Promise<{
  videoPath: string;
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
}> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1920;
  const fps = input.fps ?? 30;
  const tempDir = mkdtempSync(join(tmpdir(), "romes-motion-render-"));

  try {
    const concatEntries: string[] = [];
    const cues: SubtitleCue[] = [];
    let currentMs = 0;

    for (let i = 0; i < input.manifest.beats.length; i++) {
      const beat = input.manifest.beats[i];
      const durationSec = Math.max(1.5, beat.durationEstimateMs / 1000);
      const frames = Math.max(fps * 2, Math.round(durationSec * fps));
      const endMs = currentMs + Math.round(durationSec * 1000);

      cues.push({
        startMs: currentMs,
        endMs,
        text: beat.narration,
        keywordHighlight: beat.keywordHighlight,
      });
      currentMs = endMs;

      const imgPath = beat.imagePath && existsSync(beat.imagePath)
        ? beat.imagePath
        : join(tempDir, "placeholder.png");

      if (!existsSync(imgPath)) {
        execFileSync("ffmpeg", [
          "-y", "-f", "lavfi", "-i", `color=c=0x111625:s=${width}x${height}`,
          "-frames:v", "1", imgPath,
        ]);
      }

      const segmentMp4 = join(tempDir, `beat-${i}.mp4`);
      const filter = buildBeatMotionFilter(beat.cameraMotion, { frames, width, height, fps });

      execFileSync("ffmpeg", [
        "-y",
        "-loop", "1",
        "-i", imgPath,
        "-t", durationSec.toString(),
        "-vf", filter,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-r", fps.toString(),
        segmentMp4,
      ], { timeout: 60_000, stdio: "pipe" });

      concatEntries.push(`file '${segmentMp4}'`);
    }

    const concatTxt = join(tempDir, "concat.txt");
    writeFileSync(concatTxt, concatEntries.join("\n"), "utf8");

    const silentVideo = join(tempDir, "silent.mp4");
    execFileSync("ffmpeg", [
      "-y",
      "-f", "concat",
      "-safe", "0",
      "-i", concatTxt,
      "-c", "copy",
      silentVideo,
    ], { timeout: 60_000, stdio: "pipe" });

    const assFile = join(tempDir, "subtitles.ass");
    writeFileSync(assFile, generateAssSubtitles(cues, { width, height }), "utf8");

    const outDir = dirname(input.outputPath);
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

    execFileSync("ffmpeg", [
      "-y",
      "-i", silentVideo,
      "-i", input.audioPath,
      "-vf", `ass=${assFile}`,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-c:a", "aac",
      "-b:a", "192k",
      "-shortest",
      input.outputPath,
    ], { timeout: 120_000, stdio: "pipe" });

    const stats = statSync(input.outputPath);
    return {
      videoPath: input.outputPath,
      width,
      height,
      durationSeconds: Math.round(currentMs / 1000),
      bytes: stats.size,
    };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run server/marketing/ffmpeg-motion.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/ffmpeg-motion.ts server/marketing/ffmpeg-motion.test.ts
git commit -m "feat(marketing): implement native FFmpeg 2.5D camera motion engine"
```

---

### Task 4: Upgrade Studio Video Pipeline & MCP Tool Batch Image Generation

**Files:**
- Modify: `server/marketing/studio.ts:853-996`
- Modify: `server/marketing/mcp-server.ts:92-124, 454-478`
- Test: `server/marketing/studio.test.ts`
- Test: `server/marketing/mcp-server.test.ts`

**Interfaces:**
- Consumes: `renderBeatMotionVideo` from Task 3, `legacyScenesToBeatManifest` from Task 1.
- Expands `generate_marketing_images` tool schema up to 12 items.
- Updates `generateMarketingVideoWorkflow` to call `renderBeatMotionVideo`.

- [ ] **Step 1: Write integration test for studio with beat manifest**

```ts
// In server/marketing/studio.test.ts
it("renders a video using the native beat motion engine", async () => {
  const result = await generateMarketingVideoWorkflow(tempDir, {
    campaignSlug: "beat-test",
    script: "Thử nghiệm video nhịp điệu phong cách Vox mới.",
    targetDurationSeconds: 4,
    scenes: [
      { type: "hook", title: "Khám phá AI", durationMs: 2000 },
      { type: "cta", title: "Đăng ký ngay", durationMs: 2000 },
    ],
  });
  expect(result.videoPath).toContain("beat-test-video.mp4");
  expect(existsSync(result.videoPath)).toBe(true);
});
```

- [ ] **Step 2: Update `server/marketing/studio.ts` to call `renderBeatMotionVideo`**

Integrate `legacyScenesToBeatManifest` and `renderBeatMotionVideo` into `generateMarketingVideoWorkflow`, mapping all available beat images.

- [ ] **Step 3: Update `server/marketing/mcp-server.ts`**

Update `generate_marketing_images` description and input schema to allow 1 to 12 prompts. Update `generate_marketing_video` handler to support `beats`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run server/marketing/studio.test.ts server/marketing/mcp-server.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/studio.ts server/marketing/mcp-server.ts server/marketing/studio.test.ts server/marketing/mcp-server.test.ts
git commit -m "feat(marketing): integrate native 2.5D beat video workflow and batch image tool"
```

---

### Task 5: Upgrade Swarm Soul Prompts (Poppy, Finch, Momo) & Sync `bots.json`

**Files:**
- Modify: `server/marketing/swarm/poppy.md`
- Modify: `server/marketing/swarm/finch.md`
- Modify: `server/marketing/swarm/momo.md`
- Test: `server/marketing/swarm/team.test.ts`

- [ ] **Step 1: Update Poppy's Soul (`server/marketing/swarm/poppy.md`)**

Instruct Poppy to output structured beats (8–12 beats for 60s, 3–5s each) with `narration`, English `visualPrompt` (5-layer collage style), `cameraMotion` (`slow_zoom_in`, `punch_in`, `pan_left`, `slow_zoom_out`), and `keywordHighlight`.

- [ ] **Step 2: Update Finch's Soul (`server/marketing/swarm/finch.md`)**

Instruct Finch to generate an image for every single beat from Poppy's list, applying the 5-layer Vox-Collage prompt formula (torn paper, retro risograph/halftone, newspaper clippings, stickers) in a single batch.

- [ ] **Step 3: Update Momo's Soul (`server/marketing/swarm/momo.md`)**

Instruct Momo to receive Poppy's beats and Finch's image paths, verify every beat has an image, and call `generate_marketing_video` with the complete manifest.

- [ ] **Step 4: Sync to `~/.openmausbot/bots.json` and verify tests**

Run node script to sync `bots.json`.  
Run: `pnpm exec vitest run server/marketing/swarm/team.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/swarm/poppy.md server/marketing/swarm/finch.md server/marketing/swarm/momo.md server/marketing/swarm/team.test.ts
git commit -m "feat(swarm): update Poppy, Finch, and Momo souls for Vox beat pipeline"
```

---

### Task 6: End-to-End Verification & Server Reload

- [ ] **Step 1: Run complete marketing test suite**

Run: `pnpm exec vitest run server/marketing/beat-schema.test.ts server/marketing/kinetic-subtitles.test.ts server/marketing/ffmpeg-motion.test.ts server/marketing/studio.test.ts server/marketing/mcp-server.test.ts server/marketing/swarm/team.test.ts`  
Expected: All suites PASS.

- [ ] **Step 2: Run server typecheck**

Run: `NODE_OPTIONS="--max-old-space-size=4096" pnpm exec tsc -p tsconfig.server.json --noEmit`  
Expected: 0 errors.

- [ ] **Step 3: Restart dev server daemon**

Reload backend server on port 8799 with the new video engine.
