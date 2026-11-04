import { AgentDesktopRunner } from "./agent-desktop-runner.ts";

export class AiStudioGenerator {
  constructor(private readonly runner: AgentDesktopRunner = new AgentDesktopRunner()) {}

  async isAvailable(): Promise<boolean> {
    const tab = await this.runner.findTab(/aistudio\.google\.com/i);
    return Boolean(tab);
  }

  async submitPrompt(promptText: string): Promise<boolean> {
    const tab = await this.runner.findTab(/aistudio\.google\.com/i);
    if (!tab) {
      throw new Error("Google AI Studio tab not found in active browser.");
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
