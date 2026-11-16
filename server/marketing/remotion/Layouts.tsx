import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig, Video } from "remotion";
import { parseStat } from "./layout.ts";
import type { MarketingSceneSpec } from "./types.ts";

interface LayoutProps {
  scene: MarketingSceneSpec;
  brandName: string;
  isVertical: boolean;
  imageSource?: string;
  durationInFrames: number;
}

function bulletsOf(scene: MarketingSceneSpec): string[] {
  return (scene.bulletPoints?.length ? scene.bulletPoints : scene.features) ?? [];
}

const Badge: React.FC<{ text: string; color: string; isVertical: boolean }> = ({ text, color, isVertical }) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      padding: "8px 20px",
      borderRadius: "9999px",
      background: `${color}33`,
      border: `1px solid ${color}88`,
      backdropFilter: "blur(12px)",
    }}
  >
    <span style={{ width: "9px", height: "9px", borderRadius: "50%", backgroundColor: color, boxShadow: `0 0 12px ${color}` }} />
    <span
      style={{
        fontSize: isVertical ? "20px" : "16px",
        fontWeight: 700,
        letterSpacing: "0.1em",
        color: "#f8fafc",
        textTransform: "uppercase",
      }}
    >
      {text}
    </span>
  </div>
);

export const ProblemLayout: React.FC<LayoutProps> = ({ scene, brandName, isVertical, imageSource, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.1, 1.02], { extrapolateRight: "clamp" });
  const titleNorm = (scene.title || "").trim().toUpperCase();
  const bullets = bulletsOf(scene).filter((b) => b.trim().toUpperCase() !== titleNorm);

  return (
    <>
      {imageSource && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden" }}>
          <Img
            src={imageSource}
            alt={scene.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              filter: "brightness(0.84) contrast(1.06)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0, 0, 0, 0.35) 0%, rgba(0, 0, 0, 0.25) 45%, rgba(0, 0, 0, 0.82) 100%)",
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
          justifyContent: "center",
          height: "100%",
          padding: isVertical ? "140px 52px 260px 52px" : "90px 100px",
          boxSizing: "border-box",
          gap: "24px",
        }}
      >
        <Badge text={brandName} color="#f59e0b" isVertical={isVertical} />
        <h1
          style={{
            fontSize: isVertical ? "56px" : "46px",
            lineHeight: 1.15,
            fontWeight: 900,
            margin: 0,
            color: "#fff",
            textShadow: "0 4px 28px rgba(0, 0, 0, 0.7)",
          }}
        >
          {scene.title}
        </h1>
        {bullets.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {bullets.slice(0, 3).map((item, idx) => {
              const enter = spring({ frame: Math.max(0, frame - 8 - idx * 5), fps, config: { damping: 14 } });
              return (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    opacity: enter,
                    transform: `translateY(${(1 - enter) * 30}px)`,
                    padding: isVertical ? "16px 22px" : "14px 18px",
                    borderLeft: "5px solid #fbbf24",
                    background: "rgba(15, 23, 42, 0.65)",
                    backdropFilter: "blur(14px)",
                    borderRadius: "0 16px 16px 0",
                  }}
                >
                  <span style={{ fontSize: isVertical ? "26px" : "20px", fontWeight: 600, color: "#f8fafc" }}>{item}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export const SplitLayout: React.FC<LayoutProps> = ({ scene, brandName, isVertical, imageSource, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleNorm = (scene.title || "").trim().toUpperCase();
  const distinctBullets = bulletsOf(scene).filter((b) => b.trim().toUpperCase() !== titleNorm);
  const cardSpring = spring({ frame, fps, config: { damping: 14, mass: 0.7 } });
  const zoom = interpolate(frame, [0, durationInFrames], [1.03, 1.13], { extrapolateRight: "clamp" });
  const panY = interpolate(frame, [0, durationInFrames], [10, -14], { extrapolateRight: "clamp" });

  if (distinctBullets.length < 2) {
    return (
      <>
        {imageSource && (
          <div style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden" }}>
            <Img
              src={imageSource}
              alt={scene.title}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: `scale(${zoom}) translateY(${panY}px)`,
                filter: "brightness(0.92) contrast(1.05)",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.1) 45%, rgba(0, 0, 0, 0.78) 100%)",
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
            justifyContent: "flex-end",
            alignItems: "flex-start",
            height: "100%",
            padding: isVertical ? "80px 44px 360px 44px" : "60px 80px 180px 80px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              transform: `translateY(${(1 - cardSpring) * 40}px)`,
              opacity: cardSpring,
              padding: isVertical ? "28px 32px" : "22px 28px",
              borderRadius: "28px",
              background: "rgba(15, 23, 42, 0.58)",
              border: "1px solid rgba(255, 255, 255, 0.26)",
              backdropFilter: "blur(18px)",
              boxShadow: "0 24px 50px rgba(0, 0, 0, 0.55)",
              borderLeft: "6px solid #38bdf8",
              maxWidth: isVertical ? "94%" : "70%",
            }}
          >
            <div
              style={{
                fontSize: isVertical ? "17px" : "14px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: "#7dd3fc",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              {brandName}
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: isVertical ? "44px" : "36px",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.18,
              }}
            >
              {scene.title}
            </h2>
            {distinctBullets[0] && (
              <div
                style={{
                  marginTop: "14px",
                  fontSize: isVertical ? "24px" : "20px",
                  fontWeight: 600,
                  color: "#e2e8f0",
                }}
              >
                {distinctBullets[0]}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  const [left, right] = distinctBullets;
  const panelA = spring({ frame, fps, config: { damping: 15 } });
  const panelB = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 15 } });

  return (
    <>
      {imageSource && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden" }}>
          <Img
            src={imageSource}
            alt={scene.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              filter: "brightness(0.85) contrast(1.05)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, rgba(0, 0, 0, 0.45) 0%, rgba(0, 0, 0, 0.35) 50%, rgba(0, 0, 0, 0.82) 100%)",
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
          justifyContent: "center",
          height: "100%",
          padding: isVertical ? "90px 44px 280px 44px" : "50px 80px 150px 80px",
          boxSizing: "border-box",
          gap: "24px",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: isVertical ? "46px" : "38px",
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.15,
            textAlign: "center",
            textShadow: "0 4px 24px rgba(0, 0, 0, 0.7)",
          }}
        >
          {scene.title}
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: isVertical ? "1fr" : "1fr 1fr", gap: "20px" }}>
          <div
            style={{
              transform: `scale(${panelA})`,
              padding: isVertical ? "28px 30px" : "24px",
              borderRadius: "24px",
              background: "rgba(15, 23, 42, 0.65)",
              border: "1px solid rgba(255, 255, 255, 0.22)",
              backdropFilter: "blur(16px)",
            }}
          >
            <span style={{ fontSize: isVertical ? "32px" : "26px", fontWeight: 700, color: "#e2e8f0", lineHeight: 1.25 }}>
              {left}
            </span>
          </div>
          <div
            style={{
              transform: `scale(${panelB})`,
              padding: isVertical ? "28px 30px" : "24px",
              borderRadius: "24px",
              background: "rgba(16, 185, 129, 0.25)",
              border: "1px solid rgba(52, 211, 153, 0.45)",
              backdropFilter: "blur(16px)",
            }}
          >
            <span style={{ fontSize: isVertical ? "32px" : "26px", fontWeight: 800, color: "#ffffff", lineHeight: 1.25 }}>
              {right}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export const StatsLayout: React.FC<LayoutProps> = ({ scene, brandName, isVertical, imageSource, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const zoom = interpolate(frame, [0, durationInFrames], [1.02, 1.12], { extrapolateRight: "clamp" });
  const displayTitle = (scene.title || "")
    .replace(/^[^|]+\|\s*/, "")
    .trim();
  const titleNorm = displayTitle.toUpperCase();
  const rawItems = bulletsOf(scene).slice(0, 4);
  const stats = rawItems
    .map((text) => ({ text, stat: parseStat(text) }))
    .filter(({ text, stat }) => stat !== null || text.trim().toUpperCase() !== titleNorm);
  const maxValue = Math.max(1, ...stats.map(({ stat }) => stat?.value ?? 0));
  const singleStatSameAsTitle = stats.length === 1 && stats[0]?.stat?.label.trim().toUpperCase() === titleNorm;

  return (
    <>
      {imageSource && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden" }}>
          <Img
            src={imageSource}
            alt={displayTitle}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              filter: "brightness(0.86) contrast(1.06)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0%, rgba(0, 0, 0, 0.22) 45%, rgba(0, 0, 0, 0.82) 100%)",
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
          padding: isVertical ? "110px 48px 300px 48px" : "60px 90px",
          boxSizing: "border-box",
          gap: isVertical ? "28px" : "22px",
        }}
      >
        <Badge text={brandName} color="#38bdf8" isVertical={isVertical} />
        {!singleStatSameAsTitle && (
          <h2
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: isVertical ? "50px" : "42px",
              fontWeight: 900,
              lineHeight: 1.15,
              color: "#ffffff",
              textShadow: "0 4px 28px rgba(0, 0, 0, 0.7)",
            }}
          >
            {displayTitle}
          </h2>
        )}
        {stats.length > 0 && (
          <div
            style={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: isVertical || stats.length < 3 ? "1fr" : "1fr 1fr",
              gap: "18px",
            }}
          >
            {stats.map(({ text, stat }, idx) => {
              const progress = spring({ frame: Math.max(0, frame - 6 - idx * 7), fps, config: { damping: 20, mass: 1.2 } });
              const isYear = stat && Number.isInteger(stat.value) && stat.value >= 1900 && stat.value <= 2100 && !stat.suffix;
              const shown = stat ? (isYear ? stat.value : stat.value * progress) : 0;
              const decimals = stat && !Number.isInteger(stat.value) ? 1 : 0;
              return (
                <div
                  key={idx}
                  style={{
                    padding: isVertical ? "24px 28px" : "20px 24px",
                    borderRadius: "24px",
                    background: "rgba(15, 23, 42, 0.62)",
                    border: "1px solid rgba(255, 255, 255, 0.25)",
                    backdropFilter: "blur(18px)",
                    boxShadow: "0 20px 45px rgba(0, 0, 0, 0.45)",
                    opacity: progress,
                    transform: `translateY(${(1 - progress) * 50}px)`,
                  }}
                >
                  {stat ? (
                    <>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                        {stat.prefix && (
                          <span style={{ fontSize: isVertical ? "26px" : "20px", color: "#cbd5e1", fontWeight: 700 }}>{stat.prefix}</span>
                        )}
                        <span
                          style={{
                            fontSize: isVertical ? "84px" : "64px",
                            fontWeight: 900,
                            lineHeight: 1,
                            fontVariantNumeric: "tabular-nums",
                            color: "#38bdf8",
                          }}
                        >
                          {shown.toFixed(decimals)}
                          {stat.suffix}
                        </span>
                      </div>
                      <div style={{ marginTop: "10px", fontSize: isVertical ? "26px" : "20px", fontWeight: 600, color: "#f8fafc" }}>
                        {stat.label}
                      </div>
                      <div style={{ marginTop: "14px", height: "8px", borderRadius: "9999px", background: "rgba(255, 255, 255, 0.14)" }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: "9999px",
                            width: `${Math.max(12, (stat.value / maxValue) * 100) * progress}%`,
                            background: "linear-gradient(90deg, #38bdf8, #818cf8)",
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: isVertical ? "28px" : "22px", fontWeight: 700, color: "#f8fafc" }}>{text}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export const QuoteLayout: React.FC<LayoutProps> = ({ scene, brandName, isVertical, imageSource, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 12, mass: 0.7 } });
  const zoom = interpolate(frame, [0, durationInFrames], [1.12, 1.02], { extrapolateRight: "clamp" });
  const panX = interpolate(frame, [0, durationInFrames], [16, -16], { extrapolateRight: "clamp" });

  return (
    <>
      {imageSource && (
        <div style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden" }}>
          <Img
            src={imageSource}
            alt={scene.title}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom}) translateX(${panX}px)`,
              filter: "brightness(0.9) contrast(1.05)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(0, 0, 0, 0.48) 0%, rgba(0, 0, 0, 0.08) 40%, rgba(0, 0, 0, 0.15) 65%, rgba(0, 0, 0, 0.8) 100%)",
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
          justifyContent: "flex-start",
          alignItems: "center",
          height: "100%",
          padding: isVertical ? "96px 48px 260px 48px" : "64px 100px",
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        <div
          style={{
            transform: `scale(${mark})`,
            padding: isVertical ? "28px 36px" : "22px 32px",
            borderRadius: "28px",
            background: "rgba(15, 23, 42, 0.54)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.45)",
            maxWidth: isVertical ? "92%" : "72%",
          }}
        >
          <div
            style={{
              fontSize: isVertical ? "17px" : "14px",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: "#fcd34d",
              textTransform: "uppercase",
              marginBottom: "10px",
            }}
          >
            {brandName}
          </div>
          <h2
            style={{
              margin: 0,
              fontSize: isVertical ? "44px" : "36px",
              lineHeight: 1.2,
              fontWeight: 800,
              color: "#ffffff",
            }}
          >
            “{scene.title}”
          </h2>
        </div>
      </div>
    </>
  );
};

/* =========================================================================
   LAYOUT 5: TELEMETRY ALERT HUD (Crisis Red / Velocity Cyan)
   ========================================================================= */
export const TelemetryAlertLayout: React.FC<LayoutProps> = ({
  scene,
  brandName,
  isVertical,
  imageSource,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isSpeedTheme =
    scene.themeColor === "cyan" ||
    scene.animationType === "speed" ||
    (!scene.themeColor && scene.title.toLowerCase().includes("tốc độ"));

  const primaryColor = isSpeedTheme ? "#38bdf8" : "#f59e0b";
  const glowColor = isSpeedTheme ? "rgba(56, 189, 248, 0.4)" : "rgba(245, 158, 11, 0.4)";
  const badgeText = scene.floatingTags?.[0] || `${brandName.toUpperCase()} · ĐẶC TÍNH NỔI BẬT`;

  // 3D Parallax Camera
  const scale = interpolate(frame, [0, durationInFrames], [1.02, 1.16], { extrapolateRight: "clamp" });
  const rotateX = interpolate(frame, [0, durationInFrames], [2, -1], { extrapolateRight: "clamp" });

  // Ticking metrics parsed dynamically from bulletPoints
  const bullets = bulletsOf(scene);
  const stat1 = parseStat(bullets[0] || "");
  const stat2 = parseStat(bullets[1] || "");

  const metric1Target = stat1 ? stat1.value : (isSpeedTheme ? 98 : 100);
  const metric1Prefix = stat1 ? stat1.prefix : "";
  const metric1Suffix = stat1 ? stat1.suffix : "%";
  const metric1Label = stat1?.label || bullets[0] || "HIỆU NĂNG TỐI ƯU";

  const metric2Target = stat2 ? stat2.value : (isSpeedTheme ? 100 : 99);
  const metric2Prefix = stat2 ? stat2.prefix : "";
  const metric2Suffix = stat2 ? stat2.suffix : "%";
  const metric2Label = stat2?.label || bullets[1] || "ĐỘ HOÀN THIỆN CAO CẤP";

  const metric1Val = Math.floor(
    interpolate(
      frame,
      [0, durationInFrames],
      [Math.round(metric1Target * 0.25), metric1Target],
      { extrapolateRight: "clamp" },
    ),
  );

  const metric2Val = Math.floor(
    interpolate(
      frame,
      [0, durationInFrames],
      [Math.round(metric2Target * (isSpeedTheme ? 8 : 0.5)), metric2Target],
      { extrapolateRight: "clamp" },
    ),
  );

  const textSpring = spring({ frame: frame - 4, fps, config: { damping: 14, mass: 0.8, stiffness: 100 } });
  const textY = interpolate(textSpring, [0, 1], [30, 0]);
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);

  return (
    <>
      {/* 1. Real-life background footage/image with 3D Depth */}
      {imageSource && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${scale}) rotateX(${rotateX}deg)`,
            transformOrigin: "center center",
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          {scene.videoPath ? (
            <Video
              src={scene.videoPath}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: isSpeedTheme
                  ? "brightness(0.65) contrast(1.2) saturate(1.2)"
                  : "brightness(0.6) contrast(1.25) saturate(1.1)",
              }}
            />
          ) : (
            <Img
              src={imageSource}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: isSpeedTheme
                  ? "brightness(0.65) contrast(1.2) saturate(1.2)"
                  : "brightness(0.6) contrast(1.25) saturate(1.1)",
              }}
            />
          )}
        </div>
      )}

      {/* 2. Cinematic Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "radial-gradient(circle at center, transparent 20%, rgba(2, 6, 23, 0.75) 70%, rgba(2, 6, 23, 0.96) 100%)",
        }}
      />

      {/* 3. Cyber Scanning Laser */}
      <div
        style={{
          position: "absolute",
          top: `${(frame * (isVertical ? 5 : 3)) % (isVertical ? 1920 : 1080)}px`,
          left: 0,
          right: 0,
          height: "2px",
          background: `linear-gradient(90deg, transparent, ${primaryColor}, transparent)`,
          boxShadow: `0 0 15px ${glowColor}`,
          zIndex: 3,
        }}
      />

      {/* 4. Top Telemetry Tag & Headline */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 130 : 60,
          left: isVertical ? 60 : 80,
          right: isVertical ? 60 : 80,
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
          display: "flex",
          flexDirection: "column",
          gap: isVertical ? 16 : 10,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              padding: "6px 20px",
              borderRadius: "9999px",
              backgroundColor: isSpeedTheme ? "rgba(56, 189, 248, 0.18)" : "rgba(239, 68, 68, 0.2)",
              border: `1px solid ${primaryColor}`,
              color: primaryColor,
              fontSize: isVertical ? 22 : 16,
              fontWeight: 800,
              letterSpacing: "0.12em",
              boxShadow: `0 0 16px ${glowColor}`,
            }}
          >
            {badgeText}
          </span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: isVertical ? 20 : 14, fontWeight: 700 }}>
            {brandName} INTELLIGENCE
          </span>
        </div>

        <div
          style={{
            fontSize: isVertical ? 48 : 36,
            fontWeight: 900,
            lineHeight: 1.25,
            color: "#ffffff",
            textShadow: "0 4px 25px rgba(0,0,0,0.9)",
          }}
        >
          {scene.title}{" "}
          {scene.subtitle && (
            <span
              style={{
                color: primaryColor,
                background: isSpeedTheme
                  ? "linear-gradient(135deg, #38bdf8 0%, #34d399 100%)"
                  : "linear-gradient(135deg, #f87171 0%, #ef4444 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                borderBottom: `4px solid ${primaryColor}`,
                paddingBottom: 2,
              }}
            >
              {scene.subtitle}
            </span>
          )}
        </div>
      </div>

      {/* 5. Center Telemetry HUD Cards */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 360 : 200,
          left: isVertical ? 60 : 80,
          right: isVertical ? 60 : 80,
          display: "grid",
          gridTemplateColumns: isVertical ? "1fr" : "1fr 1fr",
          gap: isVertical ? 24 : 32,
          zIndex: 10,
        }}
      >
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            border: `1px solid ${primaryColor}66`,
            padding: isVertical ? "28px 32px" : "20px 24px",
            boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 20px ${glowColor}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: isVertical ? 18 : 14, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
              // {metric1Label.toUpperCase()}
            </span>
            <span style={{ color: primaryColor, fontSize: isVertical ? 18 : 14, fontWeight: 800 }}>
              {isSpeedTheme ? "● PEAK LOAD" : "● CRITICAL ALERT"}
            </span>
          </div>
          <div
            style={{
              fontSize: isVertical ? 52 : 40,
              fontWeight: 900,
              color: primaryColor,
              fontFamily: "monospace",
              letterSpacing: "-0.02em",
            }}
          >
            {metric1Prefix}{metric1Val.toLocaleString()}{metric1Suffix}
          </div>
          <div style={{ fontSize: isVertical ? 20 : 15, color: "#94a3b8" }}>
            {bullets[0] || (isSpeedTheme ? "Tốc độ xử lý biến động thị trường theo mili-giây" : "Lãng phí ngân sách do quyết định chậm trễ")}
          </div>
        </div>

        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(20px)",
            borderRadius: 24,
            border: `1px solid ${primaryColor}66`,
            padding: isVertical ? "28px 32px" : "20px 24px",
            boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 20px ${glowColor}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: isVertical ? 18 : 14, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
              // {metric2Label.toUpperCase()}
            </span>
            <span style={{ color: primaryColor, fontSize: isVertical ? 18 : 14, fontWeight: 800 }}>
              {isSpeedTheme ? "● OPTIMIZED" : "● SPIKING"}
            </span>
          </div>
          <div
            style={{
              fontSize: isVertical ? 52 : 40,
              fontWeight: 900,
              color: isSpeedTheme ? "#34d399" : "#fbbf24",
              fontFamily: "monospace",
              letterSpacing: "-0.02em",
            }}
          >
            {metric2Prefix}{metric2Val.toLocaleString()}{metric2Suffix}
          </div>
          <div style={{ fontSize: isVertical ? 20 : 15, color: "#94a3b8" }}>
            {bullets[1] || (isSpeedTheme ? "Phản hồi tự động trước khi đối thủ kịp nhận biết" : "Chi phí khách hàng tăng vọt do target sai đối tượng")}
          </div>
        </div>
      </div>

      {/* 6. Bottom Status Stream */}
      <div
        style={{
          position: "absolute",
          bottom: isVertical ? 110 : 40,
          left: isVertical ? 50 : 80,
          right: isVertical ? 50 : 80,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(20px)",
          borderRadius: 20,
          border: "1px solid rgba(255, 255, 255, 0.14)",
          padding: isVertical ? "20px 28px" : "14px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: isVertical ? 18 : 14, fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>
          // CHẤT LƯỢNG CHÍNH HÃNG
        </span>
        <span style={{ fontSize: isVertical ? 18 : 14, fontWeight: 700, color: primaryColor }}>
          {scene.subtitle || `${brandName.toUpperCase()} · ĐỈNH CAO TRẢI NGHIỆM`}
        </span>
      </div>
    </>
  );
};

