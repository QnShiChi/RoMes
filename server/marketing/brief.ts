export interface MarketingBriefInput {
  topic?: string;
  goal?: string;
  audience?: string;
  platform?: string;
  style?: string;
  targetDurationSeconds?: number;
  callToAction?: string;
}

export interface MarketingBrief {
  topic: string;
  goal: string;
  audience: string;
  platform: string;
  style: string;
  targetDurationSeconds: number;
  callToAction: string;
}

export type MarketingBriefField = keyof MarketingBrief;

export type MarketingBriefAssessment =
  | { complete: false; missingFields: MarketingBriefField[]; questions: string[] }
  | { complete: true; brief: MarketingBrief };

const FIELDS: MarketingBriefField[] = [
  "topic",
  "goal",
  "audience",
  "platform",
  "style",
  "targetDurationSeconds",
  "callToAction",
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
  const duration = Number.isFinite(input.targetDurationSeconds) && input.targetDurationSeconds! > 0
    ? Math.round(input.targetDurationSeconds!)
    : undefined;
  const normalized: Partial<MarketingBrief> = {
    topic: clean(input.topic),
    goal: clean(input.goal),
    audience: clean(input.audience),
    platform: clean(input.platform)?.toLowerCase(),
    style: clean(input.style),
    targetDurationSeconds: duration,
    callToAction: clean(input.callToAction),
  };
  const missingFields = FIELDS.filter((field) => normalized[field] === undefined);
  if (missingFields.length > 0) {
    return { complete: false, missingFields, questions: missingFields.map((field) => QUESTIONS[field]) };
  }
  return { complete: true, brief: normalized as MarketingBrief };
}
