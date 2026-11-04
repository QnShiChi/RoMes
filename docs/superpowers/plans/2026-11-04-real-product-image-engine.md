# Real-World Product Image Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 100% free, zero-API-key product image search and extraction engine that downloads authentic, high-resolution product photos from web indexes, strictly guaranteeing $N$ images, and integrating seamlessly into `studio.ts`.

**Architecture:** A `ProductImageSearcher` queries web image indexes to extract full-resolution image candidate URLs; an `ImageQualityFilter` enforces $\ge 600\text{px}$ resolution and eliminates stock photo watermarks; a `ProductImageDownloader` downloads files in parallel, validates magic bytes, and guarantees exactly $N$ images; `studio.ts` routes marketing image generation through this pipeline.

**Tech Stack:** TypeScript, Node.js (`node:fs`, `node:path`), Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-04-real-product-image-engine-design.md`](file:///home/phan-duong-quoc-nhat/workspace/RoMes/docs/superpowers/specs/2026-11-04-real-product-image-engine-design.md)

## Global Constraints
- **Zero Cost & No API Keys**: Never call paid OpenAI or Google Generative Language image endpoints; no external billing services.
- **Strict Count Guarantee**: If $N$ images are requested, the engine must return exactly $N$ valid image files.
- **Image Quality**: Minimum resolution $\ge 600\text{px}$ width and $\ge 400\text{px}$ height; reject watermarked stock previews and corrupted files.
- **Speed**: Query and download must complete within 2.5 seconds.
- **Adhere to AGENTS.md**: Comments only for non-obvious facts; isolated fixtures for tests.

---

### Task 1: ProductImageSearcher

**Files:**
- Create: `server/marketing/product-images/types.ts`
- Create: `server/marketing/product-images/product-image-searcher.ts`
- Test: `server/marketing/product-images/product-image-searcher.test.ts`

**Interfaces:**
- Consumes: Raw HTML/JSON responses from image search endpoints.
- Produces: `ProductImageCandidate[]` with `url`, `title`, `width`, `height`, `sourceUrl`.

- [ ] **Step 1: Write failing test for ProductImageSearcher**

```typescript
// server/marketing/product-images/product-image-searcher.test.ts
import { describe, expect, it, vi } from "vitest";
import { ProductImageSearcher } from "./product-image-searcher.ts";

