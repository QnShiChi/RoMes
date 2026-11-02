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
