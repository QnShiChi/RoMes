import { describe, expect, it, vi } from "vitest";
import { LinkedInPoster } from "./linkedin-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("LinkedInPoster", () => {
  it("publishes post via active LinkedIn tab", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:li"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "button" && query.namePattern?.test("Start a post")) return "@btn:start";
        if (query.role === "textbox") return "@box:editor";
        if (query.role === "button" && query.namePattern?.test("Post")) return "@btn:publish";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new LinkedInPoster(mockRunner as AgentDesktopRunner);
    const res = await poster.publish({
      text: "LinkedIn enterprise insights",
      images: [],
      campaignId: "c-li-1",
    });

    expect(res.success).toBe(true);
    expect(res.platform).toBe("linkedin");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:start");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:editor", "LinkedIn enterprise insights");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:publish");
  });
});
