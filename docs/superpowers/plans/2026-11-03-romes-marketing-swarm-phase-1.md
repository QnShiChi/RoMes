# RoMes Marketing Swarm Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce consultation, campaign lifecycle, artifact reuse, and evidence-backed publishing so RoMes cannot render twice for a publish request or claim an unproven social post.

**Architecture:** Add focused marketing domain modules for brief assessment, intent classification, persisted campaign state, idempotent rendering, and publisher evidence. Expose those boundaries through the existing `marketing_studio` MCP server and version the four bot profiles through the repository's existing headless team-file mechanism. Preserve the current Remotion implementation behind an injected render operation; Phase 1 does not redesign duration, captions, layouts, or image relevance.

**Tech Stack:** TypeScript, Node.js filesystem and crypto APIs, Zod, Vitest, JSON-RPC MCP, OpenMausBot headless team files, isolated verification fixtures.

---

## Scope and file map

Phase 1 creates or changes only these responsibilities:

- `server/marketing/brief.ts`: required brief fields and consultation response.
- `server/marketing/brief.test.ts`: brief and Vietnamese/English intent cases.
- `server/marketing/intent.ts`: deterministic create/revise/publish/inspect routing.
- `server/marketing/campaign-store.ts`: versioned campaign JSON, transitions, artifacts, and atomic persistence.
- `server/marketing/campaign-store.test.ts`: lifecycle, path, transition, and recovery tests.
- `server/marketing/campaign-workflow.ts`: approved render gate, render-key reuse, and artifact registration.
- `server/marketing/campaign-workflow.test.ts`: renderer injection and duplicate-render tests.
- `server/marketing/publisher-gateway.ts`: provider capability contract and evidence validation.
- `server/marketing/publisher-gateway.test.ts`: unavailable, invalid-evidence, success, and retry cases.
- `server/marketing/mcp-server.ts`: lifecycle and publishing tools; remove public success mutation.
- `server/marketing/mcp-server.test.ts`: subprocess-level MCP contract and safety checks.
- `server/marketing/studio.ts`: remove the public draft-publishing mutation; keep media generation behind the workflow.
- `server/marketing/studio.test.ts`: remove the test that trusts caller-supplied publish results.
- `server/marketing/swarm/team.yaml`: versioned four-bot structure and least-privilege tool scopes.
- `server/marketing/swarm/*.md`: canonical RoMes, Poppy, Finch, and Momo standing instructions.
- `server/marketing/swarm/team.test.ts`: parse and assert the team contract.
- `docs/verification/marketing-swarm.md`: isolated product verification recipe.
- `docs/verification/README.md`: link the new recipe.

The existing dirty marketing and attachment changes belong to the user. Before every commit, stage only the files named in that task and inspect `git diff --cached --name-status`.

### Task 1: Brief consultation and intent routing

**Files:**
- Create: `server/marketing/brief.ts`
- Create: `server/marketing/brief.test.ts`
- Create: `server/marketing/intent.ts`

- [ ] **Step 1: Write failing brief and intent tests**

```ts
import { describe, expect, it } from "vitest";
import { assessMarketingBrief } from "./brief.ts";
import { routeMarketingIntent } from "./intent.ts";

describe("marketing consultation", () => {
  it("asks for every missing production decision without approving work", () => {
    expect(assessMarketingBrief({ topic: "AI Agent" })).toEqual({
      complete: false,
      missingFields: ["goal", "audience", "platform", "style", "targetDurationSeconds", "callToAction"],
      questions: expect.arrayContaining([expect.stringContaining("mục tiêu"), expect.stringContaining("thời lượng")]),
    });
  });

  it("normalizes a complete brief", () => {
    expect(assessMarketingBrief({
      topic: " AI Agent ", goal: "lead generation", audience: "SME owners",
      platform: "tiktok", style: "modern tech", targetDurationSeconds: 60,
      callToAction: "Đăng ký demo",
    })).toMatchObject({ complete: true, brief: { topic: "AI Agent", platform: "tiktok", targetDurationSeconds: 60 } });
  });
});

describe("marketing intent", () => {
  it.each([
    ["tạo cho anh một video", "create"],
    ["sửa cảnh thứ hai của video vừa rồi", "revise"],
    ["up video vừa rồi lên TikTok", "publish"],
    ["gửi lại file mp4 cho anh", "inspect"],
  ] as const)("routes %s to %s", (message, intent) => {
    expect(routeMarketingIntent(message).intent).toBe(intent);
  });

  it("does not turn an ambiguous approval into production", () => {
    expect(routeMarketingIntent("ok")).toEqual({ intent: "unknown", confidence: "low" });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing modules fail**

Run: `pnpm exec vitest run server/marketing/brief.test.ts`

Expected: FAIL because `brief.ts` and `intent.ts` do not exist.

- [ ] **Step 3: Implement the typed brief assessment**

```ts
export interface MarketingBriefInput {
  topic?: string;
  goal?: string;
  audience?: string;
  platform?: string;
  style?: string;
  targetDurationSeconds?: number;
  callToAction?: string;
}

