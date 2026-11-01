# Video Marketing Engine & Multi-Agent Swarm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an automated, local-first Video Marketing Engine inspired by `nexu-io/html-video` and powered by Google AI Studio Speech (`gemini-3.8-flash-tts`), orchestrated across a parallel multi-agent swarm (RoMes, Poppy, Finch, Momo) defaulting to DeepSeek V4.1.

**Architecture:** Pure HTML5/CSS3 animated scene templates rendered via headless Google Chrome and encoded with local FFmpeg, combined with hybrid Google AI Studio speech generation, royalty-free BGM with audio ducking, and dual-ratio video output (9:16 and 16:9).

**Tech Stack:** TypeScript, Node.js, Headless Google Chrome, FFmpeg, Google AI Studio Speech, OpenRouter DeepSeek V4.1, Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-01-video-marketing-engine-design.md`](file:///home/phan-duong-quoc-nhat/workspace/RoMes/docs/superpowers/specs/2026-11-01-video-marketing-engine-design.md)

## Global Constraints

- Must work 100% locally on Linux without paid video rendering cloud fees.
- Headless Chrome and FFmpeg must use documented, local paths (`google-chrome`, `ffmpeg`).
- Google AI Studio Speech must support headless browser retrieval for 100% free usage, with optional API key dispatch.
- Every new agent must default to DeepSeek V4.1 (`openrouter: deepseek/deepseek-v4.1-flash-1017`).
- All code must pass Vitest tests and Oxlint without warnings or errors.

---

### Task 1: Google AI Studio Speech Engine (`server/marketing/speech-engine.ts`)

**Files:**
- Create: `server/marketing/speech-engine.ts`
- Test: `server/marketing/speech-engine.test.ts`

**Interfaces:**
- Produces: `generateSpeech(input: SpeechGenerationInput): Promise<SpeechGenerationOutput>`
  - `SpeechGenerationInput`: `{ script: string; language?: string; voice?: string; campaignSlug: string; outputDir: string }`
  - `SpeechGenerationOutput`: `{ audioPath: string; durationMs: number; format: "wav" | "mp3" }`

- [x] **Step 1: Write the failing test**
  - Create `server/marketing/speech-engine.test.ts` testing input validation, command formatting for AI Studio speech synthesis, and audio file resolution.
- [x] **Step 2: Run test to confirm failure**
  - Run `pnpm exec vitest run server/marketing/speech-engine.test.ts` and verify it fails due to missing module.
- [x] **Step 3: Implement `server/marketing/speech-engine.ts`**
  - Implement browser automation helper for `https://aistudio.google.com/generate-speech?model=gemini-3.8-flash-tts`.
  - Implement fallback to Gemini API if `GEMINI_API_KEY` is present in environment.
  - Implement audio duration probing using `ffprobe` or file headers.
- [x] **Step 4: Run test to confirm pass**
  - Run `pnpm exec vitest run server/marketing/speech-engine.test.ts` and confirm 100% pass.
- [x] **Step 5: Commit**
  - Commit `server/marketing/speech-engine.ts` and its test.

---

### Task 2: Royalty-Free BGM Catalog & Audio Ducking Mixer (`server/marketing/audio-mixer.ts`)

**Files:**
- Create: `server/marketing/audio-mixer.ts`
- Create: `server/marketing/assets/bgm/` (catalog audio files or bundled tone presets)
- Test: `server/marketing/audio-mixer.test.ts`

**Interfaces:**
- Produces: `mixCampaignAudio(input: AudioMixInput): Promise<AudioMixOutput>`
  - `AudioMixInput`: `{ voicePath: string; bgmTheme?: "tech" | "upbeat" | "chill" | "luxury"; customBgmPath?: string; outputPath: string }`
  - `AudioMixOutput`: `{ mixedAudioPath: string; durationMs: number }`

- [x] **Step 1: Write the failing test**
  - Create `server/marketing/audio-mixer.test.ts` testing BGM selection, FFmpeg filter_complex ducking command builder (`volume=0.15` during voiceover, `volume=0.85` in silence).
- [x] **Step 2: Run test to confirm failure**
  - Run `pnpm exec vitest run server/marketing/audio-mixer.test.ts` and verify it fails.
- [x] **Step 3: Implement `server/marketing/audio-mixer.ts`**
  - Implement theme-based BGM resolver.
  - Implement FFmpeg ducking pipeline using `amix`, `sidechaincompress`, or volume filters.
- [x] **Step 4: Run test to confirm pass**
  - Run `pnpm exec vitest run server/marketing/audio-mixer.test.ts` and confirm pass.
- [x] **Step 5: Commit**
  - Commit audio mixer implementation and tests.

---

### Task 3: HTML Video Template Engine (`server/marketing/video-templates.ts`)

