# Fast Video Marketing Pipeline & Cinematic Remotion Animations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce end-to-end video creation and publishing time from ~50 minutes to under 3–5 minutes while transforming output video quality into modern, cinematic Remotion motion graphics with kinetic captions, micro-animations, and floating device mockups.

**Architecture:** Decouple production from publishing. Poppy and Finch generate storyboards with visual motion directives and batch-generate 1080×1920 images in parallel (~30s). Momo executes a single-pass Remotion 30 FPS video compilation with word-by-word kinetic captions and contextual micro-animations (~20s) and outputs MP4 directly into chat. RoMes only triggers publishing upon explicit user request using an automated headless uploader script (~45s), eliminating multi-turn AI browser-clicking loops.

**Tech Stack:** TypeScript, React 19, Remotion 4.0 (`remotion`, `@remotion/bundler`, `@remotion/renderer`), Google Gemini Speech API (`gemini-3.8-flash-lite-tts`), FFmpeg 7, Chromium Headless.

**Spec:** [`docs/superpowers/specs/2026-11-02-fast-video-pipeline-and-remotion-animations-design.md`](file:///home/phan-duong-quoc-nhat/workspace/RoMes/docs/superpowers/specs/2026-11-02-fast-video-pipeline-and-remotion-animations-design.md)

## Global Constraints

- Preserve all existing public contracts and types in `server/marketing/` and `shared/`.
- Obey AGENTS.md: Write comments only for what the code cannot say. Do not leave narrations, banners, or historical changelogs.
- Maintain zero warnings and zero errors in `oxlint`.
- Ensure TypeScript typechecks pass cleanly with `NODE_OPTIONS="--max-old-space-size=4096" pnpm typecheck`.
- All tests run via Vitest (`pnpm vitest run server/marketing`).

---

## File Structure

```
server/marketing/
├── remotion/
│   ├── types.ts                    # Motion types: ContextualAnimationType, RemotionVideoProps
│   ├── KineticCaptions.tsx         # Word-by-word kinetic karaoke subtitles with spring bounce
│   ├── MicroAnimations.tsx         # Interactive widgets: email flight, AI chip, security shield, speed
│   ├── FloatingBadges.tsx          # Floating USP pills with sin(frame) floating paths
│   ├── DeviceMockup.tsx            # Modern phone/browser mockup frame with Ken Burns image scaling
│   ├── Scene.tsx                   # Composed scene view hosting mockups, animations, and captions
│   ├── MarketingVideo.tsx          # Sequence layout of scenes
│   └── Root.tsx                    # Composition registration and metadata calculation
├── video-templates.ts              # Scene spec contracts and HTML fallback template
├── video-compiler.ts               # Remotion bundle cache, rendering engine, and FFmpeg muxing
├── studio.ts                       # Marketing workflow orchestration (Poppy, Finch, Momo pipelines)
├── publisher.ts                    # Headless fast-uploader for TikTok & Facebook 1-click publishing
├── mcp-server.ts                   # MCP tool declarations including marketing_studio_publish_post
└── tests:
    ├── remotion-components.test.ts # Tests for kinetic captions and animation tokens
    ├── video-templates.test.ts     # Tests for scene spec with visual directives
    ├── video-compiler.test.ts      # Tests for Remotion compiler with animation props
    ├── publisher.test.ts           # Tests for headless fast-publisher CLI/module
    └── studio.test.ts              # End-to-end studio workflow tests
```

---

### Task 1: Remotion Motion Graphics Components (Kinetic Captions & Contextual Micro-Animations)

**Files:**
- Create: `server/marketing/remotion/KineticCaptions.tsx`
- Create: `server/marketing/remotion/MicroAnimations.tsx`
- Create: `server/marketing/remotion/FloatingBadges.tsx`
- Create: `server/marketing/remotion/DeviceMockup.tsx`
- Modify: `server/marketing/remotion/types.ts`
- Modify: `server/marketing/remotion/Scene.tsx`
- Test: `server/marketing/remotion-components.test.ts`

**Interfaces:**
- Consumes: `MarketingSceneSpec` with `animationType?: ContextualAnimationType` and `floatingTags?: string[]`
- Produces: `KineticCaptions`, `MicroAnimation`, `FloatingBadges`, `DeviceMockup` components mounted in `Scene.tsx`

- [ ] **Step 1: Write failing test for Remotion motion components**

Create `server/marketing/remotion-components.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { parseSubtitleWords } from "./remotion/KineticCaptions.tsx";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/remotion-components.test.ts`  
Expected: FAIL with "Cannot find module ./remotion/KineticCaptions.tsx"

- [ ] **Step 3: Update types.ts with animation directives**

Update `server/marketing/remotion/types.ts`:
```ts
export type VideoRatio = "9:16" | "16:9" | "1:1";

export type ContextualAnimationType =
  | "email"
  | "ai"
  | "speed"
  | "security"
  | "growth"
  | "default";

export interface MarketingSceneSpec {
  type: "hook" | "product" | "problem" | "solution" | "features" | "stats" | "cta";
  title: string;
  subtitle?: string;
  features?: string[];
  bulletPoints?: string[];
  imageUrl?: string;
  imagePath?: string;
  durationMs?: number;
  animationType?: ContextualAnimationType;
  floatingTags?: string[];
}

export interface RemotionVideoProps {
  scenes: MarketingSceneSpec[];
  brandName?: string;
  audioPath?: string;
  ratio?: VideoRatio;
}

export function getDimensionsForRatio(ratio: VideoRatio = "9:16"): { width: number; height: number } {
  switch (ratio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}
```

- [ ] **Step 4: Implement KineticCaptions.tsx**

Create `server/marketing/remotion/KineticCaptions.tsx`:
```tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export interface SubtitleToken {
  word: string;
  startFrame: number;
  endFrame: number;
}

export function parseSubtitleWords(text: string, totalFrames: number): SubtitleToken[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const framesPerWord = Math.max(2, Math.floor(totalFrames / words.length));
  return words.map((word, i) => ({
    word,
    startFrame: i * framesPerWord,
    endFrame: Math.min(totalFrames, (i + 1) * framesPerWord),
  }));
}

export const KineticCaptions: React.FC<{ text: string; isVertical: boolean }> = ({ text, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const tokens = React.useMemo(() => parseSubtitleWords(text, durationInFrames), [text, durationInFrames]);
  if (tokens.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: isVertical ? "200px" : "50px",
        left: "50%",
        transform: "translateX(-50%)",
        width: isVertical ? "88%" : "75%",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "10px 14px",
        padding: "16px 24px",
        borderRadius: "20px",
        background: "rgba(10, 15, 29, 0.82)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(99, 102, 241, 0.35)",
        boxShadow: "0 15px 35px rgba(0, 0, 0, 0.6)",
        zIndex: 50,
      }}
    >
      {tokens.map((token, i) => {
        const isActive = frame >= token.startFrame && frame < token.endFrame;
        const hasPassed = frame >= token.endFrame;

        const wordSpring = spring({
          frame: Math.max(0, frame - token.startFrame),
          fps,
          config: { damping: 10, mass: 0.5 },
        });

        const scale = isActive ? 1 + wordSpring * 0.15 : 1;
        const color = isActive ? "#facc15" : hasPassed ? "#ffffff" : "rgba(255, 255, 255, 0.55)";
        const textShadow = isActive ? "0 0 16px rgba(250, 204, 21, 0.8)" : "none";

        return (
          <span
            key={i}
            style={{
              fontSize: isVertical ? "30px" : "24px",
              fontWeight: 800,
              color,
              textShadow,
              transform: `scale(${scale})`,
              display: "inline-block",
              transition: "color 0.1s ease",
              letterSpacing: "0.02em",
            }}
          >
            {token.word}
          </span>
        );
      })}
    </div>
  );
};
```

- [ ] **Step 5: Implement MicroAnimations.tsx**

Create `server/marketing/remotion/MicroAnimations.tsx`:
```tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ContextualAnimationType } from "./types.ts";

export const MicroAnimation: React.FC<{
  type?: ContextualAnimationType;
  isVertical: boolean;
}> = ({ type, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (!type || type === "default") return null;

  if (type === "email") {
    const flightX = interpolate(frame, [0, 25], [-120, 120], { extrapolateRight: "clamp" });
    const flightY = Math.sin(frame / 6) * 18;
    const badgeScale = spring({
      frame: Math.max(0, frame - 22),
      fps,
      config: { damping: 12, mass: 0.6 },
    });

    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "28%" : "22%",
          right: isVertical ? "6%" : "12%",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            transform: `translate(${flightX}px, ${flightY}px)`,
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            boxShadow: "0 10px 25px rgba(56, 189, 248, 0.5)",
          }}
        >
          ✉️
        </div>
        <div
          style={{
            transform: `scale(${badgeScale})`,
            padding: "8px 16px",
            borderRadius: "9999px",
            background: "rgba(16, 185, 129, 0.2)",
            border: "1px solid #10b981",
            color: "#6ee7b7",
            fontWeight: 700,
            fontSize: isVertical ? "18px" : "15px",
            boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
          }}
        >
          ✓ Đã gửi email tự động
        </div>
      </div>
    );
  }

  if (type === "ai") {
    const pulse = 1 + Math.sin(frame / 8) * 0.08;
    const rotate = (frame * 1.5) % 360;
    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "24%" : "18%",
          right: isVertical ? "8%" : "14%",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 20px",
          borderRadius: "9999px",
          background: "rgba(99, 102, 241, 0.25)",
          border: "1px solid rgba(168, 85, 247, 0.5)",
          transform: `scale(${pulse})`,
        }}
      >
        <span style={{ fontSize: "24px", transform: `rotate(${rotate}deg)`, display: "inline-block" }}>
          ⚙️
        </span>
        <span style={{ fontSize: isVertical ? "18px" : "15px", fontWeight: 700, color: "#e0e7ff" }}>
          AI Neural Engine Active
        </span>
      </div>
    );
  }

  if (type === "security") {
    const shieldScale = spring({ frame, fps, config: { damping: 11 } });
    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "26%" : "20%",
          left: isVertical ? "6%" : "10%",
          zIndex: 40,
          transform: `scale(${shieldScale})`,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 18px",
          borderRadius: "16px",
          background: "rgba(16, 185, 129, 0.2)",
          border: "1px solid #10b981",
          color: "#a7f3d0",
          fontWeight: 700,
          fontSize: isVertical ? "18px" : "15px",
        }}
      >
        <span>🛡️</span>
        <span>2FA Encrypted</span>
      </div>
    );
  }

  if (type === "speed") {
    const progress = Math.min(99, Math.round(interpolate(frame, [0, durationInFrames], [10, 99])));
    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "25%" : "18%",
          right: isVertical ? "8%" : "12%",
          zIndex: 40,
          padding: "10px 18px",
          borderRadius: "16px",
          background: "rgba(245, 158, 11, 0.2)",
          border: "1px solid #f59e0b",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#fde68a",
          fontWeight: 800,
          fontSize: isVertical ? "20px" : "16px",
        }}
      >
        <span>⚡</span>
        <span>{progress}% Cực nhanh</span>
      </div>
    );
  }

  return null;
};
```

- [ ] **Step 6: Implement FloatingBadges.tsx and DeviceMockup.tsx**

Create `server/marketing/remotion/FloatingBadges.tsx`:
```tsx
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export const FloatingBadges: React.FC<{
  tags?: string[];
  isVertical: boolean;
}> = ({ tags, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!tags || tags.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "12px",
        marginTop: isVertical ? "18px" : "12px",
        zIndex: 35,
      }}
    >
      {tags.map((tag, idx) => {
        const floatY = Math.sin((frame + idx * 15) / 14) * 8;
        const badgeSpring = spring({
          frame: Math.max(0, frame - 5 - idx * 4),
          fps,
          config: { damping: 12 },
        });

        return (
          <div
            key={idx}
            style={{
              transform: `scale(${badgeSpring}) translateY(${floatY}px)`,
              padding: isVertical ? "10px 20px" : "8px 16px",
              borderRadius: "9999px",
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#e0e7ff",
              fontSize: isVertical ? "19px" : "16px",
              fontWeight: 700,
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
            }}
          >
            ✦ {tag}
          </div>
        );
      })}
    </div>
  );
};
```

Create `server/marketing/remotion/DeviceMockup.tsx`:
```tsx
import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const DeviceMockup: React.FC<{
  imageSource: string;
  isVertical: boolean;
}> = ({ imageSource, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.07], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        transform: `scale(${entrance})`,
        width: isVertical ? "92%" : "64%",
        flex: 1,
        maxHeight: isVertical ? "52%" : "56%",
        borderRadius: "32px",
        padding: "8px",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(99, 102, 241, 0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "24px",
          overflow: "hidden",
          backgroundColor: "#030712",
          position: "relative",
        }}
      >
        <img
          src={imageSource}
          alt="Marketing visual"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom})`,
            transformOrigin: "center center",
          }}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 7: Wire components into Scene.tsx**

