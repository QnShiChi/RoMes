import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

export const FloatingBadges: React.FC<{
  tags?: string[];
  isVertical: boolean;
}> = ({ tags, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!tags || tags.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        gap: "12px",
        marginTop: isVertical ? "18px" : "12px",
        zIndex: 35,
      }}
    >
      {tags.map((tag, idx) => {
        const floatY = Math.sin((frame + idx * 15) / 14) * 8;
        const badgeSpring = spring({
          frame: Math.max(0, frame - 5 - idx * 4),
          fps,
          config: { damping: 12 },
        });

        return (
          <div
            key={idx}
            style={{
              transform: `scale(${badgeSpring}) translateY(${floatY}px)`,
              padding: isVertical ? "10px 20px" : "8px 16px",
              borderRadius: "9999px",
              background: "rgba(255, 255, 255, 0.08)",
              backdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#e0e7ff",
              fontSize: isVertical ? "19px" : "16px",
              fontWeight: 700,
              boxShadow: "0 8px 20px rgba(0, 0, 0, 0.4)",
            }}
          >
            ✦ {tag}
          </div>
        );
      })}
    </div>
  );
};
