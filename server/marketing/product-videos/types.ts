export interface ProductVideoCandidate {
  url: string;
  title?: string;
  durationSeconds?: number;
  width?: number;
  height?: number;
  provider: "mixkit" | "pixabay" | "pexels" | "direct";
}

export interface DownloadedProductVideo {
  index: number;
  filePath: string;
  url: string;
  width: number;
  height: number;
  durationSeconds: number;
  bytes: number;
}

export interface StockVideoSearchOptions {
  orientation?: "portrait" | "landscape";
  timeoutMs?: number;
  limit?: number;
}
