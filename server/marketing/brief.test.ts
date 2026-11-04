import { describe, expect, it } from "vitest";

import { assessMarketingBrief } from "./brief.ts";
import { routeMarketingIntent } from "./intent.ts";

const socialSources = {
  contentType: "user",
  topic: "user",
  goal: "user",
  audience: "user",
  platform: "user",
  style: "user",
  callToAction: "user",
  imageCount: "user",
} as const;

const videoSources = {
  contentType: "proposed_default",
  topic: "user",
  goal: "user",
  audience: "user",
  platform: "user",
  style: "user",
  targetDurationSeconds: "user",
  callToAction: "user",
  imageCount: "proposed_default",
} as const;

describe("marketing consultation", () => {
  it("asks for every missing production decision without approving work for video", () => {
    const result = assessMarketingBrief({ topic: "AI Agent", contentType: "video_campaign" });
    expect(result).toMatchObject({
      complete: false,
      missingFields: ["goal", "audience", "platform", "style", "targetDurationSeconds", "callToAction"],
    });
    expect(result.complete).toBe(false);
    if (result.complete) throw new Error("expected an incomplete brief");
    expect(result.questions.join(" ").toLowerCase()).toContain("mục tiêu");
    expect(result.questions.join(" ").toLowerCase()).toContain("thời lượng");
  });

  it("normalizes a complete social post brief without requiring duration", () => {
    const result = assessMarketingBrief({
      contentType: "social_post",
      topic: "Chính sách AI Việt Nam",
      goal: "lan tỏa kiến thức",
      audience: "kỹ sư IT và sinh viên",
      platform: "Facebook",
      style: "thương mại chuyên sâu",
      callToAction: "Bình luận góc nhìn của bạn",
      imageCount: 3,
      fieldSources: socialSources,
    });
    expect(result).toMatchObject({
      complete: true,
      brief: {
        contentType: "social_post",
        topic: "Chính sách AI Việt Nam",
        platform: "facebook",
        imageCount: 3,
      },
    });
  });

  it("normalizes a complete brief", () => {
    expect(assessMarketingBrief({
      topic: " AI Agent ",
      goal: "lead generation",
      audience: "SME owners",
      platform: "TikTok",
      style: "modern tech",
      targetDurationSeconds: 60.2,
      callToAction: "Đăng ký demo",
      fieldSources: videoSources,
    })).toMatchObject({
      complete: true,
      brief: { topic: "AI Agent", platform: "tiktok", targetDurationSeconds: 60 },
    });
  });

  it("rejects a non-positive duration as missing for video", () => {
    const result = assessMarketingBrief({
      contentType: "video_campaign",
      topic: "AI Agent",
      goal: "lead generation",
      audience: "SME owners",
      platform: "TikTok",
      style: "modern tech",
      targetDurationSeconds: 0,
      callToAction: "Đăng ký demo",
      fieldSources: videoSources,
    });
    expect(result).toMatchObject({ complete: false, missingFields: ["targetDurationSeconds"] });
  });

  it("keeps user values separate from proposed defaults", () => {
    const result = assessMarketingBrief({
      contentType: "social_post",
      topic: "Cuộc đua AI của Big Tech",
      goal: "Tăng tương tác",
      audience: "Kỹ sư và sinh viên IT",
      platform: "Facebook",
      style: "Phân tích dễ hiểu",
      callToAction: "Bình luận quan điểm của bạn",
      imageCount: 5,
      fieldSources: {
        ...socialSources,
        goal: "proposed_default",
        audience: "proposed_default",
        platform: "proposed_default",
        style: "proposed_default",
        callToAction: "proposed_default",
      },
    });

    expect(result).toMatchObject({
      complete: true,
      sources: {
        topic: "user",
        goal: "proposed_default",
        imageCount: "user",
      },
    });
  });

  it("refuses a complete-looking brief whose values have no provenance", () => {
    const result = assessMarketingBrief({
      contentType: "social_post",
      topic: "Cuộc đua AI",
      goal: "Tăng tương tác",
      audience: "Người quan tâm công nghệ",
      platform: "Facebook",
      style: "Chuyên gia",
      callToAction: "Bình luận",
    });

    expect(result).toMatchObject({
      complete: false,
      missingAttribution: [
        "topic",
        "goal",
        "audience",
        "platform",
        "style",
        "callToAction",
        "contentType",
      ],
    });
  });

  it("marks an omitted image count as a proposed one-image default", () => {
    const { imageCount: _imageCount, ...withoutImageCount } = socialSources;
    const result = assessMarketingBrief({
      contentType: "social_post",
      topic: "Cuộc đua AI",
      goal: "Tăng tương tác",
      audience: "Người quan tâm công nghệ",
      platform: "Facebook",
      style: "Chuyên gia",
      callToAction: "Bình luận",
      fieldSources: withoutImageCount,
    });

    expect(result).toMatchObject({
      complete: true,
      brief: { imageCount: 1 },
      sources: { imageCount: "proposed_default" },
    });
  });
});

describe("marketing intent", () => {
  it.each([
    ["tạo cho anh một video", "create_video"],
    ["làm video về chip AI", "create_video"],
    ["dựng clip TikTok", "create_video"],
    ["em giúp anh viết một bài về chủ đề AI", "create_post"],
    ["tạo content đăng bài facebook gồm content và hình ảnh", "create_post"],
    ["viết bài post linkedin về công nghệ", "create_post"],
    ["sửa cảnh thứ hai của video vừa rồi", "revise"],
    ["up video vừa rồi lên TikTok", "publish"],
    ["đăng video này lên Facebook", "publish"],
    ["gửi lại file mp4 cho anh", "inspect"],
  ] as const)("routes %s to %s", (message, intent) => {
    expect(routeMarketingIntent(message).intent).toBe(intent);
  });

  it("does not turn an ambiguous approval into production", () => {
    expect(routeMarketingIntent("ok")).toEqual({ intent: "unknown", confidence: "low" });
  });
});
