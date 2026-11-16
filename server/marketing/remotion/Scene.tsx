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
import type { SceneLayout } from "./layout.ts";
import {
  ProblemLayout,
  QuoteLayout,
  SplitLayout,
  StatsLayout,
  TelemetryAlertLayout,
  SwarmTopologyLayout,
  SplineChartLayout,
  VictoryOutroLayout,
} from "./Layouts.tsx";
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
  const kenBurnsScale = interpolate(frame, [0, durationInFrames], [1.02, 1.13], { extrapolateRight: "clamp" });
  const zoomOutScale = interpolate(frame, [0, durationInFrames], [1.14, 1.02], { extrapolateRight: "clamp" });
  const panX = interpolate(frame, [0, durationInFrames], [-18, 18], { extrapolateRight: "clamp" });

  const imageSource = scene.imageUrl || scene.imagePath;
  const rawFeatures = (scene.bulletPoints && scene.bulletPoints.length > 0)
    ? scene.bulletPoints
    : (scene.features && scene.features.length > 0)
    ? scene.features
    : [];
  const titleNorm = (scene.title || "").trim().toUpperCase();
  const subtitleNorm = (scene.subtitle || "").trim().toUpperCase();
  const featuresList = rawFeatures.filter((f) => {
    const norm = f.trim().toUpperCase();
    return norm.length > 0 && norm !== titleNorm && norm !== subtitleNorm;
  });
  const layoutProps = { scene, brandName, isVertical, imageSource: imageSource || undefined, durationInFrames };

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0a0d14",
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
              filter: "blur(26px) brightness(0.72) saturate(1.2)",
              transform: `scale(${kenBurnsScale * 1.12})`,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(10, 13, 20, 0.2) 0%, rgba(10, 13, 20, 0.35) 55%, rgba(10, 13, 20, 0.78) 100%)",
            }}
          />
        </div>
      )}

      {/* Subtle Warm & Cool Ambient Lighting */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          left: "15%",
          width: width * 0.75,
          height: width * 0.75,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, transparent 70%)",
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
          background: "radial-gradient(circle, rgba(251, 191, 36, 0.12) 0%, transparent 70%)",
          transform: `translate(${orb2X}px, ${orb2Y}px)`,
          filter: "blur(70px)",
          pointerEvents: "none",
        }}
      />
      <MicroAnimation type={scene.animationType} isVertical={isVertical} />

      {/* =========================================================================
          LAYOUT 1: HOOK SCENE (Full-Bleed Commercial Photography + Editorial Lower/Upper Hook)
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
                  filter: "brightness(0.92) contrast(1.05)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.05) 38%, rgba(0, 0, 0, 0.15) 62%, rgba(0, 0, 0, 0.78) 100%)",
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
              alignItems: "flex-start",
              justifyContent: "flex-start",
              height: "100%",
              padding: isVertical ? "88px 48px 240px 48px" : "56px 80px",
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
                background: "rgba(255, 255, 255, 0.16)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                backdropFilter: "blur(14px)",
                marginBottom: "20px",
              }}
            >
              <span
                style={{
                  fontSize: isVertical ? "19px" : "16px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                {brandName}
              </span>
            </div>

            <div
              style={{
                transform: `scale(${titleSpring})`,
                transformOrigin: "left top",
                maxWidth: "94%",
                marginBottom: "24px",
              }}
            >
              <h1
                style={{
                  fontSize: isVertical ? "56px" : "46px",
                  lineHeight: 1.15,
                  fontWeight: 900,
                  margin: 0,
                  color: "#ffffff",
                  textShadow: "0 4px 28px rgba(0, 0, 0, 0.65)",
                }}
              >
                {scene.title}
              </h1>
            </div>

            <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />
          </div>
        </>
      )}

      {/* =========================================================================
          LAYOUT 2: EDITORIAL MAGAZINE PORTRAIT (Large Framed Photo + Minimal Title)
          ========================================================================= */}
      {layout === "cards" && (
        <div
          style={{
            position: "relative",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            height: "100%",
            padding: isVertical ? "68px 40px 230px 40px" : "40px 70px",
            boxSizing: "border-box",
          }}
        >
          {imageSource ? (
            <div
              style={{
                width: isVertical ? "96%" : "76%",
                flex: 1,
                borderRadius: "32px",
                overflow: "hidden",
                border: "1px solid rgba(255, 255, 255, 0.28)",
                boxShadow: "0 28px 65px -12px rgba(0, 0, 0, 0.75)",
                position: "relative",
                marginBottom: featuresList.length > 0 ? "18px" : "0px",
              }}
            >
              <Img
                src={imageSource}
                alt={scene.title}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${zoomOutScale}) translateX(${panX * 0.4}px)`,
                  filter: "brightness(0.95) contrast(1.04)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0, 0, 0, 0.5) 0%, transparent 35%, transparent 65%, rgba(0, 0, 0, 0.65) 100%)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: isVertical ? "28px" : "20px",
                  left: isVertical ? "28px" : "24px",
                  right: isVertical ? "28px" : "24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "10px",
                }}
              >
                <span
                  style={{
                    padding: "6px 16px",
                    borderRadius: "9999px",
                    background: "rgba(0, 0, 0, 0.45)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    backdropFilter: "blur(10px)",
                    fontSize: isVertical ? "17px" : "14px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    color: "#f8fafc",
                    textTransform: "uppercase",
                  }}
                >
                  {brandName}
                </span>
                <h2
                  style={{
                    fontSize: isVertical ? "44px" : "36px",
                    lineHeight: 1.16,
                    fontWeight: 800,
                    margin: 0,
                    color: "#ffffff",
                    textShadow: "0 4px 20px rgba(0, 0, 0, 0.7)",
                  }}
                >
                  {scene.title}
                </h2>
              </div>
            </div>
          ) : (
            <h2
              style={{
                fontSize: isVertical ? "48px" : "38px",
                lineHeight: 1.18,
                fontWeight: 800,
                margin: "0 0 24px 0",
                textAlign: "center",
                color: "#ffffff",
              }}
            >
              {scene.title}
            </h2>
          )}

          {featuresList.length > 0 && (
            <div
              style={{
                width: isVertical ? "96%" : "76%",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {featuresList.slice(0, 3).map((feat, idx) => {
                const itemSpring = spring({
                  frame: Math.max(0, frame - 6 - idx * 4),
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
                      gap: "14px",
                      padding: isVertical ? "14px 22px" : "12px 18px",
                      borderRadius: "18px",
                      background: "rgba(255, 255, 255, 0.12)",
                      border: "1px solid rgba(255, 255, 255, 0.22)",
                      backdropFilter: "blur(16px)",
                    }}
                  >
                    <span style={{ fontSize: "20px", color: "#fbbf24" }}>✦</span>
                    <span
                      style={{
                        fontSize: isVertical ? "23px" : "19px",
                        fontWeight: 600,
                        color: "#ffffff",
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
          LAYOUT 3: CTA SCENE (Full-Bleed Photography + Clean Modern Action Card)
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
                  filter: "brightness(0.84) contrast(1.06)",
                  transform: `scale(${kenBurnsScale})`,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.35) 50%, rgba(0, 0, 0, 0.82) 100%)",
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
              padding: isVertical ? "80px 48px 230px 48px" : "48px 80px",
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
                background: "rgba(255, 255, 255, 0.16)",
                border: "1px solid rgba(255, 255, 255, 0.32)",
                backdropFilter: "blur(14px)",
                marginBottom: "24px",
              }}
            >
              <span
                style={{
                  fontSize: isVertical ? "20px" : "17px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  color: "#ffffff",
                  textTransform: "uppercase",
                }}
              >
                {brandName}
              </span>
            </div>

            <div
              style={{
                transform: `scale(${titleSpring})`,
                maxWidth: "94%",
                marginBottom: "34px",
              }}
            >
              <h1
                style={{
                  fontSize: isVertical ? "54px" : "44px",
                  lineHeight: 1.18,
                  fontWeight: 900,
                  margin: 0,
                  color: "#ffffff",
                  textShadow: "0 6px 30px rgba(0, 0, 0, 0.65)",
                }}
              >
                {scene.title}
              </h1>
            </div>

            <div
              style={{
                transform: `scale(${ctaPulse})`,
                marginBottom: "24px",
              }}
            >
              <div
                style={{
                  padding: isVertical ? "20px 48px" : "16px 38px",
                  borderRadius: "9999px",
                  background: "#ffffff",
                  boxShadow: "0 18px 45px rgba(0, 0, 0, 0.45)",
                  fontWeight: 800,
                  fontSize: isVertical ? "27px" : "22px",
                  color: "#0f172a",
                  letterSpacing: "0.02em",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span>Khám Phá Ngay</span>
                <span style={{ fontSize: "26px" }}>➔</span>
              </div>
            </div>

            <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />
          </div>
        </>
      )}

      {/* =========================================================================
          LAYOUT 4: PRODUCT / SHOWCASE (Full-Bleed Cinematic B-Roll + Floating Glass Tag)
          ========================================================================= */}
      {layout === "problem" && <ProblemLayout {...layoutProps} />}
      {layout === "split" && <SplitLayout {...layoutProps} />}
      {layout === "stats" && <StatsLayout {...layoutProps} />}
      {layout === "quote" && <QuoteLayout {...layoutProps} />}
      {layout === "telemetry" && <TelemetryAlertLayout {...layoutProps} />}
      {layout === "swarm" && <SwarmTopologyLayout {...layoutProps} />}
      {layout === "chart" && <SplineChartLayout {...layoutProps} />}
      {layout === "outro" && <VictoryOutroLayout {...layoutProps} />}

      {layout === "showcase" && (
        <>
          {imageSource ? (
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
                  transform: `scale(${kenBurnsScale * 1.03}) translateX(${panX}px)`,
                  filter: "brightness(0.93) contrast(1.05)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.04) 35%, rgba(0, 0, 0, 0.08) 65%, rgba(0, 0, 0, 0.76) 100%)",
                }}
              />
            </div>
          ) : (
            <div
              style={{
                position: "relative",
                zIndex: 10,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                padding: isVertical ? "70px 48px 220px 48px" : "48px 80px",
              }}
            >
              <DeviceMockup imageSource={undefined} isVertical={isVertical} />
            </div>
          )}

          <div
            style={{
              position: "relative",
              zIndex: 10,
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "flex-start",
              height: "100%",
              padding: isVertical ? "76px 44px 230px 44px" : "48px 80px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                padding: isVertical ? "20px 28px" : "16px 24px",
                borderRadius: "24px",
                background: "rgba(15, 23, 42, 0.52)",
                border: "1px solid rgba(255, 255, 255, 0.24)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 16px 40px rgba(0, 0, 0, 0.45)",
                maxWidth: isVertical ? "90%" : "65%",
                transform: `translateY(${interpolate(frame, [0, 14], [-18, 0], { extrapolateRight: "clamp" })}px)`,
              }}
            >
              <div
                style={{
                  fontSize: isVertical ? "16px" : "14px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "#fcd34d",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                {brandName}
              </div>
              <h1
                style={{
                  fontSize: isVertical ? "40px" : "34px",
                  lineHeight: 1.18,
                  fontWeight: 800,
                  margin: 0,
                  color: "#ffffff",
                }}
              >
                {scene.title}
              </h1>
            </div>

            <FloatingBadges tags={scene.floatingTags} isVertical={isVertical} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};
