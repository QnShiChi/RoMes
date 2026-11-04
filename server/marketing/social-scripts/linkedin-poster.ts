import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { SocialPoster, SocialPostPayload, SocialPostResult } from "./types.ts";

export class LinkedInPoster implements SocialPoster {
  readonly platform = "linkedin";

  constructor(private readonly runner: AgentDesktopRunner = new AgentDesktopRunner()) {}

  async isAvailable(): Promise<boolean> {
    const tab = await this.runner.findTab(/linkedin\.com/i);
    return Boolean(tab);
  }

  async publish(payload: SocialPostPayload): Promise<SocialPostResult> {
    const start = Date.now();
    try {
      const tab = await this.runner.findTab(/linkedin\.com/i);
      if (!tab) {
        return {
          success: false,
          platform: "linkedin",
          durationMs: Date.now() - start,
          error: "LinkedIn tab not found in active browser.",
        };
      }
      await this.runner.clickRef(tab);

      const startBtn = await this.runner.findActionable({
        role: "button",
        namePattern: /(start a post|bắt đầu bài viết)/i,
      });

      if (!startBtn) {
        return {
          success: false,
          platform: "linkedin",
          durationMs: Date.now() - start,
          error: "Could not find LinkedIn 'Start a post' button.",
        };
      }

      await this.runner.clickRef(startBtn);

      const editor = await this.runner.findActionable({
        role: "textbox",
      });

      if (!editor) {
        return {
          success: false,
          platform: "linkedin",
          durationMs: Date.now() - start,
          error: "Could not find LinkedIn editor area.",
        };
      }

      await this.runner.fastPaste(editor, payload.text);

      const postBtn = await this.runner.findActionable({
        role: "button",
        namePattern: /^(post|đăng)$/i,
      });

      if (!postBtn) {
        return {
          success: false,
          platform: "linkedin",
          durationMs: Date.now() - start,
          error: "Could not find LinkedIn Post button.",
        };
      }

      await this.runner.clickRef(postBtn);

      return {
        success: true,
        platform: "linkedin",
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        platform: "linkedin",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
