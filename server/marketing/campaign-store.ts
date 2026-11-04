import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

import { z } from "zod";

import type { FieldSource, MarketingBrief, MarketingBriefSources } from "./brief.ts";

export type CampaignStatus =
  | "needs_brief"
  | "approved"
  | "scripting"
  | "assets_ready"
  | "rendering"
  | "ready"
  | "publishing"
  | "published"
  | "failed";

export type ArtifactType = "script" | "image" | "speech" | "mixed_audio" | "video" | "publish_evidence";
export type OperationKind = "render" | "publish" | "images";
export type OperationState = "running" | "succeeded" | "failed";

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

export interface CampaignOperation {
  kind: OperationKind;
  state: OperationState;
  artifactId?: string;
}

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

export interface RegisterArtifactInput {
  type: ArtifactType;
  path: string;
  operationKey: string;
  metadata: Record<string, string | number | boolean>;
}

export interface CampaignStore {
  prepare(slug: string, brief: MarketingBrief, sources: MarketingBriefSources): MarketingCampaign;
  get(idOrSlug: string): MarketingCampaign;
  approve(idOrSlug: string, revision: number): MarketingCampaign;
  transition(idOrSlug: string, status: CampaignStatus): MarketingCampaign;
  fail(idOrSlug: string, failedStage: CampaignStatus): MarketingCampaign;
  beginOperation(idOrSlug: string, key: string, kind: OperationKind): MarketingCampaign;
  finishOperation(idOrSlug: string, key: string, artifactId: string): MarketingCampaign;
  failOperation(idOrSlug: string, key: string): MarketingCampaign;
  registerArtifact(idOrSlug: string, input: RegisterArtifactInput): CampaignArtifact;
  findArtifactByOperation(idOrSlug: string, operationKey: string): CampaignArtifact | null;
  resolveLatestReadyVideo(idOrSlug: string): CampaignArtifact | null;
}

export class CampaignStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CampaignStoreError";
  }
}

const statusSchema = z.enum([
  "needs_brief",
  "approved",
  "scripting",
  "assets_ready",
  "rendering",
  "ready",
  "publishing",
  "published",
  "failed",
]);
const briefV1Schema = z.object({
  topic: z.string().min(1),
  goal: z.string().min(1),
  audience: z.string().min(1),
  platform: z.string().min(1),
  style: z.string().min(1),
  targetDurationSeconds: z.number().positive().optional(),
  callToAction: z.string().min(1),
  contentType: z.enum(["social_post", "video_campaign"]).optional(),
  imageCount: z.number().int().positive().optional(),
}).strict();
const briefSchema = z.object({
  topic: z.string().min(1),
  goal: z.string().min(1),
  audience: z.string().min(1),
  platform: z.string().min(1),
  style: z.string().min(1),
  targetDurationSeconds: z.number().positive().optional(),
  callToAction: z.string().min(1),
  contentType: z.enum(["social_post", "video_campaign"]),
  imageCount: z.number().int().positive(),
}).strict();
const metadataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
const artifactSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["script", "image", "speech", "mixed_audio", "video", "publish_evidence"]),
  path: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  bytes: z.number().int().nonnegative(),
  operationKey: z.string().min(1),
  createdAt: z.string().min(1),
  metadata: metadataSchema,
}).strict();
const operationSchema = z.object({
  kind: z.enum(["render", "publish", "images"]),
  state: z.enum(["running", "succeeded", "failed"]),
  artifactId: z.string().min(1).optional(),
}).strict();
const campaignV1Schema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  revision: z.number().int().positive(),
  status: statusSchema,
  brief: briefV1Schema,
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  lastValidStatus: statusSchema.optional(),
  failedStage: statusSchema.optional(),
  artifacts: z.array(artifactSchema),
  operations: z.record(z.string(), operationSchema),
}).strict();
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

