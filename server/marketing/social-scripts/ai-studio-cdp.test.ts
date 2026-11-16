import { describe, expect, it } from "vitest";
import { AiStudioCdpClient } from "./ai-studio-cdp.ts";

describe("AiStudioCdpClient", () => {
  it("initializes with default port and profile directory", () => {
    const client = new AiStudioCdpClient(9222);
    expect(client).toBeDefined();
  });

  it("handles isPortOpen gracefully when nothing is listening on port", async () => {
    const client = new AiStudioCdpClient(59999);
    const open = await client.isPortOpen();
    expect(open).toBe(false);
  });

  it("handles listTabs gracefully when port is closed", async () => {
    const client = new AiStudioCdpClient(59999);
    const tabs = await client.listTabs();
    expect(tabs).toEqual([]);
  });

  it("correctly normalizes various aspect ratio string formats", () => {
    const client = new AiStudioCdpClient(9222);
    expect(client.normalizeAspectRatio("9:16")).toBe("9:16");
    expect(client.normalizeAspectRatio("vertical")).toBe("9:16");
    expect(client.normalizeAspectRatio("reels")).toBe("9:16");
    expect(client.normalizeAspectRatio("tiktok")).toBe("9:16");
    expect(client.normalizeAspectRatio("16:9")).toBe("16:9");
    expect(client.normalizeAspectRatio("landscape")).toBe("16:9");
    expect(client.normalizeAspectRatio("1:1")).toBe("1:1");
    expect(client.normalizeAspectRatio("square")).toBe("1:1");
    expect(client.normalizeAspectRatio("3:4")).toBe("3:4");
    expect(client.normalizeAspectRatio("4:3")).toBe("4:3");
    expect(client.normalizeAspectRatio("")).toBe("9:16");
    expect(client.normalizeAspectRatio(undefined)).toBe("9:16");
  });

  it("handles setAspectRatio failure gracefully without throwing when invalid targetWsUrl", async () => {
    const client = new AiStudioCdpClient(9222);
    const result = await client.setAspectRatio("ws://127.0.0.1:59999", "9:16");
    expect(result).toBe(false);
  });
});
