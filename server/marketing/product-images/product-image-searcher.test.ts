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

  it("handles fallback url parsing when full JSON tag is stripped", async () => {
    const fallbackHtml = `murl&quot;:&quot;https://cdn.example.com/fallback.jpg&quot;`;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => fallbackHtml,
    });

    const searcher = new ProductImageSearcher(mockFetch as unknown as typeof fetch);
    const candidates = await searcher.search("fallback");

    expect(candidates).toHaveLength(1);
    expect(candidates[0]!.url).toBe("https://cdn.example.com/fallback.jpg");
  });

  it("throws error when response status is not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    });

    const searcher = new ProductImageSearcher(mockFetch as unknown as typeof fetch);
    await expect(searcher.search("fail")).rejects.toThrow("Failed to search images: HTTP 503");
  });
});