function migrateV1(input: z.infer<typeof campaignV1Schema>): MarketingCampaign {
  const contentType = input.brief.contentType ?? (
    /facebook|linkedin|instagram|ig|fb/i.test(input.brief.platform) ? "social_post" : "video_campaign"
  );
  const brief: MarketingBrief = {
    ...input.brief,
    contentType,
    imageCount: input.brief.imageCount ?? 1,
  };
  const keys = Object.keys(brief) as Array<keyof MarketingBrief>;
  const briefSources = Object.fromEntries(keys.map((field) => [
    field,
    field === "topic" ? "user" : "proposed_default",
  ])) as MarketingBriefSources;
  return campaignSchema.parse({
    ...input,
    schemaVersion: 2,
    brief,
    briefSources,
  }) as MarketingCampaign;
}

const NEXT: Record<CampaignStatus, CampaignStatus[]> = {
  needs_brief: ["approved", "failed"],
  approved: ["scripting", "assets_ready", "failed"],
  scripting: ["assets_ready", "failed"],
  assets_ready: ["rendering", "ready", "failed"],
  rendering: ["ready", "failed"],
  ready: ["publishing", "failed"],
  publishing: ["published", "failed"],
  published: ["publishing", "ready", "failed"],
  failed: ["approved", "assets_ready", "ready"],
};

const LAST_VALID: Partial<Record<CampaignStatus, CampaignStatus>> = {
  scripting: "approved",
  assets_ready: "approved",
  rendering: "assets_ready",
  ready: "assets_ready",
  publishing: "ready",
  published: "ready",
};

function normalizeCampaignSlug(raw: string): string {
  const slug = raw.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
  if (!slug) throw new CampaignStoreError("Campaign slug is required");
  return slug;
}

