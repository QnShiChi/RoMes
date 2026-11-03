# RoMes Marketing Swarm Reliability Refactor

**Date:** 2026-11-03  
**Status:** Approved  
**Scope:** Marketing consultation, swarm orchestration, Remotion production, media timing, image relevance, and evidence-backed publishing

## 1. Purpose

RoMes must produce visually varied marketing videos at the requested duration, reuse completed artifacts when the user asks to publish them, and never report an external action as successful without evidence from the tool that performed it.

This design replaces prompt-only workflow guarantees with typed contracts, persisted campaign state, capability gates, and isolated end-to-end verification. It preserves the useful Remotion and media work already prototyped while removing unsafe publishing and duration shortcuts.

## 2. Relationship to Earlier Designs

This document refines and, where the requirements conflict, supersedes:

- `2026-10-31-marketing-studio-pipeline-design.md`
- `2026-11-01-video-marketing-engine-design.md`
- `2026-11-02-fast-video-pipeline-and-remotion-animations-design.md`

In particular:

- `mark_marketing_published` is not a public agent tool that accepts untrusted success claims.
- Publishing is not considered successful merely because a local headless script returns a fabricated URL.
- Bot configuration is installed from a versioned preset and is not edited directly in a person's live `~/.openmausbot/bots.json` during development or verification.
- A requested duration is a production contract. Long silent or music-only padding is not an acceptable substitute for narration.
- Scene semantics use typed layout-specific data instead of overloading a generic `bulletPoints` field.

## 3. Findings in the Current Prototype

The working tree contains promising partial changes:

- additional Remotion scene types and a whole-video layout resolver;
- a bounded caption window;
- `targetDurationSeconds` in the MCP schema;
- improved stock-image keyword filtering;
- removal of a publisher that generated success URLs locally;
- stronger consultation and truthful-reporting instructions in the live bot souls.

These changes do not yet enforce the required behavior end to end:

- `enrichScriptForDuration` can append scene labels and benefits, but cannot guarantee natural narration or the requested spoken duration;
- the audio mixer can pad the voice stream to the target, leaving a material portion without narration;
- captions are distributed by word count rather than aligned to the final voice track;
- `resolveSceneLayouts` can silently change presentation semantics when generic scene data is repeated;
- nearest-directory image discovery can associate unrelated assets with a campaign;
- a caller can still pass arbitrary results to `markMarketingPublished` and cause a draft to be labelled published;
- intent safety remains primarily in the bot prompt, so a mistaken tool selection can still render or publish the wrong thing.

The refactor keeps the useful primitives but moves the invariants into code and persisted state.

## 4. Architecture

The system is divided into six bounded components:

1. **Brief service** validates required user decisions and produces an approved marketing brief.
2. **Campaign service** owns state transitions, idempotency, and the artifact manifest.
3. **Swarm coordinator** assigns typed work to Poppy, Finch, and Momo.
4. **Media pipeline** produces narration, alignment, images, audio, and Remotion video.
5. **Artifact service** resolves completed outputs for preview, revision, download, and publishing.
6. **Publisher gateway** exposes configured provider capabilities and records provider evidence.

The normal flow is:

```text
user request
  -> intent classification
  -> brief completeness gate
  -> explicit approval
  -> script and visual production
  -> narration and timing quality gate
  -> image and storyboard quality gate
  -> idempotent render
  -> ready artifact
  -> optional publish request
  -> provider capability and evidence gate
  -> published or failed
```

Creation and publishing are separate flows. A publish intent cannot access a render tool, and a create intent cannot mark an external post as published.

## 5. Campaign Contract and State Machine

### 5.1 Marketing brief

Video work requires these fields before production begins:

- topic or product;
- campaign goal;
- target audience;
- target platform or aspect ratio;
- style and tone;
- target duration;
- primary call to action.

The brief validator returns `missingFields` and two or three concise suggestions. It performs no production work until the user explicitly approves the completed brief.

### 5.2 Campaign job

Each campaign is persisted under its campaign asset directory with a stable ID and schema version. Its states are:

```text
needs_brief
  -> approved
  -> scripting
  -> assets_ready
  -> rendering
  -> ready
  -> publishing
  -> published
```

Revision creates a new artifact revision inside the same campaign; it does not mutate or lose the previously approved output.

Any active production or publishing state may transition to `failed`, recording `failedStage` and the last valid state. A retry resumes from that last valid state with the same idempotency key where the operation supports safe reconciliation.

Only the campaign service may transition state. Every transition validates the current state, required inputs, actor capability, and idempotency key.

### 5.3 Artifact manifest

Scripts, source images, speech, mixed audio, alignment data, and videos are registered as artifacts. Each record includes:

- artifact and campaign IDs;
- revision and artifact type;
- absolute canonical path inside the campaign directory;
- content hash and byte size;
- creation time and producing operation;
- media dimensions and probed duration when applicable;
- relationship to source artifact IDs.

A video render key is derived from the approved storyboard, narration, image hashes, ratio, FPS, voice, BGM, brand settings, and renderer version. An existing successful render with the same key is reused.

