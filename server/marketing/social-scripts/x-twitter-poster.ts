import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { SocialPoster, SocialPostPayload, SocialPostResult } from "./types.ts";

export class XTwitterPoster implements SocialPoster {
  readonly platform = "x";

  constructor(private readonly runner: AgentDesktopRunner = new AgentDesktopRunner()) {}

  async isAvailable(): Promise<boolean> {
    const tab = await this.runner.findTab(/twitter\.com|x\.com/i);
    return Boolean(tab);
  }

  async publish(payload: SocialPostPayload): Promise<SocialPostResult> {
    const start = Date.now();
    try {
      const tab = await this.runner.findTab(/twitter\.com|x\.com/i);
      if (!tab) {
        return {
          success: false,
          platform: "x",
          durationMs: Date.now() - start,
          error: "X/Twitter tab not found in active browser.",
        };
      }
      await this.runner.clickRef(tab);

      const inputArea =
        (await this.runner.findActionable({
          role: "textbox",
          namePattern: /(what is happening|có chuyện gì đang xảy ra|post text)/i,
        })) || (await this.runner.findActionable({ role: "textbox" }));

      if (!inputArea) {
        return {
          success: false,
          platform: "x",
          durationMs: Date.now() - start,
          error: "Could not find X tweet compose textbox.",
        };
      }

      await this.runner.fastPaste(inputArea, payload.text);

      const submitBtn = await this.runner.findActionable({
        role: "button",
        namePattern: /^(post|đăng)$/i,
      });

      if (!submitBtn) {
        return {
          success: false,
          platform: "x",
          durationMs: Date.now() - start,
          error: "Could not find X Post button.",
        };
      }

      await this.runner.clickRef(submitBtn);

      return {
        success: true,
        platform: "x",
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        platform: "x",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
