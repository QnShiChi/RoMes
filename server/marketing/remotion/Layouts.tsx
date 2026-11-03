import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
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
  const shake = Math.sin(frame * 1.7) * interpolate(frame, [0, 14], [14, 0], { extrapolateRight: "clamp" });
  const stripe = interpolate(frame, [0, 18], [-120, 0], { extrapolateRight: "clamp" });
  const zoom = interpolate(frame, [0, durationInFrames], [1.12, 1], { extrapolateRight: "clamp" });
  const bullets = bulletsOf(scene);

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
              filter: "grayscale(0.85) brightness(0.32) contrast(1.25)",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(160deg, rgba(127, 29, 29, 0.55) 0%, rgba(7, 10, 18, 0.85) 55%, #070a12 100%)",
            }}
          />
        </div>
      )}
      <div
        style={{
          position: "absolute",
          top: isVertical ? "150px" : "70px",
          left: 0,
          right: 0,
          height: "14px",
          zIndex: 5,
          background: "repeating-linear-gradient(45deg, #ef4444 0 24px, #111827 24px 48px)",
          transform: `translateX(${stripe}%)`,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          padding: isVertical ? "220px 56px 320px 56px" : "120px 110px",
          boxSizing: "border-box",
          gap: "28px",
        }}
      >
        <Badge text={`⚠ ${brandName} · Thách thức`} color="#ef4444" isVertical={isVertical} />
        <h1
          style={{
            fontSize: isVertical ? "64px" : "50px",
            lineHeight: 1.12,
            fontWeight: 900,
            margin: 0,
            color: "#fff",
            transform: `translateX(${shake}px)`,
            textShadow: "4px 0 0 rgba(239, 68, 68, 0.55), -4px 0 0 rgba(56, 189, 248, 0.35)",
          }}
        >
          {scene.title}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {bullets.slice(0, 4).map((item, idx) => {
            const enter = spring({ frame: Math.max(0, frame - 10 - idx * 6), fps, config: { damping: 14 } });
            return (
              <div
                key={idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "18px",
                  opacity: enter,
                  transform: `translateX(${(1 - enter) * -80}px)`,
                  padding: isVertical ? "18px 22px" : "14px 18px",
                  borderLeft: "6px solid #ef4444",
                  background: "rgba(15, 23, 42, 0.72)",
                  borderRadius: "0 16px 16px 0",
                }}
              >
                <span style={{ fontSize: isVertical ? "30px" : "24px", color: "#f87171", fontWeight: 900 }}>✕</span>
                <span style={{ fontSize: isVertical ? "28px" : "22px", fontWeight: 600, color: "#f1f5f9" }}>{item}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export const SplitLayout: React.FC<LayoutProps> = ({ scene, isVertical, imageSource }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [left = "Trước", right = "Sau", ...rest] = bulletsOf(scene);
  const panelA = spring({ frame, fps, config: { damping: 15 } });
  const panelB = spring({ frame: Math.max(0, frame - 8), fps, config: { damping: 15 } });
  const vs = spring({ frame: Math.max(0, frame - 16), fps, config: { damping: 8, mass: 0.6 } });
  const direction = isVertical ? "column" : "row";
  const axis = isVertical ? "Y" : "X";

  const panel = (label: string, tone: "before" | "after", progress: number) => (
    <div
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        transform: `translate${axis}(${(1 - progress) * (tone === "before" ? -100 : 100)}%)`,
      }}
    >
      {imageSource && (
        <Img
          src={imageSource}
          alt={label}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: tone === "before" ? "top" : "bottom",
            filter: tone === "before" ? "grayscale(1) brightness(0.35)" : "saturate(1.4) brightness(0.55)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: tone === "before"
            ? "linear-gradient(180deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.92))"
            : "linear-gradient(180deg, rgba(79, 70, 229, 0.55), rgba(16, 185, 129, 0.45))",
        }}
      />
      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 56px",
          boxSizing: "border-box",
          textAlign: "center",
          gap: "16px",
        }}
      >
        <span
          style={{
            fontSize: isVertical ? "22px" : "18px",
            fontWeight: 800,
            letterSpacing: "0.16em",
            color: tone === "before" ? "#94a3b8" : "#a7f3d0",
          }}
        >
          {tone === "before" ? "TRƯỚC ĐÂY" : "KHI CÓ GIẢI PHÁP"}
        </span>
        <span style={{ fontSize: isVertical ? "44px" : "36px", fontWeight: 900, color: "#fff", lineHeight: 1.2 }}>
          {label}
        </span>
      </div>
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", flexDirection: "column" }}>
      <div
        style={{
          padding: isVertical ? "90px 56px 30px 56px" : "36px 80px 20px 80px",
          textAlign: "center",
          background: "rgba(7, 10, 18, 0.92)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: isVertical ? "50px" : "40px", fontWeight: 900, color: "#fff", lineHeight: 1.15 }}>
          {scene.title}
        </h2>
        {rest[0] && (
          <div style={{ marginTop: "12px", fontSize: isVertical ? "24px" : "20px", color: "#cbd5e1" }}>{rest[0]}</div>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: direction, position: "relative", paddingBottom: isVertical ? "300px" : "0" }}>
        {panel(left, "before", panelA)}
        {panel(right, "after", panelB)}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: isVertical ? "calc(50% - 150px)" : "50%",
            transform: `translate(-50%, -50%) scale(${vs}) rotate(${(1 - vs) * -90}deg)`,
            width: isVertical ? "120px" : "100px",
            height: isVertical ? "120px" : "100px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #f43f5e, #8b5cf6)",
            border: "6px solid #070a12",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: isVertical ? "40px" : "32px",
            fontWeight: 900,
            color: "#fff",
            boxShadow: "0 0 40px rgba(244, 63, 94, 0.6)",
          }}
        >
          VS
        </div>
      </div>
    </div>
  );
};