Conversation context stores artifact IDs, not guessed paths. “Video vừa rồi” resolves to the most recent ready video attached to that conversation. Ambiguous matches produce one clarification question.

## 6. Intent Routing and Swarm Responsibilities

The intent router recognizes four operations:

- `create`: make a new marketing asset;
- `revise`: change an existing artifact;
- `publish`: distribute an existing ready artifact;
- `inspect`: preview, download, or report status.

Explicit publish verbs such as “đăng”, “up”, and “chia sẻ” take precedence when they refer to an existing artifact. Ambiguous language does not trigger tools.

Tool scopes follow least privilege:

- **Poppy** has no tools and returns a typed script and storyboard.
- **Finch** can generate campaign-bound images only.
- **Momo** can create media artifacts for an approved campaign only.
- **RoMes** can validate the brief, coordinate specialists, resolve and attach artifacts, inspect publishing capabilities, and invoke a real publisher. RoMes does not receive the raw render tool.

Poppy and Finch may work concurrently after approval. Momo starts only after their typed outputs pass validation. All assignments carry campaign ID, revision, requested duration, and an operation idempotency key. The same assignment cannot create duplicate outputs.

Prompt instructions reinforce this workflow but are not the enforcement boundary. The canonical souls and tool scopes live in a versioned bot preset with an explicit migration. Fixture installation targets a temporary home; live user configuration is never the verification target.

## 7. Duration, Narration, Audio, and Captions

### 7.1 Duration contract

`targetDurationSeconds` is required for video production and is propagated through the storyboard, speech, mixer, frame allocator, renderer, probe, and result manifest.

Poppy initially budgets Vietnamese narration at approximately 2.3 words per second. The speech engine measures the produced audio. If narration falls outside 95–105 percent of the target, the coordinator returns structured feedback to Poppy and synthesizes again, for at most three attempts. A separate final fit gate requires the narration to end at or before the target and permits no more than the 0.5–1.5 second ending hold described below; passing the broad retry band alone is not sufficient.

After the final attempt, production fails clearly rather than hiding a large narration deficit. A normal ending may contain 0.5–1.5 seconds of music and visual hold. Voice time stretching is not used to manufacture duration.

### 7.2 Audio timeline

The mixer:

- loops BGM as needed;
- applies a short crossfade at loop boundaries;
- ducks BGM against the real voice signal;
- trims the result to the exact target duration;
- pads only the small permitted ending hold;
- probes and records the final mixed duration.

The Remotion composition derives its total frames directly from the requested duration. Rounding residue is distributed deterministically across scene frame allocations, so the rendered video differs from the target by no more than one frame.

### 7.3 Narration alignment

An alignment adapter maps the final transcript to the final speech audio and returns word or phrase timestamps. Provider-native timepoints are preferred. A configured forced-alignment provider is the fallback. Scene-level speech timing is the degraded fallback; whole-script proportional timing is not presented as exact alignment.

Captions are grouped into natural phrases of three to six words. They:

- show only the phrase active at the current frame;
- occupy at most two lines;
- respect ratio-specific safe areas;
- use measured text constraints to avoid overflow;
- never cover a scene's declared focal region;
- degrade to scene-level phrase changes if word alignment is unavailable.

## 8. Typed Storyboards and Remotion Scene System

`MarketingSceneSpec` becomes a discriminated union. Each layout receives semantically correct data:

- `HookScene`: headline, support line, visual focus;
- `ProblemScene`: pain points and severity;
- `SplitScene`: explicit before and after content;
- `StatsScene`: typed value, unit, label, and optional source note;
- `FeaturesScene`: short benefits;
- `ProductScene`: product or device asset and highlights;
- `QuoteScene`: quotation and attribution;
- `CtaScene`: action, support line, and destination label.

A scene registry maps each type to a dedicated component. The initial registry includes hero, warning/glitch, split reveal, animated counters, staggered cards, moving 3D device mockup, editorial quote, and CTA layouts.

The storyboard validator rejects rather than silently repairs semantic errors. It enforces:

- no consecutive scenes from the same composition family;
- all required fields for the selected layout;
- layout-specific copy length limits;
- approximately seven or eight scenes for a 60-second video;
- a coherent hook, context or problem, evidence or solution, and CTA arc;
- a minimum readable scene duration, normally three seconds.

Motion components share typography, brand tokens, safe-area rules, easing, and transition primitives. They do not share the same visual composition. Transitions consume frames inside adjacent scenes and do not extend the target duration.

## 9. Relevant Image Pipeline

Visual requirements are represented as structured data:

- subject;
- environment;
- action;
- visual style;
- technology tags;
- excluded concepts;
- ratio and focal region.

The image pipeline uses this order:

1. reuse a campaign-bound generated artifact with matching provenance;
2. generate a new AI image;
3. use stock search only when generation fails;
4. use a branded abstract fallback if stock relevance cannot be established.

Stock queries are generated from a controlled visual ontology, not by keeping arbitrary words from an English prompt. Core tokens such as `ai`, `ar`, `vr`, `iot`, and `3d` are preserved and expanded where needed. Descriptive prompt language such as `scene`, `showing`, `dramatic`, `opportunities`, and `risks` is excluded. Technology context is added from the structured subject, for example `artificial intelligence technology office`.

