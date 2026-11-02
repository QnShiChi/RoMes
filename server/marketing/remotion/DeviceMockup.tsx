import React from "react";
import { Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const DeviceMockup: React.FC<{
  imageSource: string;
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
      </div>
    </div>
  );
};
