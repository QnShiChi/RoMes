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

  it("answers initialize, tools/list, and executes generate_marketing_images and draft tools", async () => {
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
    expect(listed.result.tools.map((t: { name: string }) => t.name)).toEqual([
      "generate_marketing_images",
      "save_marketing_draft",
      "get_marketing_draft",
      "mark_marketing_published",
    ]);

    const generated = await rpc(3, "tools/call", {
      name: "generate_marketing_images",
      arguments: {
        campaignSlug: "keychron-q1",
        prompts: [{ prompt: "mechanical keyboard studio lighting", label: "Hero Banner" }],
      },
    });
    expect(generated.result.isError).toBeUndefined();
    const parsedGen = JSON.parse(generated.result.content[0].text);
    expect(parsedGen.images).toHaveLength(1);
    expect(parsedGen.images[0].filePath).toContain("keychron-q1");

    const saved = await rpc(4, "tools/call", {
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

    const loaded = await rpc(5, "tools/call", {
      name: "get_marketing_draft",
      arguments: { campaignSlug: "keychron-q1" },
    });
    expect(JSON.parse(loaded.result.content[0].text).productName).toBe("Keychron Q1 Pro");
  });
});
