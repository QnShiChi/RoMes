import { execFile } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { SocialPoster, SocialPostPayload, SocialPostResult } from "./types.ts";

const execFileAsync = promisify(execFile);

function resolveAgentBrowserBinary(): string | null {
  if (process.env.OMB_AGENT_BROWSER_PATH && existsSync(process.env.OMB_AGENT_BROWSER_PATH)) {
    return process.env.OMB_AGENT_BROWSER_PATH;
  }
  const toolsBase = join(homedir(), ".openmausbot", "tools", "agent-browser");
  if (!existsSync(toolsBase)) return null;
  try {
    const versions = readdirSync(toolsBase).sort().reverse();
    for (const v of versions) {
      const bin = join(toolsBase, v, "agent-browser");
      if (existsSync(bin)) return bin;
    }
  } catch {
    // fallback
  }
  return null;
}

function resolveActiveProfile(): string | null {
  const base = join(homedir(), ".openmausbot", "agent-browser-profiles");
  if (!existsSync(base)) return null;
  try {
    const profiles: Array<{ path: string; mtime: number }> = [];
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const p = join(base, entry.name);
        const cookies = join(p, "Default", "Cookies");
        if (existsSync(cookies)) {
          profiles.push({ path: p, mtime: statSync(cookies).mtimeMs });
        }
      }
    }
    profiles.sort((a, b) => b.mtime - a.mtime);
    return profiles[0]?.path ?? null;
  } catch {
    // fallback
  }
  return null;
}

export class FacebookPoster implements SocialPoster {
  readonly platform = "facebook";
  private readonly runner?: AgentDesktopRunner;

  constructor(runner?: AgentDesktopRunner) {
    this.runner = runner;
  }

  async isAvailable(): Promise<boolean> {
    if (this.runner) {
      const tab = await this.runner.findTab(/facebook/i);
      return Boolean(tab);
    }
    const bin = resolveAgentBrowserBinary();
    const profile = resolveActiveProfile();
    return Boolean(bin && profile);
  }

  async publish(payload: SocialPostPayload): Promise<SocialPostResult> {
    const start = Date.now();
    if (this.runner) {
      return this.publishWithRunner(this.runner, payload, start);
    }
    const bin = resolveAgentBrowserBinary();
    const profile = resolveActiveProfile();
    if (bin && profile) {
      return this.publishWithBrowser(bin, profile, payload, start);
    }
    const fallbackRunner = new AgentDesktopRunner();
    return this.publishWithRunner(fallbackRunner, payload, start);
  }

  private async publishWithBrowser(
    binary: string,
    profile: string,
    payload: SocialPostPayload,
    start: number,
  ): Promise<SocialPostResult> {
    const session = `omb-fb-${Date.now()}`;
    const run = async (args: string[]) => {
      const fullArgs = [
        "--session", session,
        "--profile", profile,
        "--args", "--no-sandbox",
        ...args,
      ];
      const { stdout, stderr } = await execFileAsync(binary, fullArgs, { timeout: 35_000 });
      return (stdout || stderr).trim();
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await run(["open", "https://www.facebook.com/"]);
      await sleep(2500);

      const openComposeCode = `
        (() => {
          const btns = Array.from(document.querySelectorAll("div[role=region] div[role=button], div[role=region] button, [aria-label*='Tạo bài viết'] [role=button]"));
          const match = btns.find(b => /bạn đang nghĩ gì|what's on your mind/i.test(b.innerText || b.getAttribute("aria-label") || ""));
          if (match) {
            match.click();
            return true;
          }
          const generic = Array.from(document.querySelectorAll("div[role=button], span")).find(el => /bạn đang nghĩ gì/i.test(el.innerText || ""));
          if (generic) {
            generic.click();
            return true;
          }
          return false;
        })()
      `;
      const composeRes = await run(["eval", openComposeCode]);
      if (composeRes !== "true") {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook compose post button.",
        };
      }
      await sleep(2000);

      const setPublicCode = `
        (() => {
          const dialogs = Array.from(document.querySelectorAll("[role=dialog]"));
          const mainDialog = dialogs.find(d => /tạo bài viết|create post/i.test(d.innerText || "")) || dialogs[0];
          if (!mainDialog) return "no_dialog";
          const privBtn = Array.from(mainDialog.querySelectorAll("[role=button], button, div[tabindex]")).find(b => {
            const text = (b.getAttribute("aria-label") || "") + " " + (b.innerText || "");
            return /chỉ mình tôi|bạn bè|đối tượng|quyền riêng tư|privacy|audience|only me|friends/i.test(text);
          });
          if (privBtn && !/^(?:công khai|public)$/i.test(privBtn.innerText?.trim() || "")) {
            privBtn.click();
            return "opened";
          }
          return "already_public";
        })()
      `;
      const privRes = await run(["eval", setPublicCode]);
      if (privRes === '"opened"') {
        await sleep(1500);
        const pickPublicCode = `
          (() => {
            const candidates = Array.from(document.querySelectorAll("[role=dialog] [role=radio], [role=dialog] div[role=button], [role=dialog] label, [role=dialog] span"));
            const pubElement = candidates.find(el => {
              const text = (el.innerText || "") + " " + (el.getAttribute("aria-label") || "");
              return /^(?:công khai|public)$/i.test((el.innerText || "").trim()) ||
                     (/(?:bất kỳ ai ở trên hoặc ngoài facebook|anyone on or off facebook)/i.test(text) && /công khai|public/i.test(text));
            });
            if (pubElement) {
              const clickTarget = pubElement.closest("[role=radio], div[role=button], label") || pubElement;
              clickTarget.click();
            }
            return true;
          })()
        `;
        await run(["eval", pickPublicCode]);
        await sleep(1000);

        const confirmPublicCode = `
          (() => {
            const buttons = Array.from(document.querySelectorAll("[role=dialog] [role=button], [role=dialog] button, [role=dialog] span"));
            const doneBtn = buttons.find(el => {
              const t = (el.innerText || el.getAttribute("aria-label") || "").trim();
              return /^(?:lưu|xong|save|done|tiếp tục|xác nhận)$/i.test(t);
            });
            if (doneBtn) {
              const target = doneBtn.closest("[role=button], button") || doneBtn;
              target.click();
              return "confirmed";
            }
            return "no_confirm_needed";
          })()
        `;
        await run(["eval", confirmPublicCode]);
        await sleep(1200);
      }

      const validImages = (payload.images ?? []).filter((p) => existsSync(p));
      if (validImages.length > 0) {
        await run(["upload", "input[type='file']", ...validImages]);
        await sleep(2500);
      }

      const textToInsert = payload.text;
      const fillCode = `
        (() => {
          const dialogs = Array.from(document.querySelectorAll("[role=dialog]"));
          const dialog = dialogs.find(d => /tạo bài viết|create post/i.test(d.innerText || "")) || dialogs[0];
          if (!dialog) return "no_dialog";
          const textbox = dialog.querySelector("[role=textbox], div[contenteditable='true']");
          if (!textbox) return "no_textbox";
          textbox.focus();
          document.execCommand("insertText", false, ${JSON.stringify(textToInsert)});
          return "ok";
        })()
      `;
      const fillRes = await run(["eval", fillCode]);
      if (fillRes !== '"ok"') {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook post input textbox.",
        };
      }
      await sleep(3500);