export interface MarketingBrief {
  topic: string;
  goal: string;
  audience: string;
  platform: string;
  style: string;
  targetDurationSeconds: number;
  callToAction: string;
}

const FIELDS = ["topic", "goal", "audience", "platform", "style", "targetDurationSeconds", "callToAction"] as const;
const QUESTIONS: Record<(typeof FIELDS)[number], string> = {
  topic: "Anh muốn làm nội dung về chủ đề hoặc sản phẩm nào?",
  goal: "Mục tiêu chính là nhận diện, tương tác hay tạo khách hàng tiềm năng?",
  audience: "Nội dung nhắm tới nhóm khán giả nào?",
  platform: "Anh muốn dùng nội dung trên TikTok, Facebook hay nền tảng nào?",
  style: "Anh muốn phong cách hiện đại công nghệ, chuyên gia hay gần gũi kể chuyện?",
  targetDurationSeconds: "Thời lượng video mong muốn là khoảng bao nhiêu giây?",
  callToAction: "Anh muốn người xem thực hiện hành động nào sau video?",
};

export function assessMarketingBrief(input: MarketingBriefInput):
  | { complete: false; missingFields: Array<(typeof FIELDS)[number]>; questions: string[] }
  | { complete: true; brief: MarketingBrief } {
  const clean = (value: string | undefined) => value?.trim() || undefined;
  const normalized = {
    topic: clean(input.topic), goal: clean(input.goal), audience: clean(input.audience),
    platform: clean(input.platform)?.toLowerCase(), style: clean(input.style),
    targetDurationSeconds: Number.isFinite(input.targetDurationSeconds) && input.targetDurationSeconds! > 0
      ? Math.round(input.targetDurationSeconds!) : undefined,
    callToAction: clean(input.callToAction),
  };
  const missingFields = FIELDS.filter((field) => normalized[field] === undefined);
  if (missingFields.length) return { complete: false, missingFields, questions: missingFields.map((field) => QUESTIONS[field]) };
  return { complete: true, brief: normalized as MarketingBrief };
}
```

- [ ] **Step 4: Implement deterministic intent precedence**

```ts
export type MarketingIntent = "create" | "revise" | "publish" | "inspect" | "unknown";

const PATTERNS: Array<{ intent: Exclude<MarketingIntent, "unknown">; pattern: RegExp }> = [
  { intent: "publish", pattern: /\b(đăng|dang|up|upload|chia sẻ|share|post)\b.*\b(tiktok|facebook|reels?|kênh|video|bài)\b/i },
  { intent: "revise", pattern: /\b(sửa|chỉnh|đổi|làm lại|revise|edit)\b/i },
  { intent: "inspect", pattern: /\b(gửi lại|xem lại|tải|download|file|trạng thái|status)\b/i },
  { intent: "create", pattern: /\b(tạo|làm|viết|dựng|generate|create)\b/i },
];