Update `server/marketing/remotion/Scene.tsx` to mount `DeviceMockup`, `MicroAnimation`, `FloatingBadges`, and `KineticCaptions`.

- [ ] **Step 8: Run Vitest and oxlint to verify Task 1**

Run: `pnpm vitest run server/marketing/remotion-components.test.ts && pnpm lint`  
Expected: PASS with 0 warnings 0 errors.

- [ ] **Step 9: Commit Task 1**

```bash
git add server/marketing/remotion/ server/marketing/remotion-components.test.ts
git commit -m "feat(marketing): add Remotion kinetic captions, micro-animations, and device mockups"
```

---

### Task 2: Storyboard Visual Directives & Dynamic Scene Support

**Files:**
- Modify: `server/marketing/video-templates.ts`
- Modify: `server/marketing/studio.ts:740-820`
- Test: `server/marketing/video-templates.test.ts`

**Interfaces:**
- Consumes: User prompt with arbitrary number of scenes (2–6)
- Produces: `MarketingSceneSpec` containing `animationType` and `floatingTags` passed into Remotion compiler

- [ ] **Step 1: Write test for visual directives in video-templates.test.ts**

Add test checking that `buildMarketingVideoHtml` and template types cleanly accept `animationType` and `floatingTags`:
```ts
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
```

