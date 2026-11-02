import { describe, expect, it } from "vitest";
import { formatPostPayload, publishPostHeadless, type PublishPostInput } from "./publisher.ts";

describe("publisher", () => {
  it("formats TikTok post payload with hashtags correctly", () => {
    const input: PublishPostInput = {
      platform: "tiktok",
      videoPath: "/tmp/sample.mp4",
      caption: "Video giới thiệu Muse AI",
      hashtags: ["#MuseAI", "#AIContent"],
    };
    const payload = formatPostPayload(input);
    expect(payload.fullCaption).toContain("Video giới thiệu Muse AI");
    expect(payload.fullCaption).toContain("#MuseAI");
    expect(payload.fullCaption).toContain("#AIContent");
    expect(payload.platform).toBe("tiktok");
  });

  it("handles empty hashtags gracefully", () => {
    const input: PublishPostInput = {
      platform: "facebook",
      videoPath: "/tmp/sample.mp4",
      caption: "Facebook Post Content",
    };
    const payload = formatPostPayload(input);
    expect(payload.fullCaption).toBe("Facebook Post Content");
    expect(payload.platform).toBe("facebook");
  });

  it("throws error if video file is missing when calling publishPostHeadless", async () => {
    const input: PublishPostInput = {
      platform: "tiktok",
      videoPath: "/tmp/non-existent-video.mp4",
      caption: "Test",
    };
    await expect(publishPostHeadless(input)).rejects.toThrow(/video file not found/i);
  });
});