export function routeMarketingIntent(message: string): { intent: MarketingIntent; confidence: "high" | "low" } {
  const text = message.trim();
  for (const candidate of PATTERNS) if (candidate.pattern.test(text)) return { intent: candidate.intent, confidence: "high" };
  return { intent: "unknown", confidence: "low" };
}
```

- [ ] **Step 5: Run tests and commit only Task 1 files**

Run: `pnpm exec vitest run server/marketing/brief.test.ts`

Expected: PASS.

```bash
git add server/marketing/brief.ts server/marketing/brief.test.ts server/marketing/intent.ts
git diff --cached --name-status
git commit -m "feat(marketing): add consultation and intent contracts"
```

### Task 2: Persisted campaign lifecycle and artifact manifest

**Files:**
- Create: `server/marketing/campaign-store.ts`
- Create: `server/marketing/campaign-store.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Create tests that use `mkdtempSync` and remove the directory in `afterEach`. Cover this exact behavior:

```ts
const store = createCampaignStore(root, () => "2026-11-03T00:00:00.000Z");
const created = store.prepare("ai-agent", completeBrief);
expect(created.status).toBe("needs_brief");
expect(store.approve(created.id, created.revision).status).toBe("approved");
expect(() => store.transition(created.id, "published")).toThrow(/cannot transition/i);

writeFileSync(join(root, "ai-agent", "video.mp4"), "video");
const artifact = store.registerArtifact(created.id, {
  type: "video", path: join(root, "ai-agent", "video.mp4"), operationKey: "render-1",
  metadata: { durationSeconds: 60, width: 1080, height: 1920 },
});
expect(store.resolveLatestReadyVideo(created.id)?.id).toBe(artifact.id);
expect(store.registerArtifact(created.id, {
  type: "video", path: artifact.path, operationKey: "render-1", metadata: artifact.metadata,
}).id).toBe(artifact.id);
```

Also assert that an artifact outside `<assetsRoot>/<campaignSlug>/` is refused and a truncated JSON file produces a named `CampaignStoreError` rather than a default campaign.

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm exec vitest run server/marketing/campaign-store.test.ts`

Expected: FAIL because `campaign-store.ts` does not exist.

- [ ] **Step 3: Add the versioned campaign types and transition table**

```ts
export type CampaignStatus = "needs_brief" | "approved" | "scripting" | "assets_ready" | "rendering" | "ready" | "publishing" | "published" | "failed";
export type ArtifactType = "script" | "image" | "speech" | "mixed_audio" | "video" | "publish_evidence";

export interface CampaignArtifact {
  id: string;
  type: ArtifactType;
  path: string;
  sha256: string;
  bytes: number;
  operationKey: string;
  createdAt: string;
  metadata: Record<string, string | number | boolean>;
}

export interface MarketingCampaign {
  schemaVersion: 1;
  id: string;
  slug: string;
  revision: number;
  status: CampaignStatus;
  brief: MarketingBrief;
  createdAt: string;
  updatedAt: string;
  lastValidStatus?: CampaignStatus;
  failedStage?: CampaignStatus;
  artifacts: CampaignArtifact[];
  operations: Record<string, { kind: "render" | "publish"; state: "running" | "succeeded" | "failed"; artifactId?: string }>;
}

