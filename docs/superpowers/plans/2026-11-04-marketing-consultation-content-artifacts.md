# Marketing Consultation and Content Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RoMes obtain or confirm a sourced marketing brief before production, persist Poppy's exact social post and visual directions as a campaign artifact, and prevent Finch from starting before that artifact exists.

**Architecture:** Extend brief assessment with per-field provenance, persist it in a backward-compatible campaign schema, and add a focused social-post artifact module behind two MCP tools. RoMes uses the existing native `ask_user` question card for compact consultation and revision confirmation, then runs Poppy before Finch; the campaign store and image tool enforce the revision and post-artifact gates.

**Tech Stack:** TypeScript, Node.js filesystem and crypto APIs, Zod, JSON-RPC MCP, Vitest, OpenMausBot team files and isolated control fixture.

---

## Scope and file map

This plan implements slice 1 of `docs/superpowers/specs/2026-11-04-marketing-content-publishing-reliability-design.md`.

- `server/marketing/brief.ts`: normalize brief fields and require their provenance.
- `server/marketing/brief.test.ts`: sourced-brief and consultation cases.
- `server/marketing/campaign-store.ts`: schema v2, v1 read migration, persisted sources, and confirmed-source transition.
- `server/marketing/campaign-store.test.ts`: migration, revision, and confirmation tests.
- `server/marketing/social-post-artifact.ts`: validate, atomically persist, register, and read one revision-bound social post.
- `server/marketing/social-post-artifact.test.ts`: exact-count, revision, idempotency, and corrupt-file tests.
- `server/marketing/mcp-server.ts`: sourced prepare input, save/get post tools, and social-image production gate.
- `server/marketing/mcp-server.test.ts`: subprocess-level MCP contract.
- `server/marketing/swarm/romes.md`: balanced consultation, question-card confirmation, sequential handoff, and artifact persistence.
- `server/marketing/swarm/poppy.md`: one typed social-post result with structured visual directions.
- `server/marketing/swarm/finch.md`: require and load the exact post artifact before image work.
- `server/marketing/swarm/team.yaml`: least-privilege access to the new tools.
- `server/marketing/swarm/team.test.ts`: static team contract.
- `docs/verification/marketing-swarm.md`: isolated conversational verification for this slice.

Image ranking, attachment delivery, provider connections, and social adapters remain in later plans. Do not change product-image search or publisher code in this slice.

This slice makes revision changes safe: stale post artifacts cannot be read as the new revision. Optimized reuse of unchanged copy and delta generation when only `imageCount` changes belongs to slice 2, where visual assignments and image reuse are implemented together.

Before implementation, create an isolated worktree with `superpowers:using-git-worktrees`. The current worktree contains unrelated user changes; never stage them with this plan.

### Task 1: Add sourced brief assessment

**Files:**
- Modify: `server/marketing/brief.ts:1-104`
- Modify: `server/marketing/brief.test.ts:1-70`

- [ ] **Step 1: Write failing sourced-brief tests**

Add these cases to `server/marketing/brief.test.ts`:

```ts
it("keeps user values separate from proposed defaults", () => {
  const result = assessMarketingBrief({
    contentType: "social_post",
    topic: "Cuộc đua AI của Big Tech",
    goal: "Tăng tương tác",
    audience: "Kỹ sư và sinh viên IT",
    platform: "Facebook",
    style: "Phân tích dễ hiểu",
    callToAction: "Bình luận quan điểm của bạn",
    imageCount: 5,
    fieldSources: {
      contentType: "user",
      topic: "user",
      goal: "proposed_default",
      audience: "proposed_default",
      platform: "proposed_default",
      style: "proposed_default",
      callToAction: "proposed_default",
      imageCount: "user",
    },
  });

  expect(result).toMatchObject({
    complete: true,
    sources: {
      topic: "user",
      goal: "proposed_default",
      imageCount: "user",
    },
  });
});

it("refuses a complete-looking brief whose values have no provenance", () => {
  const result = assessMarketingBrief({
    contentType: "social_post",
    topic: "Cuộc đua AI",
    goal: "Tăng tương tác",
    audience: "Người quan tâm công nghệ",
    platform: "Facebook",
    style: "Chuyên gia",
    callToAction: "Bình luận",
  });

  expect(result).toMatchObject({
    complete: false,
    missingAttribution: [
      "topic",
      "goal",
      "audience",
      "platform",
      "style",
      "callToAction",
      "contentType",
    ],
  });
});

it("marks an omitted image count as a proposed one-image default", () => {
  const result = assessMarketingBrief({
    contentType: "social_post",
    topic: "Cuộc đua AI",
    goal: "Tăng tương tác",
    audience: "Người quan tâm công nghệ",
    platform: "Facebook",
    style: "Chuyên gia",
    callToAction: "Bình luận",
    fieldSources: {
      contentType: "user",
      topic: "user",
      goal: "user",
      audience: "user",
      platform: "user",
      style: "user",
      callToAction: "user",
    },
  });

  expect(result).toMatchObject({
    complete: true,
    brief: { imageCount: 1 },
    sources: { imageCount: "proposed_default" },
  });
});
```

Update the existing complete-brief fixtures to include `fieldSources` for every supplied or inferred field.

