import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createInterface } from "node:readline";
import { afterEach, describe, expect, it } from "vitest";

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

describe("marketing studio MCP server", () => {
  let child: ChildProcessWithoutNullStreams | undefined;
  let server: Server | undefined;
  const dirs: string[] = [];

  afterEach(async () => {
    child?.kill();
    child = undefined;
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("enforces consultation, approval, artifact reuse, and truthful publishing", async () => {
    const assetsRoot = mkdtempSync(join(tmpdir(), "omb-mcp-marketing-"));
    dirs.push(assetsRoot);

    server = createServer((_req, res) => {
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(VALID_JPEG);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;

    const script = join(import.meta.dirname, "mcp-server.ts");
    child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", script], {
      stdio: "pipe",
      env: {
        ...process.env,
        OMB_MARKETING_ASSETS_ROOT: assetsRoot,
        OMB_POLLINATIONS_BASE_URL: `http://127.0.0.1:${port}/prompt`,
      },
    });

    const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
    const rpc = async (id: number, method: string, params?: unknown) => {
      child!.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) })}\n`);
      const next = await lines.next();
      return JSON.parse(next.value as string) as { id: number; result?: any; error?: any };
    };

    const init = await rpc(1, "initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" },
    });
    expect(init.result.serverInfo.name).toBe("marketing_studio");

    const listed = await rpc(2, "tools/list", {});
    const names = listed.result.tools.map((t: { name: string }) => t.name);
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

    const routed = await rpc(3, "tools/call", {
      name: "route_marketing_request",
      arguments: { message: "up video vừa rồi lên TikTok" },
    });
    expect(JSON.parse(routed.result.content[0].text)).toMatchObject({ intent: "publish", confidence: "high" });

    const incomplete = await rpc(4, "tools/call", {
      name: "prepare_marketing_campaign",
      arguments: { campaignSlug: "keychron-q1", topic: "Keychron Q1" },
    });
    expect(JSON.parse(incomplete.result.content[0].text)).toMatchObject({
      needsConsultation: true,
      missingFields: expect.arrayContaining(["goal", "targetDurationSeconds"]),
    });

    const prepared = await rpc(5, "tools/call", {
      name: "prepare_marketing_campaign",
      arguments: {
        campaignSlug: "keychron-q1",
        topic: "Keychron Q1 Pro",
        goal: "lead generation",
        audience: "mechanical keyboard enthusiasts",
        platform: "TikTok",
        style: "modern tech",
        targetDurationSeconds: 2,
        callToAction: "Đăng ký nhận ưu đãi",
      },
    });
    const campaign = JSON.parse(prepared.result.content[0].text);
    expect(campaign).toMatchObject({ id: "keychron-q1", status: "needs_brief", revision: 1 });

    const blockedImages = await rpc(6, "tools/call", {
      name: "generate_marketing_images",
      arguments: {
        campaignId: campaign.id,
        prompts: [{ prompt: "mechanical keyboard studio lighting", label: "Hero Banner" }],
      },
    });
    expect(blockedImages.result.isError).toBe(true);
    expect(blockedImages.result.content[0].text).toMatch(/approved/i);

    const approved = await rpc(7, "tools/call", {
      name: "approve_marketing_campaign",
      arguments: { campaignId: campaign.id, revision: campaign.revision },
    });
    expect(JSON.parse(approved.result.content[0].text).status).toBe("approved");

    const generated = await rpc(8, "tools/call", {
      name: "generate_marketing_images",
      arguments: {
        campaignId: campaign.id,
        prompts: [{ prompt: "mechanical keyboard studio lighting", label: "Hero Banner" }],
      },
    });
    expect(generated.result.isError).toBeUndefined();
    const parsedGen = JSON.parse(generated.result.content[0].text);
    expect(parsedGen.images).toHaveLength(1);
    expect(parsedGen.images[0].filePath).toContain("keychron-q1");

    const campaignWithAssets = await rpc(9, "tools/call", {
      name: "get_marketing_campaign",
      arguments: { campaignId: campaign.id },
    });
    expect(JSON.parse(campaignWithAssets.result.content[0].text).status).toBe("assets_ready");

    const saved = await rpc(10, "tools/call", {
      name: "save_marketing_draft",
      arguments: {
        campaignSlug: "keychron-q1",
        productName: "Keychron Q1 Pro",
        targetPlatforms: ["facebook"],
        posts: [
          {
            platform: "facebook",
            body: "Bàn phím cơ custom đỉnh cao Keychron Q1 Pro!",
            imagePaths: [parsedGen.images[0].filePath],
          },
        ],
      },
    });
    expect(saved.result.isError).toBeUndefined();

    const loaded = await rpc(11, "tools/call", {
      name: "get_marketing_draft",
      arguments: { campaignSlug: "keychron-q1" },
    });
    expect(JSON.parse(loaded.result.content[0].text).productName).toBe("Keychron Q1 Pro");

    const videoArguments = {
      campaignId: campaign.id,
      campaignSlug: "keychron-q1",
      script: "Trải nghiệm gõ phím tuyệt vời cùng Keychron Q1 Pro.",
      scenes: [
        {
          type: "hook",
          title: "Đỉnh cao bàn phím cơ",
          durationMs: 1000,
        },
        {
          type: "cta",
          title: "Mua ngay hôm nay",
          durationMs: 1000,
        },
      ],
      ratio: "16:9",
      bgmTheme: "tech",
      targetDurationSeconds: 2,
    };
    const videoCall = await rpc(12, "tools/call", {
      name: "generate_marketing_video",
      arguments: videoArguments,
    });
    expect(videoCall.result.isError).toBeUndefined();
    const videoResult = JSON.parse(videoCall.result.content[0].text);
    expect(videoResult.videoPath).toContain("keychron-q1-video.mp4");
    expect(videoResult.width).toBe(1920);
    expect(videoResult.height).toBe(1080);
    expect(videoResult.ratio).toBe("16:9");
    expect(videoResult.reused).toBe(false);

    const reusedCall = await rpc(13, "tools/call", {
      name: "generate_marketing_video",
      arguments: videoArguments,
    });
    const reused = JSON.parse(reusedCall.result.content[0].text);
    expect(reused).toMatchObject({ reused: true, artifactId: videoResult.artifactId });

    const resolved = await rpc(14, "tools/call", {
      name: "resolve_marketing_artifact",
      arguments: { campaignId: campaign.id, type: "video" },
    });
    expect(JSON.parse(resolved.result.content[0].text)).toMatchObject({ id: videoResult.artifactId, path: videoResult.videoPath });

    const capabilities = await rpc(15, "tools/call", {
      name: "get_marketing_publish_capabilities",
      arguments: {},
    });
    expect(JSON.parse(capabilities.result.content[0].text)).toEqual({ capabilities: [] });

    const publishTool = listed.result.tools.find((tool: { name: string }) => tool.name === "publish_marketing_artifact");
    expect(publishTool.inputSchema.properties).not.toHaveProperty("url");
    expect(publishTool.inputSchema.properties).not.toHaveProperty("status");

    const publish = await rpc(16, "tools/call", {
      name: "publish_marketing_artifact",
      arguments: {
        campaignId: campaign.id,
        artifactId: videoResult.artifactId,
        platform: "tiktok",
        caption: "Keychron Q1 Pro",
        idempotencyKey: "publish-1",
      },
    });
    expect(JSON.parse(publish.result.content[0].text)).toMatchObject({
      published: false,
      reason: "no_configured_publisher",
      artifact: { id: videoResult.artifactId, path: videoResult.videoPath },
    });

    const finalCampaign = await rpc(17, "tools/call", {
      name: "get_marketing_campaign",
      arguments: { campaignId: campaign.id },
    });
    expect(JSON.parse(finalCampaign.result.content[0].text).status).toBe("ready");
  }, 60_000);
});
