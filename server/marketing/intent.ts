export type MarketingIntent =
  | "create"
  | "create_post"
  | "create_video"
  | "revise"
  | "publish"
  | "inspect"
  | "unknown";

const term = (words: string) => new RegExp(`(?:^|[\\s,.;!?])(?:${words})(?=$|[\\s,.;!?])`, "iu");

const PUBLISH_ACTION = term("đăng|dang|up|upload|chia\\s+sẻ|share|publish|lên\\s+bài|xuất\\s+bản|tiến\\s+hành\\s+đăng");
const PUBLISH_TARGET = term("tiktok|facebook|fb|reels?|kênh|video|bài|post|linkedin|instagram|ig|x|twitter|mạng\\s+xã\\s+hội");
const DIRECT_PUBLISH = term("đăng\\s+(?:đi|luôn|hộ|giúp|ngay)|tiến\\s+hành\\s+đăng|xuất\\s+bản\\s+ngay|publish\\s+now|lên\\s+bài\\s+ngay");
const REVISE_ACTION = term("sửa|chỉnh|đổi|làm\\s+lại|revise|edit");
const INSPECT_ACTION = term("gửi\\s+lại|xem\\s+lại|tải|download|file|trạng\\s+thái|status");
const CREATE_ACTION = term("tạo|làm|viết|dựng|generate|create|lên\\s+(?:ý\\s+tưởng|kế\\s+hoạch|bài|content)|tìm\\s+hiểu|nghiên\\s+cứu");

const POST_TERMS = term("bài|post|content|facebook|fb|linkedin|instagram|ig|status");
const VIDEO_TERMS = term("video|clip|tiktok|reels?|phim|dựng\\s+video|quay\\s+video");

export function routeMarketingIntent(message: string): {
  intent: MarketingIntent;
  confidence: "high" | "low";
} {
  const text = message.trim();

  if (REVISE_ACTION.test(text)) return { intent: "revise", confidence: "high" };
  if (INSPECT_ACTION.test(text)) return { intent: "inspect", confidence: "high" };

  if (CREATE_ACTION.test(text)) {
    if (VIDEO_TERMS.test(text)) {
      return { intent: "create_video", confidence: "high" };
    }
    if (POST_TERMS.test(text)) {
      return { intent: "create_post", confidence: "high" };
    }
    return { intent: "create", confidence: "high" };
  }

  if ((PUBLISH_ACTION.test(text) && PUBLISH_TARGET.test(text)) || DIRECT_PUBLISH.test(text)) {
    return { intent: "publish", confidence: "high" };
  }

  return { intent: "unknown", confidence: "low" };
}
