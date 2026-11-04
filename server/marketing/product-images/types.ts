export interface ProductImageCandidate {
  url: string;
  title: string;
  width?: number;
  height?: number;
  sourceUrl?: string;
}

export interface ProductImageResult {
  index: number;
  label: string;
  filePath: string;
  url: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width: number;
  height: number;
  bytes: number;
}
