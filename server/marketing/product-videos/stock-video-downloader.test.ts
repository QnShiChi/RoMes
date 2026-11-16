import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StockVideoDownloader } from "./stock-video-downloader.ts";
import type { ProductVideoCandidate } from "./types.ts";

describe("stock-video-downloader", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "stock-video-test-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("downloads videos successfully when mock returns valid binary data", async () => {
    const dummyBuffer = Buffer.alloc(60_000, "a");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => dummyBuffer.buffer,
    });

    const downloader = new StockVideoDownloader(mockFetch as unknown as typeof fetch);
    const candidates: ProductVideoCandidate[] = [
      { url: "https://assets.mixkit.co/videos/1111/1111-1080.mp4", provider: "mixkit" },
    ];

    const results = await downloader.downloadExact(candidates, tempDir, 1);
    expect(results).toHaveLength(1);
    expect(results[0]?.index).toBe(1);
    expect(existsSync(results[0]!.filePath)).toBe(true);
    expect(statSync(results[0]!.filePath).size).toBe(60_000);
  });

  it("skips corrupt/small downloads and returns empty if no valid candidate", async () => {
    const tinyBuffer = Buffer.alloc(100, "b");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => tinyBuffer.buffer,
    });

    const downloader = new StockVideoDownloader(mockFetch as unknown as typeof fetch);
    const candidates: ProductVideoCandidate[] = [
      { url: "https://assets.mixkit.co/videos/2222/2222-1080.mp4", provider: "mixkit" },
    ];

    const results = await downloader.downloadExact(candidates, tempDir, 1);
    expect(results).toHaveLength(0);
  });
});
