import { describe, expect, it, vi } from "vitest";
import { XTwitterPoster } from "./x-twitter-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("XTwitterPoster", () => {
  it("publishes tweet via active X tab", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:x"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "textbox") return "@box:tweet";
        if (query.role === "button" && query.namePattern?.test("Post")) return "@btn:post";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new XTwitterPoster(mockRunner as AgentDesktopRunner);
    const res = await poster.publish({
      text: "AI update from OpenMausBot #AI",
      images: ["/tmp/image.jpg"],
      campaignId: "c-x-1",
    });

    expect(res.success).toBe(true);
    expect(res.platform).toBe("x");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:tweet", "AI update from OpenMausBot #AI");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:post");
  });
});