describe("ProductImageSearcher", () => {
  it("parses candidate image URLs and dimensions from search response", async () => {
    const mockHtml = `
      <div class="imgpt">
        <a class="iusc" m="{&quot;murl&quot;:&quot;https://cdn.shopify.com/product.jpg&quot;,&quot;t&quot;:&quot;Meta Muse AI Official&quot;,&quot;ow&quot;:1200,&quot;oh&quot;:800}"></a>
        <a class="iusc" m="{&quot;murl&quot;:&quot;https://example.com/press.png&quot;,&quot;t&quot;:&quot;Meta Muse Press Kit&quot;,&quot;ow&quot;:1920,&quot;oh&quot;:1080}"></a>
      </div>
    `;

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => mockHtml,
    });

    const searcher = new ProductImageSearcher(mockFetch as unknown as typeof fetch);
    const candidates = await searcher.search("Meta Muse AI");

    expect(candidates).toHaveLength(2);
    expect(candidates[0]!.url).toBe("https://cdn.shopify.com/product.jpg");
    expect(candidates[0]!.title).toBe("Meta Muse AI Official");
    expect(candidates[0]!.width).toBe(1200);
    expect(candidates[0]!.height).toBe(800);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/product-images/product-image-searcher.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement types and ProductImageSearcher**

```typescript
// server/marketing/product-images/types.ts
export interface ProductImageCandidate {
  url: string;
  title: string;
  width?: number;
  height?: number;
  sourceUrl?: string;
}

export interface ProductImageResult {
  index: number;
  label: string;
  filePath: string;
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  bytes: number;
}
```

```typescript
// server/marketing/product-images/product-image-searcher.ts
import type { ProductImageCandidate } from "./types.ts";

export class ProductImageSearcher {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async search(query: string): Promise<ProductImageCandidate[]> {
    const encoded = encodeURIComponent(query.trim());
    const searchUrl = `https://www.bing.com/images/search?q=${encoded}&qft=+filterui:imagesize-large`;

    const response = await this.fetchImpl(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search images: HTTP ${response.status}`);
    }

    const html = await response.text();
    return this.parseCandidates(html);
  }

  private parseCandidates(html: string): ProductImageCandidate[] {
    const candidates: ProductImageCandidate[] = [];
    const pattern = /murl&quot;:&quot;(https:\/\/[^&]+)&quot;/g;
    const titlePattern = /&quot;t&quot;:&quot;([^&]+)&quot;/g;
    const widthPattern = /&quot;ow&quot;:(\d+)/g;
    const heightPattern = /&quot;oh&quot;:(\d+)/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1]!;
      candidates.push({
        url,
        title: "",
      });
    }

    // Extract metadata if structured block exists
    let idx = 0;
    while ((match = titlePattern.exec(html)) !== null && idx < candidates.length) {
      candidates[idx]!.title = match[1]!;
      idx++;
    }

    idx = 0;
    while ((match = widthPattern.exec(html)) !== null && idx < candidates.length) {
      candidates[idx]!.width = parseInt(match[1]!, 10);
      idx++;
    }

    idx = 0;
    while ((match = heightPattern.exec(html)) !== null && idx < candidates.length) {
      candidates[idx]!.height = parseInt(match[1]!, 10);
      idx++;
    }

    return candidates;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/marketing/product-images/product-image-searcher.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/product-images/types.ts server/marketing/product-images/product-image-searcher.ts server/marketing/product-images/product-image-searcher.test.ts
git commit -m "feat(image-engine): add ProductImageSearcher and types"
```

---

### Task 2: ImageQualityFilter

**Files:**
- Create: `server/marketing/product-images/image-quality-filter.ts`
- Test: `server/marketing/product-images/image-quality-filter.test.ts`

**Interfaces:**
- Consumes: `ProductImageCandidate[]`.
- Produces: `filterCandidates(candidates: ProductImageCandidate[]): ProductImageCandidate[]`.

- [ ] **Step 1: Write failing test for ImageQualityFilter**

```typescript
// server/marketing/product-images/image-quality-filter.test.ts
import { describe, expect, it } from "vitest";
import { filterCandidates } from "./image-quality-filter.ts";
import type { ProductImageCandidate } from "./types.ts";

describe("ImageQualityFilter", () => {
  it("filters out low-resolution images, watermarked domains, and duplicates", () => {
    const raw: ProductImageCandidate[] = [
      { url: "https://shutterstock.com/image-photo/preview-123.jpg", title: "Watermarked preview", width: 1200, height: 800 },
      { url: "https://cdn.example.com/tiny-icon.jpg", title: "Tiny icon", width: 150, height: 150 },
      { url: "https://cdn.meta.com/muse-launch.jpg", title: "Meta Muse Launch", width: 1920, height: 1080 },
      { url: "https://cdn.meta.com/muse-launch.jpg", title: "Duplicate image", width: 1920, height: 1080 },
      { url: "https://press.meta.com/interface.png", title: "Meta Muse UI", width: 1080, height: 720 },
    ];

    const clean = filterCandidates(raw);
    expect(clean).toHaveLength(2);
    expect(clean[0]!.url).toBe("https://cdn.meta.com/muse-launch.jpg");
    expect(clean[1]!.url).toBe("https://press.meta.com/interface.png");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/product-images/image-quality-filter.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement ImageQualityFilter**

```typescript
// server/marketing/product-images/image-quality-filter.ts
import type { ProductImageCandidate } from "./types.ts";

const BLOCKED_DOMAINS = [
  "shutterstock.com",
  "alamy.com",
  "gettyimages.com",
  "istockphoto.com",
  "dreamstime.com",
  "stock.adobe.com",
  "123rf.com",
];

export function filterCandidates(
  candidates: ProductImageCandidate[],
  minWidth: number = 600,
  minHeight: number = 400,
): ProductImageCandidate[] {
  const seen = new Set<string>();
  const filtered: ProductImageCandidate[] = [];

  for (const item of candidates) {
    if (!item.url || !item.url.startsWith("https://")) continue;

    // Deduplication by URL
    if (seen.has(item.url)) continue;

    // Check blocked watermark domains
    const lower = item.url.toLowerCase();
    if (BLOCKED_DOMAINS.some((domain) => lower.includes(domain))) continue;

    // Check dimensions if present
    if (item.width && item.width < minWidth) continue;
    if (item.height && item.height < minHeight) continue;

    seen.add(item.url);
    filtered.push(item);
  }

  return filtered;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/marketing/product-images/image-quality-filter.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/product-images/image-quality-filter.ts server/marketing/product-images/image-quality-filter.test.ts
git commit -m "feat(image-engine): add ImageQualityFilter"
```

---

### Task 3: ProductImageDownloader

**Files:**
- Create: `server/marketing/product-images/product-image-downloader.ts`
- Test: `server/marketing/product-images/product-image-downloader.test.ts`

**Interfaces:**
- Consumes: `ProductImageCandidate[]`, output directory, required count $N$.
- Produces: `ProductImageResult[]` of exactly $N$ validated image files.

- [ ] **Step 1: Write failing test for ProductImageDownloader**

```typescript
// server/marketing/product-images/product-image-downloader.test.ts
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductImageDownloader } from "./product-image-downloader.ts";
import type { ProductImageCandidate } from "./types.ts";

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const INVALID_HTML = Buffer.from("<html><body>Error 404</body></html>");

describe("ProductImageDownloader", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
  });

  it("downloads images, skips corrupt candidates, and guarantees exact count N", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "downloader-test-"));
    dirs.push(outDir);

    const candidates: ProductImageCandidate[] = [
      { url: "https://bad.com/404.jpg", title: "Bad 404" },
      { url: "https://good.com/real-1.jpg", title: "Real 1", width: 1200, height: 800 },
      { url: "https://good.com/real-2.jpg", title: "Real 2", width: 1080, height: 720 },
    ];

    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("bad.com")) {
        return {
          ok: true,
          arrayBuffer: async () => INVALID_HTML.buffer,
        };
      }
      return {
        ok: true,
        arrayBuffer: async () => VALID_JPEG.buffer,
      };
    });

    const downloader = new ProductImageDownloader(mockFetch as unknown as typeof fetch);
    const results = await downloader.downloadExact(candidates, outDir, 2);

    expect(results).toHaveLength(2);
    expect(results[0]!.filePath).toContain("image-1.jpg");
    expect(results[1]!.filePath).toContain("image-2.jpg");
    expect(readFileSync(results[0]!.filePath)).toEqual(VALID_JPEG);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/product-images/product-image-downloader.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement ProductImageDownloader**

