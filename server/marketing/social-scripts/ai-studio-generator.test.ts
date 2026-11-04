import { describe, expect, it, vi } from "vitest";
import { AiStudioGenerator } from "./ai-studio-generator.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("AiStudioGenerator", () => {
  it("interacts with AI Studio prompt input and triggers run", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:aistudio"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "textbox") return "@box:prompt";
        if (query.role === "button" && query.namePattern?.test("Run")) return "@btn:run";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const generator = new AiStudioGenerator(mockRunner as AgentDesktopRunner);
    const success = await generator.submitPrompt("Commercial hero image of Vietnamese tech workstation");

    expect(success).toBe(true);
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:prompt", "Commercial hero image of Vietnamese tech workstation");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:run");
  });
});
