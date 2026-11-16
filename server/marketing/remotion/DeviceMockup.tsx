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
        width: isVertical ? "94%" : "72%",
        flex: 1,
        maxHeight: isVertical ? "68%" : "68%",
        borderRadius: "28px",
        padding: "6px",
        background: "linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.08) 100%)",
        border: "1px solid rgba(255, 255, 255, 0.28)",
        boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.75)",
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
          borderRadius: "22px",
          overflow: "hidden",
          backgroundColor: "#0f172a",
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
              filter: "brightness(0.96) contrast(1.04)",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px",
              boxSizing: "border-box",
            }}
          />
        )}
      </div>
    </div>
  );
};