export const StatsLayout: React.FC<LayoutProps> = ({ scene, brandName, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const items = bulletsOf(scene).slice(0, 4);
  const stats = items.map((text) => ({ text, stat: parseStat(text) }));
  const maxValue = Math.max(1, ...stats.map(({ stat }) => stat?.value ?? 0));

  return (
    <div
      style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        padding: isVertical ? "120px 52px 320px 52px" : "60px 90px",
        boxSizing: "border-box",
        gap: isVertical ? "34px" : "24px",
      }}
    >
      <Badge text={`${brandName} · Số liệu`} color="#22d3ee" isVertical={isVertical} />
      <h2
        style={{
          margin: 0,
          textAlign: "center",
          fontSize: isVertical ? "52px" : "42px",
          fontWeight: 900,
          lineHeight: 1.15,
          background: "linear-gradient(135deg, #ffffff 0%, #a5f3fc 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        {scene.title}
      </h2>
      <div
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: isVertical || stats.length < 3 ? "1fr" : "1fr 1fr",
          gap: "20px",
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
                padding: isVertical ? "26px 30px" : "20px 24px",
                borderRadius: "24px",
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 27, 75, 0.75))",
                border: "1px solid rgba(34, 211, 238, 0.35)",
                boxShadow: "0 20px 45px rgba(0, 0, 0, 0.45)",
                opacity: progress,
                transform: `translateY(${(1 - progress) * 60}px)`,
              }}
            >
              {stat ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
                    {stat.prefix && (
                      <span style={{ fontSize: isVertical ? "26px" : "20px", color: "#94a3b8", fontWeight: 700 }}>{stat.prefix}</span>
                    )}
                    <span
                      style={{
                        fontSize: isVertical ? "92px" : "70px",
                        fontWeight: 900,
                        lineHeight: 1,
                        fontVariantNumeric: "tabular-nums",
                        background: "linear-gradient(135deg, #22d3ee 0%, #a78bfa 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {shown.toFixed(decimals)}
                      {stat.suffix}
                    </span>
                  </div>
                  <div style={{ marginTop: "10px", fontSize: isVertical ? "28px" : "22px", fontWeight: 600, color: "#e2e8f0" }}>
                    {stat.label}
                  </div>
                  <div style={{ marginTop: "16px", height: "10px", borderRadius: "9999px", background: "rgba(255, 255, 255, 0.08)" }}>
                    <div
                      style={{
                        height: "100%",
                        borderRadius: "9999px",
                        width: `${Math.max(12, (stat.value / maxValue) * 100) * progress}%`,
                        background: "linear-gradient(90deg, #22d3ee, #a78bfa)",
                      }}
                    />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: isVertical ? "30px" : "24px", fontWeight: 700, color: "#f8fafc" }}>{text}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const QuoteLayout: React.FC<LayoutProps> = ({ scene, brandName, isVertical, imageSource }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const mark = spring({ frame, fps, config: { damping: 10, mass: 0.8 } });
  const words = (scene.subtitle || scene.title).split(/\s+/).filter(Boolean);
  const revealEnd = Math.max(20, Math.round(durationInFrames * 0.6));
  const ring = (frame * 1.5) % 360;

  return (
    <div
      style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        height: "100%",
        padding: isVertical ? "140px 64px 300px 64px" : "70px 120px",
        boxSizing: "border-box",
        gap: "30px",
      }}
    >
      {imageSource && (
        <div
          style={{
            alignSelf: "center",
            width: isVertical ? "300px" : "220px",
            height: isVertical ? "300px" : "220px",
            borderRadius: "50%",
            padding: "8px",
            background: `conic-gradient(from ${ring}deg, #f59e0b, #ec4899, #8b5cf6, #f59e0b)`,
            transform: `scale(${mark})`,
          }}
        >
          <Img
            src={imageSource}
            alt={scene.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%", border: "6px solid #070a12" }}
          />
        </div>
      )}
      <div
        style={{
          fontSize: isVertical ? "220px" : "160px",
          lineHeight: 0.6,
          fontFamily: "Georgia, serif",
          fontWeight: 900,
          color: "#f59e0b",
          opacity: 0.85,
          transform: `scale(${mark}) rotate(${(1 - mark) * -20}deg)`,
          transformOrigin: "left top",
          textShadow: "0 0 50px rgba(245, 158, 11, 0.55)",
          height: isVertical ? "110px" : "80px",
        }}
      >
        “
      </div>
      <p
        style={{
          margin: 0,
          fontSize: isVertical ? "50px" : "40px",
          lineHeight: 1.3,
          fontWeight: 800,
          fontStyle: "italic",
          color: "#fff",
        }}
      >
        {words.map((word, idx) => {
          const at = 8 + (idx / Math.max(1, words.length)) * revealEnd;
          const opacity = interpolate(frame, [at, at + 6], [0.15, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return (
            <span key={idx} style={{ opacity }}>
              {word}{" "}
            </span>
          );
        })}
      </p>
      {scene.subtitle && (
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ width: "60px", height: "4px", background: "#f59e0b", borderRadius: "2px" }} />
          <span style={{ fontSize: isVertical ? "28px" : "22px", fontWeight: 700, color: "#fcd34d" }}>{scene.title}</span>
        </div>
      )}
      <span style={{ fontSize: isVertical ? "20px" : "16px", letterSpacing: "0.14em", color: "#94a3b8", textTransform: "uppercase" }}>
        {brandName} · Góc nhìn
      </span>
    </div>
  );
};
