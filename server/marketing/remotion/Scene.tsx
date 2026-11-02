import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import type { MarketingSceneSpec, VideoRatio } from "./types.ts";

interface SceneProps {
  scene: MarketingSceneSpec;
  brandName: string;
  durationInFrames: number;
  ratio: VideoRatio;
}

export const Scene: React.FC<SceneProps> = ({
  scene,
  brandName,
  durationInFrames,
  ratio,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  const isVertical = ratio === "9:16";

  const sceneOpacity = interpolate(
    frame,
    [0, 10, Math.max(15, durationInFrames - 10), durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.6 },
  });

  const cardSpring = spring({
    frame: Math.max(0, frame - 4),
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  const imageScale = interpolate(
    frame,
    [0, durationInFrames],
    [1, 1.08],
    { extrapolateRight: "clamp" },
  );

  const orb1X = Math.sin(frame / 20) * 40;
  const orb1Y = Math.cos(frame / 25) * 30;
  const orb2X = Math.cos(frame / 18) * 35;
  const orb2Y = Math.sin(frame / 22) * 45;

  const ctaPulse = 1 + Math.sin(frame / 7) * 0.035;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#070a12",
        color: "#ffffff",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        overflow: "hidden",
        opacity: sceneOpacity,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "20%",
          width: width * 0.7,
          height: width * 0.7,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.28) 0%, transparent 70%)",
          transform: `translate(${orb1X}px, ${orb1Y}px)`,
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "10%",
          right: "-10%",
          width: width * 0.8,
          height: width * 0.8,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.22) 0%, transparent 70%)",
          transform: `translate(${orb2X}px, ${orb2Y}px)`,
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          height: "100%",
          padding: isVertical ? "70px 48px" : "48px 80px",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 20px",
            borderRadius: "9999px",
            background: "rgba(255, 255, 255, 0.06)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(12px)",
            transform: `translateY(${interpolate(frame, [0, 15], [-20, 0], { extrapolateRight: "clamp" })}px)`,
            opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
            marginBottom: isVertical ? "32px" : "20px",
          }}
        >
          <span
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "#10b981",
              boxShadow: "0 0 10px #10b981",
            }}
          />
          <span
            style={{
              fontSize: isVertical ? "20px" : "18px",
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "#e2e8f0",
              textTransform: "uppercase",
            }}
          >
            {brandName}
          </span>
        </div>

        <div
          style={{
            transform: `scale(${titleSpring})`,
            textAlign: "center",
            maxWidth: "90%",
            marginBottom: isVertical ? "40px" : "24px",
          }}
        >
          <h1
            style={{
              fontSize: isVertical ? "54px" : "46px",
              lineHeight: 1.15,
              fontWeight: 800,
              margin: 0,
              background: "linear-gradient(135deg, #ffffff 0%, #e0e7ff 50%, #a5b4fc 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 4px 20px rgba(0, 0, 0, 0.4))",
            }}
          >
            {scene.title}
          </h1>
        </div>

        {(scene.imagePath || scene.imageUrl) && (
          <div
            style={{
              transform: `scale(${cardSpring})`,
              width: isVertical ? "92%" : "60%",
              flex: 1,
              maxHeight: isVertical ? "52%" : "55%",
              borderRadius: "28px",
              overflow: "hidden",
              border: "1px solid rgba(255, 255, 255, 0.16)",
              boxShadow: "0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.2)",
              position: "relative",
              backgroundColor: "#0b0f19",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={scene.imagePath || scene.imageUrl}
              alt={scene.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${imageScale})`,
                transformOrigin: "center center",
              }}
            />
          </div>
        )}

        {(scene.bulletPoints || scene.features) && (scene.bulletPoints || scene.features)!.length > 0 && (
          <div
            style={{
              width: isVertical ? "92%" : "70%",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginTop: isVertical ? "24px" : "16px",
            }}
          >
            {(scene.bulletPoints || scene.features)!.map((feat, idx) => {
              const itemSpring = spring({
                frame: Math.max(0, frame - 8 - idx * 5),
                fps,
                config: { damping: 13, mass: 0.6 },
              });
              return (
                <div
                  key={idx}
                  style={{
                    transform: `scale(${itemSpring})`,
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    padding: isVertical ? "16px 22px" : "12px 18px",
                    borderRadius: "18px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.12)",
                    backdropFilter: "blur(16px)",
                  }}
                >
                  <span style={{ fontSize: "22px", color: "#818cf8" }}>✦</span>
                  <span
                    style={{
                      fontSize: isVertical ? "24px" : "20px",
                      fontWeight: 600,
                      color: "#f8fafc",
                    }}
                  >
                    {feat}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {scene.type === "cta" && (
          <div
            style={{
              marginTop: isVertical ? "32px" : "20px",
              transform: `scale(${ctaPulse})`,
            }}
          >
            <div
              style={{
                padding: isVertical ? "20px 48px" : "16px 36px",
                borderRadius: "9999px",
                background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
                boxShadow: "0 10px 35px rgba(99, 102, 241, 0.5), 0 0 20px rgba(168, 85, 247, 0.4)",
                fontWeight: 700,
                fontSize: isVertical ? "28px" : "22px",
                color: "#ffffff",
                letterSpacing: "0.04em",
                textAlign: "center",
              }}
            >
              {scene.subtitle || "Trải Nghiệm Ngay"}
            </div>
          </div>
        )}

        {scene.subtitle && scene.type !== "cta" && (
          <div
            style={{
              position: "absolute",
              bottom: isVertical ? "220px" : "60px",
              maxWidth: "88%",
              padding: "14px 28px",
              borderRadius: "16px",
              background: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(99, 102, 241, 0.4)",
              boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)",
              backdropFilter: "blur(12px)",
              textAlign: "center",
              transform: `translateY(${interpolate(frame, [0, 10], [15, 0], { extrapolateRight: "clamp" })}px)`,
              opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
            }}
          >
            <p
              style={{
                fontSize: isVertical ? "26px" : "22px",
                fontWeight: 600,
                color: "#f1f5f9",
                margin: 0,
                lineHeight: 1.35,
              }}
            >
              {scene.subtitle}
            </p>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