- [ ] **Step 2: Run the focused test and verify the new cases fail**

Run:

```bash
pnpm exec vitest run server/marketing/brief.test.ts
```

Expected: FAIL because `fieldSources`, `missingAttribution`, and `sources` are not part of the contract.

- [ ] **Step 3: Implement the sourced brief types and assessment**

Add these contracts to `server/marketing/brief.ts`:

```ts
export type FieldSource = "user" | "proposed_default" | "confirmed";
export type MarketingBriefSourceField = keyof MarketingBrief;
export type MarketingBriefSources = Partial<Record<MarketingBriefSourceField, FieldSource>>;

export interface MarketingBriefInput {
  topic?: string;
  goal?: string;
  audience?: string;
  platform?: string;
  style?: string;
  targetDurationSeconds?: number;
  callToAction?: string;
  contentType?: "social_post" | "video_campaign";
  imageCount?: number;
  fieldSources?: MarketingBriefSources;
}

export type MarketingBriefAssessment =
  | {
      complete: false;
      missingFields: MarketingBriefField[];
      missingAttribution: MarketingBriefSourceField[];
      questions: string[];
    }
  | {
      complete: true;
      brief: MarketingBrief;
      sources: MarketingBriefSources;
    };
```

After normalizing the current values, derive `sources` without inventing attribution:

```ts
const sources: MarketingBriefSources = { ...(input.fieldSources ?? {}) };
if (input.imageCount === undefined) sources.imageCount = "proposed_default";
if (input.contentType === undefined) sources.contentType = "proposed_default";

const presentSourceFields = Object.keys(normalized).filter(
  (field): field is MarketingBriefSourceField => normalized[field as keyof typeof normalized] !== undefined,
);
const missingAttribution = presentSourceFields.filter((field) => sources[field] === undefined);

if (missingFields.length > 0 || missingAttribution.length > 0) {
  return {
    complete: false,
    missingFields,
    missingAttribution,
    questions: missingFields.map((field) => QUESTIONS[field]),
  };
}

return { complete: true, brief: normalized as MarketingBrief, sources };
```

Do not generate questions for missing attribution. Missing attribution is a malformed tool call, not a new decision for the person.

- [ ] **Step 4: Run the brief tests**

Run:

```bash
pnpm exec vitest run server/marketing/brief.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the sourced brief contract**

```bash
git add server/marketing/brief.ts server/marketing/brief.test.ts
git diff --cached --check
git commit -m "feat(marketing): track brief field provenance"
```

### Task 2: Persist sources in campaign schema v2

**Files:**
- Modify: `server/marketing/campaign-store.ts:18-365`
- Modify: `server/marketing/campaign-store.test.ts:1-130`

- [ ] **Step 1: Write failing persistence and migration tests**

Add these tests to `server/marketing/campaign-store.test.ts`:

```ts
const sources = {
  topic: "user",
  goal: "confirmed",
  audience: "confirmed",
  platform: "confirmed",
  style: "confirmed",
  callToAction: "confirmed",
  contentType: "user",
  imageCount: "user",
} as const;

it("persists brief sources and confirms proposed defaults on approval", () => {
  const root = mkdtempSync(join(tmpdir(), "omb-marketing-sources-"));
  roots.push(root);
  const store = createCampaignStore(root, () => "2026-11-04T00:00:00.000Z");
  const campaign = store.prepare("ai-race", completeBrief, {
    ...sources,
    goal: "proposed_default",
    audience: "proposed_default",
  });

  expect(campaign).toMatchObject({
    schemaVersion: 2,
    briefSources: { goal: "proposed_default", audience: "proposed_default" },
  });

  expect(store.approve(campaign.id, campaign.revision)).toMatchObject({
    status: "approved",
    briefSources: { goal: "confirmed", audience: "confirmed" },
  });
});

it("reads a schema v1 campaign through the conservative migration", () => {
  const root = mkdtempSync(join(tmpdir(), "omb-marketing-v1-"));
  roots.push(root);
  const campaignDir = join(root, "legacy-post");
  mkdirSync(campaignDir, { recursive: true });
  writeFileSync(join(campaignDir, "campaign.json"), JSON.stringify({
    schemaVersion: 1,
    id: "legacy-post",
    slug: "legacy-post",
    revision: 1,
    status: "needs_brief",
    brief: completeBrief,
    createdAt: "2026-11-03T00:00:00.000Z",
    updatedAt: "2026-11-03T00:00:00.000Z",
    artifacts: [],
    operations: {},
  }));

  expect(createCampaignStore(root).get("legacy-post")).toMatchObject({
    schemaVersion: 2,
    briefSources: {
      topic: "user",
      goal: "proposed_default",
      audience: "proposed_default",
      platform: "proposed_default",
      style: "proposed_default",
      callToAction: "proposed_default",
    },
  });
});
```

Update every existing `store.prepare(slug, brief)` call in this test file to pass `sources`.

- [ ] **Step 2: Run the store test and verify it fails**

Run:

```bash
pnpm exec vitest run server/marketing/campaign-store.test.ts
```

Expected: FAIL because `prepare` accepts two arguments and the manifest only accepts schema version 1.

- [ ] **Step 3: Add schema v2 and a strict v1 migration**

Change the store contracts:

```ts
import type { FieldSource, MarketingBrief, MarketingBriefSources } from "./brief.ts";

