import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { Scene } from "./Scene.tsx";
import type { RemotionVideoProps } from "./types.ts";

export const MarketingVideo: React.FC<RemotionVideoProps> = ({
  scenes,
  brandName = "RoMes AI",
  ratio = "9:16",
}) => {
  const { fps } = useVideoConfig();

  let accumulatedFrames = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#070a12" }}>
      {scenes.map((scene, idx) => {
        const durationSec = Math.max(1, (scene.durationMs || 3000) / 1000);
        const durationInFrames = Math.max(15, Math.round(durationSec * fps));
        const from = accumulatedFrames;
        accumulatedFrames += durationInFrames;

        return (
          <Sequence
            key={idx}
            from={from}
            durationInFrames={durationInFrames}
            name={`Scene-${idx + 1}-${scene.type}`}
          >
            <Scene
              scene={scene}
              brandName={brandName}
              durationInFrames={durationInFrames}
              ratio={ratio}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
