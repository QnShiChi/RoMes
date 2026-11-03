export type MarketingIntent = "create" | "revise" | "publish" | "inspect" | "unknown";

const term = (words: string) => new RegExp(`(?:^|[\\s,.;!?])(?:${words})(?=$|[\\s,.;!?])`, "iu");

const PUBLISH_ACTION = term("đăng|dang|up|upload|chia\\s+sẻ|share|post");
const PUBLISH_TARGET = term("tiktok|facebook|reels?|kênh|video|bài");
const REVISE_ACTION = term("sửa|chỉnh|đổi|làm\\s+lại|revise|edit");
const INSPECT_ACTION = term("gửi\\s+lại|xem\\s+lại|tải|download|file|trạng\\s+thái|status");
const CREATE_ACTION = term("tạo|làm|viết|dựng|generate|create");

export function routeMarketingIntent(message: string): {
  intent: MarketingIntent;
  confidence: "high" | "low";
} {
  const text = message.trim();
  if (PUBLISH_ACTION.test(text) && PUBLISH_TARGET.test(text)) return { intent: "publish", confidence: "high" };
  if (REVISE_ACTION.test(text)) return { intent: "revise", confidence: "high" };
  if (INSPECT_ACTION.test(text)) return { intent: "inspect", confidence: "high" };
  if (CREATE_ACTION.test(text)) return { intent: "create", confidence: "high" };
  return { intent: "unknown", confidence: "low" };
}
