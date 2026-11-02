import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { parseSubtitleWords, type SubtitleToken } from "./subtitles.ts";

export { parseSubtitleWords, type SubtitleToken };

export const KineticCaptions: React.FC<{ text: string; isVertical: boolean }> = ({ text, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const tokens = React.useMemo(() => parseSubtitleWords(text, durationInFrames), [text, durationInFrames]);
  if (tokens.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: isVertical ? "200px" : "50px",
        left: "50%",
        transform: "translateX(-50%)",
        width: isVertical ? "88%" : "75%",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "10px 14px",
        padding: "16px 24px",
        borderRadius: "20px",
        background: "rgba(10, 15, 29, 0.82)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(99, 102, 241, 0.35)",
        boxShadow: "0 15px 35px rgba(0, 0, 0, 0.6)",
        zIndex: 50,
      }}
    >
      {tokens.map((token, i) => {
        const isActive = frame >= token.startFrame && frame < token.endFrame;
        const hasPassed = frame >= token.endFrame;

        const wordSpring = spring({
          frame: Math.max(0, frame - token.startFrame),
          fps,
          config: { damping: 10, mass: 0.5 },
        });

        const scale = isActive ? 1 + wordSpring * 0.15 : 1;
        const color = isActive ? "#facc15" : hasPassed ? "#ffffff" : "rgba(255, 255, 255, 0.55)";
        const textShadow = isActive ? "0 0 16px rgba(250, 204, 21, 0.8)" : "none";

        return (
          <span
            key={i}
            style={{
              fontSize: isVertical ? "30px" : "24px",
              fontWeight: 800,
              color,
              textShadow,
              transform: `scale(${scale})`,
              display: "inline-block",
              letterSpacing: "0.02em",
            }}
          >
            {token.word}
          </span>
        );
      })}
    </div>
  );
};
