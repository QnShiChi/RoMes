import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const DeviceMockup: React.FC<{
  imageSource?: string;
  isVertical: boolean;
}> = ({ imageSource, isVertical }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const entrance = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.8 },
  });

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.07], { extrapolateRight: "clamp" });

  return (
    <div
      style={{
        transform: `scale(${entrance})`,
        width: isVertical ? "92%" : "64%",
        flex: 1,
        maxHeight: isVertical ? "52%" : "56%",
        borderRadius: "32px",
        padding: "8px",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(99, 102, 241, 0.15) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.8), 0 0 50px rgba(99, 102, 241, 0.25)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "24px",
          overflow: "hidden",
          backgroundColor: "#030712",
          position: "relative",
        }}
      >
        {imageSource ? (
          <Img
            src={imageSource}
            alt="Marketing visual"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${zoom})`,
              transformOrigin: "center center",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(180deg, #0f172a 0%, #020617 100%)",
              display: "flex",
              flexDirection: "column",
              padding: "24px",
              boxSizing: "border-box",
              fontFamily: "'Fira Code', monospace, sans-serif",
            }}
          >
            {/* Terminal Window Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
              <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#10b981" }} />
              <span style={{ fontSize: "14px", color: "#64748b", marginLeft: "12px" }}>ai-agent-terminal.sh</span>
            </div>
            {/* Mockup Terminal Output */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: isVertical ? "20px" : "16px" }}>
              <div style={{ color: "#38bdf8" }}>$ openmausbot --deploy agentic-ai</div>
              <div style={{ color: "#a5b4fc" }}>✔ Orchestrating Swarm: [Poppy, Finch, Momo]</div>
              <div style={{ color: "#34d399" }}>✔ Generating Full-Bleed 4K Motion Assets...</div>
              <div style={{ color: "#f472b6" }}>⚡ Status: AUTONOMOUS DEVELOPMENT READY</div>
              <div style={{ color: "#94a3b8", marginTop: "12px" }}>
                <span>&gt; pipeline ready for launch</span>
                <span style={{ opacity: Math.sin(frame / 4) > 0 ? 1 : 0 }}> ▋</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