const NEXT: Record<CampaignStatus, CampaignStatus[]> = {
  needs_brief: ["approved", "failed"], approved: ["scripting", "assets_ready", "failed"],
  scripting: ["assets_ready", "failed"], assets_ready: ["rendering", "failed"],
  rendering: ["ready", "failed"], ready: ["publishing", "failed"],
  publishing: ["published", "failed"], published: [], failed: ["approved", "assets_ready", "ready"],
};
```

- [ ] **Step 4: Implement atomic persistence and strict reads**

Use `campaign.json` under the normalized campaign directory. Write `campaign.json.tmp`, `fsyncSync` its descriptor, then `renameSync` it over `campaign.json`. Validate the parsed object with a private Zod schema before returning it. Never fall back to “latest campaign” and never invent a missing campaign.

The exported store interface must be:

```ts
export interface CampaignStore {
  prepare(slug: string, brief: MarketingBrief): MarketingCampaign;
  get(idOrSlug: string): MarketingCampaign;
  approve(idOrSlug: string, revision: number): MarketingCampaign;
  transition(idOrSlug: string, status: CampaignStatus): MarketingCampaign;
  fail(idOrSlug: string, failedStage: CampaignStatus): MarketingCampaign;
  beginOperation(idOrSlug: string, key: string, kind: "render" | "publish"): MarketingCampaign;
  finishOperation(idOrSlug: string, key: string, artifactId: string): MarketingCampaign;
  registerArtifact(idOrSlug: string, input: Omit<CampaignArtifact, "id" | "sha256" | "bytes" | "createdAt">): CampaignArtifact;
  findArtifactByOperation(idOrSlug: string, operationKey: string): CampaignArtifact | null;
  resolveLatestReadyVideo(idOrSlug: string): CampaignArtifact | null;
}
```

- [ ] **Step 5: Run tests and commit**

Run: `pnpm exec vitest run server/marketing/campaign-store.test.ts`

Expected: PASS, including path containment and corrupt-manifest cases.

```bash
git add server/marketing/campaign-store.ts server/marketing/campaign-store.test.ts
git diff --cached --name-status
git commit -m "feat(marketing): persist campaign lifecycle and artifacts"
```

### Task 3: Idempotent approved render workflow

**Files:**
- Create: `server/marketing/campaign-workflow.ts`
- Create: `server/marketing/campaign-workflow.test.ts`
- Modify: `server/marketing/studio.ts`

- [ ] **Step 1: Write a failing renderer-injection test**

```ts
it("renders an approved campaign once and reuses the ready artifact", async () => {
  const videoPath = join(root, "ai-agent", "ai-agent-video.mp4");
  let renders = 0;
  const render = async () => {
    renders += 1;
    writeFileSync(videoPath, "video-bytes");
    return { campaignSlug: "ai-agent", videoPath, mixedAudioPath: videoPath, speechAudioPath: videoPath,
      width: 1080, height: 1920, durationSeconds: 60, narrationSeconds: 59, bytes: 11,
      ratio: "9:16" as const, nextStepHint: "ready" };
  };
  const first = await renderApprovedCampaign(store, "ai-agent", input, render);
  const second = await renderApprovedCampaign(store, "ai-agent", input, render);
  expect(renders).toBe(1);
  expect(first.reused).toBe(false);
  expect(second).toMatchObject({ reused: true, artifactId: first.artifactId, videoPath });
});
```

Add cases that reject `needs_brief`, `approved` without `assets_ready`, and a second operation key while status is `rendering`.

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `pnpm exec vitest run server/marketing/campaign-workflow.test.ts`

Expected: FAIL because the workflow module does not exist.

- [ ] **Step 3: Implement a canonical render key**

```ts
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
}

export function marketingRenderKey(campaign: MarketingCampaign, input: GenerateMarketingVideoInput): string {
  return createHash("sha256").update(JSON.stringify(canonical({
    campaignId: campaign.id, revision: campaign.revision, input,
  }))).digest("hex");
}
```

- [ ] **Step 4: Implement the injected workflow**

Export `renderApprovedCampaign(store, campaignId, input, render = generateMarketingVideoWorkflow)`. It must:

1. Require campaign status `assets_ready` or reuse a ready artifact.
2. Compute the render key before changing state.
3. Return an existing artifact only when its file still exists.
4. Begin the render operation and transition to `rendering`.
5. Call the injected renderer.
6. Register the returned MP4 with probed metadata, finish the operation, and transition to `ready`.
7. On error, record the failed render operation, transition to `failed` with `failedStage: "rendering"`, and rethrow.

Return this exact public shape:

```ts
export interface CampaignRenderResult extends GenerateMarketingVideoOutput {
  campaignId: string;
  artifactId: string;
  renderKey: string;
  reused: boolean;
}
```

- [ ] **Step 5: Remove unsafe fallback behavior from the Phase 1 boundary**

Do not yet delete the current media helpers from `studio.ts`; Phase 2 will replace them. Change `GenerateMarketingVideoInput` so `script`, `scenes`, and `targetDurationSeconds` are required at the campaign workflow boundary. Keep the lower-level renderer callable by existing media tests.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm exec vitest run server/marketing/campaign-workflow.test.ts server/marketing/studio.test.ts`