**Files:**
- Create: `server/marketing/video-templates.ts`
- Test: `server/marketing/video-templates.test.ts`

**Interfaces:**
- Produces: `buildMarketingSceneHtml(scene: MarketingSceneSpec, options: TemplateOptions): string`
  - `MarketingSceneSpec`: `{ type: "hook" | "product" | "features" | "cta"; title: string; subtitle?: string; imagePath?: string; bulletPoints?: string[]; durationMs: number; subtitles?: string[] }`
  - `TemplateOptions`: `{ ratio: "9:16" | "16:9"; width: number; height: number; fps: number; brandName?: string }`

- [x] **Step 1: Write the failing test**
  - Create `server/marketing/video-templates.test.ts` verifying HTML output contains CSS animation keyframes (Ken Burns zoom, kinetic text entry, contrasting subtitle overlay, responsive viewports).
- [x] **Step 2: Run test to confirm failure**
  - Run `pnpm exec vitest run server/marketing/video-templates.test.ts`.
- [x] **Step 3: Implement `server/marketing/video-templates.ts`**
  - Implement full HTML/CSS generator with 60fps/30fps CSS timing.
  - Integrate Ken Burns pan/zoom on product images.
  - Implement kinetic typography for hooks and CTAs.
- [x] **Step 4: Run test to confirm pass**
  - Run `pnpm exec vitest run server/marketing/video-templates.test.ts` and verify.
- [x] **Step 5: Commit**
  - Commit video template engine and tests.

---

### Task 4: Headless Chrome & FFmpeg Video Compiler (`server/marketing/video-compiler.ts`)

**Files:**
- Create: `server/marketing/video-compiler.ts`
- Test: `server/marketing/video-compiler.test.ts`

**Interfaces:**
- Produces: `renderMarketingVideo(spec: VideoRenderSpec): Promise<VideoRenderOutput>`
  - `VideoRenderSpec`: `{ campaignSlug: string; scenes: MarketingSceneSpec[]; audioPath: string; ratio: "9:16" | "16:9"; outputPath: string; fps?: number }`
  - `VideoRenderOutput`: `{ videoPath: string; width: number; height: number; durationSeconds: number; bytes: number }`

- [ ] **Step 1: Write the failing test**
  - Create `server/marketing/video-compiler.test.ts` testing scene compilation, FFmpeg encoding parameter building, and file output resolution.
- [ ] **Step 2: Run test to confirm failure**
  - Run `pnpm exec vitest run server/marketing/video-compiler.test.ts`.
- [ ] **Step 3: Implement `server/marketing/video-compiler.ts`**
  - Spawn Chrome headless to capture time-stepped animation frames.
  - Invoke `ffmpeg -framerate {fps} -i ... -i audio -c:v libx264 -pix_fmt yuv420p ... output.mp4`.
- [ ] **Step 4: Run test to confirm pass**
  - Run `pnpm exec vitest run server/marketing/video-compiler.test.ts`.
- [ ] **Step 5: Commit**
  - Commit video compiler and tests.

---

### Task 5: Marketing Studio MCP & Swarm Orchestration Integration

**Files:**
- Modify: `server/marketing/studio.ts`
- Modify: `server/marketing/mcp-server.ts`
- Test: `server/marketing/studio.test.ts`
- Test: `server/marketing/mcp-server.test.ts`

**Interfaces:**
- MCP Tool: `generate_marketing_video`
  - Input: `{ campaignSlug: string; ratio: "9:16" | "16:9"; script: string; scenes: MarketingSceneSpec[]; bgmTheme?: string }`
  - Output: `{ videoPath: string; durationSeconds: number; ratio: string; previewUrl: string }`

- [ ] **Step 1: Write the failing test**
  - Update `server/marketing/mcp-server.test.ts` to expect `generate_marketing_video` in tools list and test its invocation.
- [ ] **Step 2: Run test to confirm failure**
  - Run `pnpm exec vitest run server/marketing/mcp-server.test.ts`.
- [ ] **Step 3: Integrate into `studio.ts` and `mcp-server.ts`**
  - Connect `speech-engine`, `audio-mixer`, `video-templates`, and `video-compiler` to `server/marketing/studio.ts`.
  - Register `generate_marketing_video` tool in `server/marketing/mcp-server.ts`.
  - Update RoMes Chief of Staff prompt to orchestrate Poppy (script), Finch (Nano Banana 2 Lite images), and Momo (AI Studio Speech & BGM) in parallel before compiling.
- [ ] **Step 4: Run all tests & verify**
  - Run full vitest suite across marketing studio and verify 100% pass.
- [ ] **Step 5: Commit & Push**
  - Commit all files and push cleanly to GitHub repository.
