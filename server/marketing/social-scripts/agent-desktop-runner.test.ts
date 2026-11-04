import { describe, expect, it, vi } from "vitest";
import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { DesktopCliExecutor, SnapshotNode } from "./types.ts";

describe("AgentDesktopRunner", () => {
  it("parses tree and finds actionable elements by role and regex", async () => {
    const mockTree: SnapshotNode = {
      role: "window",
      ref_id: "@w:1",
      name: "Google Chrome",
      children: [
        {
          role: "tablist",
          ref_id: "@tl:1",
          children: [
            { role: "tab", ref_id: "@tab:fb", name: "(1) Facebook" },
            { role: "tab", ref_id: "@tab:ai", name: "Google AI Studio" },
          ],
        },
        {
          role: "webarea",
          ref_id: "@web:1",
          name: "Facebook",
          children: [
            { role: "button", ref_id: "@btn:compose", name: "Bạn đang nghĩ gì thế?" },
            { role: "button", ref_id: "@btn:post", name: "Đăng" },
          ],
        },
      ],
    };

    const mockExecutor: DesktopCliExecutor = {
      run: vi.fn().mockResolvedValue({
        ok: true,
        data: { snapshot_id: "s1", tree: mockTree },
      }),
    };

    const runner = new AgentDesktopRunner(mockExecutor);
    const tabRef = await runner.findTab(/facebook/i);
    expect(tabRef).toBe("@tab:fb");

    const composeBtn = await runner.findActionable({
      role: "button",
      namePattern: /bạn đang nghĩ gì/i,
    });
    expect(composeBtn).toBe("@btn:compose");
  });

  it("handles fastPaste using clipboard-set, focus, and press ctrl+v", async () => {
    const commands: string[] = [];
    const mockExecutor: DesktopCliExecutor = {
      run: vi.fn().mockImplementation(async (cmd: string, args: string[]) => {
        commands.push(`${cmd} ${args.join(" ")}`);
        return { ok: true, data: {} };
      }),
    };

    const runner = new AgentDesktopRunner(mockExecutor);
    await runner.fastPaste("@input:1", "Nội dung bài viết marketing tiếng Việt");

    expect(commands).toContain("clipboard-set Nội dung bài viết marketing tiếng Việt");
    expect(commands).toContain("focus @input:1");
    expect(commands).toContain("press ctrl+v");
  });
});
