import { execFile } from "node:child_process";
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
  private readonly executor: DesktopCliExecutor;
  private lastSnapshotTree: SnapshotNode | null = null;

  constructor(executor?: DesktopCliExecutor) {
    this.executor = executor ?? new DefaultDesktopExecutor();
  }

  async snapshot(app: string = "chrome"): Promise<SnapshotNode> {
    const res = await this.executor.run("snapshot", ["--app", app, "-i", "--compact"]);
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
