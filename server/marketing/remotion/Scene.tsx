import React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DeviceMockup } from "./DeviceMockup.tsx";
import { FloatingBadges } from "./FloatingBadges.tsx";
import { KineticCaptions } from "./KineticCaptions.tsx";
import type { SceneLayout } from "./layout.ts";
import { ProblemLayout, QuoteLayout, SplitLayout, StatsLayout } from "./Layouts.tsx";
import { MicroAnimation } from "./MicroAnimations.tsx";
import type { MarketingSceneSpec, VideoRatio } from "./types.ts";

interface SceneProps {
  scene: MarketingSceneSpec;
  layout: SceneLayout;
  brandName: string;
  durationInFrames: number;
  ratio: VideoRatio;
}

export const Scene: React.FC<SceneProps> = ({
  scene,
  layout,
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

  const ctaPulse = 1 + Math.sin(frame / 7) * 0.04;
  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1, 1.14], { extrapolateRight: "clamp" });

  const imageSource = scene.imageUrl || scene.imagePath;
  const featuresList = (scene.bulletPoints && scene.bulletPoints.length > 0)
    ? scene.bulletPoints
    : (scene.features && scene.features.length > 0)
    ? scene.features
    : scene.subtitle
    ? [scene.subtitle]
    : scene.floatingTags && scene.floatingTags.length > 0
    ? scene.floatingTags
    : ["Tối ưu hiệu suất vượt trội", "Công nghệ AI tiên phong"];
  const captionText = scene.subtitles?.length ? scene.subtitles.join(" ") : layout === "cta" ? "" : scene.subtitle;
  const layoutProps = { scene, brandName, isVertical, imageSource: imageSource || undefined, durationInFrames };

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
      {imageSource && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          <Img
            src={imageSource}
            alt="Ambient background"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "blur(42px) brightness(0.26) saturate(1.3)",
              transform: `scale(${kenBurnsScale * 1.15})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(7, 10, 18, 0.4) 0%, rgba(7, 10, 18, 0.72) 60%, rgba(7, 10, 18, 0.96) 100%)",
            }}
          />
        </div>
      )}

      {/* Dynamic Background Orbs */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "15%",
          width: width * 0.75,
          height: width * 0.75,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.35) 0%, transparent 70%)",
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
          width: width * 0.85,
          height: width * 0.85,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168, 85, 247, 0.28) 0%, transparent 70%)",
          transform: `translate(${orb2X}px, ${orb2Y}px)`,
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "40%",
          left: "20%",
          width: width * 0.6,
          height: width * 0.6,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(56, 189, 248, 0.22) 0%, transparent 70%)",
          transform: `translate(${Math.cos(frame / 20) * 35}px, ${Math.sin(frame / 22) * 25}px)`,
          filter: "blur(65px)",
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

      {/* =========================================================================
          LAYOUT 1: HOOK SCENE (Cinematic Full-Bleed Hero Image + Punchy Typography)
          ========================================================================= */}
      {layout === "hero" && (
        <>
          {imageSource && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                overflow: "hidden",
              }}
            >
              <Img
                src={imageSource}
                alt={scene.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${kenBurnsScale})`,
                  filter: "brightness(0.38) contrast(1.15)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(7, 10, 18, 0.45) 0%, rgba(7, 10, 18, 0.75) 50%, #070a12 100%)",
                }}
              />
            </div>
          )}

          <div
            style={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: isVertical ? "80px 48px 220px 48px" : "48px 80px",
              boxSizing: "border-box",
              textAlign: "center",
            }}
          >
            {/* High-Impact Top Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "10px 24px",
                borderRadius: "9999px",
                background: "rgba(99, 102, 241, 0.2)",
                border: "1px solid rgba(165, 180, 252, 0.35)",
                backdropFilter: "blur(16px)",
                marginBottom: "32px",
                boxShadow: "0 0 20px rgba(99, 102, 241, 0.3)",
              }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "#ef4444",
                  boxShadow: "0 0 12px #ef4444",
                }}
              />
              <span
                style={{
                  fontSize: isVertical ? "22px" : "18px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#f8fafc",
                  textTransform: "uppercase",
                }}
              >
                {brandName} · TIÊU ĐIỂM
              </span>
            </div>

            {/* Giant Title */}
            <div
              style={{
                transform: `scale(${titleSpring})`,
                maxWidth: "96%",
                marginBottom: "32px",
              }}
            >
              <h1
                style={{
                  fontSize: isVertical ? "58px" : "46px",
                  lineHeight: 1.15,
                  fontWeight: 900,
                  margin: 0,
                  background: "linear-gradient(135deg, #ffffff 0%, #e0e7ff 40%, #818cf8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 6px 30px rgba(0, 0, 0, 0.6))",
                }}
              >
                {scene.title}
              </h1>
            </div>

            {/* Floating Tags */}
            <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />
          </div>
        </>
      )}

      {/* =========================================================================
          LAYOUT 2: FEATURES SCENE (Asymmetrical Split: Photo Top + Staggered Cards Bottom)
          ========================================================================= */}
      {layout === "cards" && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: imageSource ? "flex-start" : "center",
            height: "100%",
            padding: isVertical ? (imageSource ? "65px 44px 220px 44px" : "60px 44px 220px 44px") : "40px 70px",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              padding: "7px 18px",
              borderRadius: "9999px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.18)",
              backdropFilter: "blur(12px)",
              marginBottom: "18px",
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#38bdf8",
                boxShadow: "0 0 10px #38bdf8",
              }}
            />
            <span
              style={{
                fontSize: isVertical ? "19px" : "16px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "#e2e8f0",
                textTransform: "uppercase",
              }}
            >
              {brandName} · CHIẾN LƯỢC
            </span>
          </div>

          <h2
            style={{
              fontSize: isVertical ? "46px" : "38px",
              lineHeight: 1.18,
              fontWeight: 800,
              margin: "0 0 22px 0",
              textAlign: "center",
              background: "linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {scene.title}
          </h2>

          {/* Featured Visual Window */}
          {imageSource ? (
            <div
              style={{
                width: isVertical ? "94%" : "68%",
                height: isVertical ? "32%" : "38%",
                borderRadius: "24px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.22)",
                boxShadow: "0 20px 50px -10px rgba(0, 0, 0, 0.7), 0 0 35px rgba(56, 189, 248, 0.2)",
                position: "relative",
                marginBottom: "20px",
              }}
            >
              <Img
                src={imageSource}
                alt={scene.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${kenBurnsScale})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, transparent 60%, rgba(7, 10, 18, 0.8) 100%)",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: isVertical ? "94%" : "72%",
                margin: "10px 0 24px 0",
                padding: isVertical ? "26px 22px" : "18px",
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(99, 102, 241, 0.18) 0%, rgba(56, 189, 248, 0.12) 100%)",
                border: "1px solid rgba(165, 180, 252, 0.35)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), inset 0 0 30px rgba(99, 102, 241, 0.15)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "24px" }}>⚡</span>
                <span style={{ fontSize: isVertical ? "21px" : "17px", fontWeight: 700, color: "#38bdf8", letterSpacing: "0.06em" }}>
                  AGENTIC AI ARCHITECTURE
                </span>
              </div>
              <div style={{ fontSize: isVertical ? "16px" : "13px", color: "#94a3b8", textAlign: "center" }}>
                {scene.subtitle || "Tối ưu hóa quy trình làm việc và tự động hoá phát triển"}
              </div>
            </div>
          )}

          {/* Staggered Animated Feature Cards */}
          {featuresList && featuresList.length > 0 && (
            <div
              style={{
                width: isVertical ? "94%" : "72%",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {featuresList.map((feat, idx) => {
                const itemSpring = spring({
                  frame: Math.max(0, frame - 6 - idx * 4),
                  fps,
                  config: { damping: 13, mass: 0.6 },
                });
                const icons = ["✦", "⚡", "🛡️", "🚀", "💡"];
                const icon = icons[idx % icons.length];
                return (
                  <div
                    key={idx}
                    style={{
                      transform: `scale(${itemSpring})`,
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      padding: isVertical ? "15px 20px" : "12px 18px",
                      borderRadius: "18px",
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "1px solid rgba(255, 255, 255, 0.14)",
                      backdropFilter: "blur(16px)",
                    }}
                  >
                    <span style={{ fontSize: "20px", color: "#60a5fa" }}>{icon}</span>
                    <span
                      style={{
                        fontSize: isVertical ? "23px" : "19px",
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

          <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />
        </div>
      )}

      {/* =========================================================================
          LAYOUT 3: CTA SCENE (Pulsing High-Conversion Action Button + Authority Badge)
          ========================================================================= */}
      {layout === "cta" && (
        <>
          {imageSource && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                overflow: "hidden",
              }}
            >
              <Img
                src={imageSource}
                alt={scene.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  filter: "blur(24px) brightness(0.25)",
                  transform: "scale(1.1)",
                }}
              />
            </div>
          )}

          <div
            style={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              padding: isVertical ? "80px 48px 220px 48px" : "48px 80px",
              boxSizing: "border-box",
              textAlign: "center",
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 22px",
                borderRadius: "9999px",
                background: "rgba(236, 72, 153, 0.2)",
                border: "1px solid rgba(244, 114, 182, 0.4)",
                backdropFilter: "blur(12px)",
                marginBottom: "28px",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#ec4899",
                  boxShadow: "0 0 10px #ec4899",
                }}
              />
              <span
                style={{
                  fontSize: isVertical ? "20px" : "17px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#fbcfe8",
                  textTransform: "uppercase",
                }}
              >
                {brandName} · HÀNH ĐỘNG
              </span>
            </div>

            <div
              style={{
                transform: `scale(${titleSpring})`,
                maxWidth: "94%",
                marginBottom: "36px",
              }}
            >
              <h1
                style={{
                  fontSize: isVertical ? "54px" : "44px",
                  lineHeight: 1.18,
                  fontWeight: 900,
                  margin: 0,
                  background: "linear-gradient(135deg, #ffffff 0%, #fbcfe8 50%, #f472b6 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 6px 30px rgba(0, 0, 0, 0.5))",
                }}
              >
                {scene.title}
              </h1>
            </div>

            {/* Giant Pulsing Action Button */}
            <div
              style={{
                transform: `scale(${ctaPulse})`,
                marginBottom: "28px",
              }}
            >
              <div
                style={{
                  padding: isVertical ? "22px 52px" : "18px 40px",
                  borderRadius: "9999px",
                  background: "linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)",
                  boxShadow:
                    "0 15px 45px rgba(99, 102, 241, 0.6), 0 0 30px rgba(236, 72, 153, 0.4)",
                  fontWeight: 800,
                  fontSize: isVertical ? "28px" : "22px",
                  color: "#ffffff",
                  letterSpacing: "0.04em",
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                }}
              >
                <span>{scene.subtitle || "Bắt Đầu Ngay"}</span>
                <span style={{ fontSize: "30px" }}>➔</span>
              </div>
            </div>

            <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />
          </div>
        </>
      )}

      {/* =========================================================================
          LAYOUT 4: PRODUCT / SHOWCASE (3D Floating Glass Frame with Badges)
          ========================================================================= */}
      {layout === "problem" && <ProblemLayout {...layoutProps} />}
      {layout === "split" && <SplitLayout {...layoutProps} />}
      {layout === "stats" && <StatsLayout {...layoutProps} />}
      {layout === "quote" && <QuoteLayout {...layoutProps} />}

      {layout === "showcase" && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            height: "100%",
            padding: isVertical ? "70px 48px 220px 48px" : "48px 80px",
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
              marginBottom: isVertical ? "24px" : "16px",
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
              marginBottom: isVertical ? "26px" : "18px",
            }}
          >
            <h1
              style={{
                fontSize: isVertical ? "50px" : "42px",
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

          <DeviceMockup imageSource={imageSource || undefined} isVertical={isVertical} />

          {scene.subtitle && (
            <div
              style={{
                marginTop: isVertical ? "18px" : "12px",
                marginBottom: isVertical ? "16px" : "10px",
                padding: isVertical ? "12px 28px" : "10px 22px",
                borderRadius: "18px",
                background: "rgba(255, 255, 255, 0.08)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                backdropFilter: "blur(16px)",
                maxWidth: isVertical ? "92%" : "72%",
                textAlign: "center",
                boxShadow: "0 10px 30px rgba(0, 0, 0, 0.4)",
              }}
            >
              <span
                style={{
                  fontSize: isVertical ? "22px" : "18px",
                  fontWeight: 600,
                  color: "#f1f5f9",
                  lineHeight: 1.35,
                }}
              >
                {scene.subtitle}
              </span>
            </div>
          )}

          <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />
        </div>
      )}

      {/* Synchronized Kinetic Captions for voiceover / narration */}
      {captionText && layout !== "quote" && (
        <KineticCaptions text={captionText} isVertical={isVertical} />
      )}
    </AbsoluteFill>
  );
};
