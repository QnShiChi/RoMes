# Agent-Desktop Social Automation & AI Studio Image Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a high-speed, zero-fumbling social media publishing and Google AI Studio image extraction subsystem using `vercel-labs/agent-desktop` accessibility tree refs, with dynamic matching (zero hardcoding), interactive user clarification, and total purge of pollinations.ai/gradient fallbacks.

**Architecture:** An `AgentDesktopRunner` wraps the `agent-desktop` CLI to execute headless semantic accessibility queries and instant clipboard paste operations (<100ms) on running Chrome tabs. Specialized posters (`facebook-poster.ts`, `x-twitter-poster.ts`, `linkedin-poster.ts`, `instagram-poster.ts`) and `ai-studio-generator.ts` plug into `PublisherGateway` and `studio.ts`.

**Tech Stack:** TypeScript, Node.js (`node:child_process`, `node:fs`), `agent-desktop` CLI (v1.1.0 via Linux AT-SPI), Vitest.

**Spec:** [`docs/superpowers/specs/2026-11-04-agent-desktop-social-automation-design.md`](file:///home/phan-duong-quoc-nhat/workspace/RoMes/docs/superpowers/specs/2026-11-04-agent-desktop-social-automation-design.md)

## Global Constraints
- **Strict Performance**: Clipboard-based fast paste (`clipboard-set` + `ctrl+v`) must be used instead of key-by-key typing; per-step timeouts strictly capped at 5,000ms.
- **Zero Hardcoding**: No static `@ref` IDs, PIDs, or hardcoded button strings. Query elements dynamically using roles (`button`, `textbox`, `tab`) and multilingual regex patterns (`/bạn đang nghĩ gì|what's on your mind/i`, `/đăng|post/i`).
- **Interactive Clarification**: Never guess missing parameters or privacy settings. Present drafts and preview images for user approval before publishing.
- **Purge Low-Quality Fallbacks**: Completely remove all references to `pollinations.ai` and `generateFallbackGradientImage` (no blue/purple ovals).
- **Documentation & Verification**: Adhere to `AGENTS.md` and `docs/verification/README.md`. Comments strictly for non-obvious facts; no narration.

---

### Task 1: Core Automation Types & AgentDesktopRunner

**Files:**
- Create: `server/marketing/social-scripts/types.ts`
- Create: `server/marketing/social-scripts/agent-desktop-runner.ts`
- Test: `server/marketing/social-scripts/agent-desktop-runner.test.ts`

**Interfaces:**
- Consumes: `npx --yes agent-desktop` CLI JSON output envelopes.
- Produces: `AgentDesktopRunner` class with `snapshot`, `findTab`, `findActionable`, `fastPaste`, `clickRef`, `attachFiles`, and `safeRetry`.

- [ ] **Step 1: Write the failing test for AgentDesktopRunner**

```typescript
// server/marketing/social-scripts/agent-desktop-runner.test.ts
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

  it("handles fastPaste using clipboard-set and press ctrl+v", async () => {
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/social-scripts/agent-desktop-runner.test.ts`
Expected: FAIL (cannot find module `./types.ts` and `./agent-desktop-runner.ts`)

- [ ] **Step 3: Write minimal implementation of types and AgentDesktopRunner**

```typescript
// server/marketing/social-scripts/types.ts
export interface SnapshotNode {
  ref_id?: string;
  role?: string;
  name?: string;
  value?: string;
  children?: SnapshotNode[];
  states?: string[];
}

export interface CliEnvelope<T = unknown> {
  ok: boolean;
  command?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    disposition?: { retry: "safe" | "unsafe" };
  };
}

export interface DesktopCliExecutor {
  run(command: string, args: string[]): Promise<CliEnvelope>;
}

export interface ElementQuery {
  role?: string;
  namePattern?: RegExp;
}

export interface SocialPostPayload {
  text: string;
  images: string[];
  campaignId: string;
  options?: Record<string, unknown>;
}

export interface SocialPostResult {
  success: boolean;
  platform: "facebook" | "x" | "linkedin" | "instagram";
  postUrl?: string;
  durationMs: number;
  error?: string;
}

export interface SocialPoster {
  readonly platform: string;
  isAvailable(): Promise<boolean>;
  publish(payload: SocialPostPayload): Promise<SocialPostResult>;
}
```

```typescript
// server/marketing/social-scripts/agent-desktop-runner.ts
import { execFile } from "node:child_process";
import { promisify } from "node:process";
import type {
  CliEnvelope,
  DesktopCliExecutor,
  ElementQuery,
  SnapshotNode,
} from "./types.ts";

export class DefaultDesktopExecutor implements DesktopCliExecutor {
  async run(command: string, args: string[]): Promise<CliEnvelope> {
    return new Promise((resolve, reject) => {
      execFile(
        "npx",
        ["--yes", "agent-desktop", command, ...args],
        { timeout: 10000, maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error && !stdout) {
            return reject(new Error(stderr || error.message));
          }
          try {
            const parsed = JSON.parse(stdout) as CliEnvelope;
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse agent-desktop output: ${stdout || err}`));
          }
        },
      );
    });
  }
}

