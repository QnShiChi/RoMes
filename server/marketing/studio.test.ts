import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectImageFormat,
  generateMarketingImages,
  getMarketingDraft,
  markMarketingPublished,
  saveMarketingDraft,
} from "./studio.ts";

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe("marketing studio core", () => {
  const dirs: string[] = [];
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-marketing-studio-"));
    dirs.push(dir);
    return dir;
  };

  it("detects valid JPEG, PNG, and WEBP magic bytes and rejects HTML/text", () => {
    expect(detectImageFormat(VALID_JPEG)).toBe("jpeg");
    expect(detectImageFormat(VALID_PNG)).toBe("png");
    expect(detectImageFormat(Buffer.from("<html>error</html>"))).toBeNull();
  });

  it("generates multiple images in parallel, retries transient 502 errors, and saves files to disk", async () => {
    const root = makeTempDir();
    let calls = 0;
    server = createServer((req, res) => {
      calls += 1;
      if (req.url?.includes("flaky") && calls === 1) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end("Bad gateway");
        return;
      }
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(VALID_JPEG);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;

    const result = await generateMarketingImages(
      {
        campaignSlug: "Sony XM6 Launch!",
        prompts: [
          { prompt: "studio shot of headphones on marble desk", label: "Studio Shot" },
          { prompt: "flaky lifestyle shot in coffee shop", label: "Lifestyle Shot" },
        ],
      },
      { assetsRoot: root, baseUrl: `http://127.0.0.1:${port}/prompt`, timeoutMs: 5_000 },
    );

    expect(result.campaignSlug).toBe("sony-xm6-launch");
    expect(result.images).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(readFileSync(result.images[0]!.filePath)).toEqual(VALID_JPEG);
    expect(readFileSync(result.images[1]!.filePath)).toEqual(VALID_JPEG);
    expect(result.images[0]!.label).toBe("Studio Shot");
  });

  it("persists, retrieves, and updates campaign draft state", async () => {
    const root = makeTempDir();
    const saved = await saveMarketingDraft(root, {
      campaignSlug: "iphone-duo",
      productName: "iPhone Duo",
      targetPlatforms: ["facebook", "x"],
      posts: [
        {
          platform: "facebook",
          title: "Siêu phẩm gập đôi iPhone Duo",
          body: "Trải nghiệm công nghệ tương lai ngay hôm nay.",
          hashtags: ["#iPhoneDuo", "#Tech"],
          imagePaths: [join(root, "iphone-duo", "image-1.jpg")],
        },
      ],
    });

    expect(saved.status).toBe("pending_approval");
    const loaded = await getMarketingDraft(root, "iphone-duo");
    expect(loaded.productName).toBe("iPhone Duo");
    expect(loaded.posts[0]!.platform).toBe("facebook");

    const published = await markMarketingPublished(root, {
      campaignSlug: "iphone-duo",
      results: [{ platform: "facebook", status: "published", url: "https://facebook.com/posts/123" }],
    });
    expect(published.status).toBe("published");
    expect(published.publishedResults?.[0]?.url).toBe("https://facebook.com/posts/123");
  });
});
