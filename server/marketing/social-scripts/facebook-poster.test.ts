import { describe, expect, it, vi } from "vitest";
import { FacebookPoster } from "./facebook-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("FacebookPoster", () => {
  it("discovers composer, pastes text, attaches images, and clicks post", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:fb"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "button" && query.namePattern?.test("Bạn đang nghĩ gì")) {
          return "@btn:composer";
        }
        if (query.role === "textbox") {
          return "@box:input";
        }
        if (query.role === "button" && query.namePattern?.test("Đăng")) {
          return "@btn:submit";
        }
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new FacebookPoster(mockRunner as AgentDesktopRunner);
    const result = await poster.publish({
      text: "Bài viết ra mắt sản phẩm mới!",
      images: ["/tmp/image-1.jpg", "/tmp/image-2.jpg"],
      campaignId: "camp-fb-1",
    });

    expect(result.success).toBe(true);
    expect(result.platform).toBe("facebook");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:input", "Bài viết ra mắt sản phẩm mới!");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:submit");
  });

  it("fails fast with actionable error when Facebook tab is not found", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue(null),
    };

    const poster = new FacebookPoster(mockRunner as AgentDesktopRunner);
    const result = await poster.publish({
      text: "Hello",
      images: [],
      campaignId: "c1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/facebook tab not found/i);
  });
});
