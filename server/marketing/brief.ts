export interface MarketingBriefInput {
  topic?: string;
  goal?: string;
  audience?: string;
  platform?: string;
  style?: string;
  targetDurationSeconds?: number;
  callToAction?: string;
  contentType?: "social_post" | "video_campaign";
  imageCount?: number;
  fieldSources?: MarketingBriefSources;
}

export interface MarketingBrief {
  topic: string;
  goal: string;
  audience: string;
  platform: string;
  style: string;
  targetDurationSeconds?: number;
  callToAction: string;
  contentType: "social_post" | "video_campaign";
  imageCount: number;
}

export type FieldSource = "user" | "proposed_default" | "confirmed";
export type MarketingBriefSourceField = keyof MarketingBrief;
export type MarketingBriefSources = Partial<Record<MarketingBriefSourceField, FieldSource>>;

export type MarketingBriefField =
  | "topic"
  | "goal"
  | "audience"
  | "platform"
  | "style"
  | "targetDurationSeconds"
  | "callToAction";

export type MarketingBriefAssessment =
  | {
      complete: false;
      missingFields: MarketingBriefField[];
      missingAttribution: MarketingBriefSourceField[];
      questions: string[];
    }
  | { complete: true; brief: MarketingBrief; sources: MarketingBriefSources };

const VIDEO_FIELDS: MarketingBriefField[] = [
  "topic",
  "goal",
  "audience",
  "platform",
  "style",
  "targetDurationSeconds",
  "callToAction",
];

const SOCIAL_POST_FIELDS: MarketingBriefField[] = [
  "topic",
  "goal",
  "audience",
  "platform",
  "style",
  "callToAction",
];

const SOURCE_FIELDS: MarketingBriefSourceField[] = [
  "topic",
  "goal",
  "audience",
  "platform",
  "style",
  "callToAction",
  "contentType",
  "imageCount",
  "targetDurationSeconds",
];

const QUESTIONS: Record<MarketingBriefField, string> = {
  topic: "Anh muốn làm nội dung về chủ đề hoặc sản phẩm nào?",
  goal: "Mục tiêu chính là nhận diện, tương tác hay tạo khách hàng tiềm năng?",
  audience: "Nội dung nhắm tới nhóm khán giả nào?",
  platform: "Anh muốn dùng nội dung trên TikTok, Facebook hay nền tảng nào?",
  style: "Anh muốn phong cách hiện đại công nghệ, chuyên gia hay gần gũi kể chuyện?",
  targetDurationSeconds: "Thời lượng video mong muốn là khoảng bao nhiêu giây?",
  callToAction: "Anh muốn người xem thực hiện hành động nào sau video?",
};

export function assessMarketingBrief(input: MarketingBriefInput): MarketingBriefAssessment {
  const clean = (value: string | undefined) => value?.trim() || undefined;
  const isSocialPost =
    input.contentType === "social_post" ||
    (input.platform && /facebook|linkedin|instagram|ig|fb/i.test(input.platform) && !input.contentType);

  const contentType: "social_post" | "video_campaign" = isSocialPost ? "social_post" : "video_campaign";

  const duration =
    Number.isFinite(input.targetDurationSeconds) && input.targetDurationSeconds! > 0
      ? Math.round(input.targetDurationSeconds!)
      : undefined;

  const hasValidImageCount = Number.isFinite(input.imageCount) && input.imageCount! > 0;
  const imageCount = hasValidImageCount
    ? Math.min(12, Math.max(1, Math.round(input.imageCount!)))
    : 1;

  const normalized: Partial<MarketingBrief> = {
    topic: clean(input.topic),
    goal: clean(input.goal),
    audience: clean(input.audience),
    platform: clean(input.platform)?.toLowerCase(),
    style: clean(input.style),
    callToAction: clean(input.callToAction),
    contentType,
    imageCount,
    ...(contentType === "video_campaign" ? { targetDurationSeconds: duration } : {}),
  };

  const requiredFields = contentType === "social_post" ? SOCIAL_POST_FIELDS : VIDEO_FIELDS;
  const missingFields = requiredFields.filter((field) => normalized[field] === undefined);
  const sources: MarketingBriefSources = {
    ...input.fieldSources,
    ...(!input.contentType ? { contentType: "proposed_default" as const } : {}),
    ...(!hasValidImageCount ? { imageCount: "proposed_default" as const } : {}),
  };
  const missingAttribution = SOURCE_FIELDS.filter(
    (field) => normalized[field] !== undefined && sources[field] === undefined,
  );

  if (missingFields.length > 0 || missingAttribution.length > 0) {
    return {
      complete: false,
      missingFields,
      missingAttribution,
      questions: missingFields.map((field) => QUESTIONS[field]),
    };
  }

  return { complete: true, brief: normalized as MarketingBrief, sources };
}
