import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { SocialPoster, SocialPostPayload, SocialPostResult } from "./types.ts";

export class InstagramPoster implements SocialPoster {
  readonly platform = "instagram";
  private readonly runner: AgentDesktopRunner;

  constructor(runner?: AgentDesktopRunner) {
    this.runner = runner ?? new AgentDesktopRunner();
  }

  async isAvailable(): Promise<boolean> {
    const tab = await this.runner.findTab(/instagram\.com|threads\.net/i);
    return Boolean(tab);
  }

  async publish(payload: SocialPostPayload): Promise<SocialPostResult> {
    const start = Date.now();
    try {
      const tab = await this.runner.findTab(/instagram\.com|threads\.net/i);
      if (!tab) {
        return {
          success: false,
          platform: "instagram",
          durationMs: Date.now() - start,
          error: "Instagram / Threads tab not found in active browser.",
        };
      }
      await this.runner.clickRef(tab);

      const createBtn = await this.runner.findActionable({
        role: "button",
        namePattern: /(create|new post|tạo mới)/i,
      });

      if (!createBtn) {
        return {
          success: false,
          platform: "instagram",
          durationMs: Date.now() - start,
          error: "Could not find Instagram Create button.",
        };
      }

      await this.runner.clickRef(createBtn);

      const captionArea = await this.runner.findActionable({
        role: "textbox",
      });

      if (!captionArea) {
        return {
          success: false,
          platform: "instagram",
          durationMs: Date.now() - start,
          error: "Could not find Instagram caption textbox.",
        };
      }

      await this.runner.fastPaste(captionArea, payload.text);

      const shareBtn = await this.runner.findActionable({
        role: "button",
        namePattern: /(share|chia sẻ)/i,
      });

      if (!shareBtn) {
        return {
          success: false,
          platform: "instagram",
          durationMs: Date.now() - start,
          error: "Could not find Instagram Share button.",
        };
      }

      await this.runner.clickRef(shareBtn);

      return {
        success: true,
        platform: "instagram",
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        platform: "instagram",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