Expected: PASS.

```bash
git add server/marketing/campaign-workflow.ts server/marketing/campaign-workflow.test.ts server/marketing/studio.ts
git diff --cached --name-status
git commit -m "feat(marketing): reuse idempotent campaign renders"
```

### Task 4: Publisher capability and evidence gate

**Files:**
- Create: `server/marketing/publisher-gateway.ts`
- Create: `server/marketing/publisher-gateway.test.ts`
- Modify: `server/marketing/studio.ts`
- Modify: `server/marketing/studio.test.ts`

- [ ] **Step 1: Write failing gateway tests**

Test these three paths with an approved campaign in `ready` state and a registered video:

```ts
await expect(gateway.publish({ campaignId, artifactId, platform: "tiktok", caption: "AI Agent", idempotencyKey: "publish-1" }))
  .rejects.toThrow(/no configured publisher/i);

await expect(invalidGateway.publish(request)).rejects.toThrow(/provider evidence/i);
expect(store.get(campaignId).status).toBe("failed");
expect(store.get(campaignId).artifacts.some((item) => item.type === "publish_evidence")).toBe(false);

const result = await validGateway.publish(request);
expect(result).toMatchObject({ platform: "tiktok", providerPostId: "post-123", canonicalUrl: "https://www.tiktok.com/@romes/video/123" });
expect(store.get(campaignId).status).toBe("published");
```

Repeat the valid request with the same idempotency key and assert the adapter was called once.

- [ ] **Step 2: Run the test and confirm failure**

Run: `pnpm exec vitest run server/marketing/publisher-gateway.test.ts`

Expected: FAIL because `publisher-gateway.ts` does not exist.

- [ ] **Step 3: Implement the adapter and evidence contracts**

```ts
export interface PublishCapability {
  provider: string;
  platform: "tiktok" | "facebook";
  accountId: string;
}

export interface PublishEvidence extends PublishCapability {
  providerPostId: string;
  canonicalUrl: string;
  publishedAt: string;
}

export interface PublisherAdapter {
  capabilities(): Promise<PublishCapability[]>;
  publish(input: { platform: PublishCapability["platform"]; videoPath: string; caption: string; idempotencyKey: string }): Promise<PublishEvidence>;
}

export interface PublisherGateway {
  capabilities(): Promise<PublishCapability[]>;
  publish(input: { campaignId: string; artifactId: string; platform: PublishCapability["platform"]; caption: string; idempotencyKey: string }): Promise<PublishEvidence>;
}
```

Validate evidence with Zod: non-empty provider, account ID, provider post ID, ISO timestamp, HTTPS URL, and URL hostname matching the requested platform's allowlist. Check that the adapter capability matches platform, provider, and account before calling it.

- [ ] **Step 4: Make publishing transitions evidence-owned**

The gateway must resolve the artifact from the campaign manifest, require a ready MP4, begin the publish operation, and transition `ready -> publishing`. Only validated evidence may be serialized to a JSON artifact and cause `publishing -> published`. Adapter errors or invalid evidence cause `failedStage: "publishing"` and never register evidence.

- [ ] **Step 5: Remove caller-controlled publication**

Delete `MarkPublishedInput`, `markMarketingPublished`, and the corresponding `studio.test.ts` assertion. Do not replace them with another public setter.

- [ ] **Step 6: Run tests and commit**

Run: `pnpm exec vitest run server/marketing/publisher-gateway.test.ts server/marketing/studio.test.ts`

Expected: PASS and no test can mark a campaign published by passing a URL.

```bash
git add server/marketing/publisher-gateway.ts server/marketing/publisher-gateway.test.ts server/marketing/studio.ts server/marketing/studio.test.ts
git diff --cached --name-status
git commit -m "feat(marketing): require provider evidence for publishing"
```

### Task 5: Replace the unsafe MCP surface with lifecycle tools

**Files:**
- Modify: `server/marketing/mcp-server.ts`
- Modify: `server/marketing/mcp-server.test.ts`

- [ ] **Step 1: Rewrite the subprocess contract test first**

Assert `tools/list` contains these tools:

