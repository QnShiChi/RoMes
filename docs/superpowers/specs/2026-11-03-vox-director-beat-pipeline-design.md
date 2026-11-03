# Vox-Director Beat Pipeline & 2.5D Kinetic Motion Engine

**Status**: Ready for Review  
**Author**: Antigravity  
**Date**: 2026-11-03  

---

## 1. Executive Summary

The existing video generation pipeline produced static, monotonous videos (often just a single image frozen for 30+ seconds, lack of visual diversity, no animation, and static captured HTML screenshots). Furthermore, expecting lightweight swarm models like `gpt-4o-mini` to code complex HTML/React templates caused failure modes and poor visual output.

This specification redesigns the video production pipeline by adapting the proven architecture of **`Alisa0808/vox-director`**:
1. **Beat-Layer Architecture (`beats.json`)**: Replaces vague, lengthy scenes with a structured sequence of 8–12 rapid beats (3–5 seconds each) matching short-form video pacing (TikTok / Reels / Shorts).
2. **Visual Collage Art Engine**: Empowers Finch with Vox-Director's 5-layer prompt engine (torn paper, retro risograph/halftone, newspaper clippings, sticker badges, vibrant duotone contrast) to generate high-aesthetic keyframes per beat.
3. **2.5D Native FFmpeg Motion & Kinetic Subtitles**: Eliminates the fragile Chrome headless screenshot pipeline in favor of a fast native FFmpeg engine that executes dynamic 2.5D camera movements (`slow_zoom_in`, `punch_in`, `pan_lướt`), burns word-by-word kinetic typography (via `.ass` subtitle format), and applies audio ducking with sound effects (whoosh, paper slide).
4. **Clean Swarm Role Specialization**:
   - **RoMes**: Orchestrator & campaign lifecycle manager.
   - **Poppy**: Beat architect (writes voiceover and structures the 8–12 narrative beats).
   - **Finch**: Visual & collage director (generates unique collage keyframes per beat).
   - **Momo**: Video compositor (executes TTS timing scaling, FFmpeg 2.5D assembly, and audio mastering).

---

## 2. Problem Statement & Root Cause Analysis