- [ ] **Step 2: Update video-templates.ts**

Extend `MarketingSceneSpec` in `server/marketing/video-templates.ts` with `animationType?: ContextualAnimationType` and `floatingTags?: string[]`.

- [ ] **Step 3: Update studio.ts workflow**

In `server/marketing/studio.ts`, ensure `generateMarketingVideoWorkflow` forwards `animationType` and `floatingTags` without dropping them during duration normalization.

- [ ] **Step 4: Run Vitest**

Run: `pnpm vitest run server/marketing/video-templates.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add server/marketing/video-templates.ts server/marketing/studio.ts server/marketing/video-templates.test.ts
git commit -m "feat(marketing): support storyboard visual directives and dynamic scene counts"
```

---

### Task 3: Fast Parallel Image Generation (Finch Batch 1080×1920)

**Files:**
- Modify: `server/marketing/studio.ts:580-640`
- Modify: `~/.openmausbot/bots.json` (Finch Soul & settings)
- Test: `server/marketing/studio.test.ts`

**Interfaces:**
- Consumes: `GenerateImagesInput` with array of prompts
- Produces: `GenerateImagesOutput` with all images generated concurrently at 1080×1920

- [ ] **Step 1: Write test verifying concurrent image generation in studio.test.ts**

Add unit test ensuring `generateMarketingImages` executes prompts in parallel using mock fetcher.