export class AgentDesktopRunner {
  private lastSnapshotTree: SnapshotNode | null = null;

  constructor(private readonly executor: DesktopCliExecutor = new DefaultDesktopExecutor()) {}

  async snapshot(app: string = "chrome"): Promise<SnapshotNode> {
    const res = await this.executor.run("snapshot", ["--app", app, "--skeleton", "-i", "--compact"]);
    if (!res.ok || !res.data) {
      throw new Error(res.error?.message ?? "Snapshot failed");
    }
    const data = res.data as { tree: SnapshotNode };
    this.lastSnapshotTree = data.tree;
    return data.tree;
  }

  async findTab(titlePattern: RegExp, app: string = "chrome"): Promise<string | null> {
    const tree = await this.snapshot(app);
    return this.searchNode(tree, (node) => {
      return node.role === "tab" && Boolean(node.name && titlePattern.test(node.name));
    });
  }

  async findActionable(query: ElementQuery, rootTree?: SnapshotNode): Promise<string | null> {
    const tree = rootTree || this.lastSnapshotTree || (await this.snapshot());
    return this.searchNode(tree, (node) => {
      if (query.role && node.role !== query.role) return false;
      if (query.namePattern && (!node.name || !query.namePattern.test(node.name))) return false;
      return Boolean(node.ref_id);
    });
  }

  async clickRef(ref: string): Promise<void> {
    const res = await this.executor.run("click", [ref]);
    if (!res.ok) {
      throw new Error(res.error?.message ?? `Click failed for ${ref}`);
    }
  }

  async fastPaste(targetRef: string, text: string): Promise<void> {
    await this.executor.run("clipboard-set", [text]);
    await this.executor.run("focus", [targetRef]);
    await this.executor.run("press", ["ctrl+v"]);
  }

