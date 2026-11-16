import { execFile, execFileSync } from "node:child_process";
import { existsSync, readdirSync, readlinkSync, statSync, unlinkSync } from "node:fs";
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

export function formatForFacebook(text: string): string {
  if (!text) return "";
  return text
    // Replace markdown bullet points (* item or - item) with clean unicode bullets
    .replace(/^[\*\-]\s+/gm, "• ")
    // Remove markdown bold / italic syntax (**bold**, ***bold-italic***, *italic*)
    .replace(/\*{1,3}([^\*\n]+)\*{1,3}/g, "$1")
    // Remove standalone decorative asterisks
    .replace(/(^|\s)\*{1,3}(\s|$)/gm, "$1$2")
    // Remove markdown headers: #, ##, ###
    .replace(/^#{1,6}\s+/gm, "")
    // Normalize CRLF to LF
    .replace(/\r\n/g, "\n");
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
    const isReel = Boolean(
      payload.videoPath ||
      payload.images?.some((p) => /\.(mp4|mov|webm)$/i.test(p)),
    );

    if (isReel) {
      if (this.runner) {
        return this.publishReelWithRunner(this.runner, payload, start);
      }
      const bin = resolveAgentBrowserBinary();
      const profile = resolveActiveProfile();
      if (bin && profile) {
        return this.publishReelWithBrowser(bin, profile, payload, start);
      }
      const fallbackRunner = new AgentDesktopRunner();
      return this.publishReelWithRunner(fallbackRunner, payload, start);
    }

    if (this.runner) {
      return this.publishPostWithRunner(this.runner, payload, start);
    }
    const bin = resolveAgentBrowserBinary();
    const profile = resolveActiveProfile();
    if (bin && profile) {
      return this.publishPostWithBrowser(bin, profile, payload, start);
    }
    const fallbackRunner = new AgentDesktopRunner();
    return this.publishPostWithRunner(fallbackRunner, payload, start);
  }

  private async publishPostWithBrowser(
    binary: string,
    profile: string,
    payload: SocialPostPayload,
    start: number,
  ): Promise<SocialPostResult> {
    let session = `omb-fb-${Date.now()}`;
    let useExistingSession = false;
    try {
      const { stdout: sessionListOut } = await execFileAsync(binary, ["session", "list"], { timeout: 5000 });
      const matched = sessionListOut.match(/(?:bot-[a-zA-Z0-9_-]+)/);
      if (matched && matched[0]) {
        session = matched[0];
        useExistingSession = true;
      }
    } catch {
      // fallback
    }

    const lockFile = join(profile, "SingletonLock");
    if (existsSync(lockFile)) {
      try {
        const linkTarget = readlinkSync(lockFile);
        const matchPid = linkTarget.match(/-(\d+)$/);
        const pid = matchPid ? parseInt(matchPid[1], 10) : null;
        let isAlive = false;
        if (pid) {
          try {
            process.kill(pid, 0);
            isAlive = true;
          } catch {
            isAlive = false;
          }
        }
        if (isAlive) {
          useExistingSession = true;
          if (!session.startsWith("bot-")) {
            session = "bot-ec4a2649-95fe-4c4f-8eda-b63a64251b03";
          }
        } else {
          try { unlinkSync(lockFile); } catch {}
          try { const c = join(profile, "SingletonCookie"); if (existsSync(c)) unlinkSync(c); } catch {}
          try { const s = join(profile, "SingletonSocket"); if (existsSync(s)) unlinkSync(s); } catch {}
        }
      } catch {
        // ignore
      }
    }
    const run = async (args: string[]) => {
      const fullArgs = useExistingSession
        ? ["--session", session, ...args]
        : [
            "--session", session,
            "--profile", profile,
            "--args", "--no-sandbox,--ignore-gpu-blocklist,--enable-gpu-rasterization,--enable-zero-copy",
            ...args,
          ];
      const launcherPath = join(homedir(), ".openmausbot", "browser", "chrome-launcher.sh");
      const env = {
        ...process.env,
        ...(existsSync(launcherPath) ? { AGENT_BROWSER_EXECUTABLE_PATH: launcherPath } : {}),
      };
      const { stdout, stderr } = await execFileAsync(binary, fullArgs, { timeout: 35_000, env });
      const raw = (stdout || stderr).trim();
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => !l.startsWith("[agent-browser]"));
      return lines.pop() ?? raw;
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await run(["open", "https://www.facebook.com/"]);
      await sleep(2000);

      let composeOpened = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        const checkOpenCode = `
          (() => {
            const dialog = document.querySelector("[role=dialog]");
            if (dialog && dialog.querySelector("[role=textbox], div[contenteditable='true']")) {
              return "dialog_ready";
            }
            const btns = Array.from(document.querySelectorAll("div[role=region] div[role=button], div[role=region] button, [aria-label*='Tạo bài viết'] [role=button], div[role=button], button, span"));
            const match = btns.find(b => /bạn đang nghĩ gì|what's on your mind/i.test((b.getAttribute("aria-label") || "") + " " + (b.innerText || "")));
            if (match) {
              const target = match.closest("[role=button], button") || match;
              target.click();
              return "clicked";
            }
            return "not_found";
          })()
        `;
        const res = await run(["eval", checkOpenCode]);
        if (res === '"dialog_ready"') {
          composeOpened = true;
          break;
        }
        if (res === '"clicked"') {
          await sleep(1500);
          composeOpened = true;
          break;
        }
        await sleep(1000);
      }

      if (!composeOpened) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook compose post button.",
        };
      }
      await sleep(1000);

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

      const textToInsert = formatForFacebook(payload.text);
      const fillCode = `
        (() => {
          const dialogs = Array.from(document.querySelectorAll("[role=dialog]"));
          const dialog = dialogs.find(d => /tạo bài viết|create post/i.test(d.innerText || "")) || dialogs[0];
          if (!dialog) return "no_dialog";
          const textbox = dialog.querySelector("[role=textbox], div[contenteditable='true']");
          if (!textbox) return "no_textbox";
          textbox.focus();

          const text = ${JSON.stringify(textToInsert)};
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          const pasteEvent = new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          });
          textbox.dispatchEvent(pasteEvent);
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
      await sleep(1000);

      const validImages = (payload.images ?? []).filter((p) => existsSync(p));
      if (validImages.length > 0) {
        // Ensure all images are PNG or JPEG (convert .webp on the fly for Facebook upload compatibility)
        const uploadableImages: string[] = [];
        for (const img of validImages) {
          if (/\.webp$/i.test(img)) {
            const pngPath = img.replace(/\.webp$/i, ".png");
            if (!existsSync(pngPath)) {
              try {
                execFileSync("ffmpeg", ["-y", "-i", img, "-frames:v", "1", pngPath], { stdio: "pipe", timeout: 5000 });
              } catch {}
            }
            uploadableImages.push(existsSync(pngPath) ? pngPath : img);
          } else {
            uploadableImages.push(img);
          }
        }

        const setupUploadInputCode = `
          (() => {
            const dialogs = Array.from(document.querySelectorAll("[role=dialog]"));
            const dialog = dialogs.find(d => /tạo bài viết|create post/i.test(d.innerText || "")) || dialogs[0];
            if (!dialog) return false;
            const fileInput = dialog.querySelector("input[type='file']");
            if (fileInput) {
              fileInput.id = "omb-fb-file-upload";
              return true;
            }
            return false;
          })()
        `;
        const setupRes = await run(["eval", setupUploadInputCode]);
        if (setupRes === "true") {
          await run(["upload", "#omb-fb-file-upload", ...uploadableImages]);
          await sleep(4000);
        }
      }

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

      for (let i = 0; i < 35; i++) {
        const state = await run(["eval", waitForPostReadyCode]);
        if (state === '"ready"') break;
        await sleep(1000);
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

      // Wait for dialog to close indicating post submission completed
      for (let i = 0; i < 15; i++) {
        const isClosed = await run(["eval", "Boolean(!document.querySelector('[role=dialog]'))"]);
        if (isClosed === "true") break;
        await sleep(1000);
      }

      await sleep(3000);

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
      if (!useExistingSession) {
        await run(["close"]).catch(() => undefined);
      }
    }
  }

  private async publishPostWithRunner(
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

      await runner.fastPaste(inputArea, formatForFacebook(payload.text));

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

  private async publishReelWithBrowser(
    binary: string,
    profile: string,
    payload: SocialPostPayload,
    start: number,
  ): Promise<SocialPostResult> {
    const videoFile =
      payload.videoPath ||
      payload.images?.find((p) => /\.(mp4|mov|webm)$/i.test(p));

    if (!videoFile || !existsSync(videoFile)) {
      return {
        success: false,
        platform: "facebook",
        durationMs: Date.now() - start,
        error: `Video file not found on disk for Facebook Reel upload: ${videoFile}`,
      };
    }

    let session = `omb-fb-${Date.now()}`;
    let useExistingSession = false;
    try {
      const { stdout: sessionListOut } = await execFileAsync(binary, ["session", "list"], { timeout: 5000 });
      const matched = sessionListOut.match(/(?:bot-[a-zA-Z0-9_-]+)/);
      if (matched && matched[0]) {
        session = matched[0];
        useExistingSession = true;
      }
    } catch {
      // fallback
    }

    const lockFile = join(profile, "SingletonLock");
    if (existsSync(lockFile)) {
      try {
        const linkTarget = readlinkSync(lockFile);
        const matchPid = linkTarget.match(/-(\d+)$/);
        const pid = matchPid ? parseInt(matchPid[1], 10) : null;
        let isAlive = false;
        if (pid) {
          try {
            process.kill(pid, 0);
            isAlive = true;
          } catch {
            isAlive = false;
          }
        }
        if (isAlive) {
          useExistingSession = true;
          if (!session.startsWith("bot-")) {
            session = "bot-ec4a2649-95fe-4c4f-8eda-b63a64251b03";
          }
        } else {
          try { unlinkSync(lockFile); } catch {}
          try { const c = join(profile, "SingletonCookie"); if (existsSync(c)) unlinkSync(c); } catch {}
          try { const s = join(profile, "SingletonSocket"); if (existsSync(s)) unlinkSync(s); } catch {}
        }
      } catch {
        // ignore
      }
    }

    const run = async (args: string[]) => {
      const fullArgs = useExistingSession
        ? ["--session", session, ...args]
        : [
            "--session", session,
            "--profile", profile,
            "--args", "--no-sandbox,--ignore-gpu-blocklist,--enable-gpu-rasterization,--enable-zero-copy",
            ...args,
          ];
      const launcherPath = join(homedir(), ".openmausbot", "browser", "chrome-launcher.sh");
      const env = {
        ...process.env,
        ...(existsSync(launcherPath) ? { AGENT_BROWSER_EXECUTABLE_PATH: launcherPath } : {}),
      };
      const { stdout, stderr } = await execFileAsync(binary, fullArgs, { timeout: 35_000, env });
      const raw = (stdout || stderr).trim();
      const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => !l.startsWith("[agent-browser]"));
      return lines.pop() ?? raw;
    };

    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    try {
      await run(["open", "https://www.facebook.com/"]);
      await sleep(2500);

      // Step 1: Open Reel creation modal
      let reelModalOpened = false;
      for (let attempt = 0; attempt < 8; attempt++) {
        const checkModalCode = `
          (() => {
            const headings = Array.from(document.querySelectorAll("h1, h2, [role=heading]"));
            if (headings.some(h => /tạo thước phim|create reel/i.test(h.innerText || ""))) {
              return "modal_ready";
            }
            return "not_ready";
          })()
        `;
        const state = await run(["eval", checkModalCode]);
        if (state === '"modal_ready"') {
          reelModalOpened = true;
          break;
        }

        // Open Facebook global menu button
        const openMenuCode = `
          (() => {
            const menuBtn = Array.from(document.querySelectorAll("div[role=navigation] [role=button], [role=button], button")).find(b => {
              const text = (b.getAttribute("aria-label") || "") + " " + (b.innerText || "");
              return /menu trên facebook|facebook menu/i.test(text);
            });
            if (menuBtn) {
              menuBtn.click();
              return "clicked";
            }
            return "not_found";
          })()
        `;
        await run(["eval", openMenuCode]);
        await sleep(1500);

        // Click "Thước phim" / "Reels" in the menu
        const clickReelBtnCode = `
          (() => {
            const buttons = Array.from(document.querySelectorAll("div[role=dialog] [role=button], div[role=dialog] button, button, div[role=button]"));
            const reelBtn = buttons.find(b => {
              const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
              return /^(?:thước phim|reels?)$/i.test(t);
            });
            if (reelBtn) {
              reelBtn.click();
              return "clicked";
            }
            return "not_found";
          })()
        `;
        const reelRes = await run(["eval", clickReelBtnCode]);
        if (reelRes === '"clicked"') {
          await sleep(2000);
          reelModalOpened = true;
          break;
        }
        await sleep(1000);
      }

      if (!reelModalOpened) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not open Facebook Reel creation modal.",
        };
      }
      await sleep(1000);

      // Step 2: Set ID on Reel file input and upload video
      const setupReelInputCode = `
        (() => {
          const inputs = Array.from(document.querySelectorAll("input[type=file]"));
          const reelInput = inputs.find(i => {
            const parentText = (i.parentElement?.innerText || "") + " " + (i.closest("div")?.innerText || "");
            const accept = (i.getAttribute("accept") || "").toLowerCase();
            return (accept.includes("video") || accept.includes("mp4")) && /thêm video|tải video|tải lên/i.test(parentText);
          }) || inputs.find(i => (i.getAttribute("accept") || "").includes("video"));

          if (reelInput) {
            reelInput.id = "omb-fb-reel-file-upload";
            return true;
          }
          return false;
        })()
      `;
      const setupInputRes = await run(["eval", setupReelInputCode]);
      if (setupInputRes !== "true") {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not locate Facebook Reel video upload input element.",
        };
      }

      await run(["upload", "#omb-fb-reel-file-upload", videoFile]);
      await sleep(4000);

      // Step 3: Click first "Tiếp" (Next) button
      let firstNextClicked = false;
      for (let i = 0; i < 25; i++) {
        const clickNextCode = `
          (() => {
            const buttons = Array.from(document.querySelectorAll("[role=dialog] [role=button], [role=dialog] button, button, div[role=button]"));
            const nextBtn = buttons.find(b => {
              const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
              return /^(?:tiếp|next)$/i.test(t);
            });
            if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true" && !nextBtn.disabled) {
              nextBtn.click();
              return "clicked";
            }
            return "waiting";
          })()
        `;
        const nextRes = await run(["eval", clickNextCode]);
        if (nextRes === '"clicked"') {
          firstNextClicked = true;
          break;
        }
        await sleep(1000);
      }

      if (!firstNextClicked) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Timed out waiting for Reel video to process and enable 'Tiếp' button.",
        };
      }
      await sleep(2000);

      // Step 4: Click second "Tiếp" (Next) button (from edit video to reel settings)
      for (let i = 0; i < 15; i++) {
        const clickSecondNextCode = `
          (() => {
            const buttons = Array.from(document.querySelectorAll("[role=dialog] [role=button], [role=dialog] button, button, div[role=button]"));
            const nextBtn = buttons.find(b => {
              const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
              return /^(?:tiếp|next)$/i.test(t);
            });
            if (nextBtn && nextBtn.getAttribute("aria-disabled") !== "true" && !nextBtn.disabled) {
              nextBtn.click();
              return "clicked";
            }
            return "waiting";
          })()
        `;
        const nextRes = await run(["eval", clickSecondNextCode]);
        if (nextRes === '"clicked"') {
          break;
        }
        await sleep(1000);
      }
      await sleep(2000);

      // Step 5: Fill Caption / Description
      const textToInsert = formatForFacebook(payload.text);
      const fillDescriptionCode = `
        (() => {
          const textbox = document.querySelector("[role=textbox], div[contenteditable='true'], textarea");
          if (!textbox) return "no_textbox";
          textbox.focus();
          const text = ${JSON.stringify(textToInsert)};
          const dt = new DataTransfer();
          dt.setData("text/plain", text);
          const pasteEvent = new ClipboardEvent("paste", {
            clipboardData: dt,
            bubbles: true,
            cancelable: true,
          });
          textbox.dispatchEvent(pasteEvent);
          return "ok";
        })()
      `;
      await run(["eval", fillDescriptionCode]);
      await sleep(1500);

      // Step 6: Set Privacy to Public if needed
      const setPublicCode = `
        (() => {
          const buttons = Array.from(document.querySelectorAll("[role=dialog] [role=button], [role=dialog] button, div[role=button]"));
          const privBtn = buttons.find(b => {
            const text = (b.getAttribute("aria-label") || "") + " " + (b.innerText || "");
            return /chỉ mình tôi|bạn bè|đối tượng|quyền riêng tư|privacy|audience|only me|friends/i.test(text);
          });
          if (privBtn && !/công khai|public/i.test(privBtn.innerText?.trim() || "")) {
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

      // Step 7: Click "Đăng" (Post Reel)
      let reelPublished = false;
      for (let i = 0; i < 30; i++) {
        const clickPublishReelCode = `
          (() => {
            const buttons = Array.from(document.querySelectorAll("[role=dialog] [role=button], [role=dialog] button, button, div[role=button]"));
            const postBtn = buttons.find(b => {
              const t = (b.innerText || b.getAttribute("aria-label") || "").trim();
              return /^(?:đăng|post|chia sẻ|share)$/i.test(t);
            });
            if (postBtn && postBtn.getAttribute("aria-disabled") !== "true" && !postBtn.disabled) {
              postBtn.scrollIntoView({ block: "center" });
              const evOpts = { bubbles: true, cancelable: true, view: window };
              postBtn.dispatchEvent(new MouseEvent("mousedown", evOpts));
              postBtn.dispatchEvent(new MouseEvent("mouseup", evOpts));
              postBtn.click();
              return "clicked";
            }
            return "waiting";
          })()
        `;
        const pubRes = await run(["eval", clickPublishReelCode]);
        if (pubRes === '"clicked"') {
          reelPublished = true;
          break;
        }
        await sleep(1000);
      }

      if (!reelPublished) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not click Facebook submit 'Đăng' button for Reel.",
        };
      }

      // Wait for modal to close indicating Reel submission succeeded
      for (let i = 0; i < 20; i++) {
        const isClosed = await run(["eval", "Boolean(!document.querySelector('[role=dialog]'))"]);
        if (isClosed === "true") break;
        await sleep(1000);
      }

      await sleep(3000);

      return {
        success: true,
        platform: "facebook",
        postUrl: "https://www.facebook.com/reel",
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
      if (!useExistingSession) {
        await run(["close"]).catch(() => undefined);
      }
    }
  }

  private async publishReelWithRunner(
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

      // 1. Open Menu on Facebook
      const menuBtn = await runner.findActionable({
        role: "button",
        namePattern: /(menu trên facebook|facebook menu|menu)/i,
      });
      if (menuBtn) {
        await runner.clickRef(menuBtn);
      }

      // 2. Click "Thước phim" (Reel)
      const reelBtn = await runner.findActionable({
        role: "button",
        namePattern: /^(thước phim|reels?)$/i,
      });
      if (!reelBtn) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook Reel creation button.",
        };
      }
      await runner.clickRef(reelBtn);

      // 3. Step 1: Click "Tiếp" (Next)
      const nextBtn1 = await runner.findActionable({
        role: "button",
        namePattern: /^(tiếp|next)$/i,
      });
      if (nextBtn1) {
        await runner.clickRef(nextBtn1);
      }

      // 4. Step 2: Click "Tiếp" (Next)
      const nextBtn2 = await runner.findActionable({
        role: "button",
        namePattern: /^(tiếp|next)$/i,
      });
      if (nextBtn2) {
        await runner.clickRef(nextBtn2);
      }

      // 5. Fill Reel caption / description
      const inputArea = await runner.findActionable({
        role: "textbox",
      });
      if (inputArea) {
        await runner.fastPaste(inputArea, formatForFacebook(payload.text));
      }

      // 6. Submit "Đăng" / "Chia sẻ"
      const postBtn = await runner.findActionable({
        role: "button",
        namePattern: /^(đăng|post|chia sẻ|share)$/i,
      });
      if (!postBtn) {
        return {
          success: false,
          platform: "facebook",
          durationMs: Date.now() - start,
          error: "Could not find Facebook submit 'Đăng' button for Reel.",
        };
      }

      await runner.clickRef(postBtn);

      return {
        success: true,
        platform: "facebook",
        postUrl: "https://www.facebook.com/reel",
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
