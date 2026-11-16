import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { DownloadedProductVideo, ProductVideoCandidate } from "./types.ts";

export interface StockVideoDownloaderOptions {
  timeoutMs?: number;
  maxRetries?: number;
}

export function probeVideoInfo(filePath: string): { duration: number; width: number; height: number } {
  try {
    const raw = execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height,duration",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        filePath,
      ],
      { encoding: "utf8", timeout: 10_000, stdio: "pipe" },
    );
    const data = JSON.parse(raw) as {
      streams?: Array<{ width?: number; height?: number; duration?: string }>;
      format?: { duration?: string };
    };
    const stream = data.streams?.[0];
    const durStr = stream?.duration || data.format?.duration || "4.0";
    return {
      duration: Math.max(1.0, parseFloat(durStr) || 4.0),
      width: stream?.width || 1080,
      height: stream?.height || 1920,
    };
  } catch {
    return { duration: 4.0, width: 1080, height: 1920 };
  }
}

export class StockVideoDownloader {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async downloadExact(
    candidates: ProductVideoCandidate[],
    outputDir: string,
    targetCount: number,
    options?: StockVideoDownloaderOptions,
  ): Promise<DownloadedProductVideo[]> {
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const timeoutMs = options?.timeoutMs ?? 30_000;
    const downloaded: DownloadedProductVideo[] = [];

    for (let i = 0; i < candidates.length && downloaded.length < targetCount; i++) {
      const candidate = candidates[i]!;
      const targetIndex = downloaded.length + 1;
      const targetPath = join(outputDir, `video-${targetIndex}.mp4`);

      try {
        const buffer = await this.downloadBuffer(candidate.url, timeoutMs);
        if (buffer && buffer.length > 50_000) {
          writeFileSync(targetPath, buffer);
          const probe = probeVideoInfo(targetPath);
          downloaded.push({
            index: targetIndex,
            filePath: targetPath,
            url: candidate.url,
            width: probe.width,
            height: probe.height,
            durationSeconds: probe.duration,
            bytes: statSync(targetPath).size,
          });
        }
      } catch {
        // Fallback to next resolution if 1080p URL failed
        if (candidate.url.includes("-1080.mp4")) {
          const fallbackUrl = candidate.url.replace("-1080.mp4", "-720.mp4");
          try {
            const buf = await this.downloadBuffer(fallbackUrl, timeoutMs);
            if (buf && buf.length > 50_000) {
              writeFileSync(targetPath, buf);
              const probe = probeVideoInfo(targetPath);
              downloaded.push({
                index: targetIndex,
                filePath: targetPath,
                url: fallbackUrl,
                width: probe.width,
                height: probe.height,
                durationSeconds: probe.duration,
                bytes: statSync(targetPath).size,
              });
            }
          } catch {
            // Next candidate
          }
        }
      }
    }

    return downloaded;
  }

  private async downloadBuffer(url: string, timeoutMs: number): Promise<Buffer | null> {
    const res = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} when downloading video: ${url}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
