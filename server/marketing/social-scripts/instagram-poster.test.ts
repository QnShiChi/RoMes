import { describe, expect, it, vi } from "vitest";
import { InstagramPoster } from "./instagram-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("InstagramPoster", () => {
  it("interacts with Instagram create and share buttons", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:ig"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "button" && query.namePattern?.test("Create|New post")) return "@btn:create";
        if (query.role === "textbox") return "@box:caption";
        if (query.role === "button" && query.namePattern?.test("Share")) return "@btn:share";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new InstagramPoster(mockRunner as AgentDesktopRunner);
    const res = await poster.publish({
      text: "Instagram visual story #brand",
      images: ["/tmp/ig-1.jpg"],
      campaignId: "c-ig-1",
    });

    expect(res.success).toBe(true);
    expect(res.platform).toBe("instagram");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:create");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:caption", "Instagram visual story #brand");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:share");
  });
});
