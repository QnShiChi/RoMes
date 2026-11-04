# Social Post Content & Multi-Tier AI Image Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish an autonomous, high-quality Social Post (Facebook/LinkedIn) production pipeline with commercial copywriting and a resilient multi-tier AI image generation engine (Google AI Studio Image API + FLUX fallback), strictly decoupling social posts from video rendering.

**Architecture:** Extend intent classification to route "social_post" distinctly from "video_campaign". Implement a 5-layer commercial prompt framework in Finch that generates exactly $N$ images requested by the user. Upgrade `studio.ts` to query Google AI Studio multimodal image generation (`gemini-3.1-flash-lite-image`/`gemini-2.5-flash-image`) with seamless fallback to High-Resolution FLUX on HTTP 429 quota exhaustion, purging Unsplash and torn-paper artifacts. Update RoMes, Poppy, and Finch soul files and sync to OpenMausBot.

**Tech Stack:** TypeScript, Node.js, Vitest, Google Generative Language API, Pollinations FLUX Engine, OpenMausBot Swarm.

**Spec:** [`docs/superpowers/specs/2026-11-04-social-post-content-and-ai-image-pipeline-design.md`](file:///home/phan-duong-quoc-nhat/workspace/RoMes/docs/superpowers/specs/2026-11-04-social-post-content-and-ai-image-pipeline-design.md)

## Global Constraints

- Never call Momo or FFmpeg video compilation when intent is a social post.
- Exactly $N$ images generated when the user or brief requests $N$ images.
- No Unsplash image queries, no paper collage, no torn paper edges, no newspaper cutouts.
- Zero test regressions across `server/marketing/*.test.ts`.
- Follow AGENTS.md: comments only for facts forced from outside or wire contracts; launch isolated verification.

---

### Task 1: Intent Routing & Social Post Brief Support

**Files:**
- Modify: `server/marketing/intent.ts`
- Modify: `server/marketing/brief.ts`
- Test: `server/marketing/intent.test.ts`
- Test: `server/marketing/brief.test.ts`

**Interfaces:**
- Consumes: User message string
- Produces: `routeMarketingIntent(message: string)` returning `MarketingIntent` (extended with `"create_post"` | `"create_video"` alongside `"create"` | `"revise"` | `"publish"` | `"inspect"` | `"unknown"`)
- Produces: `MarketingBriefInput` supporting optional `contentType: "social_post" | "video_campaign"` and `imageCount?: number`

- [ ] **Step 1: Write failing tests in `server/marketing/intent.test.ts`**

Add tests asserting:
1. Messages like `"em giúp anh viết một bài về chủ đề AI"`, `"tạo content đăng bài facebook"`, `"viết bài post linkedin"` route to `{ intent: "create_post", confidence: "high" }`.
2. Messages like `"tạo video tiktok"`, `"làm video về chip AI"`, `"dựng clip"` route to `{ intent: "create_video", confidence: "high" }`.
3. Legacy generic `"tạo nội dung marketing"` still maps to `"create"`.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/intent.test.ts`
Expected: FAIL with missing `"create_post"` / `"create_video"` intent matching.

- [ ] **Step 3: Implement updated `intent.ts` and `brief.ts`**

Update `server/marketing/intent.ts`:
- Define `POST_TERMS = term("viết\\s+bài|bài\\s+viết|bài\\s+đăng|post|content|facebook|fb|linkedin|instagram|ig|status")`.
- Define `VIDEO_TERMS = term("video|clip|tiktok|reels?|phim|dựng\\s+video|quay\\s+video")`.
- If `CREATE_ACTION` matches:
  - If `POST_TERMS` matches and NOT `VIDEO_TERMS`: return `{ intent: "create_post", confidence: "high" }`.
  - If `VIDEO_TERMS` matches: return `{ intent: "create_video", confidence: "high" }`.
  - Else: return `{ intent: "create", confidence: "high" }`.

Update `server/marketing/brief.ts`:
- Add `contentType?: "social_post" | "video_campaign"` and `imageCount?: number` to `MarketingBriefInput` and `MarketingBrief`.
- Default `contentType` to `"social_post"` if platform is Facebook/LinkedIn or if `POST_TERMS` matched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/marketing/intent.test.ts server/marketing/brief.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/marketing/intent.ts server/marketing/brief.ts server/marketing/intent.test.ts server/marketing/brief.test.ts
git commit -m "feat(marketing): add social post intent routing and brief support"
```

---

### Task 2: Multi-Tier Resilient Image Generation Engine

**Files:**
- Modify: `server/marketing/studio.ts:390-480`
- Test: `server/marketing/studio.test.ts`

**Interfaces:**
- Consumes: `GenerateImagesInput` (`campaignSlug: string`, `prompts: ImagePromptSpec[]`)
- Produces: `GenerateImagesOutput` with exactly `prompts.length` images generated via Google AI Studio Image API or FLUX, saving to `.jpg` files without Unsplash.

- [ ] **Step 1: Write failing tests in `server/marketing/studio.test.ts`**

Add tests:
1. `generateMarketingImages` generates exactly 3 images when 3 prompts are given.
2. When Google AI Studio returns 429 Quota Exceeded, fallback automatically executes without throwing, returning valid JPEG buffers.
3. Verify Unsplash is never called.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/studio.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement Multi-Tier Engine in `server/marketing/studio.ts`**

1. Add Google AI Studio image generator function `fetchFromGeminiImageApi`:
   - URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${apiKey}` (with fallback to `gemini-2.5-flash-image`).
   - Body: `{ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"] } }`.
   - Extracts base64 image data from `candidates[0].content.parts[0].inlineData.data`.
2. Update `fetchSingleImage`:
   - Try `fetchFromGeminiImageApi` first if `GEMINI_API_KEY` is present.
   - If it throws (e.g. 429 Quota Exceeded / Free Tier limit 0) or no key:
     - Fallback immediately to high-resolution FLUX endpoint:
       `${baseUrl}/${encodeURIComponent(prompt)}?model=flux&width=${width}&height=${height}&seed=${seed}&nologo=true`.
   - Remove `fetchFromUnsplash` and Unsplash access key checking from `fetchSingleImage`.
   - Remove `rough torn paper edges, vintage newspaper typography` defaults.
3. Ensure exact count: If input has $N$ prompts, iterate through all $N$ prompts and produce $N$ images.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/marketing/studio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/marketing/studio.ts server/marketing/studio.test.ts
git commit -m "feat(marketing): implement multi-tier ai image engine with google ai studio and flux fallback"
```

---

### Task 3: MCP Server Social Post & Image Tools Extension

**Files:**
- Modify: `server/marketing/mcp-server.ts`
- Test: `server/marketing/mcp-server.test.ts` (or marketing test suite)

**Interfaces:**
- Consumes: MCP tool calls `prepare_marketing_campaign`, `generate_marketing_images`, `save_social_post`
- Produces: Updated campaign status handling for social posts where `assets_ready` represents ready post with images, without requiring `generate_marketing_video`.

- [ ] **Step 1: Write failing test for social post campaign lifecycle**

Test that a campaign with `contentType: "social_post"` completes when post content and $N$ images are generated, transitioning status to `assets_ready` and ready for review/publish without requiring video render.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/`
Expected: FAIL.

- [ ] **Step 3: Update `server/marketing/mcp-server.ts`**

1. In `prepare_marketing_campaign`:
   - Accept `contentType?: "social_post" | "video_campaign"` and `imageCount?: number`.
   - Default style for `social_post` to `"Bài viết truyền thông thương mại chuyên sâu"`.
2. In `generate_marketing_images`:
   - Enforce exact $N$ images matching `prompts` array.
   - Set metadata clearly indicating `post_image` vs `video_beat`.
3. In `save_marketing_post` tool:
   - Ensure title, body, hashtags, and imagePaths are saved cleanly in Campaign Store.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/marketing/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/marketing/mcp-server.ts
git commit -m "feat(marketing): support social post lifecycle in mcp server"
```

---

### Task 4: Swarm Soul Instructions (RoMes, Poppy, Finch) & Bot Config Sync

**Files:**
- Modify: `server/marketing/swarm/romes.md`
- Modify: `server/marketing/swarm/poppy.md`
- Modify: `server/marketing/swarm/finch.md`
- Modify: `~/.openmausbot/bots.json`

**Interfaces:**
- RoMes: Detects social post intent, coordinates Poppy (copywriting) and Finch (commercial images) for exactly $N$ images, returns finished post in chat without calling Momo.
- Poppy: Produces Headline, Body with bullet points, CTA, Hashtags, and exactly $N$ Commercial Visual Prompts.
- Finch: Applies 5-layer commercial framework, generates exactly $N$ images, returns image preview paths.

- [ ] **Step 1: Update `romes.md`**

Add strict rules:
1. When user asks to write an article / Facebook post / LinkedIn post / content:
   - Do NOT create a video campaign.
   - Do NOT ask Poppy for voiceover or beats.
   - Do NOT call Momo.
   - Check if user specified number of images $N$ (e.g. 1 cover, 3 images, 4 images). If user specified, enforce exact $N$. If user did not specify, suggest 1 Cover or 3-4 Carousel images.
   - Direct Poppy to write Facebook/Social copywriting + $N$ image prompts.
   - Direct Finch to generate $N$ commercial images.
   - Present the final post with text and image previews in chat.

- [ ] **Step 2: Update `poppy.md`**

Add dual-role copywriting:
1. When assigned a `social_post`:
   - Structure:
     - `### BÀI VIẾT FACEBOOK / MẠNG XÃ HỘI`
     - **Tiêu đề (Hook)**
     - **Thân bài (Body)**: 3-4 luận điểm ngắn, bullet points, icon, số liệu thực tế cho đối tượng mục tiêu.
     - **Lời kết & Kêu gọi hành động (CTA)**
     - **Hashtags**
     - `### DANH SÁCH PROMPT HÌNH ẢNH (COMMERCIAL IMAGE PROMPTS)`: Đúng $N$ prompt tiếng Anh chi tiết, tả thực, thương mại, không dùng từ cắt dán giấy.

- [ ] **Step 3: Update `finch.md`**

Replace paper collage instructions:
1. For social posts, apply the 5-layer Commercial & Brand Framework:
   - Subject & Context: Vietnamese tech engineers, clean semiconductor cleanroom, high-tech AI datacenter in HCMC/Hanoi.
   - Commercial composition: 16:9 or 1:1, negative space for headlines, Hasselblad studio lighting.
   - Negative filter: Absolutely no torn paper, no vintage newspaper collage, no creepy eyes, no blurry faces.
   - Call `generate_marketing_images` for exactly the $N$ prompts received.

- [ ] **Step 4: Sync to `~/.openmausbot/bots.json`**

Sync the updated markdown content of `romes.md`, `poppy.md`, and `finch.md` into the corresponding `soul` fields of `~/.openmausbot/bots.json` so the live OpenMausBot app picks them up immediately.

- [ ] **Step 5: Commit**

```bash
git add server/marketing/swarm/romes.md server/marketing/swarm/poppy.md server/marketing/swarm/finch.md
git commit -m "feat(marketing): update swarm souls for social posts and commercial image prompts"
```

---

### Task 5: End-to-End Verification

**Files:**
- Test suite: `pnpm vitest run server/marketing`
- Live verification script / dialogue test

- [ ] **Step 1: Run full marketing vitest suite**

Run: `pnpm vitest run server/marketing`
Expected: All 15+ test files pass (100% green).

- [ ] **Step 2: Execute isolated test dialogue**

Send a mock user request: `"em giúp anh viết một bài về chủ đề Chính sách phát triển AI của các nước Đông Nam Á, đặc biệt là Việt Nam, tạo 3 ảnh minh họa"`.
Verify:
1. Intent correctly detected as social post.
2. Poppy creates Facebook copywriting + exactly 3 commercial image prompts.
3. Finch creates exactly 3 images via AI engine.
4. No voiceover generated, Momo remains idle.
5. All 3 images exist on disk and are valid JPEGs with commercial content.

- [ ] **Step 3: Commit plan & verification results**

```bash
git add docs/superpowers/plans/2026-11-04-social-post-content-and-ai-image-pipeline.md
git commit -m "docs: finalize social post and multi-tier image pipeline implementation plan"
```