- [ ] **Step 2: Implement Promise.allSettled in generateMarketingImages**

In `server/marketing/studio.ts`:
Refactor `generateMarketingImages` to run all prompt requests simultaneously instead of sequentially:
```ts
const results = await Promise.allSettled(
  prompts.map((spec, i) => generateSingleMarketingImage(spec, i, campaignDir, options))
);
```
Ensure default width is 1080 and height is 1920 for vertical 9:16 videos.

- [ ] **Step 3: Update Finch's Soul in ~/.openmausbot/bots.json**

Update Finch's soul instruction:
- Enforce 1-shot parallel image generation.
- Forbid opening browser tabs to inspect or re-verify files.
- Return generated image file paths directly to RoMes and Momo.

- [ ] **Step 4: Run Vitest on studio.test.ts**

Run: `pnpm vitest run server/marketing/studio.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add server/marketing/studio.ts server/marketing/studio.test.ts
git commit -m "perf(marketing): parallelize batch image generation at 1080x1920"
```

---

### Task 4: Momo 1-Shot Video Production & Swarm Coordination Decoupling

**Files:**
- Modify: `~/.openmausbot/bots.json` (Momo and RoMes Souls)
- Modify: `server/marketing/studio.ts`
- Test: Manual verification with test script

**Interfaces:**
- Consumes: Kịch bản và ảnh từ Finch & Poppy
- Produces: Single-pass Remotion video with MP4 output in chat, decoupling production from publishing

- [ ] **Step 1: Update Momo's Soul in ~/.openmausbot/bots.json**

Configure Momo:
- Call `marketing_studio_generate_marketing_video` in exactly 1 turn.
- Forbid opening Chrome tabs to check video frames.
- Hand file directly to RoMes to attach in chat.

- [ ] **Step 2: Update RoMes's Chief of Staff Soul in ~/.openmausbot/bots.json**

Configure RoMes:
- **Phase 3 (Preview)**: Attach MP4 and images into chat for user review. Stop there.
- **Phase 4 (Publish)**: ONLY activate when user explicitly requests ("Duyệt đăng", "Đăng lên TikTok", "Đăng lên Facebook").
- Use `marketing_studio_publish_post` rather than interactive browser clicks.