1. **Single-Image Stagnation**:
   - Finch's soul prompt previously had no requirement to match individual scenes with distinct images, causing Finch to generate only one image (`image-1.jpg`).
   - In [`server/marketing/studio.ts`](file:///home/phan-duong-quoc-nhat/workspace/RoMes/server/marketing/studio.ts#L925), the fallback mechanism `discoveredImages[idx % length]` looped over the single available image, forcing every scene to render with `image-1.jpg`.
2. **Frozen Chrome Headless Screenshotting**:
   - The fallback renderer [`renderWithHtmlFfmpeg`](file:///home/phan-duong-quoc-nhat/workspace/RoMes/server/marketing/video-compiler.ts#L170) opened Chrome headless, captured a single static PNG screenshot of the scene's HTML card, and applied a naive FFmpeg loop.
   - Any dynamic CSS animation, kinetic typography, or reactive layout in HTML was completely flattened into a static raster image.
3. **Mismatched Agent Burden**:
   - Expecting LLMs to write low-level Remotion/HTML code on the fly led to brittle syntax errors and low aesthetic quality.
   - LLMs excel at structured storytelling (`beats.json`); deterministic engines excel at rendering 60 FPS motion graphics and audio sync.

---

## 3. Data Contract: `beats.json` Schema

The pipeline centers on a deterministic beat manifest produced by Poppy and consumed by Finch and Momo:

```ts
export type CameraMotion =
  | "slow_zoom_in"   // Smooth progressive zoom from 1.0x to 1.15x
  | "slow_zoom_out"  // Pull back from 1.15x to 1.0x
  | "punch_in"       // Rapid 1.25x snap zoom on emphatic keyword
  | "pan_left"       // Horizontal sweep across horizontal collage assets
  | "pan_right"      // Horizontal sweep right
  | "static_drift";  // Gentle 2% floating drift

export type CollageStyleTheme =
  | "retro_tech_newspaper"   // Kraft paper, halftone dots, news clippings, neon amber/red
  | "modern_cyber_editorial" // Deep charcoal, cyan/purple neon torn edges, circuit tape
  | "bold_flat_pop";         // High-contrast orange/blue, giant sticker shapes, flat geometry

export interface NarrativeBeat {
  beatIndex: number;
  durationEstimateMs: number; // 3000ms - 5000ms
  narration: string;          // Spoken sentence or phrase (8 - 15 words)
  visualPrompt: string;       // Rich English prompt for Flux/Nano-Banana-2
  cameraMotion: CameraMotion;
  keywordHighlight?: string;  // Word or phrase to emphasize in kinetic subtitles
  transitionSfx?: "whoosh" | "paper_slide" | "pop" | "none";
}

export interface CampaignBeatManifest {
  campaignSlug: string;
  targetDurationSeconds: number;
  styleTheme: CollageStyleTheme;
  beats: NarrativeBeat[];
}
```

---

## 4. Multi-Agent Swarm Specialization & Workflow

```
[User Request]
       │
       ▼
 👑 RoMes (Chief of Staff & Coordinator)
   - Prepares campaign brief and locks approval.
   - Passes campaign parameters and style preset to Poppy.
       │
       ▼
 ✍️ Poppy (Beat Architect & Storyboarder)
   - Writes voiceover narration.
   - Partitions kịch bản into 8–12 structured beats (`beats.json`).
   - Assigns `cameraMotion` and `keywordHighlight` per beat.
       │
       ▼
 🎨 Finch (Visual & Collage Director)
   - Reads `beats.json` visual prompts.
   - Prepends the 5-layer Collage Style Prefix corresponding to `styleTheme`.
   - Calls `generate_marketing_images` in batch to produce `image-1.jpg` .. `image-N.jpg`.
       │
       ▼
 🎬 Momo (Video Compositor & Sound Master)
   - Synthesizes speech with Google AI Studio Speech.
   - Calculates exact beat durations aligned with speech timing.
   - Runs native FFmpeg 2.5D compositor with ASS kinetic subtitles and audio ducking.
   - Delivers finished MP4 preview to chat.
```

---

## 5. Visual Prompt Engine for Finch

To guarantee the signature Vox paper-collage aesthetic without 3D morphing or plastic CGI artifacts, Finch composes each prompt using the 5-layer anatomy:

```
[Medium & Art Direction]
"Mixed-media torn-paper collage, retro editorial explainer illustration, vintage risograph and halftone screen-print texture"
+
[Focal Subject per Beat]
"${beat.visualPrompt}"
+
[Paper-Craft & Ephemera Elements]
"Rough torn paper edges, vintage newspaper typography cutouts, translucent scotch tape, bright highlighter pen circles, hand-drawn vector sticker arrows"
+
[Color Palette & Lighting]
"Bold graphic duotone palette: deep charcoal background with electric amber and cyan paper cutouts, flat editorial lighting, crisp high-contrast shadows"
+
[Framing & Negative Space]
"Vertical 9:16 poster composition, ample negative space at top and bottom for kinetic captions, clean graphic layout, no blurry 3D CGI or photorealistic render artifacts"
```

---

## 6. Native FFmpeg 2.5D Motion & Kinetic Subtitle Engine

### 6.1 Audio Sync & Beat Duration Rescaling
1. Google AI Studio Speech synthesizes full voiceover or beat segments to produce `speech.wav`.
2. Total speech duration $D_{\text{speech}}$ is calculated.
3. If user requested duration $D_{\text{target}} > D_{\text{speech}}$, the remainder is cushioned with BGM outro or beat timestamps are proportional to narration word counts:
   $$\text{duration}(beat_i) = \max\left(2.5, \frac{\text{wordCount}(beat_i)}{\text{totalWords}} \times D_{\text{speech}}\right)$$

### 6.2 2.5D Camera Filter Specifications
Each beat image (`image-i.jpg`) is processed into an animated video segment using FFmpeg filtergraphs:
* **`slow_zoom_in`**:
  ```
  scale=1080*2:1920*2,zoompan=z='min(zoom+0.0012,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1080x1920:fps=30
  ```
* **`punch_in`**:
  ```
  scale=1080*2:1920*2,zoompan=z='if(lte(on,10),1.0+on*0.02,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={frames}:s=1080x1920:fps=30
  ```
* **`pan_left` / `pan_right`**:
  ```
  scale=1080*2:1920*2,zoompan=z='1.10':x='if(lte(x,0),0,x-1)':y='ih/2-(ih/zoom/2)':d={frames}:s=1080x1920:fps=30
  ```

### 6.3 Kinetic Subtitle Generation (`.ass`)
A dedicated subtitle generator writes Advanced SubStation Alpha (`.ass`) files:
- **Font**: Sans-Serif Bold / Heavy (Montserrat / Arial Black).
- **Style**: Primary font color white (`&H00FFFFFF`), border size 4px solid black (`&H00000000`), subtle drop shadow.
- **Position**: Center aligned, bottom margin $Y = 320\text{px}$ (safe zone for mobile short-form UI).
- **Keyword Accent**: Words matching `keywordHighlight` are wrapped in color override tags `{\c&H00E5FF&}` (Electric Yellow) or `{\c&HFF3300&}` (Vibrant Coral).

### 6.4 Audio Mastering
- **Voiceover**: Normalized to -14 LUFS.
- **Background Music**: Ducked to -22 dB during speech segments, raised to -14 dB during intros/outros.
- **SFX**: Subtle paper-rustle and whoosh audio cues overlaid at beat cut transitions.

---

## 7. Migration & Compatibility

1. **Backwards Compatibility**:
   - `generate_marketing_video` continues to accept legacy `scenes` array, transforming them internally into `beats` if necessary.
   - If an existing campaign has older assets, the engine executes smoothly without breaking.
2. **Batch Image Generation Upgrade**:
   - Expand `generate_marketing_images` tool schema to permit up to 12 prompts per call, enabling 1-shot generation of all beat posters.
3. **Elimination of Puppeteer/Chrome Dependency**:
   - Native FFmpeg eliminates Chrome process overhead, memory leaks, and sandbox permission issues.

---

## 8. Verification Plan

1. **Unit Tests**:
   - `server/marketing/beat-schema.test.ts`: Validate `beats.json` parsing, duration scaling, and fallback handling.
   - `server/marketing/kinetic-subtitles.test.ts`: Verify `.ass` generation with proper styling and color highlight tags.
   - `server/marketing/ffmpeg-motion.test.ts`: Test zoom/pan filter generation and concat pipeline.
2. **Integration Tests**:
   - Run end-to-end video compilation with mock image and audio assets.
   - Verify video output metadata: 1080x1920, 30fps, valid AAC audio, valid duration.
3. **Swarm E2E Verification**:
   - Test interaction flow between RoMes, Poppy, Finch, and Momo on an isolated test campaign.
   - Confirm each beat produces a unique image and motion sequence.
