import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { ContextualAnimationType } from "./types.ts";

export const MicroAnimation: React.FC<{
  type?: ContextualAnimationType;
  isVertical: boolean;
}> = ({ type, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (!type || type === "default") return null;

  if (type === "email") {
    const flightX = interpolate(frame, [0, 25], [-120, 120], { extrapolateRight: "clamp" });
    const flightY = Math.sin(frame / 6) * 18;
    const badgeScale = spring({
      frame: Math.max(0, frame - 22),
      fps,
      config: { damping: 12, mass: 0.6 },
    });

    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "28%" : "22%",
          right: isVertical ? "6%" : "12%",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <div
          style={{
            transform: `translate(${flightX}px, ${flightY}px)`,
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            background: "linear-gradient(135deg, #38bdf8 0%, #6366f1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "28px",
            boxShadow: "0 10px 25px rgba(56, 189, 248, 0.5)",
          }}
        >
          ✉️
        </div>
        <div
          style={{
            transform: `scale(${badgeScale})`,
            padding: "8px 16px",
            borderRadius: "9999px",
            background: "rgba(16, 185, 129, 0.2)",
            border: "1px solid #10b981",
            color: "#6ee7b7",
            fontWeight: 700,
            fontSize: isVertical ? "18px" : "15px",
            boxShadow: "0 0 15px rgba(16, 185, 129, 0.4)",
          }}
        >
          ✓ Đã gửi email tự động
        </div>
      </div>
    );
  }

  if (type === "ai") {
    const pulse = 1 + Math.sin(frame / 8) * 0.08;
    const rotate = (frame * 1.5) % 360;
    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "24%" : "18%",
          right: isVertical ? "8%" : "14%",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "10px 20px",
          borderRadius: "9999px",
          background: "rgba(99, 102, 241, 0.25)",
          border: "1px solid rgba(168, 85, 247, 0.5)",
          transform: `scale(${pulse})`,
        }}
      >
        <span style={{ fontSize: "24px", transform: `rotate(${rotate}deg)`, display: "inline-block" }}>
          ⚙️
        </span>
        <span style={{ fontSize: isVertical ? "18px" : "15px", fontWeight: 700, color: "#e0e7ff" }}>
          AI Neural Engine Active
        </span>
      </div>
    );
  }

  if (type === "security") {
    const shieldScale = spring({ frame, fps, config: { damping: 11 } });
    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "26%" : "20%",
          left: isVertical ? "6%" : "10%",
          zIndex: 40,
          transform: `scale(${shieldScale})`,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 18px",
          borderRadius: "16px",
          background: "rgba(16, 185, 129, 0.2)",
          border: "1px solid #10b981",
          color: "#a7f3d0",
          fontWeight: 700,
          fontSize: isVertical ? "18px" : "15px",
        }}
      >
        <span>🛡️</span>
        <span>2FA Encrypted</span>
      </div>
    );
  }

  if (type === "speed") {
    const progress = Math.min(99, Math.round(interpolate(frame, [0, durationInFrames], [10, 99])));
    return (
      <div
        style={{
          position: "absolute",
          top: isVertical ? "25%" : "18%",
          right: isVertical ? "8%" : "12%",
          zIndex: 40,
          padding: "10px 18px",
          borderRadius: "16px",
          background: "rgba(245, 158, 11, 0.2)",
          border: "1px solid #f59e0b",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          color: "#fde68a",
          fontWeight: 800,
          fontSize: isVertical ? "20px" : "16px",
        }}
      >
        <span>⚡</span>
        <span>{progress}% Cực nhanh</span>
      </div>
    );
  }

  return null;
};
