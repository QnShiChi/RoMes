export type VideoRatio = "9:16" | "16:9";

export type MarketingSceneType = "hook" | "product" | "features" | "cta";

export interface MarketingSceneSpec {
  type: MarketingSceneType;
  title: string;
  subtitle?: string;
  imagePath?: string;
  bulletPoints?: string[];
  durationMs: number;
  subtitles?: string[];
  brandName?: string;
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
      const imgTag = scene.imagePath
        ? `<div class="image-wrapper ken-burns">
            <img src="${escapeHtml(scene.imagePath)}" alt="${title}" />
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
      background: #090a0f;
      color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    .video-viewport {
      position: relative;
      width: ${width}px;
      height: ${height}px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 30%, #1e1b4b 0%, #090a0f 80%);
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
      display: inline-block;
      padding: 10px 24px;
      border-radius: 9999px;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(129, 140, 248, 0.4);
      color: #a5b4fc;
      font-size: 24px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      margin-bottom: 32px;
    }
    .headline {
      font-size: 72px;
      font-weight: 900;
      line-height: 1.15;
      color: #ffffff;
      text-shadow: 0 4px 20px rgba(0, 0, 0, 0.8);
      max-width: 90%;
      margin-bottom: 24px;
    }
    .subheadline {
      font-size: 36px;
      color: #94a3b8;
      max-width: 80%;
      line-height: 1.4;
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
    .ken-burns img {
      animation: kenBurnsAnim 8s ease-out infinite alternate;
    }
    @keyframes kenBurnsAnim {
      0% { transform: scale(1.0); }
      100% { transform: scale(1.18); }
    }
    .product-content .overlay-text {
      position: absolute;
      bottom: 120px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 3;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(16px);
      padding: 32px 48px;
      border-radius: 24px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      width: 85%;
    }
    .scene-title {
      font-size: 54px;
      font-weight: 800;
      margin-bottom: 16px;
    }
    .scene-subtitle {
      font-size: 32px;
      color: #cbd5e1;
    }
    .features-list {
      list-style: none;
      text-align: left;
      margin-top: 40px;
      width: 85%;
    }
    .feature-item {
      display: flex;
      align-items: center;
      gap: 20px;
      font-size: 36px;
      margin-bottom: 24px;
      background: rgba(30, 41, 59, 0.7);
      padding: 20px 28px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .feature-icon {
      color: #38bdf8;
      font-size: 40px;
    }
    .cta-title {
      font-size: 80px;
      font-weight: 900;
      margin-bottom: 24px;
    }
    .cta-subtitle {
      font-size: 40px;
      color: #cbd5e1;
      margin-bottom: 48px;
    }
    .cta-button {
      display: inline-block;
      padding: 24px 60px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      font-size: 42px;
      font-weight: 800;
      border-radius: 9999px;
      box-shadow: 0 10px 30px rgba(79, 70, 229, 0.4);
    }
    .subtitles-container {
      position: absolute;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 10;
      background: rgba(0, 0, 0, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 12px 28px;
      border-radius: 14px;
      font-size: 28px;
      font-weight: 700;
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
