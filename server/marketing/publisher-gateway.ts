import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { z } from "zod";

import { CampaignStoreError, type CampaignStore } from "./campaign-store.ts";

export type PublishPlatform = "tiktok" | "facebook";

export interface PublishCapability {
  provider: string;
  platform: PublishPlatform;
  accountId: string;
}

export interface PublishEvidence extends PublishCapability {
  providerPostId: string;
  canonicalUrl: string;
  publishedAt: string;
}

export interface PublisherAdapter {
  capabilities(): Promise<PublishCapability[]>;
  publish(input: {
    platform: PublishPlatform;
    videoPath: string;
    caption: string;
    idempotencyKey: string;
  }): Promise<PublishEvidence>;
}

export interface PublishRequest {
  campaignId: string;
  artifactId: string;
  platform: PublishPlatform;
  caption: string;
  idempotencyKey: string;
}

export interface PublisherGateway {
  capabilities(): Promise<PublishCapability[]>;
  publish(input: PublishRequest): Promise<PublishEvidence>;
}

export class PublisherGatewayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublisherGatewayError";
  }
}

const capabilitySchema = z.object({
  provider: z.string().trim().min(1),
  platform: z.enum(["tiktok", "facebook"]),
  accountId: z.string().trim().min(1),
}).strict();

const evidenceSchema = capabilitySchema.extend({
  providerPostId: z.string().trim().min(1),
  canonicalUrl: z.string().url().refine((value) => value.startsWith("https://"), "must use HTTPS"),
  publishedAt: z.string().datetime({ offset: true }),
}).strict();

function validPlatformHost(platform: PublishPlatform, hostname: string): boolean {
  const host = hostname.toLowerCase();
  const domains = platform === "tiktok" ? ["tiktok.com"] : ["facebook.com", "fb.watch"];
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function validateEvidence(raw: PublishEvidence, requested: PublishCapability): PublishEvidence {
  let evidence: PublishEvidence;
  try {
    evidence = evidenceSchema.parse(raw) as PublishEvidence;
  } catch (error) {
    throw new PublisherGatewayError(`Invalid provider evidence: ${error instanceof Error ? error.message : String(error)}`);
  }
  let hostname = "";
  try {
    hostname = new URL(evidence.canonicalUrl).hostname;
  } catch {
    throw new PublisherGatewayError("Invalid provider evidence: canonical URL is invalid");
  }
  if (!validPlatformHost(requested.platform, hostname)) {
    throw new PublisherGatewayError(`Invalid provider evidence: URL does not belong to ${requested.platform}`);
  }
  if (
    evidence.platform !== requested.platform ||
    evidence.provider !== requested.provider ||
    evidence.accountId !== requested.accountId
  ) {
    throw new PublisherGatewayError("Invalid provider evidence: capability identity changed");
  }
  return evidence;
}

export function createPublisherGateway(
  store: CampaignStore,
  adapters: PublisherAdapter[],
): PublisherGateway {
  const available = async () => {
    const rows: Array<{ adapter: PublisherAdapter; capability: PublishCapability }> = [];
    for (const adapter of adapters) {
      const capabilities = await adapter.capabilities();
      for (const raw of capabilities) {
        const capability = capabilitySchema.parse(raw) as PublishCapability;
        rows.push({ adapter, capability });
      }
    }
    return rows;
  };

  return {
    async capabilities() {
      return (await available()).map((row) => row.capability);
    },

    async publish(input) {
      const campaign = store.get(input.campaignId);
      const operationKey = `publish:${input.platform}:${input.idempotencyKey}`;
      const existing = store.findArtifactByOperation(campaign.id, operationKey);
      if (existing?.type === "publish_evidence" && existsSync(existing.path)) {
        return evidenceSchema.parse(JSON.parse(readFileSync(existing.path, "utf8"))) as PublishEvidence;
      }
      if (campaign.status !== "ready") {
        throw new CampaignStoreError(`Campaign must be ready before publishing; current status is ${campaign.status}`);
      }
      const video = campaign.artifacts.find((artifact) => artifact.id === input.artifactId && artifact.type === "video");
      if (!video || !existsSync(video.path)) throw new CampaignStoreError(`Ready video artifact not found: ${input.artifactId}`);
      const selected = (await available()).find((row) => row.capability.platform === input.platform);
      if (!selected) throw new PublisherGatewayError(`No configured publisher for ${input.platform}`);

      store.beginOperation(campaign.id, operationKey, "publish");
      store.transition(campaign.id, "publishing");
      try {
        const raw = await selected.adapter.publish({
          platform: input.platform,
          videoPath: video.path,
          caption: input.caption,
          idempotencyKey: input.idempotencyKey,
        });
        const evidence = validateEvidence(raw, selected.capability);
        const suffix = createHash("sha256").update(operationKey).digest("hex").slice(0, 16);
        const evidencePath = join(dirname(video.path), `publish-evidence-${suffix}.json`);
        writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
        const artifact = store.registerArtifact(campaign.id, {
          type: "publish_evidence",
          path: evidencePath,
          operationKey,
          metadata: {
            platform: evidence.platform,
            provider: evidence.provider,
            accountId: evidence.accountId,
            providerPostId: evidence.providerPostId,
            canonicalUrl: evidence.canonicalUrl,
            publishedAt: evidence.publishedAt,
          },
        });
        store.finishOperation(campaign.id, operationKey, artifact.id);
        store.transition(campaign.id, "published");
        return evidence;
      } catch (error) {
        store.failOperation(campaign.id, operationKey);
        store.fail(campaign.id, "publishing");
        throw error;
      }
    },
  };
}