```typescript
// server/marketing/product-images/product-image-downloader.ts
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
        // Continue to next candidate on timeout or network error
        continue;
      }
    }

    if (results.length < targetCount) {
      throw new Error(`Only downloaded ${results.length}/${targetCount} valid product images.`);
    }

    return results;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/marketing/product-images/product-image-downloader.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/product-images/product-image-downloader.ts server/marketing/product-images/product-image-downloader.test.ts
git commit -m "feat(image-engine): add ProductImageDownloader with magic bytes check and candidate fallback"
```

---

### Task 4: Integrate into studio.ts & Purge Fake Generators

**Files:**
- Modify: `server/marketing/studio.ts`
- Test: `server/marketing/studio.test.ts`

**Interfaces:**
- Consumes: `ProductImageSearcher`, `filterCandidates`, `ProductImageDownloader`.
- Produces: `generateMarketingImages` strictly using real-world product search without API keys.

- [ ] **Step 1: Write test verifying generateMarketingImages uses real product search without keys**

In `server/marketing/studio.test.ts`, add test:
```typescript
it("generates marketing images by searching and downloading real product photos without API keys", async () => {
  const root = makeTempDir();
  const result = await generateMarketingImages(
    {
      campaignSlug: "keychron-q1",
      prompts: [
        { prompt: "Keychron Q1 Pro mechanical keyboard official", label: "Hero" },
        { prompt: "Keychron Q1 Pro switch layout", label: "Detail" },
      ],
    },
    { assetsRoot: root },
  );

  expect(result.images).toHaveLength(2);
  expect(existsSync(result.images[0]!.filePath)).toBe(true);
  expect(existsSync(result.images[1]!.filePath)).toBe(true);
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run: `pnpm vitest run server/marketing/studio.test.ts`

- [ ] **Step 3: Update generateMarketingImages in studio.ts**

Import `ProductImageSearcher`, `filterCandidates`, and `ProductImageDownloader`:
```typescript
import { ProductImageSearcher } from "./product-images/product-image-searcher.ts";
import { filterCandidates } from "./product-images/image-quality-filter.ts";
import { ProductImageDownloader } from "./product-images/product-image-downloader.ts";
```
In `generateMarketingImages`:
- Extract search query from campaign slug / prompt topic.
- Query `ProductImageSearcher`.
- Filter with `filterCandidates`.
- Call `ProductImageDownloader.downloadExact`.
- Completely delete any remaining fake gradient calls.

- [ ] **Step 4: Run tests to verify it passes**

Run: `pnpm vitest run server/marketing/studio.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/studio.ts server/marketing/studio.test.ts
git commit -m "feat(studio): wire ProductImageEngine and eliminate fake fallback image generation"
```

---

### Task 5: Live Verification with "Meta Muse AI" and Full Regression

**Files:**
- Run full regression suite on `server/marketing/`.
- Run one-off script to fetch real images for "Meta Muse AI".

- [ ] **Step 1: Run full regression tests**

Run: `pnpm vitest run server/marketing/`
Expected: ALL test files pass (100% green).

- [ ] **Step 2: Live test query for "Meta Muse AI"**

Run script searching for "Meta Muse AI", verify 3 high-res images downloaded to `/tmp/facebook-test-assets/`.

- [ ] **Step 3: Commit all changes**

```bash
git status
git commit -m "chore(marketing): complete real-world product image engine"
```
