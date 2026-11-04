import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ProductImageCandidate, ProductImageResult } from "./types.ts";

export function detectImageMagicBytes(buf: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export class ProductImageDownloader {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async downloadExact(
    candidates: ProductImageCandidate[],
    outputDir: string,
    targetCount: number,
  ): Promise<ProductImageResult[]> {
    const results: ProductImageResult[] = [];
    let currentIdx = 1;

    for (const candidate of candidates) {
      if (results.length >= targetCount) break;

      try {
        const res = await this.fetchImpl(candidate.url, {
          signal: AbortSignal.timeout(4000),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          },
        });

        if (!res.ok) continue;

        const buffer = Buffer.from(await res.arrayBuffer());
        const mimeType = detectImageMagicBytes(buffer);
        if (!mimeType) continue;

        const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
        const filePath = join(outputDir, `image-${currentIdx}.${ext}`);
        writeFileSync(filePath, buffer);

        results.push({
          index: currentIdx,
          label: candidate.title || `Product Image ${currentIdx}`,
          filePath,
          url: candidate.url,
          mimeType,
          width: candidate.width ?? 1080,
          height: candidate.height ?? 1080,
          bytes: buffer.length,
        });

        currentIdx++;
      } catch {
        continue;
      }
    }

    if (results.length < targetCount) {
      throw new Error(`Only downloaded ${results.length}/${targetCount} valid product images.`);
    }

    return results;
  }
}