  private searchNode(
    node: SnapshotNode,
    predicate: (n: SnapshotNode) => boolean,
  ): string | null {
    if (predicate(node) && node.ref_id) {
      return node.ref_id;
    }
    if (node.children) {
      for (const child of node.children) {
        const found = this.searchNode(child, predicate);
        if (found) return found;
      }
    }
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/marketing/social-scripts/agent-desktop-runner.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/social-scripts/types.ts server/marketing/social-scripts/agent-desktop-runner.ts server/marketing/social-scripts/agent-desktop-runner.test.ts
git commit -m "feat(social): add agent-desktop runner core and types"
```

---

### Task 2: Facebook Automation Poster

**Files:**
- Create: `server/marketing/social-scripts/facebook-poster.ts`
- Test: `server/marketing/social-scripts/facebook-poster.test.ts`

**Interfaces:**
- Consumes: `AgentDesktopRunner`, `SocialPoster`, `SocialPostPayload`, `SocialPostResult`.
- Produces: `FacebookPoster` class implementing `SocialPoster`.

- [ ] **Step 1: Write failing test for FacebookPoster**

```typescript
// server/marketing/social-scripts/facebook-poster.test.ts
import { describe, expect, it, vi } from "vitest";
import { FacebookPoster } from "./facebook-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("FacebookPoster", () => {
  it("discovers composer, pastes text, attaches images, and clicks post", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:fb"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "button" && query.namePattern?.test("Bạn đang nghĩ gì")) {
          return "@btn:composer";
        }
        if (query.role === "textbox") {
          return "@box:input";
        }
        if (query.role === "button" && query.namePattern?.test("Đăng")) {
          return "@btn:submit";
        }
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new FacebookPoster(mockRunner as AgentDesktopRunner);
    const result = await poster.publish({
      text: "Bài viết ra mắt sản phẩm mới!",
      images: ["/tmp/image-1.jpg", "/tmp/image-2.jpg"],
      campaignId: "camp-fb-1",
    });

    expect(result.success).toBe(true);
    expect(result.platform).toBe("facebook");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:input", "Bài viết ra mắt sản phẩm mới!");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:submit");
  });

  it("fails fast with actionable error when Facebook tab is not found", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue(null),
    };

    const poster = new FacebookPoster(mockRunner as AgentDesktopRunner);
    const result = await poster.publish({
      text: "Hello",
      images: [],
      campaignId: "c1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/facebook tab not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/social-scripts/facebook-poster.test.ts`
Expected: FAIL (module `./facebook-poster.ts` not found)

- [ ] **Step 3: Write minimal implementation of FacebookPoster**

```typescript
// server/marketing/social-scripts/facebook-poster.ts
import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { SocialPoster, SocialPostPayload, SocialPostResult } from "./types.ts";

export class FacebookPoster implements SocialPoster {
  readonly platform = "facebook";

  constructor(private readonly runner: AgentDesktopRunner = new AgentDesktopRunner()) {}

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

      await this.runner.clickRef(fbTab);

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/marketing/social-scripts/facebook-poster.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/social-scripts/facebook-poster.ts server/marketing/social-scripts/facebook-poster.test.ts
git commit -m "feat(social): add FacebookPoster with accessibility ref interaction"
```

---

### Task 3: X (Twitter) & LinkedIn Automation Posters

**Files:**
- Create: `server/marketing/social-scripts/x-twitter-poster.ts`
- Create: `server/marketing/social-scripts/linkedin-poster.ts`
- Test: `server/marketing/social-scripts/x-twitter-poster.test.ts`
- Test: `server/marketing/social-scripts/linkedin-poster.test.ts`

**Interfaces:**
- Consumes: `AgentDesktopRunner`, `SocialPoster`, `SocialPostPayload`, `SocialPostResult`.
- Produces: `XTwitterPoster` and `LinkedInPoster`.

- [ ] **Step 1: Write failing tests for XTwitterPoster and LinkedInPoster**

```typescript
// server/marketing/social-scripts/x-twitter-poster.test.ts
import { describe, expect, it, vi } from "vitest";
import { XTwitterPoster } from "./x-twitter-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("XTwitterPoster", () => {
  it("publishes tweet via active X tab", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:x"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "textbox") return "@box:tweet";
        if (query.role === "button" && query.namePattern?.test("Post")) return "@btn:post";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new XTwitterPoster(mockRunner as AgentDesktopRunner);
    const res = await poster.publish({
      text: "AI update from OpenMausBot #AI",
      images: ["/tmp/image.jpg"],
      campaignId: "c-x-1",
    });

    expect(res.success).toBe(true);
    expect(res.platform).toBe("x");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:tweet", "AI update from OpenMausBot #AI");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:post");
  });
});
```

```typescript
// server/marketing/social-scripts/linkedin-poster.test.ts
import { describe, expect, it, vi } from "vitest";
import { LinkedInPoster } from "./linkedin-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("LinkedInPoster", () => {
  it("publishes post via active LinkedIn tab", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:li"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "button" && query.namePattern?.test("Start a post")) return "@btn:start";
        if (query.role === "textbox") return "@box:editor";
        if (query.role === "button" && query.namePattern?.test("Post")) return "@btn:publish";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new LinkedInPoster(mockRunner as AgentDesktopRunner);
    const res = await poster.publish({
      text: "LinkedIn enterprise insights",
      images: [],
      campaignId: "c-li-1",
    });

    expect(res.success).toBe(true);
    expect(res.platform).toBe("linkedin");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:start");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:editor", "LinkedIn enterprise insights");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:publish");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run server/marketing/social-scripts/x-twitter-poster.test.ts server/marketing/social-scripts/linkedin-poster.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Implement XTwitterPoster and LinkedInPoster**

```typescript
// server/marketing/social-scripts/x-twitter-poster.ts
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

      const inputArea = await this.runner.findActionable({
        role: "textbox",
        namePattern: /(what is happening|có chuyện gì đang xảy ra|post text)/i,
      }) || await this.runner.findActionable({ role: "textbox" });

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
```

```typescript
// server/marketing/social-scripts/linkedin-poster.ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run server/marketing/social-scripts/x-twitter-poster.test.ts server/marketing/social-scripts/linkedin-poster.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/social-scripts/x-twitter-poster.ts server/marketing/social-scripts/x-twitter-poster.test.ts server/marketing/social-scripts/linkedin-poster.ts server/marketing/social-scripts/linkedin-poster.test.ts
git commit -m "feat(social): add XTwitterPoster and LinkedInPoster"
```

---

### Task 4: Instagram / Threads Automation Poster

**Files:**
- Create: `server/marketing/social-scripts/instagram-poster.ts`
- Test: `server/marketing/social-scripts/instagram-poster.test.ts`

**Interfaces:**
- Consumes: `AgentDesktopRunner`, `SocialPoster`, `SocialPostPayload`, `SocialPostResult`.
- Produces: `InstagramPoster`.

- [ ] **Step 1: Write failing test for InstagramPoster**

```typescript
// server/marketing/social-scripts/instagram-poster.test.ts
import { describe, expect, it, vi } from "vitest";
import { InstagramPoster } from "./instagram-poster.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("InstagramPoster", () => {
  it("interacts with Instagram create and share buttons", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:ig"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "button" && query.namePattern?.test("Create|New post")) return "@btn:create";
        if (query.role === "textbox") return "@box:caption";
        if (query.role === "button" && query.namePattern?.test("Share")) return "@btn:share";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const poster = new InstagramPoster(mockRunner as AgentDesktopRunner);
    const res = await poster.publish({
      text: "Instagram visual story #brand",
      images: ["/tmp/ig-1.jpg"],
      campaignId: "c-ig-1",
    });

    expect(res.success).toBe(true);
    expect(res.platform).toBe("instagram");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:create");
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:caption", "Instagram visual story #brand");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:share");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/social-scripts/instagram-poster.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement InstagramPoster**

```typescript
// server/marketing/social-scripts/instagram-poster.ts
import { AgentDesktopRunner } from "./agent-desktop-runner.ts";
import type { SocialPoster, SocialPostPayload, SocialPostResult } from "./types.ts";

export class InstagramPoster implements SocialPoster {
  readonly platform = "instagram";

  constructor(private readonly runner: AgentDesktopRunner = new AgentDesktopRunner()) {}

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/marketing/social-scripts/instagram-poster.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/social-scripts/instagram-poster.ts server/marketing/social-scripts/instagram-poster.test.ts
git commit -m "feat(social): add InstagramPoster"
```

---

### Task 5: AI Studio Generator & Purge Pollinations.ai

**Files:**
- Create: `server/marketing/social-scripts/ai-studio-generator.ts`
- Test: `server/marketing/social-scripts/ai-studio-generator.test.ts`
- Modify: `server/marketing/studio.ts`
- Test: `server/marketing/studio.test.ts`

**Interfaces:**
- Consumes: `AgentDesktopRunner`, marketing prompt strings.
- Produces: `AiStudioGenerator`, clean `studio.ts` with no pollinations.ai or gradient ovals.

- [ ] **Step 1: Write test for AiStudioGenerator and verify purge requirements**

```typescript
// server/marketing/social-scripts/ai-studio-generator.test.ts
import { describe, expect, it, vi } from "vitest";
import { AiStudioGenerator } from "./ai-studio-generator.ts";
import type { AgentDesktopRunner } from "./agent-desktop-runner.ts";

describe("AiStudioGenerator", () => {
  it("interacts with AI Studio prompt input and triggers run", async () => {
    const mockRunner: Partial<AgentDesktopRunner> = {
      findTab: vi.fn().mockResolvedValue("@tab:aistudio"),
      clickRef: vi.fn().mockResolvedValue(undefined),
      findActionable: vi.fn().mockImplementation(async (query) => {
        if (query.role === "textbox") return "@box:prompt";
        if (query.role === "button" && query.namePattern?.test("Run")) return "@btn:run";
        return null;
      }),
      fastPaste: vi.fn().mockResolvedValue(undefined),
    };

    const generator = new AiStudioGenerator(mockRunner as AgentDesktopRunner);
    const success = await generator.submitPrompt("Commercial hero image of Vietnamese tech workstation");

    expect(success).toBe(true);
    expect(mockRunner.fastPaste).toHaveBeenCalledWith("@box:prompt", "Commercial hero image of Vietnamese tech workstation");
    expect(mockRunner.clickRef).toHaveBeenCalledWith("@btn:run");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run server/marketing/social-scripts/ai-studio-generator.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement AiStudioGenerator and purge pollinations in studio.ts**

```typescript
// server/marketing/social-scripts/ai-studio-generator.ts
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
```

In `server/marketing/studio.ts`:
- Delete `DEFAULT_BASE_URL = "https://image.pollinations.ai/prompt"`.
- Delete `generateFallbackGradientImage`.
- Replace fallback block with a clear, descriptive throw or direct error payload:
  `throw new Error("Image generation failed. Never falling back to pollinations or geometric ovals.");`

- [ ] **Step 4: Run tests to verify purge and AiStudioGenerator pass**

Run: `pnpm vitest run server/marketing/social-scripts/ai-studio-generator.test.ts server/marketing/studio.test.ts`
Expected: PASS

- [ ] **Step 5: Verify no remaining traces of pollinations or gradient oval**

Run: `grep -r "pollinations.ai" server/marketing/`
Expected: No matches found

Run: `grep -r "generateFallbackGradientImage" server/marketing/`
Expected: No matches found

- [ ] **Step 6: Commit**

```bash
git add server/marketing/social-scripts/ai-studio-generator.ts server/marketing/social-scripts/ai-studio-generator.test.ts server/marketing/studio.ts server/marketing/studio.test.ts
git commit -m "feat(image): add AiStudioGenerator and completely purge pollinations.ai and gradient fallbacks"
```

---

### Task 6: Extend PublisherGateway & Wire Social Adapters

**Files:**
- Modify: `server/marketing/publisher-gateway.ts`
- Modify: `server/marketing/mcp-server.ts`
- Test: `server/marketing/publisher-gateway.test.ts`
- Test: `server/marketing/mcp-server.test.ts`

**Interfaces:**
- Consumes: `FacebookPoster`, `XTwitterPoster`, `LinkedInPoster`, `InstagramPoster`.
- Produces: Updated `PublisherGateway` with social adapters plugged in.

- [ ] **Step 1: Write test for extended social platforms in publisher-gateway**

Add test cases in `server/marketing/publisher-gateway.test.ts` verifying that `facebook`, `x`, `linkedin`, and `instagram` platforms are accepted and mapped to valid canonical domain URLs (`facebook.com`, `x.com`, `linkedin.com`, `instagram.com`).

- [ ] **Step 2: Run test to verify failure on new platforms**

Run: `pnpm vitest run server/marketing/publisher-gateway.test.ts`
Expected: FAIL (unrecognized platforms)

- [ ] **Step 3: Update publisher-gateway.ts and mcp-server.ts**

Extend `PublishPlatform`:
```typescript
export type PublishPlatform = "tiktok" | "facebook" | "x" | "linkedin" | "instagram";
```
Extend domain validation in `validPlatformHost`:
```typescript
function validPlatformHost(platform: PublishPlatform, hostname: string): boolean {
  const host = hostname.toLowerCase();
  const domains: Record<PublishPlatform, string[]> = {
    tiktok: ["tiktok.com"],
    facebook: ["facebook.com", "fb.watch"],
    x: ["x.com", "twitter.com"],
    linkedin: ["linkedin.com"],
    instagram: ["instagram.com", "threads.net"],
  };
  const allowed = domains[platform] ?? [];
  return allowed.some((domain) => host === domain || host.endsWith(`.${domain}`));
}
```
In `server/marketing/mcp-server.ts`:
Ensure `createPublisherGateway` is initialized with browser-backed adapters for `facebook`, `x`, `linkedin`, and `instagram`.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run server/marketing/publisher-gateway.test.ts server/marketing/mcp-server.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/marketing/publisher-gateway.ts server/marketing/publisher-gateway.test.ts server/marketing/mcp-server.ts server/marketing/mcp-server.test.ts
git commit -m "feat(publisher): wire social adapters for facebook, x, linkedin, and instagram"
```

---

### Task 7: Full Regression and Live Verification

**Files:**
- Run full server test suite.
- Run live non-destructive verification against running Chrome accessibility tree.

- [ ] **Step 1: Run all marketing server tests**

Run: `pnpm vitest run server/marketing/`
Expected: ALL test files pass (100% green).

- [ ] **Step 2: Verify live non-destructive tab detection via agent-desktop**

Run a one-off verification script to confirm that `AgentDesktopRunner` accurately discovers the active Facebook and AI Studio tabs on Chrome PID 35728 without errors.

- [ ] **Step 3: Commit all changes**

```bash
git status
git commit -m "chore(marketing): complete agent-desktop social automation and verified test suite"
```
