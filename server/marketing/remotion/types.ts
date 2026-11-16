export type VideoRatio = "9:16" | "16:9" | "1:1";

export type ContextualAnimationType =
  | "email"
  | "ai"
  | "speed"
  | "security"
  | "growth"
  | "default";

export type MarketingSceneType =
  | "hook"
  | "problem"
  | "split"
  | "stats"
  | "features"
  | "product"
  | "quote"
  | "solution"
  | "cta"
  | "swarm"
  | "chart"
  | "telemetry"
  | "outro";

export interface TelemetryMetric {
  label: string;
  value: string | number;
  delta?: string;
  status?: "danger" | "warning" | "success" | "info";
}

export interface SwarmAgentNode {
  id: string;
  name: string;
  role: string;
  icon?: string;
  status?: string;
}

export interface MarketingSceneSpec {
  type: MarketingSceneType;
  title: string;
  subtitle?: string;
  features?: string[];
  bulletPoints?: string[];
  subtitles?: string[];
  imageUrl?: string;
  imagePath?: string;
  videoPath?: string;
  durationMs?: number;
  animationType?: ContextualAnimationType;
  floatingTags?: string[];
  themeColor?: "red" | "cyan" | "green" | "amber" | "purple";
  telemetryMetrics?: TelemetryMetric[];
  swarmNodes?: SwarmAgentNode[];
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
