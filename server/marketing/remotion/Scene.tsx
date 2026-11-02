import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DeviceMockup } from "./DeviceMockup.tsx";
import { FloatingBadges } from "./FloatingBadges.tsx";
import { KineticCaptions } from "./KineticCaptions.tsx";
import { MicroAnimation } from "./MicroAnimations.tsx";
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

  const orb1X = Math.sin(frame / 20) * 40;
  const orb1Y = Math.cos(frame / 25) * 30;
  const orb2X = Math.cos(frame / 18) * 35;
  const orb2Y = Math.sin(frame / 22) * 45;

  const ctaPulse = 1 + Math.sin(frame / 7) * 0.035;
  const imageSource = scene.imagePath || scene.imageUrl;
  const featuresList = scene.bulletPoints || scene.features;

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

      <MicroAnimation type={scene.animationType} isVertical={isVertical} />

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
            marginBottom: isVertical ? "28px" : "18px",
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
            maxWidth: "92%",
            marginBottom: isVertical ? "30px" : "20px",
          }}
        >
          <h1
            style={{
              fontSize: isVertical ? "52px" : "44px",
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

        {imageSource && (
          <DeviceMockup imageSource={imageSource} isVertical={isVertical} />
        )}

        <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />

        {featuresList && featuresList.length > 0 && (
          <div
            style={{
              width: isVertical ? "92%" : "70%",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              marginTop: isVertical ? "20px" : "14px",
            }}
          >
            {featuresList.map((feat, idx) => {
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
              marginTop: isVertical ? "28px" : "18px",
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
          <KineticCaptions text={scene.subtitle} isVertical={isVertical} />
        )}
      </div>
    </AbsoluteFill>
  );
};
