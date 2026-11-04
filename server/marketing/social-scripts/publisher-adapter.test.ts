import { describe, expect, it, vi } from "vitest";
import { AgentDesktopPublisherAdapter } from "./publisher-adapter.ts";
import type { FacebookPoster } from "./facebook-poster.ts";
import type { XTwitterPoster } from "./x-twitter-poster.ts";
import type { LinkedInPoster } from "./linkedin-poster.ts";
import type { InstagramPoster } from "./instagram-poster.ts";

describe("AgentDesktopPublisherAdapter", () => {
  it("provides capabilities for facebook, x, linkedin, and instagram", async () => {
    const adapter = new AgentDesktopPublisherAdapter();
    const caps = await adapter.capabilities();
    expect(caps.map((c) => c.platform)).toEqual(["facebook", "x", "linkedin", "instagram"]);
  });

  it("delegates publish to the matching poster and formats evidence", async () => {
    const mockFb: Partial<FacebookPoster> = {
      publish: vi.fn().mockResolvedValue({
        success: true,
        platform: "facebook",
        durationMs: 120,
      }),
    };

    const adapter = new AgentDesktopPublisherAdapter(
      mockFb as FacebookPoster,
      {} as XTwitterPoster,
      {} as LinkedInPoster,
      {} as InstagramPoster,
    );

    const evidence = await adapter.publish({
      platform: "facebook",
      caption: "Test Facebook Post",
      idempotencyKey: "test-idemp",
      imagePaths: ["/tmp/img1.jpg"],
    });

    expect(evidence.platform).toBe("facebook");
    expect(evidence.canonicalUrl).toContain("facebook.com");
    expect(mockFb.publish).toHaveBeenCalledWith({
      text: "Test Facebook Post",
      images: ["/tmp/img1.jpg"],
      campaignId: "test-idemp",
    });
  });
});
