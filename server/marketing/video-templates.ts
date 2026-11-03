import { existsSync, readFileSync } from "node:fs";

export type VideoRatio = "9:16" | "16:9";

export type ContextualAnimationType =
  | "email"
  | "ai"
  | "speed"
  | "security"
  | "growth"
  | "default";

export type MarketingSceneType =
  | "hook"
  | "problem"
  | "split"
  | "stats"
  | "features"
  | "product"
  | "quote"
  | "cta";

export interface MarketingSceneSpec {
  type: MarketingSceneType;
  title: string;
  subtitle?: string;
  imagePath?: string;
  bulletPoints?: string[];
  durationMs: number;
  subtitles?: string[];
  brandName?: string;
  animationType?: ContextualAnimationType;
  floatingTags?: string[];
}

export interface TemplateOptions {
  ratio: VideoRatio;
  width: number;
  height: number;
  fps?: number;
  brandName?: string;
}

export function getDimensionsForRatio(ratio: VideoRatio): { width: number; height: number } {
  if (ratio === "9:16") {
    return { width: 1080, height: 1920 };
  }
  return { width: 1920, height: 1080 };
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function resolveImageSource(imagePath?: string): string {
  if (!imagePath) return "";
  if (imagePath.startsWith("data:") || imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  try {
    if (existsSync(imagePath)) {
      const ext = imagePath.toLowerCase().split(".").pop();
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const b64 = readFileSync(imagePath).toString("base64");
      return `data:${mime};base64,${b64}`;
    }
  } catch {
    // Ignore file read error and fall through
  }
  return "";
}

export function buildMarketingSceneHtml(
  scene: MarketingSceneSpec,
  options: TemplateOptions,
): string {
  const isPortrait = options.ratio === "9:16";
  const title = escapeHtml(scene.title);
  const subtitle = scene.subtitle ? escapeHtml(scene.subtitle) : "";
  const brandName = escapeHtml(scene.brandName || options.brandName || "RoMes AI");

  let sceneBody = "";

  switch (scene.type) {
    case "hook": {
      sceneBody = `
        <div class="hook-content">
          <div class="brand-badge">${brandName}</div>
          <h1 class="headline kinetic-text">${title}</h1>
          ${subtitle ? `<p class="subheadline">${subtitle}</p>` : ""}
        </div>
      `;
      break;
    }

    case "product": {
      const imgSrc = resolveImageSource(scene.imagePath) || scene.imagePath || "";
      const imgTag = scene.imagePath
        ? `<div class="image-wrapper ken-burns">
            <img src="${escapeHtml(imgSrc)}" alt="${title}" />
            <div class="image-overlay"></div>
          </div>`
        : "";
      sceneBody = `
        <div class="product-content">
          ${imgTag}
          <div class="overlay-text">
            <h2 class="scene-title">${title}</h2>
            ${subtitle ? `<p class="scene-subtitle">${subtitle}</p>` : ""}
          </div>
        </div>
      `;
      break;
    }

    case "problem":
    case "split":
    case "stats":
    case "quote":
    case "features": {
      const bullets = (scene.bulletPoints || [])
        .map(
          (b, i) =>
            `<li class="feature-item" style="animation-delay: ${0.2 * i}s">
              <span class="feature-icon">✦</span>
              <span class="feature-text">${escapeHtml(b)}</span>
            </li>`,
        )
        .join("");
      sceneBody = `
        <div class="features-content">
          <h2 class="scene-title">${title}</h2>
          ${subtitle ? `<p class="scene-subtitle">${subtitle}</p>` : ""}
          <ul class="features-list">
            ${bullets}
          </ul>
        </div>
      `;
      break;
    }

    case "cta": {
      sceneBody = `
        <div class="cta-content">
          <div class="brand-badge pulse">${brandName}</div>
          <h1 class="cta-title">${title}</h1>
          ${subtitle ? `<p class="cta-subtitle">${subtitle}</p>` : ""}
          <div class="cta-button">Bắt đầu ngay &rarr;</div>
        </div>
      `;
      break;
    }
  }

  const subtitlesOverlay = (scene.subtitles || [])
    .map((s) => `<div class="subtitle-line">${escapeHtml(s)}</div>`)
    .join("");

  return `
    <div class="scene-inner ${isPortrait ? "portrait" : "landscape"}" data-type="${scene.type}">
      ${sceneBody}
      ${subtitlesOverlay ? `<div class="subtitles-container">${subtitlesOverlay}</div>` : ""}
    </div>
  `;
}

export function buildMarketingVideoHtml(
  scenes: MarketingSceneSpec[],
  options: TemplateOptions,
): string {
  const { width, height } = options;
  const brandName = escapeHtml(options.brandName || "RoMes AI");

  let accumulatedMs = 0;
  const sceneElements: string[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const s = scenes[i];
    const startMs = accumulatedMs;
    const durationMs = s.durationMs || 3000;
    accumulatedMs += durationMs;

    const innerHtml = buildMarketingSceneHtml(s, options);
    sceneElements.push(`
      <section 
        class="scene scene-${i}" 
        id="scene-${i}" 
        data-index="${i}" 
        data-start-ms="${startMs}" 
        data-duration-ms="${durationMs}">
        ${innerHtml}
      </section>
    `);
  }

  const totalDurationMs = accumulatedMs;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=${width}, height=${height}, initial-scale=1.0">
  <title>${brandName} Video</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      user-select: none;
    }
    body, html {
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #08090f;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .video-viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: #08090f;
    }
    .ambient-glow {
      position: absolute;
      width: 100%;
      height: 100%;
      top: 0;
      left: 0;
      z-index: 0;
      background: 
        radial-gradient(circle at 20% 25%, rgba(99, 102, 241, 0.35) 0%, transparent 55%),
        radial-gradient(circle at 80% 75%, rgba(168, 85, 247, 0.3) 0%, transparent 55%),
        radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 65%);
      filter: blur(40px);
    }
    .scene {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.25s ease-out;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }
    .scene.active {
      opacity: 1;
      pointer-events: auto;
    }
    .scene-inner {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      text-align: center;
      position: relative;
    }
    .brand-badge {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      padding: 12px 32px;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.2);
      border: 1.5px solid rgba(165, 180, 252, 0.5);
      backdrop-filter: blur(16px);
      box-shadow: 0 0 30px rgba(99, 102, 241, 0.4);
      color: #e0e7ff;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      margin-bottom: 36px;
    }
    .headline {
      font-size: 80px;
      font-weight: 900;
      line-height: 1.12;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, #ffffff 20%, #e0e7ff 65%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      text-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
      max-width: 92%;
      margin-bottom: 28px;
    }
    .subheadline {
      font-size: 38px;
      color: #94a3b8;
      max-width: 85%;
      line-height: 1.4;
      font-weight: 500;
    }
    .image-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      overflow: hidden;
    }
    .image-wrapper img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform-origin: center center;
    }
    .image-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 2;
      background: linear-gradient(to top, rgba(8,9,15,0.96) 0%, rgba(8,9,15,0.7) 45%, rgba(8,9,15,0.2) 80%, rgba(8,9,15,0.4) 100%);
    }
    .ken-burns img {
      animation: kenBurnsAnim 8s ease-out infinite alternate;
    }
    @keyframes kenBurnsAnim {
      0% { transform: scale(1.0); }
      100% { transform: scale(1.18); }
    }
    .product-content .overlay-text {
      position: absolute;
      bottom: 140px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 3;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(24px);
      padding: 36px 48px;
      border-radius: 28px;
      border: 1.5px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.75);
      width: 88%;
      text-align: center;
    }
    .scene-title {
      font-size: 58px;
      font-weight: 900;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 16px;
      background: linear-gradient(135deg, #ffffff 30%, #e2e8f0 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .scene-subtitle {
      font-size: 34px;
      color: #cbd5e1;
      line-height: 1.35;
      font-weight: 500;
    }
    .features-list {
      list-style: none;
      text-align: left;
      margin-top: 48px;
      width: 88%;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 24px;
      font-size: 36px;
      font-weight: 600;
      color: #f8fafc;
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(20px);
      padding: 24px 32px;
      border-radius: 20px;
      border: 1.5px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
    }
    .feature-icon {
      font-size: 40px;
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .cta-content {
      position: relative;
      z-index: 3;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 90%;
    }
    .cta-title {
      font-size: 84px;
      font-weight: 900;
      line-height: 1.12;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #ffffff 20%, #fef08a 85%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 24px;
      text-shadow: 0 10px 40px rgba(0,0,0,0.6);
    }
    .cta-subtitle {
      font-size: 38px;
      color: #e2e8f0;
      margin-bottom: 52px;
      line-height: 1.4;
      font-weight: 500;
    }
    .cta-button {
      display: inline-block;
      padding: 28px 72px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #9333ea 100%);
      color: #ffffff;
      font-size: 44px;
      font-weight: 800;
      border-radius: 9999px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      box-shadow: 0 16px 44px rgba(124, 58, 237, 0.55);
      letter-spacing: 0.02em;
    }
    .subtitles-container {
      position: absolute;
      bottom: ${options.ratio === "9:16" ? "220px" : "60px"};
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      background: rgba(8, 9, 15, 0.88);
      backdrop-filter: blur(16px);
      border: 1.5px solid rgba(254, 240, 138, 0.45);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.65);
      padding: 16px 40px;
      border-radius: 20px;
      font-size: 34px;
      font-weight: 800;
      color: #fef08a;
      text-shadow: 0 2px 4px rgba(0,0,0,0.8);
      max-width: 90%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div class="video-viewport">
    <div class="ambient-glow"></div>
    ${sceneElements.join("")}
  </div>

  <script>
    (function() {
      const scenes = Array.from(document.querySelectorAll('.scene'));
      window.__totalDurationMs = ${totalDurationMs};

      window.__seekToMs = function(targetMs) {
        let activeIdx = 0;
        for (let i = 0; i < scenes.length; i++) {
          const el = scenes[i];
          const start = parseFloat(el.getAttribute('data-start-ms') || '0');
          const duration = parseFloat(el.getAttribute('data-duration-ms') || '0');
          if (targetMs >= start && targetMs < start + duration) {
            activeIdx = i;
            break;
          }
          if (targetMs >= start + duration) {
            activeIdx = i;
          }
        }

        scenes.forEach((el, idx) => {
          if (idx === activeIdx) {
            el.classList.add('active');
          } else {
            el.classList.remove('active');
          }
        });
      };

      // Initialize at 0ms
      window.__seekToMs(0);
    })();
  </script>
</body>
</html>`;
}
