export interface SubtitleCue {
  startMs: number;
  endMs: number;
  text: string;
  keywordHighlight?: string;
}

function formatAssTimestamp(ms: number): string {
  const totalSeconds = Math.max(0, ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const hundredths = Math.floor((totalSeconds % 1) * 100);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(hundredths).padStart(2, "0")}`;
}

export function generateAssSubtitles(
  cues: SubtitleCue[],
  options: { width?: number; height?: number } = {},
): string {
  const width = options.width ?? 1080;
  const height = options.height ?? 1920;

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${width}
PlayResY: ${height}
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kinetic,Arial,58,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,2,0,1,5,3,2,60,60,340,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const lines = cues.map((cue) => {
    let formattedText = cue.text.trim();
    if (cue.keywordHighlight && formattedText.includes(cue.keywordHighlight)) {
      formattedText = formattedText.replaceAll(
        cue.keywordHighlight,
        `{\\c&H00E5FF&}${cue.keywordHighlight}{\\r}`,
      );
    }
    const start = formatAssTimestamp(cue.startMs);
    const end = formatAssTimestamp(cue.endMs);
    return `Dialogue: 0,${start},${end},Kinetic,,0,0,0,,${formattedText}`;
  });

  return `${header}${lines.join("\n")}\n`;
}