export interface MarketingCampaign {
  schemaVersion: 2;
  id: string;
  slug: string;
  revision: number;
  status: CampaignStatus;
  brief: MarketingBrief;
  briefSources: MarketingBriefSources;
  createdAt: string;
  updatedAt: string;
  lastValidStatus?: CampaignStatus;
  failedStage?: CampaignStatus;
  artifacts: CampaignArtifact[];
  operations: Record<string, CampaignOperation>;
}

export interface CampaignStore {
  prepare(slug: string, brief: MarketingBrief, sources: MarketingBriefSources): MarketingCampaign;
  // keep the remaining methods unchanged
}
```

Keep the current schema as `campaignV1Schema`. Define `sourceSchema` and `campaignSchema` for v2:

```ts
const sourceSchema = z.enum(["user", "proposed_default", "confirmed"]);
const briefSourcesSchema = z.record(z.string(), sourceSchema);

const campaignSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  revision: z.number().int().positive(),
  status: statusSchema,
  brief: briefSchema,
  briefSources: briefSourcesSchema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastValidStatus: statusSchema.optional(),
  failedStage: statusSchema.optional(),
  artifacts: z.array(artifactSchema),
  operations: z.record(z.string(), operationSchema),
}).strict();
```

Add a conservative migration and use it in `read`:

```ts
function migrateV1(input: z.infer<typeof campaignV1Schema>): MarketingCampaign {
  const keys = Object.keys(input.brief) as Array<keyof MarketingBrief>;
  const briefSources = Object.fromEntries(keys.map((field) => [
    field,
    field === "topic" ? "user" : "proposed_default",
  ])) as MarketingBriefSources;
  return campaignSchema.parse({
    ...input,
    schemaVersion: 2,
    briefSources,
  }) as MarketingCampaign;
}

const raw = JSON.parse(readFileSync(path, "utf8"));
const campaign = raw?.schemaVersion === 1
  ? migrateV1(campaignV1Schema.parse(raw))
  : campaignSchema.parse(raw);
return campaign as MarketingCampaign;
```

Do not silently migrate malformed v1 data.

- [ ] **Step 4: Persist sources and confirm proposed defaults atomically**

Change `prepare` and `approve`:

```ts
prepare(rawSlug, brief, briefSources) {
  const { slug, path } = location(rawSlug);
  const existing = existsSync(path) ? read(slug) : null;
  const timestamp = now();
  return write({
    schemaVersion: 2,
    id: slug,
    slug,
    revision: (existing?.revision ?? 0) + 1,
    status: "needs_brief",
    brief,
    briefSources,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    artifacts: [],
    operations: {},
  });
},

approve(idOrSlug, revision) {
  return update(idOrSlug, (campaign) => {
    if (campaign.revision !== revision) {
      throw new CampaignStoreError(`Campaign revision changed from ${revision} to ${campaign.revision}`);
    }
    if (campaign.status !== "needs_brief") {
      throw new CampaignStoreError(`Cannot transition campaign from ${campaign.status} to approved`);
    }
    const briefSources = Object.fromEntries(
      Object.entries(campaign.briefSources).map(([field, source]) => [
        field,
        source === "proposed_default" ? "confirmed" : source,
      ]),
    ) as Record<string, FieldSource>;
    return { ...campaign, status: "approved", briefSources, updatedAt: now() };
  });
},
```

- [ ] **Step 5: Update other compile-time `prepare` callers**

Find callers:

```bash
rg -n "\.prepare\(" server/marketing -g '*.ts'
```

For fixtures representing explicit briefs, pass a shared `allUserSources` object. For tests specifically exercising defaults, pass `proposed_default` only for those fields. Do not use `as any`.

- [ ] **Step 6: Run store and dependent domain tests**

Run:

```bash
pnpm exec vitest run \
  server/marketing/campaign-store.test.ts \
  server/marketing/campaign-workflow.test.ts \
  server/marketing/publisher-gateway.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit schema v2**

```bash
git add server/marketing/brief.ts server/marketing/campaign-store.ts server/marketing/campaign-store.test.ts server/marketing/campaign-workflow.test.ts server/marketing/publisher-gateway.test.ts
git diff --cached --check
git commit -m "feat(marketing): persist confirmed brief sources"
```

### Task 3: Add the revision-bound social-post artifact

**Files:**
- Create: `server/marketing/social-post-artifact.ts`
- Create: `server/marketing/social-post-artifact.test.ts`

- [ ] **Step 1: Write failing artifact tests**

Create `server/marketing/social-post-artifact.test.ts` with fixtures that prepare and approve a sourced social campaign, then cover the exact contract:

```ts
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createCampaignStore } from "./campaign-store.ts";
import {
  readMarketingPostArtifact,
  saveMarketingPostArtifact,
  type MarketingPostInput,
} from "./social-post-artifact.ts";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const post: MarketingPostInput = {
  campaignId: "ai-race",
  revision: 1,
  platform: "facebook",
  headline: "Cuộc đua AI của Big Tech",
  body: "AI đang trở thành năng lực vận hành cốt lõi.",
  callToAction: "Bạn đánh giá lợi thế nào quan trọng nhất?",
  hashtags: ["#AI", "#BigTech"],
  caption: "Cuộc đua AI của Big Tech\n\nAI đang trở thành năng lực vận hành cốt lõi.\n\nBạn đánh giá lợi thế nào quan trọng nhất?\n\n#AI #BigTech",
  visualPrompts: [
    {
      index: 1,
      label: "Hạ tầng AI",
      subject: "hyperscale AI data center",
      context: "enterprise computing infrastructure",
      action: "engineers monitoring GPU clusters",
      requiredTerms: ["AI", "data center", "GPU"],
      excludedTerms: ["illustration", "cartoon", "watermark"],
      aspectRatio: "1:1",
    },
  ],
};

describe("social post artifact", () => {
  it("persists and reuses the exact approved revision", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    const first = saveMarketingPostArtifact(store, root, post);
    const second = saveMarketingPostArtifact(store, root, post);

    expect(second.artifact.id).toBe(first.artifact.id);
    expect(readMarketingPostArtifact(store, post.campaignId, first.artifact.id).post).toEqual(post);
    expect(store.get(post.campaignId).status).toBe("scripting");
  });

  it("requires exactly the campaign image count", () => {
    const root = setupApprovedCampaign(roots, { imageCount: 2 });
    const store = createCampaignStore(root);
    expect(() => saveMarketingPostArtifact(store, root, post)).toThrow(/exactly 2 visual prompts/i);
  });

  it("rejects a stale revision", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    expect(() => saveMarketingPostArtifact(store, root, { ...post, revision: 99 })).toThrow(/revision changed/i);
  });

  it("rejects a corrupt registered post file", () => {
    const root = setupApprovedCampaign(roots);
    const store = createCampaignStore(root);
    const saved = saveMarketingPostArtifact(store, root, post);
    writeFileSync(saved.artifact.path, "{broken");
    expect(() => readMarketingPostArtifact(store, post.campaignId, saved.artifact.id)).toThrow(/invalid social post artifact/i);
  });
});
```

Implement `setupApprovedCampaign` in the test using the complete social brief and sourced `store.prepare`, then `store.approve`.

- [ ] **Step 2: Run the artifact test and verify the module is missing**

Run:

```bash
pnpm exec vitest run server/marketing/social-post-artifact.test.ts
```

Expected: FAIL because `social-post-artifact.ts` does not exist.

- [ ] **Step 3: Define the exact post and visual-direction schemas**

Create `server/marketing/social-post-artifact.ts` with:

```ts
import { createHash } from "node:crypto";
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, writeSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";

import { CampaignStoreError, type CampaignArtifact, type CampaignStore } from "./campaign-store.ts";

const visualPromptSchema = z.object({
  index: z.number().int().positive(),
  label: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(500),
  context: z.string().trim().min(1).max(500),
  action: z.string().trim().min(1).max(500),
  requiredTerms: z.array(z.string().trim().min(1).max(100)).min(1).max(12),
  excludedTerms: z.array(z.string().trim().min(1).max(100)).max(20),
  aspectRatio: z.enum(["1:1", "4:5", "16:9"]),
}).strict();

const marketingPostSchema = z.object({
  campaignId: z.string().trim().min(1),
  revision: z.number().int().positive(),
  platform: z.string().trim().min(1),
  headline: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  callToAction: z.string().trim().min(1).max(1_000),
  hashtags: z.array(z.string().trim().regex(/^#[\p{L}\p{N}_]+$/u)).max(20),
  caption: z.string().trim().min(1).max(25_000),
  visualPrompts: z.array(visualPromptSchema).min(1).max(12),
}).strict();

export type MarketingPostInput = z.infer<typeof marketingPostSchema>;
export type VisualPrompt = z.infer<typeof visualPromptSchema>;

export interface SavedMarketingPost {
  post: MarketingPostInput;
  artifact: CampaignArtifact;
}
```

- [ ] **Step 4: Implement atomic persistence, registration, and exact reads**

Add these exported functions:

```ts
function atomicWriteJson(path: string, value: unknown): void {
  const temporary = `${path}.tmp`;
  const descriptor = openSync(temporary, "w", 0o600);
  try {
    writeSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, undefined, "utf8");
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
  renameSync(temporary, path);
}

export function saveMarketingPostArtifact(
  store: CampaignStore,
  assetsRoot: string,
  raw: MarketingPostInput,
): SavedMarketingPost {
  const post = marketingPostSchema.parse(raw);
  let campaign = store.get(post.campaignId);
  if (campaign.revision !== post.revision) {
    throw new CampaignStoreError(`Campaign revision changed from ${post.revision} to ${campaign.revision}`);
  }
  if (campaign.brief.contentType !== "social_post") {
    throw new CampaignStoreError("A social post artifact requires a social_post campaign");
  }
  if (!["approved", "scripting"].includes(campaign.status)) {
    throw new CampaignStoreError(`Campaign must be approved before saving copy; current status is ${campaign.status}`);
  }
  if (post.visualPrompts.length !== campaign.brief.imageCount) {
    throw new CampaignStoreError(`Expected exactly ${campaign.brief.imageCount} visual prompts`);
  }
  post.visualPrompts.forEach((prompt, index) => {
    if (prompt.index !== index + 1) throw new CampaignStoreError("Visual prompt indexes must be consecutive from 1");
  });

  const campaignDirectory = resolve(assetsRoot, campaign.slug);
  const root = resolve(assetsRoot);
  const relativeDirectory = relative(root, campaignDirectory);
  if (!relativeDirectory || relativeDirectory.startsWith("..") || isAbsolute(relativeDirectory)) {
    throw new CampaignStoreError("Campaign artifact directory is invalid");
  }
  const serialized = `${JSON.stringify(post, null, 2)}\n`;
  const digest = createHash("sha256").update(serialized).digest("hex");
  const path = join(campaignDirectory, `post-r${post.revision}-${digest.slice(0, 16)}.json`);
  if (!existsSync(path)) atomicWriteJson(path, post);
  if (campaign.status === "approved") campaign = store.transition(campaign.id, "scripting");
  const artifact = store.registerArtifact(campaign.id, {
    type: "script",
    path,
    operationKey: `post:${post.revision}:${digest}`,
    metadata: {
      kind: "social_post",
      revision: post.revision,
      platform: post.platform,
      imageCount: post.visualPrompts.length,
    },
  });
  return { post, artifact };
}

export function readMarketingPostArtifact(
  store: CampaignStore,
  campaignId: string,
  artifactId: string,
): SavedMarketingPost {
  const campaign = store.get(campaignId);
  const artifact = campaign.artifacts.find((candidate) =>
    candidate.id === artifactId && candidate.type === "script" && candidate.metadata.kind === "social_post");
  if (!artifact || !existsSync(artifact.path)) throw new CampaignStoreError(`Social post artifact not found: ${artifactId}`);
  try {
    const post = marketingPostSchema.parse(JSON.parse(readFileSync(artifact.path, "utf8")));
    if (post.campaignId !== campaign.id || post.revision !== campaign.revision) {
      throw new Error("artifact campaign or revision does not match");
    }
    return { post, artifact };
  } catch (error) {
    throw new CampaignStoreError(`Invalid social post artifact: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function latestMarketingPostArtifact(store: CampaignStore, campaignId: string): CampaignArtifact | null {
  const campaign = store.get(campaignId);
  return campaign.artifacts.findLast((candidate) =>
    candidate.type === "script" &&
    candidate.metadata.kind === "social_post" &&
    candidate.metadata.revision === campaign.revision &&
    existsSync(candidate.path)) ?? null;
}
```

- [ ] **Step 5: Run the artifact tests**

Run:

```bash
pnpm exec vitest run server/marketing/social-post-artifact.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the artifact module**

```bash
git add server/marketing/social-post-artifact.ts server/marketing/social-post-artifact.test.ts
git diff --cached --check
git commit -m "feat(marketing): persist social post artifacts"
```

### Task 4: Expose post tools and enforce the production dependency

**Files:**
- Modify: `server/marketing/mcp-server.ts:39-290,354-522`
- Modify: `server/marketing/mcp-server.test.ts:29-410`

- [ ] **Step 1: Add failing MCP contract cases**

Extend the tool-list assertion in `server/marketing/mcp-server.test.ts` with:

```ts
expect(names).toContain("save_marketing_post");
expect(names).toContain("get_marketing_post");
```

In the social-post subprocess test, after prepare and approval, assert image generation is blocked before copy is saved:

```ts
const imagesBeforePost = await rpc(6, "tools/call", {
  name: "generate_marketing_images",
  arguments: {
    campaignId: campaign.id,
    prompts: [{ prompt: "AI data center", label: "Hạ tầng AI" }],
  },
});
expect(imagesBeforePost.result.isError).toBe(true);
expect(imagesBeforePost.result.content[0].text).toMatch(/social post artifact/i);
```

Then save and read the artifact:

```ts
const savedPost = await rpc(7, "tools/call", {
  name: "save_marketing_post",
  arguments: {
    campaignId: campaign.id,
    revision: campaign.revision,
    platform: "facebook",
    headline: "Cuộc đua AI",
    body: "AI đang trở thành năng lực cốt lõi.",
    callToAction: "Bình luận quan điểm của bạn.",
    hashtags: ["#AI", "#BigTech"],
    caption: "Cuộc đua AI\n\nAI đang trở thành năng lực cốt lõi.\n\nBình luận quan điểm của bạn.\n\n#AI #BigTech",
    visualPrompts: [{
      index: 1,
      label: "Hạ tầng AI",
      subject: "hyperscale AI data center",
      context: "enterprise infrastructure",
      action: "engineers monitor GPU clusters",
      requiredTerms: ["AI", "GPU"],
      excludedTerms: ["cartoon", "watermark"],
      aspectRatio: "1:1",
    }],
  },
});
const saved = JSON.parse(savedPost.result.content[0].text);
expect(saved).toMatchObject({ campaignId: campaign.id, revision: campaign.revision });
expect(saved.artifactId).toMatch(/^artifact-script-/);

const loadedPost = await rpc(8, "tools/call", {
  name: "get_marketing_post",
  arguments: { campaignId: campaign.id, artifactId: saved.artifactId },
});
expect(JSON.parse(loadedPost.result.content[0].text)).toMatchObject({
  post: { headline: "Cuộc đua AI" },
});
```

