import { describe, expect, it } from "vitest";

import { routeMarketingIntent } from "./intent.ts";

describe("routeMarketingIntent", () => {
  it("routes post creation intents accurately", () => {
    expect(routeMarketingIntent("giúp anh lên ý tưởng content chủ đề Claude Duet")).toEqual({
      intent: "create_post",
      confidence: "high",
    });
    expect(routeMarketingIntent("Lên ý tưởng content cho chủ đề Claude Duet")).toEqual({
      intent: "create_post",
      confidence: "high",
    });
    expect(routeMarketingIntent("tìm hiểu về Claude Duet rồi viết bài nha")).toEqual({
      intent: "create_post",
      confidence: "high",
    });
    expect(routeMarketingIntent("em có thể tìm hiểu về nó rồi viết nha")).toEqual({
      intent: "create",
      confidence: "high",
    });
  });

  it("routes video creation intents accurately", () => {
    expect(routeMarketingIntent("làm video TikTok về AI")).toEqual({
      intent: "create_video",
      confidence: "high",
    });
    expect(routeMarketingIntent("lên kế hoạch dựng video clip ngắn")).toEqual({
      intent: "create_video",
      confidence: "high",
    });
  });

  it("routes publish and revision intents", () => {
    expect(routeMarketingIntent("đăng bài lên facebook giúp anh")).toEqual({
      intent: "publish",
      confidence: "high",
    });
    expect(routeMarketingIntent("em đăng lên fb hộ anh nhé")).toEqual({
      intent: "publish",
      confidence: "high",
    });
    expect(routeMarketingIntent("anh đã đăng nhập sẵn rồi, em giúp anh đăng bài lên nhé")).toEqual({
      intent: "publish",
      confidence: "high",
    });
    expect(routeMarketingIntent("tiến hành đăng")).toEqual({
      intent: "publish",
      confidence: "high",
    });
    expect(routeMarketingIntent("đăng luôn đi")).toEqual({
      intent: "publish",
      confidence: "high",
    });
    expect(routeMarketingIntent("chỉnh sửa lại tiêu đề bài viết")).toEqual({
      intent: "revise",
      confidence: "high",
    });
  });
});