function atomicWrite(path: string, value: MarketingCampaign): void {
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

export function createCampaignStore(
  assetsRoot: string,
  now: () => string = () => new Date().toISOString(),
): CampaignStore {
  const root = resolve(assetsRoot);
  mkdirSync(root, { recursive: true });

  const location = (idOrSlug: string) => {
    const slug = normalizeCampaignSlug(idOrSlug);
    return { slug, directory: join(root, slug), path: join(root, slug, "campaign.json") };
  };

  const read = (idOrSlug: string): MarketingCampaign => {
    const { path } = location(idOrSlug);
    if (!existsSync(path)) throw new CampaignStoreError(`Marketing campaign not found: ${idOrSlug}`);
    try {
      const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
      if (typeof raw === "object" && raw !== null && "schemaVersion" in raw && raw.schemaVersion === 1) {
        return migrateV1(campaignV1Schema.parse(raw));
      }
      return campaignSchema.parse(raw) as MarketingCampaign;
    } catch (error) {
      if (error instanceof CampaignStoreError) throw error;
      throw new CampaignStoreError(`Marketing campaign manifest is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const write = (campaign: MarketingCampaign): MarketingCampaign => {
    const { directory, path } = location(campaign.slug);
    mkdirSync(directory, { recursive: true });
    atomicWrite(path, campaign);
    return campaign;
  };

  const update = (idOrSlug: string, mutate: (campaign: MarketingCampaign) => MarketingCampaign): MarketingCampaign => {
    const campaign = read(idOrSlug);
    return write(campaignSchema.parse(mutate(campaign)) as MarketingCampaign);
  };

  const store: CampaignStore = {
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

    get(idOrSlug) {
      return read(idOrSlug);
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

    transition(idOrSlug, status) {
      return update(idOrSlug, (campaign) => {
        if (!NEXT[campaign.status].includes(status)) {
          throw new CampaignStoreError(`Cannot transition campaign from ${campaign.status} to ${status}`);
        }
        return {
          ...campaign,
          status,
          updatedAt: now(),
          ...(campaign.status === "failed" ? { failedStage: undefined, lastValidStatus: undefined } : {}),
        };
      });
    },

    fail(idOrSlug, failedStage) {
      return update(idOrSlug, (campaign) => {
        if (campaign.status === "failed") return campaign;
        if (!NEXT[campaign.status].includes("failed")) {
          throw new CampaignStoreError(`Cannot fail campaign from ${campaign.status}`);
        }
        return {
          ...campaign,
          status: "failed",
          failedStage,
          lastValidStatus: LAST_VALID[failedStage] ?? campaign.status,
          updatedAt: now(),
        };
      });
    },

    beginOperation(idOrSlug, key, kind) {
      if (!key.trim()) throw new CampaignStoreError("Operation key is required");
      return update(idOrSlug, (campaign) => {
        const existing = campaign.operations[key];
        if (existing) return campaign;
        const running = Object.entries(campaign.operations).find(([, operation]) => operation.kind === kind && operation.state === "running");
        if (running) throw new CampaignStoreError(`${kind} operation ${running[0]} is already running`);
        return {
          ...campaign,
          updatedAt: now(),
          operations: { ...campaign.operations, [key]: { kind, state: "running" } },
        };
      });
    },

    finishOperation(idOrSlug, key, artifactId) {
      return update(idOrSlug, (campaign) => {
        const operation = campaign.operations[key];
        if (!operation) throw new CampaignStoreError(`Operation not found: ${key}`);
        if (!campaign.artifacts.some((artifact) => artifact.id === artifactId)) {
          throw new CampaignStoreError(`Artifact not found: ${artifactId}`);
        }
        return {
          ...campaign,
          updatedAt: now(),
          operations: { ...campaign.operations, [key]: { ...operation, state: "succeeded", artifactId } },
        };
      });
    },

    failOperation(idOrSlug, key) {
      return update(idOrSlug, (campaign) => {
        const operation = campaign.operations[key];
        if (!operation) throw new CampaignStoreError(`Operation not found: ${key}`);
        return {
          ...campaign,
          updatedAt: now(),
          operations: { ...campaign.operations, [key]: { ...operation, state: "failed" } },
        };
      });
    },

    registerArtifact(idOrSlug, input) {
      const campaign = read(idOrSlug);
      const existing = campaign.artifacts.find((artifact) => artifact.operationKey === input.operationKey && artifact.type === input.type);
      if (existing) return existing;
      const campaignDirectory = realpathSync(location(campaign.slug).directory);
      const artifactPath = resolve(input.path);
      const contained = isAbsolute(artifactPath) && relative(campaignDirectory, artifactPath) !== "" && !relative(campaignDirectory, artifactPath).startsWith("..") && !isAbsolute(relative(campaignDirectory, artifactPath));
      if (!contained) throw new CampaignStoreError("Artifact must be inside the campaign directory");
      if (!existsSync(artifactPath)) throw new CampaignStoreError(`Artifact file not found: ${artifactPath}`);
      const bytes = statSync(artifactPath).size;
      const sha256 = createHash("sha256").update(readFileSync(artifactPath)).digest("hex");
      const id = `artifact-${input.type}-${createHash("sha256").update(`${input.operationKey}:${sha256}`).digest("hex").slice(0, 16)}`;
      const artifact: CampaignArtifact = {
        id,
        type: input.type,
        path: artifactPath,
        sha256,
        bytes,
        operationKey: input.operationKey,
        createdAt: now(),
        metadata: input.metadata,
      };
      update(campaign.id, (current) => ({
        ...current,
        updatedAt: now(),
        artifacts: [...current.artifacts, artifact],
      }));
      return artifact;
    },

    findArtifactByOperation(idOrSlug, operationKey) {
      return read(idOrSlug).artifacts.find((artifact) => artifact.operationKey === operationKey) ?? null;
    },

    resolveLatestReadyVideo(idOrSlug) {
      const campaign = read(idOrSlug);
      if (!["ready", "publishing", "published"].includes(campaign.status)) return null;
      return campaign.artifacts.findLast((artifact) => artifact.type === "video" && existsSync(artifact.path)) ?? null;
    },
  };

  return store;
}
