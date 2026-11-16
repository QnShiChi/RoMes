import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import { AiStudioCdpClient } from "./ai-studio-cdp.ts";

export class AiStudioGenerator {
  private readonly runner: AgentDesktopRunner;
  private readonly cdp: AiStudioCdpClient;

  constructor(runner?: AgentDesktopRunner, cdp?: AiStudioCdpClient) {
    this.runner = runner ?? new AgentDesktopRunner();
    this.cdp = cdp ?? new AiStudioCdpClient();
  }

  async isAvailable(): Promise<boolean> {
    // Priority 1: Project's dedicated Chrome via CDP
    const cdpTab = await this.cdp.findAiStudioTab().catch(() => null);
    if (cdpTab) return true;

    // Priority 2: System browser via AgentDesktopRunner
    const tab = await this.runner.findTab(/(aistudio\.google\.com|google ai studio)/i).catch(() => null);
    return Boolean(tab);
  }

  async submitPrompt(promptText: string): Promise<boolean> {
    // Priority 1: Direct CDP automation on Project Browser
    const cdpTab = await this.cdp.findAiStudioTab().catch(() => null);
    if (cdpTab?.webSocketDebuggerUrl) {
      const escaped = JSON.stringify(promptText);
      const res = await this.cdp.executeInTab(
        cdpTab.webSocketDebuggerUrl,
        `
        (function() {
          const textarea = document.querySelector("textarea.cdk-textarea-autosize, textarea, [contenteditable=true]");
          if (!textarea) return false;
          if (textarea.tagName === "TEXTAREA") {
            textarea.value = ${escaped};
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            textarea.dispatchEvent(new Event("change", { bubbles: true }));
          } else {
            textarea.innerText = ${escaped};
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
          }
          const runBtn = Array.from(document.querySelectorAll("button")).find(b => {
            const t = (b.innerText || "").trim().toLowerCase();
            const a = (b.getAttribute("aria-label") || "").trim().toLowerCase();
            if (a.includes("settings") || a.includes("panel") || a.includes("close")) return false;
            return t.startsWith("run") || t === "run" || a === "run" || a.startsWith("run ");
          });
          if (runBtn) {
            runBtn.click();
            return true;
          }
          textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
          return true;
        })()
        `,
      );
      if (res) return true;
    }

    // Priority 2: Fallback via AgentDesktopRunner
    const tab = await this.runner.findTab(/(aistudio\.google\.com|google ai studio)/i);
    if (!tab) {
      throw new Error("Google AI Studio tab not found in project or desktop browser.");
    }
    await this.runner.clickRef(tab);

    const promptBox = await this.runner.findActionable({ role: "textbox" });
    if (!promptBox) {
      throw new Error("Could not find AI Studio prompt input textbox.");
    }

    await this.runner.fastPaste(promptBox, promptText);

    const runBtn = await this.runner.findActionable({
      role: "button",
      namePattern: /^(run|send|chạy|gửi)$/i,
    });

    if (runBtn) {
      await this.runner.clickRef(runBtn);
    }
    return true;
  }
}
