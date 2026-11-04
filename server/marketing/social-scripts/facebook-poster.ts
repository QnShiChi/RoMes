import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { SocialPoster, SocialPostPayload, SocialPostResult } from "./types.ts";

export class FacebookPoster implements SocialPoster {
  readonly platform = "facebook";
  private readonly runner: AgentDesktopRunner;

  constructor(runner?: AgentDesktopRunner) {
    this.runner = runner ?? new AgentDesktopRunner();
  }

  async isAvailable(): Promise<boolean> {
    const tab = await this.runner.findTab(/facebook\.com/i);
    return Boolean(tab);
  }

  async publish(payload: SocialPostPayload): Promise<SocialPostResult> {
    const start = Date.now();
    try {
      const fbTab = await this.runner.findTab(/facebook/i);
      if (!fbTab) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Facebook tab not found in active browser. Please open Facebook in Chrome.",
        };
      }

      try {
        await this.runner.clickRef(fbTab);
      } catch {
        // Tab may already be active or requires compositor focus on Wayland
      }

      const composerBtn = await this.runner.findActionable({
        role: "button",
        namePattern: /(bạn đang nghĩ gì|what's on your mind|tạo bài viết|create post)/i,
      });

      if (!composerBtn) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook compose post button.",
        };
      }

      await this.runner.clickRef(composerBtn);

      const inputArea = await this.runner.findActionable({
        role: "textbox",
      });

      if (!inputArea) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook post input textbox.",
        };
      }

      await this.runner.fastPaste(inputArea, payload.text);

      const postBtn = await this.runner.findActionable({
        role: "button",
        namePattern: /^(đăng|post)$/i,
      });

      if (!postBtn) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook submit 'Đăng' button.",
        };
      }

      await this.runner.clickRef(postBtn);

      return {
        success: true,
        platform: "facebook",
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        platform: "facebook",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
