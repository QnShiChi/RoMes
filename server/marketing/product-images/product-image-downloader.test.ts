import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectImageMagicBytes, ProductImageDownloader } from "./product-image-downloader.ts";
import type { ProductImageCandidate } from "./types.ts";

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
const VALID_WEBP = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
const INVALID_HTML = Buffer.from("<html><body>Error 404</body></html>");

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe("ProductImageDownloader", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("detects valid image mime types from magic bytes", () => {
    expect(detectImageMagicBytes(VALID_JPEG)).toBe("image/jpeg");
    expect(detectImageMagicBytes(VALID_PNG)).toBe("image/png");
    expect(detectImageMagicBytes(VALID_WEBP)).toBe("image/webp");
    expect(detectImageMagicBytes(INVALID_HTML)).toBeNull();
  });

  it("downloads images, skips corrupt candidates, and guarantees exact count N", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "downloader-test-"));
    dirs.push(outDir);

    const candidates: ProductImageCandidate[] = [
      { url: "https://bad.com/404.jpg", title: "Bad 404" },
      { url: "https://good.com/real-1.jpg", title: "Real 1", width: 1200, height: 800 },
      { url: "https://good.com/real-2.png", title: "Real 2", width: 1080, height: 720 },
    ];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("bad.com")) {
        return {
          ok: true,
          arrayBuffer: async () => toArrayBuffer(INVALID_HTML),
        };
      }
      if (url.includes("real-2.png")) {
        return {
          ok: true,
          arrayBuffer: async () => toArrayBuffer(VALID_PNG),
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => toArrayBuffer(VALID_JPEG),
      };
    });

    const downloader = new ProductImageDownloader(mockFetch as unknown as typeof fetch);
    const results = await downloader.downloadExact(candidates, outDir, 2);

    expect(results).toHaveLength(2);
    expect(results[0]!.filePath).toContain("image-1.jpg");
    expect(results[0]!.mimeType).toBe("image/jpeg");
    expect(results[1]!.filePath).toContain("image-2.png");
    expect(results[1]!.mimeType).toBe("image/png");
    expect(readFileSync(results[0]!.filePath)).toEqual(VALID_JPEG);
    expect(readFileSync(results[1]!.filePath)).toEqual(VALID_PNG);
  });

  it("throws error when candidates cannot fulfill target count", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "downloader-test-"));
    dirs.push(outDir);

    const candidates: ProductImageCandidate[] = [
      { url: "https://bad.com/404.jpg", title: "Bad 404" },
    ];

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const downloader = new ProductImageDownloader(mockFetch as unknown as typeof fetch);
    await expect(downloader.downloadExact(candidates, outDir, 1)).rejects.toThrow(
      "Only downloaded 0/1 valid product images",
    );
  });
});