Update prepare calls to pass `fieldSources`. Include every field sent in the tool arguments.

- [ ] **Step 2: Run the MCP test and verify it fails**

Run:

```bash
pnpm exec vitest run server/marketing/mcp-server.test.ts
```

Expected: FAIL because the new tools and image gate do not exist.

- [ ] **Step 3: Add sourced prepare input and the two tool schemas**

In `prepare_marketing_campaign`, add:

```ts
fieldSources: {
  type: "object",
  description: "For every supplied brief field, mark whether it came from the user's words or is a proposed default.",
  properties: Object.fromEntries([
    "topic", "goal", "audience", "platform", "style", "targetDurationSeconds",
    "callToAction", "contentType", "imageCount",
  ].map((field) => [field, { type: "string", enum: ["user", "proposed_default"] }])),
},
```

Add `fieldSources` to the required list. Add these tool definitions after `get_marketing_campaign`:

```ts
{
  name: "save_marketing_post",
  description: "Validate and persist Poppy's exact social post and visual directions for one approved campaign revision before Finch starts.",
  inputSchema: {
    type: "object",
    properties: {
      campaignId: { type: "string" },
      revision: { type: "number" },
      platform: { type: "string" },
      headline: { type: "string" },
      body: { type: "string" },
      callToAction: { type: "string" },
      hashtags: { type: "array", items: { type: "string" } },
      caption: { type: "string" },
      visualPrompts: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "number" },
            label: { type: "string" },
            subject: { type: "string" },
            context: { type: "string" },
            action: { type: "string" },
            requiredTerms: { type: "array", items: { type: "string" } },
            excludedTerms: { type: "array", items: { type: "string" } },
            aspectRatio: { type: "string", enum: ["1:1", "4:5", "16:9"] },
          },
          required: ["index", "label", "subject", "context", "action", "requiredTerms", "excludedTerms", "aspectRatio"],
        },
      },
    },
    required: ["campaignId", "revision", "platform", "headline", "body", "callToAction", "hashtags", "caption", "visualPrompts"],
  },
},
{
  name: "get_marketing_post",
  description: "Load one exact persisted social-post artifact by campaign and artifact ID.",
  inputSchema: {
    type: "object",
    properties: {
      campaignId: { type: "string" },
      artifactId: { type: "string" },
    },
    required: ["campaignId", "artifactId"],
  },
},
```

- [ ] **Step 4: Wire sourced prepare and post handlers**

Import the artifact functions:

```ts
import {
  latestMarketingPostArtifact,
  readMarketingPostArtifact,
  saveMarketingPostArtifact,
  type MarketingPostInput,
} from "./social-post-artifact.ts";
```

Pass assessment sources into prepare:

```ts
const campaign = CAMPAIGNS.prepare(
  String(args.campaignSlug ?? ""),
  assessment.brief,
  assessment.sources,
);
```

Add handlers before image generation:

```ts
if (name === "save_marketing_post") {
  const campaignId = resolveCampaignId(ASSETS_ROOT, String(args.campaignId ?? ""));
  const saved = saveMarketingPostArtifact(CAMPAIGNS, ASSETS_ROOT, {
    ...(args as unknown as MarketingPostInput),
    campaignId,
  });
  return { content: [{ type: "text", text: JSON.stringify({
    campaignId,
    revision: saved.post.revision,
    artifactId: saved.artifact.id,
    path: saved.artifact.path,
  }, null, 2) }] };
}

if (name === "get_marketing_post") {
  const campaignId = resolveCampaignId(ASSETS_ROOT, String(args.campaignId ?? ""));
  const saved = readMarketingPostArtifact(CAMPAIGNS, campaignId, String(args.artifactId ?? ""));
  return { content: [{ type: "text", text: JSON.stringify(saved, null, 2) }] };
}
```

- [ ] **Step 5: Enforce the social-post dependency at image generation**

Immediately after loading the campaign in `generate_marketing_images`, add:

```ts
if (campaign.brief.contentType === "social_post" && !latestMarketingPostArtifact(CAMPAIGNS, campaign.id)) {
  throw new Error(`Campaign ${campaign.id} has no persisted social post artifact for revision ${campaign.revision}`);
}
```

This does not redesign image search. It only prevents Finch from running before Poppy's validated result is durable.

- [ ] **Step 6: Run MCP and domain tests**

Run:

