export interface SubtitleToken {
  word: string;
  startFrame: number;
  endFrame: number;
}

export function computeSpeechWordWeight(word: string): number {
  const clean = word.replace(/[.,!?;:…"'()[\]]/g, "");
  const charBonus = Math.max(0, clean.length - 3) * 0.08;
  let pauseBonus = 0;
  if (/[.!?…]$/.test(word)) {
    pauseBonus = 0.85;
  } else if (/[,;:]$/.test(word)) {
    pauseBonus = 0.45;
  }
  return 1 + charBonus + pauseBonus;
}

export function computeSentenceSpeechWeight(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;
  return words.reduce((sum, w) => sum + computeSpeechWordWeight(w), 0);
}

export function parseSubtitleWords(text: string, totalFrames: number): SubtitleToken[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const safeTotalFrames = Math.max(words.length * 2, totalFrames);
  const weights = words.map(computeSpeechWordWeight);
  const totalWeight = weights.reduce((a, b) => a + b, 0) || words.length;

  let cumulativeWeight = 0;
  return words.map((word, i) => {
    const startFrame = i === 0 ? 0 : Math.round((cumulativeWeight / totalWeight) * safeTotalFrames);
    cumulativeWeight += weights[i]!;
    const rawEnd = i === words.length - 1
      ? totalFrames
      : Math.round((cumulativeWeight / totalWeight) * safeTotalFrames);
    const endFrame = Math.min(totalFrames, Math.max(startFrame + 2, rawEnd));
    return {
      word,
      startFrame: Math.min(startFrame, Math.max(0, endFrame - 1)),
      endFrame,
    };
  });
}

export const CAPTION_WINDOW_WORDS = 6;

export function captionWindow(tokens: SubtitleToken[], frame: number, size = CAPTION_WINDOW_WORDS): SubtitleToken[] {
  const active = tokens.findIndex((token) => frame < token.endFrame);
  const index = active < 0 ? tokens.length - 1 : active;
  const start = Math.floor(index / size) * size;
  return tokens.slice(start, start + size);
}

