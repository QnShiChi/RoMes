# Fast Video Marketing Pipeline & Cinematic Remotion Animations

**Status**: Approved by User  
**Author**: Antigravity  
**Date**: 2026-11-02  

---

## 1. Executive Summary

The current video production and publishing workflow requires ~49 minutes and experiences intermittent failures due to manual browser interaction loops (Finch inspecting images 14 times, Momo re-rendering and checking 18 times, RoMes automating TikTok Creator Studio DOM over 26 evaluations). Furthermore, the rendered video output lacked kinetic visual engagement (simple 2D pan over static images without contextual animations or animated subtitles).

This specification establishes a **Fast-Track 3-Phase Pipeline** that reduces total end-to-end execution to **under 3–5 minutes** while elevating video quality to full **Remotion Motion Graphics** with kinetic karaoke captions, contextual micro-animations (e.g. email sending, AI processing, security shield, speed boost), and floating device mockups.

---

## 2. Core Architectural Principles

1. **Decoupled Workflow (Stop-at-Preview)**:
   - Video creation finishes upon delivery of the MP4 into chat.
   - Publishing is an optional, independent phase triggered strictly upon explicit user request.
2. **Dynamic & Flexible Scene Count**:
   - Scene count is not fixed to 4. Poppy dynamically decides between 2 to 6 scenes based on user brief; Finch generates corresponding images in parallel.
3. **Zero Browser-Sniffing Loops**:
   - Agents must not open browser tabs to visually inspect intermediate files.
   - Images are generated in a single parallel batch; Remotion renders in a single 15–20s pass.
4. **1-Click Headless Publishing**:
   - Publishing uses existing authenticated Chrome session cookies via a dedicated background automation script, avoiding multi-turn AI visual inspection of Single Page App DOMs.

---

## 3. High-Level Architecture & Flow

```
[User Request] (e.g. "Làm video giới thiệu Meta Muse AI")
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Parallel Asset & Storyboard Generation (~30s)      │
├──────────────────────────────┬──────────────────────────────┤
│ Poppy (Storyboard & Directives) Finch (Batch Parallel Gen)  │
│ - 2 to 6 dynamic scenes      │ - Promise.all([p1..pN])      │
│ - Voiceover script           │ - Exact 1080x1920 (9:16)     │
│ - animationType & tags       │ - Direct API, no browser tab │
└──────────────────────────────┴──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: 1-Shot Remotion Video Engine (~20s)                │
├─────────────────────────────────────────────────────────────┤
│ Momo (Voice, BGM & Remotion Render)                         │
│ 1. Gemini TTS multi-model cascade (wav in 3-5s)             │
│ 2. Background music ducking (1-2s)                          │
│ 3. Remotion 30 FPS render with:                             │
│    - Kinetic karaoke subtitles (word-by-word neon highlight)│
│    - Contextual micro-animations (email/AI/shield/speed)    │
│    - Floating pills with sin(frame) floating motion         │
│    - Glassmorphism device mockups (iPhone/MacOS)            │
│ 4. Output MP4 delivered directly to chat for user preview   │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
[User Review in Chat] ─── (User inspects / downloads MP4)
       │
       ├──> If user wants to publish ("Đăng lên TikTok/FB"):
       ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Optional Headless 1-Click Publishing (~45s)        │
├─────────────────────────────────────────────────────────────┤
│ RoMes (Headless Fast-Uploader)                              │
│ - Uses local Chrome session cookies for chosen platform     │
│ - Direct background script (TikTok/Facebook)                │
│ - No manual DOM element hunting or screenshot inspection    │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Detailed Component Design

### 4.1 Poppy Storyboard Directives (`server/marketing/video-templates.ts` & Soul)

Each scene specification is enriched with motion graphics metadata:

```ts
export type ContextualAnimationType =
  | "email"       // Animated envelope flight, prompt bubble, verified tick
  | "ai"          // Glowing neon neural pulse, microchip heartbeat
  | "speed"       // Stopwatch counter (0->99%), fast progress streak
  | "security"    // Rotating radar shield, closing padlock, 2FA pill
  | "growth"      // Bar chart rising, positive metrics spike
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
```

### 4.2 Remotion Motion Graphics Components (`server/marketing/remotion/`)

1. **`KineticCaptions.tsx`**:
   - Parses scene subtitles/script into word tokens with timestamps.
   - Computes active word via `frame` interpolation.
   - Highlights active word with `#facc15` (neon yellow) or `#38bdf8` (electric cyan), spring scale `1.15`, and glass backdrop.
   - Adheres to TikTok/Reels safe area (`bottom: 220px` in 9:16).

