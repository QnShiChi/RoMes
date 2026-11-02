import React from "react";
import { Composition, registerRoot } from "remotion";
import { MarketingVideo } from "./MarketingVideo.tsx";
import { getDimensionsForRatio, type RemotionVideoProps } from "./types.ts";

export const RemotionRoot = () => {
  return (
    <Composition
      id="MarketingVideo"
      component={MarketingVideo}
      durationInFrames={120}
      fps={30}
      width={1080}
      height={1920}
      calculateMetadata={async ({ props }) => {
        const p = props as RemotionVideoProps;
        const fps = 30;
        const totalDurationSec = (p.scenes || []).reduce(
          (acc, s) => acc + Math.max(1, (s.durationMs || 3000) / 1000),
          0,
        );
        const durationInFrames = Math.max(30, Math.round(totalDurationSec * fps));
        const dims = getDimensionsForRatio(p.ratio || "9:16");
        return {
          durationInFrames,
          width: dims.width,
          height: dims.height,
          fps,
        };
      }}
      defaultProps={{
        scenes: [],
        brandName: "RoMes AI",
        ratio: "9:16",
      }}
    />
  );
};

registerRoot(RemotionRoot);