```bash
pnpm exec vitest run \
  server/marketing/brief.test.ts \
  server/marketing/campaign-store.test.ts \
  server/marketing/social-post-artifact.test.ts \
  server/marketing/mcp-server.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the MCP contract**

```bash
git add server/marketing/mcp-server.ts server/marketing/mcp-server.test.ts
git diff --cached --check
git commit -m "feat(marketing): gate images on persisted copy"
```

### Task 5: Make the swarm consult and hand off sequentially

**Files:**
- Modify: `server/marketing/swarm/romes.md:1-64`
- Modify: `server/marketing/swarm/poppy.md:1-30`
- Modify: `server/marketing/swarm/finch.md:1-16`
- Modify: `server/marketing/swarm/team.yaml:6-37`
- Modify: `server/marketing/swarm/team.test.ts:8-61`

- [ ] **Step 1: Replace the failing static behavior expectations**

Replace the current “autonomous execution without redundant user questions” test with:

```ts
it("requires balanced consultation and a persisted post before visual work", () => {
  const poppy = readFileSync(fileURLToPath(new URL("./poppy.md", import.meta.url)), "utf8");
  const romes = readFileSync(fileURLToPath(new URL("./romes.md", import.meta.url)), "utf8");
  const finch = readFileSync(fileURLToPath(new URL("./finch.md", import.meta.url)), "utf8");

  expect(romes).toContain("ask_user");
  expect(romes).toMatch(/xác nhận brief|duyệt revision/i);
  expect(romes).toContain("save_marketing_post");
  expect(romes).toMatch(/Poppy.*trước.*Finch|chỉ giao Finch sau/is);
  expect(romes).not.toMatch(/gọi luôn approve_marketing_campaign|không dừng lại hỏi xin duyệt/i);
  expect(poppy).toContain("visualPrompts");
  expect(finch).toContain("POST_ARTIFACT_ID:");
  expect(finch).toContain("get_marketing_post");
});
```

Update least-privilege expectations so RoMes receives `save_marketing_post` and `get_marketing_post`, while Finch receives only `get_marketing_post` in addition to its current tools.

- [ ] **Step 2: Run the team test and verify it fails**

Run:

```bash
pnpm exec vitest run server/marketing/swarm/team.test.ts
```

Expected: FAIL against the current auto-approval and parallel-dispatch instructions.

- [ ] **Step 3: Rewrite RoMes's social-post flow around the native question card**

Replace the current social-post steps in `romes.md` with this behavior, preserving the greeting and publishing sections:

```md
### LUỒNG 1: BÀI VIẾT SOCIAL POST
1. Chỉ lấy các giá trị người dùng thực sự nêu. Mọi giá trị em đề xuất phải được đánh dấu `proposed_default` trong `fieldSources`; không được giả thành lời người dùng.
2. Gọi `prepare_marketing_campaign`. Nếu tool trả `needsConsultation: true`, dùng `ask_user` đúng một lần để hỏi gọn các quyết định còn thiếu có ảnh hưởng đến đầu ra. Không giao việc cho đồng đội trong lượt đang chờ câu trả lời.
3. Khi brief đã đủ, dùng `ask_user` hiển thị tóm tắt brief và hai lựa chọn `Bắt đầu` và `Chỉnh sửa`. Chỉ gọi `approve_marketing_campaign` cho đúng revision sau khi người dùng chọn `Bắt đầu`. Nếu chọn `Chỉnh sửa`, hỏi phần cần đổi và prepare revision mới.
4. Sau approval, chỉ giao Poppy. Assignment phải chứa `CAMPAIGN_ID`, `CAMPAIGN_STATUS: approved`, `CAMPAIGN_REVISION`, `CONTENT_TYPE`, `IMAGE_COUNT` và toàn bộ brief đã xác nhận.
5. Khi Poppy trả kết quả, gọi `save_marketing_post` với toàn bộ trường typed. Nếu tool từ chối, giao lại Poppy sửa đúng lỗi; không giao Finch.
6. Chỉ sau khi `save_marketing_post` trả artifact ID mới giao Finch. Assignment phải chứa `CAMPAIGN_ID`, `CAMPAIGN_STATUS: scripting`, `CAMPAIGN_REVISION` và `POST_ARTIFACT_ID`.
7. Chỉ báo hoàn thành khi post artifact và đúng số image artifact của revision đều tồn tại.
```

State explicitly that `ask_user` is RoMes's user interaction tool; Poppy and Finch still do not ask the person directly.

- [ ] **Step 4: Make Poppy return one typed object**

Replace Poppy's social-post output contract with:

```md
Trả về đúng một JSON object, không bọc trong code fence và không thêm văn bản ngoài JSON:
{
  "campaignId": "<id>",
  "revision": 1,
  "platform": "facebook",
  "headline": "...",
  "body": "...",
  "callToAction": "...",
  "hashtags": ["#AI"],
  "caption": "toàn văn chính xác sẽ đăng",
  "visualPrompts": [{
    "index": 1,
    "label": "...",
    "subject": "...",
    "context": "...",
    "action": "...",
    "requiredTerms": ["..."],
    "excludedTerms": ["watermark", "cartoon"],
    "aspectRatio": "1:1"
  }]
}
`visualPrompts` phải có đúng IMAGE_COUNT phần tử, index liên tiếp từ 1. Đây là mô tả để tìm ảnh thật, không phải prompt tạo ảnh bằng model.
```

- [ ] **Step 5: Make Finch load the post artifact instead of inventing prompts**

Change Finch's assignment gate and first action:

```md
Assignment hợp lệ bắt buộc có `CAMPAIGN_ID`, `CAMPAIGN_STATUS: scripting`, `CAMPAIGN_REVISION` và `POST_ARTIFACT_ID`. Nếu thiếu, trả `NEEDS INPUT: POST_ARTIFACT_ID` và không gọi tool.

