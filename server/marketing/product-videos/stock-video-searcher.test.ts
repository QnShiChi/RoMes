import { describe, expect, it, vi } from "vitest";
import { extractStockSearchQuery, StockVideoSearcher } from "./stock-video-searcher.ts";

describe("stock-video-searcher", () => {
  it("extracts search queries dynamically across different domains without hardcoding", () => {
    expect(extractStockSearchQuery("tiệm hoa tươi phong cách hiện đại")).toBe("flowers");
    expect(extractStockSearchQuery("quán cà phê ấm cúng")).toBe("coffee");
    expect(extractStockSearchQuery("bàn phím cơ gõ văn phòng")).toBe("keyboard");
    expect(extractStockSearchQuery("thời trang dạo phố mùa hè")).toBe("fashion");
    expect(extractStockSearchQuery("lập trình phần mềm AI")).toBe("technology");
    expect(extractStockSearchQuery("căn hộ chung cư cao cấp")).toBe("interior");
  });

  it("parses mixkit html candidates correctly", () => {
    const searcher = new StockVideoSearcher();
    const mockHtml = `
      <div>
        <a href="https://assets.mixkit.co/videos/1234/1234-360.mp4">Clip 1</a>
        <video src="https://assets.mixkit.co/videos/5678/5678-720.mp4"></video>
      </div>
    `;

    const candidates = searcher.parseMixkitHtml(mockHtml, "flowers");
    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.url).toBe("https://assets.mixkit.co/videos/1234/1234-1080.mp4");
    expect(candidates[0]?.provider).toBe("mixkit");
    expect(candidates[1]?.url).toBe("https://assets.mixkit.co/videos/5678/5678-1080.mp4");
  });

  it("handles fetch errors gracefully without throwing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network timeout"));
    const searcher = new StockVideoSearcher(mockFetch as unknown as typeof fetch);

    const results = await searcher.search("tiệm hoa");
    expect(results).toEqual([]);
  });
});