2. **`MicroAnimations.tsx`**:
   - **Email Widget (`email`)**:
     - User prompt message pill: *"Gửi email tự động..."*
     - Envelope icon `✉️` with spring translation `(x, y)` traversing across screen.
     - Confirmation badge: `[ ✓ Đã gửi thành công ]` with scale spring punch.
   - **AI Chip Widget (`ai`)**:
     - Concentric glowing rings with sine wave pulsation.
     - Particle streaks emitting from center chip.
   - **Shield Widget (`security`)**:
     - Hexagonal glowing shield rotating into center.
     - Lock icon `🔒` snapping shut with spring damping.
   - **Speed Widget (`speed`)**:
     - Counter interpolating numbers (e.g. `0% -> 99%` or `0.2s`).
     - Progress bar speeding from left to right.

3. **`FloatingBadges.tsx`**:
   - Renders 2–3 pills from `scene.floatingTags`.
   - Oscillates vertically using `Math.sin((frame + offset) / 15) * 12px`.
   - Styled with glassmorphism (`backdrop-filter: blur(12px)`), neon borders, and glowing dot.

4. **`DeviceMockup.tsx`**:
   - Houses the image in a sleek smartphone / tablet mockup bezel with rounded corners (`28px`), subtle glare overlay, and glass drop shadow (`box-shadow: 0 25px 60px rgba(0,0,0,0.6)`).
   - Ken Burns smooth scale animation (`1.0 -> 1.08`).

### 4.3 Finch Parallel Image Batch (`server/marketing/studio.ts`)

- `generateMarketingImages`:
  - Receives array of prompts (length $N \ge 1$).
  - Fires all requests concurrently via `Promise.allSettled`.
  - Enforces aspect ratio 1080×1920 (or target video resolution) on the upstream generation request.
  - Updates Finch's system prompt (Soul) to forbid opening Chrome tabs to inspect files.

### 4.4 Momo 1-Shot Video Production (`server/marketing/studio.ts`)

- `generateMarketingVideoWorkflow`:
  - Executes audio TTS (Gemini multi-model cascade) $\rightarrow$ Audio mixer $\rightarrow$ Remotion compiler.
  - Updates Momo's Soul: strictly 1-shot execution, return MP4 immediately, no browser inspections.

### 4.5 RoMes Headless Fast-Publishing (`server/marketing/publisher.ts`)

- Standalone CLI/script module:
  - Takes `{ platform: "tiktok" | "facebook", videoPath, caption, hashtags }`.
  - Launches headless Chromium pointing to user's existing Chrome profile directory (`~/.openmausbot/browser` or system profile).
  - Uses direct navigation and file input attachment without interactive AI screenshot inspection loops.
  - Finishes within 30–60 seconds.

---

## 5. Implementation Phases

1. **Phase 1: Remotion Micro-Animations & Kinetic Captions**:
   - Implement `KineticCaptions.tsx`, `MicroAnimations.tsx`, `FloatingBadges.tsx`, `DeviceMockup.tsx`.
   - Wire them into `Scene.tsx` and `Root.tsx`.
2. **Phase 2: Swarm Souls & Storyboard Directives Update**:
   - Update Poppy, Finch, and Momo souls in `~/.openmausbot/bots.json` to enforce 1-shot execution and visual directives.
   - Update `MarketingSceneSpec` to accept `animationType` and `floatingTags`.
3. **Phase 3: Fast Parallel Image Generation**:
   - Ensure `studio.ts` handles concurrent image creation without timeouts.
4. **Phase 4: Headless Fast-Uploader Script**:
   - Implement streamlined publisher module for TikTok & Facebook.
5. **Phase 5: Verification & Automated Tests**:
   - Add unit tests for kinetic captions and micro-animations.
   - Run vitest across `server/marketing/` and verify linting with `oxlint`.

---

## 6. Success Metrics

- **End-to-end production time**: $\le 3$ minutes (from user prompt to MP4 in chat).
- **Publishing time**: $\le 60$ seconds (from user "Duyệt đăng" to published post).
- **Error rate**: 0 tool failures (`browser_click` / `eval` errors eliminated).
- **Video retention visual score**: High-quality kinetic typography, contextual animation, and glassmorphism styling verified on 1080×1920 MP4 outputs.
