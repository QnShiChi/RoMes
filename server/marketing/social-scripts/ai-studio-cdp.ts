import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface CdpTarget {
  id: string;
  title: string;
  type: string;
  url: string;
  webSocketDebuggerUrl?: string;
}

export class AiStudioCdpClient {
  private readonly port: number;
  private readonly profileDir: string;
  private browserProc: ChildProcess | null = null;
  private static queue: Promise<any> = Promise.resolve();

  constructor(port = 9222, profileDir?: string) {
    this.port = port;
    this.profileDir =
      profileDir || join(homedir(), ".openmausbot", "browser", "profiles", "ai-studio");
    mkdirSync(this.profileDir, { recursive: true });
  }

  async isPortOpen(): Promise<boolean> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json/version`, {
        signal: AbortSignal.timeout(1500),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async ensureBrowser(headed = false): Promise<boolean> {
    if (await this.isPortOpen()) return true;

    const chromeBin = "/usr/bin/google-chrome";
    if (!existsSync(chromeBin)) {
      return false;
    }

    const args = [
      `--user-data-dir=${this.profileDir}`,
      `--remote-debugging-port=${this.port}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      "https://aistudio.google.com/prompts/new_chat?model=gemini-nano-banana-2.1",
    ];

    if (!headed && !process.env.DISPLAY) {
      args.unshift("--headless=new");
    }

    this.browserProc = spawn(chromeBin, args, {
      detached: true,
      stdio: "ignore",
    });
    this.browserProc.unref();

    // Wait up to 8 seconds for port to become active
    for (let i = 0; i < 16; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await this.isPortOpen()) return true;
    }

    return false;
  }

  async listTabs(): Promise<CdpTarget[]> {
    try {
      const res = await fetch(`http://127.0.0.1:${this.port}/json/list`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!res.ok) return [];
      return (await res.json()) as CdpTarget[];
    } catch {
      return [];
    }
  }

  async findAiStudioTab(): Promise<CdpTarget | null> {
    if (!(await this.isPortOpen())) {
      await this.ensureBrowser();
    }
    let tabs = await this.listTabs();
    let match = tabs.find(
      (t) =>
        t.type === "page" &&
        (/aistudio\.google\.com/i.test(t.url) || /ai studio/i.test(t.title)),
    );
    if (!match && (await this.isPortOpen())) {
      try {
        await fetch(
          `http://127.0.0.1:${this.port}/json/new?https://aistudio.google.com/prompts/new_chat?model=gemini-nano-banana-2.1`,
          { method: "PUT" },
        );
        await new Promise((r) => setTimeout(r, 2500));
        tabs = await this.listTabs();
        match = tabs.find(
          (t) =>
            t.type === "page" &&
            (/aistudio\.google\.com/i.test(t.url) || /ai studio/i.test(t.title)),
        );
      } catch {}
    }
    return match || null;
  }

  async executeInTab(targetWsUrl: string, expression: string, timeoutMs = 15_000): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(targetWsUrl);
      const timer = setTimeout(() => {
        try {
          ws.close();
        } catch {}
        reject(new Error("CDP evaluate timed out"));
      }, timeoutMs);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            id: 1,
            method: "Runtime.evaluate",
            params: {
              expression,
              returnByValue: true,
              awaitPromise: true,
            },
          }),
        );
      };

      ws.onmessage = (event) => {
        clearTimeout(timer);
        try {
          const data = JSON.parse(String(event.data));
          ws.close();
          if (data.error) {
            reject(new Error(data.error.message || "CDP error"));
          } else {
            resolve(data.result?.result?.value);
          }
        } catch (err) {
          reject(err);
        }
      };

      ws.onerror = (err) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  }

  normalizeAspectRatio(ratio?: string): "9:16" | "16:9" | "1:1" | "3:4" | "4:3" {
    const raw = (ratio || "").trim().toLowerCase();
    if (
      raw === "9:16" ||
      raw.includes("9:16") ||
      raw.includes("vertical") ||
      raw.includes("story") ||
      raw.includes("reels") ||
      raw.includes("tiktok") ||
      raw.includes("portrait")
    ) {
      return "9:16";
    }
    if (
      raw === "16:9" ||
      raw.includes("16:9") ||
      raw.includes("horizontal") ||
      raw.includes("landscape") ||
      raw.includes("youtube")
    ) {
      return "16:9";
    }
    if (raw === "1:1" || raw.includes("1:1") || raw.includes("square")) {
      return "1:1";
    }
    if (raw === "3:4" || raw.includes("3:4")) {
      return "3:4";
    }
    if (raw === "4:3" || raw.includes("4:3")) {
      return "4:3";
    }
    return "9:16";
  }

  async setAspectRatio(targetWsUrl: string, ratio = "9:16"): Promise<boolean> {
    const normalized = this.normalizeAspectRatio(ratio);
    const escaped = JSON.stringify(normalized);
    try {
      const res = await this.executeInTab(
        targetWsUrl,
        `
        (async function() {
          const target = ${escaped};
          let select = document.querySelector("mat-select[aria-label*='Aspect' i], mat-select[aria-label*='aspect' i]");
          if (!select) {
            const settingsBtn = Array.from(document.querySelectorAll("button")).find(b => {
              const label = (b.getAttribute("aria-label") || "").toLowerCase();
              const text = (b.innerText || "").toLowerCase();
              return label.includes("setting") || text.includes("settings");
            });
            if (settingsBtn) {
              settingsBtn.click();
              await new Promise(r => setTimeout(r, 600));
            }
            select = document.querySelector("mat-select[aria-label*='Aspect' i], mat-select[aria-label*='aspect' i]");
          }
          if (!select) return false;

          const currentText = (select.innerText || "").trim();
          if (currentText.toLowerCase() === target.toLowerCase()) return true;

          select.click();
          await new Promise(r => setTimeout(r, 400));

          const options = Array.from(document.querySelectorAll("mat-option, [role='option']"));
          const targetOption = options.find(opt => (opt.innerText || "").trim().toLowerCase() === target.toLowerCase());
          if (!targetOption) {
            document.body.click();
            return false;
          }

          targetOption.click();
          await new Promise(r => setTimeout(r, 300));
          return true;
        })()
        `,
        10_000,
      );
      return Boolean(res);
    } catch {
      return false;
    }
  }

  async generateImage(
    prompt: string,
    timeoutMs = 60_000,
    targetAspectRatio = "9:16",
  ): Promise<{ buffer: Buffer; url: string } | null> {
    return (AiStudioCdpClient.queue = AiStudioCdpClient.queue.then(
      () => this.runGenerateImage(prompt, timeoutMs, targetAspectRatio),
      () => this.runGenerateImage(prompt, timeoutMs, targetAspectRatio),
    ));
  }

  private async runGenerateImage(
    prompt: string,
    timeoutMs = 60_000,
    targetAspectRatio = "9:16",
  ): Promise<{ buffer: Buffer; url: string } | null> {
    const tab = await this.findAiStudioTab();
    if (!tab?.webSocketDebuggerUrl) return null;

    // 1. Ensure tab is actively on gemini-nano-banana-2.1
    const modelState = await this.executeInTab(
      tab.webSocketDebuggerUrl,
      `
      (function() {
        const url = location.href;
        const card = document.querySelector(".model-selector-card, .model-selector-btn, [data-test-id*='model']")?.innerText || "";
        const isBanana = url.includes("model=gemini-nano-banana-2.1") || card.includes("Banana") || card.includes("nano-banana");
        if (!isBanana) {
          location.href = "https://aistudio.google.com/prompts/new_chat?model=gemini-nano-banana-2.1";
          return "navigating";
        }
        return "ready";
      })()
      `,
    ).catch(() => null);

    if (modelState === "navigating") {
      await new Promise((r) => setTimeout(r, 4000));
    }

    // Wait up to 15 seconds for textarea to be ready
    let textareaReady = false;
    for (let i = 0; i < 15; i++) {
      textareaReady = Boolean(
        await this.executeInTab(
          tab.webSocketDebuggerUrl,
          `Boolean(document.querySelector("textarea.cdk-textarea-autosize, textarea, [contenteditable=true]"))`,
        ).catch(() => false),
      );
      if (textareaReady) {
        await new Promise((r) => setTimeout(r, 1000));
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 2. Select target Aspect Ratio (e.g. 9:16 for vertical video) before prompt run
    await this.setAspectRatio(tab.webSocketDebuggerUrl, targetAspectRatio);

    // Snapshot existing images on the page before submitting
    const existingSrcs: string[] = await this.executeInTab(
      tab.webSocketDebuggerUrl,
      `
      (function() {
        return Array.from(document.querySelectorAll("img.loaded-image, img"))
          .map(i => i.src)
          .filter(src => src && (src.startsWith("blob:") || src.startsWith("data:image/")));
      })()
      `,
    ).catch(() => []);

    const escaped = JSON.stringify(prompt);
    // 2. Enter prompt and click Run
    const submitted = await this.executeInTab(
      tab.webSocketDebuggerUrl,
      `
      (function() {
        const textarea = document.querySelector("textarea.cdk-textarea-autosize, textarea, [contenteditable=true]");
        if (!textarea) return false;
        textarea.focus();
        if (textarea.tagName === "TEXTAREA") {
          textarea.value = ${escaped};
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          textarea.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          textarea.innerText = ${escaped};
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
        }
        setTimeout(() => {
          const runBtn = document.querySelector(".run-button-label")?.closest("button") ||
            Array.from(document.querySelectorAll("button")).find(b => {
              const t = (b.innerText || "").trim().toLowerCase();
              return t.startsWith("run") || b.classList.contains("ms-button-primary");
            });
          if (runBtn) {
            runBtn.click();
          } else {
            textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
          }
        }, 250);
        return true;
      })()
      `,
    ).catch((err) => {
      if (err?.message?.includes("Promise was collected")) return true;
      return false;
    });

    if (!submitted) return null;

    // 3. Poll until model finishes and a new image appears
    const start = Date.now();
    const existingSetJson = JSON.stringify(existingSrcs || []);
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollResult = await this.executeInTab(
        tab.webSocketDebuggerUrl,
        `
        (async function() {
          const errorElem = document.querySelector(".error, .banner-error, .mat-error, [data-test-id*='error']");
          const errorText = (errorElem ? errorElem.innerText : "").toLowerCase();
          if (errorText.includes("safety") || errorText.includes("blocked") || errorText.includes("violation")) {
            return { error: "SafetyFilterBlocked: " + errorText };
          }
          const existing = new Set(${existingSetJson});
          const isBusy = !!document.querySelector(".in-progress, .thinking-progress-icon.in-progress") ||
            Array.from(document.querySelectorAll("button")).some(b => (b.innerText || "").toLowerCase().includes("stop"));
          const imgs = Array.from(document.querySelectorAll("img.loaded-image, img")).filter(img => {
            const src = img.src || "";
            return (src.startsWith("blob:") || src.startsWith("data:image/") || src.includes("generativelanguage")) &&
              !src.includes("watermark") &&
              !src.includes("avatar") &&
              !existing.has(src);
          });
          if (imgs.length === 0 || isBusy) return null;
          const latestImg = imgs[imgs.length - 1];
          const src = latestImg.src;
          if (src.startsWith("data:image/")) {
            return src;
          }
          if (src.startsWith("blob:")) {
            try {
              const res = await fetch(src);
              const blob = await res.blob();
              return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
              });
            } catch {
              return null;
            }
          }
          return null;
        })()
        `,
      );

      if (pollResult && typeof pollResult === "object" && pollResult.error) {
        // Safety blocked: return null to allow prompt refinement / next step
        return null;
      }

      if (typeof pollResult === "string" && pollResult.startsWith("data:image/")) {
        const commaIdx = pollResult.indexOf(",");
        if (commaIdx > -1) {
          const b64 = pollResult.slice(commaIdx + 1);

          // Reset tab state to fresh Nano Banana 2.1 chat for the subsequent beat
          this.executeInTab(
            tab.webSocketDebuggerUrl,
            `location.href = "https://aistudio.google.com/prompts/new_chat?model=gemini-nano-banana-2.1"`,
          ).catch(() => {});

          return {
            buffer: Buffer.from(b64, "base64"),
            url: `data:image/jpeg;base64,${b64.slice(0, 32)}...`,
          };
        }
      }
    }

    return null;
  }
}
