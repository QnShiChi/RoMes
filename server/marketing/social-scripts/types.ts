export interface SnapshotNode {
  ref_id?: string;
  role?: string;
  name?: string;
  value?: string;
  children?: SnapshotNode[];
  states?: string[];
}

export interface CliEnvelope<T = unknown> {
  ok: boolean;
  command?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    disposition?: { retry: "safe" | "unsafe" };
  };
}

export interface DesktopCliExecutor {
  run(command: string, args: string[]): Promise<CliEnvelope>;
}

export interface ElementQuery {
  role?: string;
  namePattern?: RegExp;
}

export interface SocialPostPayload {
  text: string;
  images: string[];
  campaignId: string;
  options?: Record<string, unknown>;
}

export interface SocialPostResult {
  success: boolean;
  platform: "facebook" | "x" | "linkedin" | "instagram";
  postUrl?: string;
  durationMs: number;
  error?: string;
}

export interface SocialPoster {
  readonly platform: string;
  isAvailable(): Promise<boolean>;
  publish(payload: SocialPostPayload): Promise<SocialPostResult>;
}