```ts
expect(names).toEqual([
  "route_marketing_request",
  "prepare_marketing_campaign",
  "approve_marketing_campaign",
  "get_marketing_campaign",
  "generate_marketing_images",
  "generate_marketing_video",
  "resolve_marketing_artifact",
  "get_marketing_publish_capabilities",
  "publish_marketing_artifact",
  "save_marketing_draft",
  "get_marketing_draft",
]);
expect(names).not.toContain("mark_marketing_published");
```

Add JSON-RPC calls proving:

- a partial brief returns `needsConsultation: true` and no campaign;
- a complete brief creates `needs_brief`, approval changes it to `approved`;
- image generation before approval returns an MCP error;
- video generation before `assets_ready` returns an MCP error;
- the first valid render returns `reused: false`, the repeated call returns `reused: true` and the same artifact ID;
- no publisher returns a structured unavailable result and leaves the campaign ready;
- `publish_marketing_artifact` does not accept `url`, `status`, or `publishedAt` in its input schema.

- [ ] **Step 2: Run the subprocess test and confirm the old surface fails**

Run: `pnpm exec vitest run server/marketing/mcp-server.test.ts`

Expected: FAIL because the new lifecycle tools are absent and `mark_marketing_published` remains listed.

- [ ] **Step 3: Instantiate domain services once in the MCP process**

At module startup, create the campaign store from `ASSETS_ROOT`, create a publisher gateway with no adapters by default, and keep `generateMarketingVideoWorkflow` injected into `renderApprovedCampaign`.

Do not read or write `~/.openmausbot/bots.json` from this process.

- [ ] **Step 4: Add strict tool schemas**

`prepare_marketing_campaign` accepts `campaignSlug` and the seven brief fields. `approve_marketing_campaign` accepts `campaignId` and `revision`. Both production tools require `campaignId`. `generate_marketing_video` requires `script`, `scenes`, and `targetDurationSeconds`; it no longer creates default scenes or a default script at the MCP boundary.

`publish_marketing_artifact` accepts only:

```ts
{
  campaignId: string;
  artifactId: string;
  platform: "tiktok" | "facebook";
  caption: string;
  idempotencyKey: string;
}
```

- [ ] **Step 5: Register image artifacts and readiness**

After `generateMarketingImages` succeeds, register every returned file as an `image` artifact tied to an operation key derived from campaign ID and prompt payload. When at least one image exists, transition the approved campaign through `scripting` if needed and then to `assets_ready`. A repeated identical call reuses registered image artifacts rather than downloading again.

- [ ] **Step 6: Return honest publishing results**

When capabilities are empty, return:

```json
{
  "published": false,
  "reason": "no_configured_publisher",
  "message": "No real TikTok publisher is configured. Reuse the ready video artifact for manual upload.",
  "artifact": { "id": "artifact-video-1", "path": "/tmp/fixture/ai-agent/video.mp4" }
}
```

Do not transition the campaign away from `ready` for this capability failure.

- [ ] **Step 7: Run tests and commit**

Run: `pnpm exec vitest run server/marketing/mcp-server.test.ts server/marketing/brief.test.ts server/marketing/campaign-store.test.ts server/marketing/campaign-workflow.test.ts server/marketing/publisher-gateway.test.ts`

Expected: PASS.

```bash
git add server/marketing/mcp-server.ts server/marketing/mcp-server.test.ts
git diff --cached --name-status
git commit -m "feat(marketing): enforce lifecycle through MCP tools"
```

### Task 6: Version the RoMes swarm with the existing team-file mechanism

**Files:**
- Create: `server/marketing/swarm/team.yaml`
- Create: `server/marketing/swarm/romes.md`
- Create: `server/marketing/swarm/poppy.md`
- Create: `server/marketing/swarm/finch.md`
- Create: `server/marketing/swarm/momo.md`
- Create: `server/marketing/swarm/team.test.ts`

- [ ] **Step 1: Write the failing team-file test**

