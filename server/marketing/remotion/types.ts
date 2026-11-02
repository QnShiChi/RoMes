export type VideoRatio = "9:16" | "16:9" | "1:1";

export interface MarketingSceneSpec {
  type: "hook" | "product" | "problem" | "solution" | "features" | "stats" | "cta";
  title: string;
  subtitle?: string;
  features?: string[];
  bulletPoints?: string[];
  imageUrl?: string;
  imagePath?: string;
  durationMs?: number;
}

export interface RemotionVideoProps {
  scenes: MarketingSceneSpec[];
  brandName?: string;
  audioPath?: string;
  ratio?: VideoRatio;
}

export function getDimensionsForRatio(ratio: VideoRatio = "9:16"): { width: number; height: number } {
  switch (ratio) {
    case "16:9":
      return { width: 1920, height: 1080 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "9:16":
    default:
      return { width: 1080, height: 1920 };
  }
}