Every image is validated for format, dimensions, campaign provenance, and declared subject tags. Directory recency alone never establishes that an image belongs to a campaign.

## 10. Evidence-Backed Publishing

The publisher gateway exposes:

```text
capabilities() -> configured providers, platforms, account identity, and permission state
publish(artifact, copy, idempotencyKey) -> provider evidence
```

Provider evidence contains platform, provider, account identifier, provider post ID, canonical URL, and timestamp. The gateway validates the response before it can transition a campaign to `published`.

If no provider is configured, authentication is missing, or evidence validation fails, the artifact remains `ready` or the publish attempt becomes `failed`. RoMes states that it could not publish, explains why, reattaches the ready MP4, and explains how to enable a supported provider.

`mark_marketing_published` is removed from the public MCP surface. Internal persistence accepts only an authenticated gateway result tied to the same campaign, artifact, provider call, and idempotency key. The model cannot create successful publish records by supplying a URL.

The first implementation phase builds the capability and evidence gate. Postiz or browser-based adapters may be added behind the same interface, but neither is required for honest failure behavior.

## 11. Failure Handling

- Validation failures return typed field errors and do not start expensive work.
- A failed specialist assignment records its operation and can be retried without duplicating completed artifacts.
- TTS duration failure reports measured duration, target, and the exhausted attempt count.
- Image generation failure proceeds to stock only through the relevance gate.
- Render failure retains its source artifacts and never registers a ready video.
- Publish timeout remains an unknown or failed attempt until the provider can be queried by idempotency key; it is never assumed successful.
- Missing or moved artifact files invalidate the manifest entry and produce a recovery message instead of a guessed path.

## 12. Verification

Verification follows `docs/verification/README.md`. It launches an isolated OpenMausBot fixture and never mutates the user's running app, bots, conversations, browser profile, or social accounts.

The implementation adds `docs/verification/marketing-swarm.md` and covers:

### Unit and contract tests

- intent classification and brief completeness;
- valid and invalid campaign transitions;
- render and publish idempotency;
- typed storyboard parsing and layout validation;
- duration budgeting and exact frame allocation;
- BGM loop, crossfade, ducking, trim, and probe behavior;
- caption phrase windows and safe-area constraints;
- visual ontology queries, including preservation of `ai`, `ar`, `vr`, and `iot`;
- rejection of arbitrary publish results.

### Media integration tests

- deterministic fake TTS with controlled durations;
- real FFmpeg mixing and duration probing;
- real Remotion rendering in a temporary assets directory;
- a 60-second MP4 within one frame of the target;
- frame stills at the beginning, middle, and end of every scene;
- no consecutive composition family and no caption overflow.

### Conversation and publishing fixtures

- an incomplete “tạo cho anh một video” request asks for missing brief fields and makes no production tool call;
- an approved brief coordinates the expected specialist operations once;
- “up video vừa rồi lên TikTok” resolves the ready artifact and never calls a render tool;
- no configured publisher produces an honest refusal and an attached MP4;
- a loopback publisher response without valid evidence cannot mark a campaign published;
- a valid loopback Postiz or browser adapter response records the canonical URL and provider post ID;
- repeating the same render or publish command does not create a duplicate.

The verification report retains the redacted tool-call transcript, campaign manifest, duration probes, render metadata, selected frame stills, and synthetic publish evidence. Completion is not claimed from unit tests alone.

## 13. Delivery Phases

### Phase 1: Safety and orchestration

- campaign contract, state machine, and artifact manifest;
- consultation and intent gates;
- render reuse and artifact resolution;
- publisher capability and evidence gate;
- versioned four-bot preset and migration;
- isolated conversation verification for creation and publishing intent.

This phase resolves duplicate rendering, false publishing claims, and premature execution.

### Phase 2: Duration and narration

- speech duration feedback loop;
- exact audio and frame timelines;
- narration alignment abstraction;
- kinetic caption phrase timing and safe areas.

### Phase 3: Visual production

- discriminated scene contracts and registry;
- storyboard quality gate;
- varied Remotion compositions;
- structured AI-first image pipeline and safe stock fallback;
- visual regression evidence.

### Phase 4: End-to-end hardening

- recovery and retry behavior;
- performance benchmark and compatibility migration;
- complete fixture recipe and operator documentation.

Each phase is independently testable and reversible. The implementation plan following this specification covers Phase 1 only.

## 14. Acceptance Criteria

The program is complete when all of these statements are proven in isolated verification:

- vague requests lead to consultation without production tool calls;
- approved requests produce exactly one campaign revision and one reusable video artifact;
- a requested 60-second video is within one frame of 60 seconds and narration satisfies the agreed coverage policy;
- adjacent scenes have different composition families and use typed semantic content;
- captions follow measured narration timing and remain inside safe areas;
- technology imagery remains campaign-relevant through AI generation or controlled fallback;
- publish requests reuse the existing video and cannot invoke rendering;
- no external success is reported without provider post ID and canonical URL evidence;
- no verification step touches live OpenMausBot or social data.