```ts
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { loadTeamFile } from "../../headless/team-file.ts";

describe("RoMes marketing swarm team file", () => {
  it("has one chief and least-privilege tools", () => {
    const team = loadTeamFile(fileURLToPath(new URL("./team.yaml", import.meta.url)));
    const byName = new Map(team.bots.map((bot) => [bot.name, bot]));
    expect(byName.get("RoMes")).toMatchObject({ chief: true, manages: ["Marketing"] });
    expect(byName.get("Poppy")?.tools).toEqual({ allow: [] });
    expect(byName.get("Finch")?.tools).toEqual({ allow: [
      "mcp:marketing_studio:get_marketing_campaign",
      "mcp:marketing_studio:generate_marketing_images",
    ] });
    expect(byName.get("Momo")?.tools).toEqual({ allow: [
      "mcp:marketing_studio:get_marketing_campaign",
      "mcp:marketing_studio:generate_marketing_video",
    ] });
    expect(byName.get("RoMes")?.tools?.allow).not.toContain("mcp:marketing_studio:generate_marketing_video");
  });
});
```

- [ ] **Step 2: Run the test and confirm the missing team file fails**

Run: `pnpm exec vitest run server/marketing/swarm/team.test.ts`

Expected: FAIL because `team.yaml` does not exist.

- [ ] **Step 3: Create the canonical team file**

```yaml
version: 1
teams:
  - name: Marketing
    brief: RoMes coordinates approved marketing campaigns. External success requires tool evidence.
bots:
  - name: RoMes
    team: Marketing
    chief: true
    manages: [Marketing]
    computer: off
    soul: { file: romes.md }
    tools:
      allow:
        - mcp:agents:coordinate_bots
        - mcp:agents:attach_file
        - mcp:marketing_studio:route_marketing_request
        - mcp:marketing_studio:prepare_marketing_campaign
        - mcp:marketing_studio:approve_marketing_campaign
        - mcp:marketing_studio:get_marketing_campaign
        - mcp:marketing_studio:resolve_marketing_artifact
        - mcp:marketing_studio:get_marketing_publish_capabilities
        - mcp:marketing_studio:publish_marketing_artifact
  - name: Poppy
    team: Marketing
    computer: off
    soul: { file: poppy.md }
    tools: { allow: [] }
  - name: Finch
    team: Marketing
    computer: off
    soul: { file: finch.md }
    tools:
      allow:
        - mcp:marketing_studio:get_marketing_campaign
        - mcp:marketing_studio:generate_marketing_images
  - name: Momo
    team: Marketing
    computer: off
    soul: { file: momo.md }
    tools:
      allow:
        - mcp:marketing_studio:get_marketing_campaign
        - mcp:marketing_studio:generate_marketing_video
```

- [ ] **Step 4: Write concise role contracts in the four soul files**

RoMes must route every request, prepare missing-field consultation, wait for approval, coordinate once, reuse ready artifact IDs, and report publication only from `publish_marketing_artifact` evidence. Poppy must return the approved duration and typed storyboard without tools. Finch must use the supplied campaign ID and generate only campaign-bound images. Momo must render only the approved campaign ID once and return its artifact ID. Do not duplicate implementation details or historical explanations in the souls.

- [ ] **Step 5: Parse, dry-run, and commit**

Run: `pnpm exec vitest run server/marketing/swarm/team.test.ts server/headless/team-file.test.ts`

Expected: PASS.

Run against an isolated fixture URL only:

`pnpm control:omb team apply server/marketing/swarm/team.yaml --dry-run --url http://127.0.0.1:PORT`

Expected: a plan showing four bots and the Marketing team; no live workspace is changed.

```bash
git add server/marketing/swarm/team.yaml server/marketing/swarm/romes.md server/marketing/swarm/poppy.md server/marketing/swarm/finch.md server/marketing/swarm/momo.md server/marketing/swarm/team.test.ts
git diff --cached --name-status
git commit -m "feat(marketing): version the RoMes swarm contract"
```

### Task 7: Add isolated verification for consultation, reuse, and truthful publishing

**Files:**
- Create: `docs/verification/marketing-swarm.md`
- Modify: `docs/verification/README.md`
- Modify: `server/marketing/mcp-server.test.ts`

- [ ] **Step 1: Extend the subprocess fixture with safety assertions**