      const waitForPostReadyCode = `
        (() => {
          const dialogs = Array.from(document.querySelectorAll("[role=dialog]"));
          const dialog = dialogs.find(d => /tạo bài viết|create post/i.test(d.innerText || "")) || dialogs[0];
          const scope = dialog || document;
          const candidates = Array.from(scope.querySelectorAll("[role=button], button, div[role=button], span"));
          const postBtn = candidates.find(b => {
            const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
            return /^đăng$/i.test(t) || /^post$/i.test(t);
          });
          if (!postBtn) return "not_found";
          const target = postBtn.closest("[role=button], button") || postBtn;
          if (target.getAttribute("aria-disabled") === "true") return "disabled";
          return "ready";
        })()
      `;

      for (let i = 0; i < 6; i++) {
        const state = await run(["eval", waitForPostReadyCode]);
        if (state === '"ready"') break;
        await sleep(2000);
      }

      const clickPostCode = `
        (() => {
          const dialogs = Array.from(document.querySelectorAll("[role=dialog]"));
          const dialog = dialogs.find(d => /tạo bài viết|create post/i.test(d.innerText || "")) || dialogs[0];
          const scope = dialog || document;
          const candidates = Array.from(scope.querySelectorAll("[role=button], button, div[role=button], span"));
          const postBtn = candidates.find(b => {
            const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
            return /^đăng$/i.test(t) || /^post$/i.test(t);
          });
          if (postBtn) {
            const target = postBtn.closest("[role=button], button") || postBtn;
            target.scrollIntoView({ block: "center" });
            const evOpts = { bubbles: true, cancelable: true, view: window };
            target.dispatchEvent(new MouseEvent("mousedown", evOpts));
            target.dispatchEvent(new MouseEvent("mouseup", evOpts));
            target.click();
            return "clicked";
          }
          return "not_found";
        })()
      `;
      const clickRes = await run(["eval", clickPostCode]);
      if (clickRes !== '"clicked"') {
        try {
          const snap = await run(["snapshot", "-i"]);
          const postMatch = snap.match(/button "(?:Đăng|Post)" (?:\[.*?\] )?\[ref=([^\]]+)\]/i);
          if (postMatch?.[1]) {
            await run(["click", `@${postMatch[1]}`]);
          }
        } catch {
          await sleep(1000);
          await run(["eval", clickPostCode]);
        }
      }

      await sleep(6000);

      return {
        success: true,
        platform: "facebook",
        postUrl: "https://www.facebook.com/me",
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        platform: "facebook",
        durationMs: Date.now() - start,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      await run(["close"]).catch(() => undefined);
    }
  }

  private async publishWithRunner(
    runner: AgentDesktopRunner,
    payload: SocialPostPayload,
    start: number,
  ): Promise<SocialPostResult> {
    try {
      const fbTab = await runner.findTab(/facebook/i);
      if (!fbTab) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Facebook tab not found in active browser. Please open Facebook in Chrome.",
        };
      }

      try {
        await runner.clickRef(fbTab);
      } catch {
        // Active tab or Wayland compositor
      }

      const composerBtn = await runner.findActionable({
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

      await runner.clickRef(composerBtn);

      const inputArea = await runner.findActionable({
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

      await runner.fastPaste(inputArea, payload.text);

      const postBtn = await runner.findActionable({
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

      await runner.clickRef(postBtn);

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
