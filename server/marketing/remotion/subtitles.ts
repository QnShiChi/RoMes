export interface SubtitleToken {
  word: string;
  startFrame: number;
  endFrame: number;
}

export function parseSubtitleWords(text: string, totalFrames: number): SubtitleToken[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const framesPerWord = Math.max(2, Math.floor(totalFrames / words.length));
  return words.map((word, i) => ({
    word,
    startFrame: i * framesPerWord,
    endFrame: Math.min(totalFrames, (i + 1) * framesPerWord),
  }));
}

export const CAPTION_WINDOW_WORDS = 7;

export function captionWindow(tokens: SubtitleToken[], frame: number, size = CAPTION_WINDOW_WORDS): SubtitleToken[] {
  const active = tokens.findIndex((token) => frame < token.endFrame);
  const index = active < 0 ? tokens.length - 1 : active;
  const start = Math.floor(index / size) * size;
  return tokens.slice(start, start + size);
}