/* =========================================================================
   LAYOUT 6: SWARM TOPOLOGY (100% Remotion Motion Graphics Multi-Agent Network)
   ========================================================================= */
export const SwarmTopologyLayout: React.FC<LayoutProps> = ({
  scene,
  brandName,
  isVertical,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerSpring = spring({ frame: frame - 6, fps, config: { damping: 14, mass: 0.8, stiffness: 100 } });
  const headerY = interpolate(headerSpring, [0, 1], [40, 0]);
  const headerOpacity = interpolate(headerSpring, [0, 1], [0, 1]);

  const networkScale = interpolate(
    spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 90 } }),
    [0, 1],
    [0.92, 1],
  );

  // Traveling data packets (looped)
  const p1_t = ((frame * 1.6) % 100) / 100;
  const p2_t = (((frame + 25) * 1.6) % 100) / 100;
  const p3_t = (((frame + 50) * 1.6) % 100) / 100;
  const p4_t = (((frame + 75) * 1.6) % 100) / 100;

  const getQuadBezier = (p0: [number, number], p1: [number, number], p2: [number, number], t: number) => {
    const x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0];
    const y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1];
    return { x, y };
  };

  const center: [number, number] = [490, 240];
  const a1 = getQuadBezier(center, [330, 120], [170, 90], p1_t);
  const a2 = getQuadBezier(center, [650, 120], [810, 90], p2_t);
  const a3 = getQuadBezier(center, [330, 360], [170, 390], p3_t);
  const a4 = getQuadBezier(center, [650, 360], [810, 390], p4_t);

  const corePulse = 1 + Math.sin(frame * 0.1) * 0.06;
  const coreGlow = 0.4 + Math.sin(frame * 0.1) * 0.25;

  const bullets = bulletsOf(scene);
  const parseNode = (bullet: string | undefined, defaultTitle: string, defaultDesc: string) => {
    if (!bullet) return { title: defaultTitle, desc: defaultDesc };
    const parts = bullet.split(/\s*[:|–—-]\s+/);
    if (parts.length >= 2) {
      return { title: parts[0]!.trim(), desc: parts.slice(1).join(" ").trim() };
    }
    return { title: bullet.trim(), desc: defaultDesc };
  };

  const node1 = parseNode(bullets[0], "🎯 Strategy Agent", "Tín hiệu thị trường");
  const node2 = parseNode(bullets[1], "✍️ Creative Agent", "Đa định dạng nội dung");
  const node3 = parseNode(bullets[2], "⚡ Ad Optimizer", "Tối ưu ngân sách 24/7");
  const node4 = parseNode(bullets[3], "💰 Sales Closer", "Tăng trưởng chuyển đổi");

  const coreTitle = brandName ? brandName.toUpperCase() : "CORE";
  const coreSubtitle = scene.floatingTags?.[0] || "DECISION";
  const statusLog = scene.subtitle || bullets[4] || `Hệ thống tác tử ${brandName} tự động vận hành thời gian thực`;

  return (
    <>
      {/* Ambient Gradient Mesh */}
      <div
        style={{
          position: "absolute",
          top: "-15%",
          right: "-10%",
          width: "700px",
          height: "700px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%)",
          filter: "blur(90px)",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "-10%",
          left: "-10%",
          width: "650px",
          height: "650px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(16, 185, 129, 0.25) 0%, transparent 70%)",
          filter: "blur(100px)",
          zIndex: 1,
        }}
      />

      {/* Cyber Grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          zIndex: 2,
        }}
      />

      {/* Header */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 110 : 50,
          left: isVertical ? 60 : 80,
          right: isVertical ? 60 : 80,
          transform: `translateY(${headerY}px)`,
          opacity: headerOpacity,
          display: "flex",
          flexDirection: "column",
          gap: isVertical ? 16 : 8,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              padding: "6px 20px",
              borderRadius: "9999px",
              backgroundColor: "rgba(56, 189, 248, 0.18)",
              border: "1px solid rgba(56, 189, 248, 0.6)",
              color: "#38bdf8",
              fontSize: isVertical ? 22 : 15,
              fontWeight: 800,
              letterSpacing: "0.12em",
            }}
          >
            ● INTELLIGENCE DECISION
          </span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: isVertical ? 20 : 14, fontWeight: 700 }}>
            {brandName} SWARM
          </span>
        </div>

        <div style={{ fontSize: isVertical ? 48 : 34, fontWeight: 900, lineHeight: 1.25, color: "#ffffff" }}>
          {scene.title}{" "}
          {scene.subtitle && (
            <span
              style={{
                background: "linear-gradient(135deg, #38bdf8 0%, #34d399 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {scene.subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Center Swarm Network Card */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 340 : 160,
          left: isVertical ? 50 : 80,
          right: isVertical ? 50 : 80,
          height: isVertical ? 680 : 560,
          backgroundColor: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(24px)",
          borderRadius: 32,
          border: "1px solid rgba(255, 255, 255, 0.14)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.8)",
          transform: `scale(${networkScale})`,
          overflow: "hidden",
          zIndex: 10,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 32,
            fontSize: isVertical ? 20 : 14,
            fontWeight: 800,
            letterSpacing: "0.1em",
            color: "rgba(255, 255, 255, 0.6)",
            textTransform: "uppercase",
          }}
        >
          // Autonomous Multi-Agent Topology
        </div>

        <svg style={{ width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 980 480">
          <defs>
            <linearGradient id="lineGradCyanL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="lineGradGreenL" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#34d399" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.3" />
            </linearGradient>
            <radialGradient id="coreGradientL" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="60%" stopColor="#0284c7" />
              <stop offset="100%" stopColor="#0369a1" />
            </radialGradient>
          </defs>

          {/* Curves */}
          <path d="M 490 240 Q 330 120 170 90" fill="none" stroke="url(#lineGradCyanL)" strokeWidth="3.5" strokeDasharray="8 8" />
          <path d="M 490 240 Q 650 120 810 90" fill="none" stroke="url(#lineGradGreenL)" strokeWidth="3.5" strokeDasharray="8 8" />
          <path d="M 490 240 Q 330 360 170 390" fill="none" stroke="url(#lineGradCyanL)" strokeWidth="3.5" strokeDasharray="8 8" />
          <path d="M 490 240 Q 650 360 810 390" fill="none" stroke="url(#lineGradGreenL)" strokeWidth="3.5" strokeDasharray="8 8" />

          {/* Traveling Packets */}
          <circle cx={a1.x} cy={a1.y} r="8" fill="#38bdf8" filter="drop-shadow(0 0 12px #38bdf8)" />
          <circle cx={a2.x} cy={a2.y} r="8" fill="#34d399" filter="drop-shadow(0 0 12px #34d399)" />
          <circle cx={a3.x} cy={a3.y} r="8" fill="#818cf8" filter="drop-shadow(0 0 12px #818cf8)" />
          <circle cx={a4.x} cy={a4.y} r="8" fill="#fbbf24" filter="drop-shadow(0 0 12px #fbbf24)" />

          {/* Satellite Nodes */}
          <g transform="translate(170, 90)">
            <rect x="-115" y="-38" width="230" height="76" rx="18" fill="#0f172a" stroke="#38bdf8" strokeWidth="2.5" />
            <text x="0" y="-6" fill="#ffffff" fontSize="18" fontWeight="800" textAnchor="middle">{node1.title}</text>
            <text x="0" y="20" fill="#94a3b8" fontSize="13" fontWeight="600" textAnchor="middle">{node1.desc}</text>
          </g>

          <g transform="translate(810, 90)">
            <rect x="-115" y="-38" width="230" height="76" rx="18" fill="#0f172a" stroke="#34d399" strokeWidth="2.5" />
            <text x="0" y="-6" fill="#ffffff" fontSize="18" fontWeight="800" textAnchor="middle">{node2.title}</text>
            <text x="0" y="20" fill="#94a3b8" fontSize="13" fontWeight="600" textAnchor="middle">{node2.desc}</text>
          </g>

          <g transform="translate(170, 390)">
            <rect x="-115" y="-38" width="230" height="76" rx="18" fill="#0f172a" stroke="#818cf8" strokeWidth="2.5" />
            <text x="0" y="-6" fill="#ffffff" fontSize="18" fontWeight="800" textAnchor="middle">{node3.title}</text>
            <text x="0" y="20" fill="#94a3b8" fontSize="13" fontWeight="600" textAnchor="middle">{node3.desc}</text>
          </g>

          <g transform="translate(810, 390)">
            <rect x="-115" y="-38" width="230" height="76" rx="18" fill="#0f172a" stroke="#fbbf24" strokeWidth="2.5" />
            <text x="0" y="-6" fill="#ffffff" fontSize="18" fontWeight="800" textAnchor="middle">{node4.title}</text>
            <text x="0" y="20" fill="#94a3b8" fontSize="13" fontWeight="600" textAnchor="middle">{node4.desc}</text>
          </g>

          {/* Center Core */}
          <g transform={`translate(490, 240) scale(${corePulse})`}>
            <circle cx="0" cy="0" r="74" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="8 8" opacity={coreGlow} />
            <circle cx="0" cy="0" r="58" fill="url(#coreGradientL)" stroke="#ffffff" strokeWidth="3" filter="drop-shadow(0 0 35px #38bdf8)" />
            <text x="0" y="-8" fill="#ffffff" fontSize="17" fontWeight="900" textAnchor="middle">{coreTitle}</text>
            <text x="0" y="16" fill="#e0f2fe" fontSize="13" fontWeight="800" textAnchor="middle">{coreSubtitle}</text>
          </g>
        </svg>
      </div>

      {/* Bottom Live Execution Logs */}
      <div
        style={{
          position: "absolute",
          bottom: isVertical ? 110 : 40,
          left: isVertical ? 50 : 80,
          right: isVertical ? 50 : 80,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(20px)",
          borderRadius: 24,
          border: "1px solid rgba(255, 255, 255, 0.14)",
          padding: isVertical ? "20px 32px" : "14px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: isVertical ? 18 : 14, fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>// HỆ THỐNG KẾT NỐI TOÀN DIỆN</span>
          <span style={{ color: "#22c55e", fontSize: isVertical ? 18 : 14, fontWeight: 800 }}>● HOẠT ĐỘNG HOÀN HẢO</span>
        </div>

        <div style={{ padding: "10px 16px", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.05)", fontSize: isVertical ? 19 : 14, color: "#e2e8f0" }}>
          <strong style={{ color: "#38bdf8" }}>[{brandName}]:</strong> {statusLog}
        </div>
      </div>
    </>
  );
};

/* =========================================================================
   LAYOUT 7: HOLOGRAPHIC SPLINE CHART (Animated Growth & Revenue Acceleration)
   ========================================================================= */
export const SplineChartLayout: React.FC<LayoutProps> = ({
  scene,
  brandName,
  isVertical,
  imageSource,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // 3D Parallax Push
  const scale = interpolate(frame, [0, durationInFrames], [1.03, 1.18], { extrapolateRight: "clamp" });
  const rotateX = interpolate(frame, [0, durationInFrames], [-2, 2], { extrapolateRight: "clamp" });

  // Spline Chart Progress
  const chartProgress = interpolate(frame, [15, Math.max(20, durationInFrames - 30)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const totalPathLength = 900;
  const strokeDashoffset = totalPathLength * (1 - chartProgress);

  const bullets = bulletsOf(scene);
  const stat1 = parseStat(bullets[0] || "");
  const stat2 = parseStat(bullets[1] || "");

  const metric1Target = stat1 ? stat1.value : 142800;
  const metric1Prefix = stat1 ? stat1.prefix : "+$";
  const metric1Suffix = stat1 ? stat1.suffix : "";
  const metric1Label = stat1?.label || "NET CONVERTED REVENUE";

  const metric2Target = stat2 ? stat2.value : 4.8;
  const metric2Prefix = stat2 ? stat2.prefix : "";
  const metric2Suffix = stat2 ? stat2.suffix : "x";
  const metric2Label = stat2?.label || "BLENDED ROAS";

  const metric1Val = Math.floor(
    interpolate(frame, [15, Math.max(20, durationInFrames - 30)], [Math.round(metric1Target * 0.2), metric1Target], {
      extrapolateRight: "clamp",
    }),
  );
  const metric2Val = (
    interpolate(frame, [15, Math.max(20, durationInFrames - 30)], [metric2Target * 0.25, metric2Target], {
      extrapolateRight: "clamp",
    })
  ).toFixed(metric2Target % 1 !== 0 ? 1 : 0);

  const tipX = 60 + chartProgress * (980 - 60);
  const tipY = 240 - Math.pow(chartProgress, 1.3) * 190;

  const textSpring = spring({ frame: frame - 6, fps, config: { damping: 14, mass: 0.8, stiffness: 100 } });
  const textY = interpolate(textSpring, [0, 1], [40, 0]);
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);

  return (
    <>
      {/* 1. Real-life Boardroom / Growth Background */}
      {imageSource && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${scale}) rotateX(${rotateX}deg)`,
            transformOrigin: "center center",
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          {scene.videoPath ? (
            <Video
              src={scene.videoPath}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.6) contrast(1.2) saturate(1.1)",
              }}
            />
          ) : (
            <Img
              src={imageSource}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.6) contrast(1.2) saturate(1.1)",
              }}
            />
          )}
        </div>
      )}

      {/* 2. Cinematic Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "radial-gradient(circle at center, transparent 15%, rgba(2, 6, 23, 0.75) 65%, rgba(2, 6, 23, 0.96) 100%)",
        }}
      />

      {/* 3. Top Headline */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 130 : 60,
          left: isVertical ? 60 : 80,
          right: isVertical ? 60 : 80,
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
          display: "flex",
          flexDirection: "column",
          gap: isVertical ? 16 : 8,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              padding: "6px 20px",
              borderRadius: "9999px",
              backgroundColor: "rgba(34, 197, 94, 0.18)",
              border: "1px solid rgba(34, 197, 94, 0.6)",
              color: "#4ade80",
              fontSize: isVertical ? 22 : 15,
              fontWeight: 800,
              letterSpacing: "0.12em",
              boxShadow: "0 0 16px rgba(34, 197, 94, 0.3)",
            }}
          >
            {scene.floatingTags?.[0] || `● ${brandName.toUpperCase()} · ĐÁNH GIÁ 5 SAO`}
          </span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: isVertical ? 20 : 14, fontWeight: 700 }}>
            {brandName}
          </span>
        </div>

        <div style={{ fontSize: isVertical ? 48 : 34, fontWeight: 900, lineHeight: 1.25, color: "#ffffff" }}>
          {scene.title}{" "}
          {scene.subtitle && (
            <span
              style={{
                color: "#4ade80",
                background: "linear-gradient(135deg, #4ade80 0%, #38bdf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {scene.subtitle}
            </span>
          )}
        </div>
      </div>

      {/* 4. Center Holographic Spline Chart Box */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 350 : 170,
          left: isVertical ? 50 : 80,
          right: isVertical ? 50 : 80,
          height: isVertical ? 620 : 520,
          backgroundColor: "rgba(15, 23, 42, 0.82)",
          backdropFilter: "blur(24px)",
          borderRadius: 32,
          border: "1px solid rgba(34, 197, 94, 0.4)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.85), 0 0 40px rgba(34, 197, 94, 0.15)",
          padding: isVertical ? "28px 32px" : "20px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: isVertical ? 18 : 13, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
              // {metric1Label.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: isVertical ? 54 : 38,
                fontWeight: 900,
                color: "#22c55e",
                fontFamily: "monospace",
                marginTop: 4,
              }}
            >
              {metric1Prefix}{metric1Val.toLocaleString()}{metric1Suffix}
            </div>
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: isVertical ? 18 : 13, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>
              // {metric2Label.toUpperCase()}
            </div>
            <div
              style={{
                fontSize: isVertical ? 54 : 38,
                fontWeight: 900,
                color: "#38bdf8",
                fontFamily: "monospace",
                marginTop: 4,
              }}
            >
              {metric2Prefix}{metric2Val}{metric2Suffix}
            </div>
          </div>
        </div>

        {/* SVG Spline Curve */}
        <div style={{ flex: 1, position: "relative", width: "100%", minHeight: isVertical ? 340 : 260 }}>
          <svg style={{ width: "100%", height: "100%", overflow: "visible" }} viewBox="0 0 1000 300">
            <defs>
              <linearGradient id="splineGradientL" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="50%" stopColor="#22c55e" />
                <stop offset="100%" stopColor="#4ade80" />
              </linearGradient>
              <linearGradient id="areaFillGradientL" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#22c55e" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            <line x1="50" y1="60" x2="950" y2="60" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            <line x1="50" y1="140" x2="950" y2="140" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />
            <line x1="50" y1="220" x2="950" y2="220" stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" />

            {/* Area Fill */}
            <path
              d="M 60 250 C 260 240, 480 200, 700 120 C 820 80, 900 60, 980 50 L 980 270 L 60 270 Z"
              fill="url(#areaFillGradientL)"
              opacity={chartProgress}
            />

            {/* The Main Glowing Spline */}
            <path
              d="M 60 250 C 260 240, 480 200, 700 120 C 820 80, 900 60, 980 50"
              fill="none"
              stroke="url(#splineGradientL)"
              strokeWidth="6"
              strokeDasharray={totalPathLength}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              filter="drop-shadow(0 0 16px rgba(34, 197, 94, 0.8))"
            />

            {/* Leading Pulse Point */}
            {chartProgress > 0.05 && (
              <g transform={`translate(${tipX}, ${tipY})`}>
                <circle cx="0" cy="0" r="16" fill="rgba(34, 197, 94, 0.3)" />
                <circle cx="0" cy="0" r="8" fill="#4ade80" stroke="#ffffff" strokeWidth="2.5" filter="drop-shadow(0 0 14px #4ade80)" />
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* 5. Bottom Live Ticker */}
      <div
        style={{
          position: "absolute",
          bottom: isVertical ? 110 : 40,
          left: isVertical ? 50 : 80,
          right: isVertical ? 50 : 80,
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(20px)",
          borderRadius: 20,
          border: "1px solid rgba(255, 255, 255, 0.14)",
          padding: isVertical ? "20px 28px" : "12px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
        }}
      >
        <span style={{ fontSize: isVertical ? 18 : 14, fontWeight: 800, color: "rgba(255,255,255,0.6)" }}>
          // ĐÁNH GIÁ THỰC TẾ
        </span>
        <span style={{ fontSize: isVertical ? 18 : 14, fontWeight: 700, color: "#4ade80" }}>
          {bullets[0] || scene.subtitle || "Sự lựa chọn hàng đầu được người dùng tin tưởng và đánh giá cao"}
        </span>
      </div>
    </>
  );
};

/* =========================================================================
   LAYOUT 8: VICTORY & CTA OUTRO (Celebratory High-Impact Brand Closer)
   ========================================================================= */
export const VictoryOutroLayout: React.FC<LayoutProps> = ({
  scene,
  brandName,
  isVertical,
  imageSource,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Slow 3D Parallax Pull Out
  const scale = interpolate(frame, [0, durationInFrames], [1.2, 1.05], { extrapolateRight: "clamp" });
  const rotateY = interpolate(frame, [0, durationInFrames], [3, -2], { extrapolateRight: "clamp" });

  // CTA Pulse
  const ctaPulse = 1 + Math.sin(frame * 0.12) * 0.04;

  const textSpring = spring({ frame: frame - 6, fps, config: { damping: 14, mass: 0.8, stiffness: 100 } });
  const textY = interpolate(textSpring, [0, 1], [40, 0]);
  const textOpacity = interpolate(textSpring, [0, 1], [0, 1]);

  const cardSpring = spring({ frame: frame - 15, fps, config: { damping: 15, mass: 0.8, stiffness: 90 } });
  const cardScale = interpolate(cardSpring, [0, 1], [0.92, 1]);
  const cardOpacity = interpolate(cardSpring, [0, 1], [0, 1]);

  const bullets = bulletsOf(scene);
  const badgeText = scene.floatingTags?.[0] || `● ${brandName.toUpperCase()} · CHÍNH HÃNG`;
  const tagline = scene.subtitle || `${brandName.toUpperCase()} · LỰA CHỌN HOÀN HẢO`;
  const valueProp = bullets[0] || "Sản phẩm chính hãng với chất lượng gia công đỉnh cao. Cam kết uy tín và hỗ trợ chu đáo.";
  const ctaButtonText = scene.floatingTags?.[1] || `Sở Hữu ${brandName} Ngay`;
  const footerCred = scene.floatingTags?.[2] || `${brandName.toUpperCase()} · CAM KẾT CHÍNH HÃNG & BẢO HÀNH TOÀN DIỆN`;

  return (
    <>
      {/* 1. Real-life Victory Celebration Background */}
      {imageSource && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: `scale(${scale}) rotateY(${rotateY}deg)`,
            transformOrigin: "center center",
            zIndex: 1,
            overflow: "hidden",
          }}
        >
          {scene.videoPath ? (
            <Video
              src={scene.videoPath}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.65) contrast(1.2) saturate(1.15)",
              }}
            />
          ) : (
            <Img
              src={imageSource}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "brightness(0.65) contrast(1.2) saturate(1.15)",
              }}
            />
          )}
        </div>
      )}

      {/* 2. Cinematic Vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background:
            "radial-gradient(circle at center, transparent 20%, rgba(2, 6, 23, 0.75) 65%, rgba(2, 6, 23, 0.96) 100%)",
        }}
      />

      {/* 3. Top Headline */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? 130 : 60,
          left: isVertical ? 60 : 80,
          right: isVertical ? 60 : 80,
          transform: `translateY(${textY}px)`,
          opacity: textOpacity,
          display: "flex",
          flexDirection: "column",
          gap: isVertical ? 16 : 8,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span
            style={{
              padding: "6px 20px",
              borderRadius: "9999px",
              backgroundColor: "rgba(250, 204, 21, 0.18)",
              border: "1px solid rgba(250, 204, 21, 0.6)",
              color: "#facc15",
              fontSize: isVertical ? 22 : 15,
              fontWeight: 800,
              letterSpacing: "0.12em",
              boxShadow: "0 0 16px rgba(250, 204, 21, 0.3)",
            }}
          >
            {badgeText}
          </span>
          <span style={{ color: "rgba(255,255,255,0.6)", fontSize: isVertical ? 20 : 14, fontWeight: 700 }}>
            {brandName} CTA
          </span>
        </div>

        <div
          style={{
            fontSize: isVertical ? 48 : 34,
            fontWeight: 900,
            lineHeight: 1.25,
            color: "#ffffff",
            textShadow: "0 4px 25px rgba(0,0,0,0.9)",
          }}
        >
          {scene.title}{" "}
          {scene.subtitle && (
            <span
              style={{
                color: "#facc15",
                background: "linear-gradient(135deg, #facc15 0%, #fb923c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                borderBottom: "4px solid #facc15",
                paddingBottom: 2,
              }}
            >
              {scene.subtitle}
            </span>
          )}
        </div>
      </div>

      {/* 4. Center High-Tech Brand Official Outro Card */}
      <div
        style={{
          position: "absolute",
          top: isVertical ? "42%" : "50%",
          left: "50%",
          transform: `translate(-50%, -50%) scale(${cardScale})`,
          width: isVertical ? 900 : 760,
          backgroundColor: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(28px)",
          borderRadius: 36,
          border: "2px solid rgba(56, 189, 248, 0.5)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.9), inset 0 0 30px rgba(56, 189, 248, 0.15)",
          padding: isVertical ? "48px 40px" : "32px 36px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          gap: isVertical ? 28 : 18,
          opacity: cardOpacity,
          zIndex: 10,
        }}
      >
        {/* Brand Icon Badge */}
        <div
          style={{
            width: isVertical ? 100 : 80,
            height: isVertical ? 100 : 80,
            borderRadius: "28px",
            background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
            border: "2px solid #38bdf8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 30px rgba(56, 189, 248, 0.6)",
          }}
        >
          <span style={{ fontSize: isVertical ? 48 : 38 }}>⚡</span>
        </div>

        {/* Title */}
        <div>
          <div style={{ fontSize: isVertical ? 56 : 42, fontWeight: 900, color: "#ffffff", letterSpacing: "-0.02em" }}>
            {brandName}
          </div>
          <div style={{ fontSize: isVertical ? 24 : 17, fontWeight: 700, color: "#38bdf8", letterSpacing: "0.08em", marginTop: 4 }}>
            {tagline.toUpperCase()}
          </div>
        </div>

        {/* Value Prop */}
        <div style={{ fontSize: isVertical ? 22 : 16, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, maxWidth: "85%" }}>
          {valueProp}
        </div>

        {/* Glowing Pulsing CTA Button */}
        <div
          style={{
            transform: `scale(${ctaPulse})`,
            padding: isVertical ? "20px 48px" : "14px 36px",
            borderRadius: "9999px",
            background: "linear-gradient(135deg, #22c55e 0%, #059669 100%)",
            boxShadow: "0 0 30px rgba(34, 197, 94, 0.7)",
            border: "2px solid #86efac",
            color: "#ffffff",
            fontSize: isVertical ? 26 : 20,
            fontWeight: 900,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {ctaButtonText}
        </div>
      </div>

      {/* 5. Bottom Outro Credential */}
      <div
        style={{
          position: "absolute",
          bottom: isVertical ? 110 : 36,
          left: 50,
          right: 50,
          textAlign: "center",
          color: "rgba(255, 255, 255, 0.6)",
          fontSize: isVertical ? 20 : 14,
          fontWeight: 600,
          zIndex: 10,
        }}
      >
        {footerCred}
      </div>
    </>
  );
};