Record the JSON-RPC calls made during the MCP test and assert:

```ts
expect(calls.filter((call) => call.name === "generate_marketing_video")).toHaveLength(2);
expect(firstRender.artifactId).toBe(secondRender.artifactId);
expect(secondRender.reused).toBe(true);
expect(unavailablePublish.published).toBe(false);
expect(unavailablePublish.reason).toBe("no_configured_publisher");
expect(readFileSync(join(assetsRoot, "ai-agent", "campaign.json"), "utf8")).not.toContain('"status": "published"');
```

The two video tool calls intentionally prove one underlying renderer invocation through the reused artifact result.

- [ ] **Step 2: Write the verification recipe**

The recipe must use these isolated steps:

1. Launch `node --experimental-strip-types scripts/control-omb.ts launch` and copy its printed fixture URL.
2. Register the repository marketing MCP server in that fixture only.
3. Apply `server/marketing/swarm/team.yaml` to that fixture URL.
4. Configure the fake engine to answer a vague request without tool calls and verify the transcript contains consultation.
5. Configure deterministic tool calls for a complete brief, approval, assets, and render.
6. Send “up video vừa rồi lên TikTok” and verify the transcript contains the ready artifact path, an honest unavailable message, and no render call.
7. Retain redacted messages, MCP call records, and `campaign.json` under `.omb-scratch/verify-evidence/marketing-swarm/`.
8. Stop the fixture launcher so its temporary home is removed.

State explicitly that the recipe proves routing, lifecycle, reuse, and honest refusal; it does not prove a real TikTok upload.

- [ ] **Step 3: Link the recipe from the verification map**

Add one entry near the Postiz and browser recipes in `docs/verification/README.md`:

```md
- [Marketing swarm safety and artifact reuse](marketing-swarm.md)
```

- [ ] **Step 4: Run focused and full marketing verification**

Run: `pnpm exec vitest run server/marketing/*.test.ts server/marketing/swarm/team.test.ts`

Expected: PASS.

Run: `pnpm typecheck`

Expected: PASS.

Run: `pnpm lint`

Expected: PASS with no suppressed correctness rules.

- [ ] **Step 5: Commit documentation and fixture assertions**

```bash
git add docs/verification/marketing-swarm.md docs/verification/README.md server/marketing/mcp-server.test.ts
git diff --cached --name-status
git commit -m "test(marketing): verify swarm safety in isolation"
```

### Task 8: Final Phase 1 acceptance run

**Files:**
- Modify only if verification exposes a Phase 1 defect in files already named above.

- [ ] **Step 1: Confirm no live data target is present**

Run: `git diff --name-only HEAD~7..HEAD | sort`

Expected: only repository files from Tasks 1–7; no path under `~/.openmausbot` and no generated marketing assets.

- [ ] **Step 2: Run the campaign safety suite**

Run:

```bash
pnpm exec vitest run \
  server/marketing/brief.test.ts \
  server/marketing/campaign-store.test.ts \
  server/marketing/campaign-workflow.test.ts \
  server/marketing/publisher-gateway.test.ts \
  server/marketing/mcp-server.test.ts \
  server/marketing/swarm/team.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run repository static checks**

Run: `pnpm typecheck && pnpm lint`

Expected: both commands exit 0.

- [ ] **Step 4: Run the documented isolated conversation fixture**

Follow `docs/verification/marketing-swarm.md` exactly.

Expected evidence:

- vague request: consultation and zero production calls;
- approved request: one ready video artifact;
- repeated render tool call: same artifact ID and `reused: true`;
- publish request: zero underlying renders and honest unavailable result;
- campaign state remains `ready` without provider evidence;
- fixture home is removed after shutdown.

- [ ] **Step 5: Inspect the final diff and produce the test handoff**

Run: `git status --short && git log --oneline -8`

Expected: the pre-existing user changes may remain, but all Phase 1 files are committed and no generated fixture data is tracked.

Handoff the exact test commands, fixture evidence path, known limitation that no real social provider is configured, and the command the user can run to apply the versioned team file to a chosen workspace after reviewing the dry run.
