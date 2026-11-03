import { describe, expect, it } from "vitest";

import { assessMarketingBrief } from "./brief.ts";
import { routeMarketingIntent } from "./intent.ts";

describe("marketing consultation", () => {
  it("asks for every missing production decision without approving work", () => {
    const result = assessMarketingBrief({ topic: "AI Agent" });
    expect(result).toMatchObject({
      complete: false,
      missingFields: ["goal", "audience", "platform", "style", "targetDurationSeconds", "callToAction"],
    });
    expect(result.complete).toBe(false);
    if (result.complete) throw new Error("expected an incomplete brief");
    expect(result.questions.join(" ").toLowerCase()).toContain("mục tiêu");
    expect(result.questions.join(" ").toLowerCase()).toContain("thời lượng");
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
    })).toMatchObject({
      complete: true,
      brief: { topic: "AI Agent", platform: "tiktok", targetDurationSeconds: 60 },
    });
  });

  it("rejects a non-positive duration as missing", () => {
    const result = assessMarketingBrief({
      topic: "AI Agent",
      goal: "lead generation",
      audience: "SME owners",
      platform: "TikTok",
      style: "modern tech",
      targetDurationSeconds: 0,
      callToAction: "Đăng ký demo",
    });
    expect(result).toMatchObject({ complete: false, missingFields: ["targetDurationSeconds"] });
  });
});

describe("marketing intent", () => {
  it.each([
    ["tạo cho anh một video", "create"],
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