Gọi `get_marketing_post` đúng một lần với campaign ID và post artifact ID. Chỉ dùng `visualPrompts` trong artifact đó; không tự viết prompt khác, không thay subject, requiredTerms hoặc excludedTerms. Chuyển mỗi visual direction thành một search description cho `generate_marketing_images` trong cùng thứ tự.
```

- [ ] **Step 6: Grant only the required tools**

In `team.yaml`, add to RoMes:

```yaml
        - mcp:marketing_studio:save_marketing_post
        - mcp:marketing_studio:get_marketing_post
```

Add to Finch:

```yaml
        - mcp:marketing_studio:get_marketing_post
```

Do not grant Poppy any marketing tools.

- [ ] **Step 7: Run the team contract test**

Run:

```bash
pnpm exec vitest run server/marketing/swarm/team.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the team behavior**

```bash
git add \
  server/marketing/swarm/romes.md \
  server/marketing/swarm/poppy.md \
  server/marketing/swarm/finch.md \
  server/marketing/swarm/team.yaml \
  server/marketing/swarm/team.test.ts
git diff --cached --check
git commit -m "feat(marketing): consult before sequential production"
```

### Task 6: Update isolated verification and run the slice gate

**Files:**
- Modify: `docs/verification/marketing-swarm.md:1-117`

- [ ] **Step 1: Update the automated test list and expected tool count**

Add `server/marketing/social-post-artifact.test.ts` to the focused command. Replace the fixed “eleven marketing tools” statement with an assertion that explicitly names `save_marketing_post` and `get_marketing_post`, so future unrelated tool additions do not stale the document.

- [ ] **Step 2: Replace the conversational recipe with the approved interaction**

Document this exact isolated scenario:

```md
1. Send RoMes: `viết giúp anh bài về cuộc đua AI của các hãng công nghệ`.
   Expected: one compact `ask_user` card covering the proposed platform, audience, goal, CTA and image count. The transcript contains no `coordinate_bots` call.
2. Accept the proposed values but choose five images.
   Expected: a brief summary card for revision 1. `campaign.json` remains `needs_brief`.
3. Choose `Bắt đầu`.
   Expected: approval for revision 1, one Poppy assignment, then one `script` artifact created by `save_marketing_post`.
4. Read the coordinator transcript before Finch starts.
   Expected: Finch's assignment contains the exact `POST_ARTIFACT_ID`; there was no earlier Finch assignment.
5. Send a revised request changing only the image count.
   Expected: revision 2 requires confirmation and the old artifact is not presented as revision 2.
```

State that an unscripted model response is observational only. Deterministic lifecycle evidence comes from the MCP and artifact tests.

- [ ] **Step 3: Run all focused marketing tests**

Run:

```bash
pnpm exec vitest run \
  server/marketing/brief.test.ts \
  server/marketing/campaign-store.test.ts \
  server/marketing/social-post-artifact.test.ts \
  server/marketing/campaign-workflow.test.ts \
  server/marketing/publisher-gateway.test.ts \
  server/marketing/mcp-server.test.ts \
  server/marketing/swarm/team.test.ts
```

Expected: all listed test files pass.

- [ ] **Step 4: Run typecheck and lint only the completed implementation**

Run:

```bash
pnpm typecheck
pnpm exec oxlint --deny-warnings \
  server/marketing/brief.ts \
  server/marketing/brief.test.ts \
  server/marketing/campaign-store.ts \
  server/marketing/campaign-store.test.ts \
  server/marketing/social-post-artifact.ts \
  server/marketing/social-post-artifact.test.ts \
  server/marketing/mcp-server.ts \
  server/marketing/mcp-server.test.ts \
  server/marketing/swarm/team.test.ts
```

Expected: both commands exit 0 with no warnings.

- [ ] **Step 5: Launch and exercise the disposable fixture**

Follow `docs/verification/README.md` and `docs/verification/marketing-swarm.md`. Launch only:

```bash
node --experimental-strip-types scripts/control-omb.ts launch
```

Register the marketing MCP with `MARKETING_ASSETS_ROOT` under the printed temporary data directory, apply `server/marketing/swarm/team.yaml` to that fixture, and exercise the five documented turns. Never point the commands at the person's running `127.0.0.1:5199` app.

Expected evidence:

- question card before approval;
- no production call before confirmation;
- Poppy assignment before Finch assignment;
- one registered `script` artifact bound to the approved revision;
- stale revision refusal after a changed brief.

- [ ] **Step 6: Commit verification documentation**

```bash
git add docs/verification/marketing-swarm.md
git diff --cached --check
git commit -m "docs(marketing): verify consultation and copy artifacts"
```

## Completion gate

Before claiming this slice complete, invoke `superpowers:verification-before-completion` and rerun Task 6 Steps 3–5 from a clean isolated fixture. Report separately:

- automated test and typecheck results;
- isolated fixture results;
- any behavior that remains dependent on model judgment;
- the fact that image relevance and social publishing reliability are intentionally deferred to slices 2 and 3.
- the fact that image-count-only copy reuse is deferred to slice 2 while stale revision reuse is blocked here.