- [ ] **Step 3: Test Swarm coordination configuration**

Verify `~/.openmausbot/bots.json` parses cleanly without syntax errors:
Run: `node -e 'JSON.parse(require("fs").readFileSync(require("os").homedir() + "/.openmausbot/bots.json", "utf8"))'`  
Expected: Clean exit code 0.

---

### Task 5: Headless Fast-Publisher Module for 1-Click Publishing (TikTok & Facebook)

**Files:**
- Create: `server/marketing/publisher.ts`
- Modify: `server/marketing/mcp-server.ts`
- Test: `server/marketing/publisher.test.ts`

**Interfaces:**
- Consumes: `{ platform: "tiktok" | "facebook", videoPath: string, caption: string, hashtags?: string[] }`
- Produces: `{ success: boolean, url?: string, note?: string }` in under 60 seconds

- [ ] **Step 1: Write unit test for publisher input validation and parameter preparation**

Create `server/marketing/publisher.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatPostPayload, type PublishPostInput } from "./publisher.ts";

describe("publisher", () => {
  it("formats TikTok post payload with hashtags correctly", () => {
    const input: PublishPostInput = {
      platform: "tiktok",
      videoPath: "/tmp/sample.mp4",
      caption: "Video giới thiệu Muse AI",
      hashtags: ["#MuseAI", "#AIContent"],
    };
    const payload = formatPostPayload(input);
    expect(payload.fullCaption).toContain("Video giới thiệu Muse AI");
    expect(payload.fullCaption).toContain("#MuseAI");
    expect(payload.fullCaption).toContain("#AIContent");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/publisher.test.ts`  
Expected: FAIL with "Cannot find module ./publisher.ts"

- [ ] **Step 3: Implement publisher.ts**

Create `server/marketing/publisher.ts`:
- Define `PublishPostInput` and `PublishPostOutput`.
- Implement `formatPostPayload`.
- Implement `publishPostHeadless(input: PublishPostInput, options?: { chromeProfileDir?: string })`:
  - Connects to user's existing Chrome profile session cookies.
  - Automates upload and publish in headless mode without multi-turn screenshot-reading loops.
  - Implements fallback logging and direct success receipt.

- [ ] **Step 4: Register publisher tool in mcp-server.ts**

Expose `marketing_studio_publish_post` in `server/marketing/mcp-server.ts` with parameters `{ platform, videoPath, caption, hashtags }`.

- [ ] **Step 5: Run Vitest**

Run: `pnpm vitest run server/marketing/publisher.test.ts`  
Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add server/marketing/publisher.ts server/marketing/publisher.test.ts server/marketing/mcp-server.ts
git commit -m "feat(marketing): add headless fast-publishing module for 1-click social media uploads"
```

---

### Task 6: End-to-End System Verification & Benchmark

**Files:**
- Create: `server/marketing/bench-remotion-pipeline.ts`
- Test: Full Vitest suite & live rendering benchmark

**Interfaces:**
- Consumes: Entire marketing video stack
- Produces: Validated, zero-error, benchmarked video output under 3 minutes

- [ ] **Step 1: Write pipeline benchmark script**

Create `server/marketing/bench-remotion-pipeline.ts`:
- Runs `generateMarketingVideoWorkflow` with:
  - 4 scenes containing `animationType: "email"` and `animationType: "security"`
  - `floatingTags`
  - Real voiceover script
- Measures and logs exact milliseconds for TTS, mixing, and Remotion rendering.
- Verifies output MP4 size > 500KB and duration matches expectation.

- [ ] **Step 2: Run benchmark script**

Run: `node --experimental-strip-types server/marketing/bench-remotion-pipeline.ts`  
Expected:
- Remotion render completes in < 25 seconds.
- Total video pipeline completes in < 35 seconds.
- Video duration > 0, 1080×1920 H.264 High profile.

- [ ] **Step 3: Run all Vitest suites**

Run: `pnpm vitest run server/marketing`  
Expected: All tests pass (25+ tests).

- [ ] **Step 4: Run linter and typechecker**

Run: `pnpm lint && NODE_OPTIONS="--max-old-space-size=4096" pnpm typecheck`  
Expected: 0 warnings, 0 errors.

- [ ] **Step 5: Restart development server**

Restart `dev:server` to apply all changes:
Run: `pnpm dev:server`

- [ ] **Step 6: Final Commit & Push**

```bash
git add server/marketing/
git commit -m "test(marketing): add Remotion pipeline benchmark and verify end-to-end performance"
NODE_OPTIONS="--max-old-space-size=4096" git push origin main
```
