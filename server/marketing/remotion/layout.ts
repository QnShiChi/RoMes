import type { MarketingSceneSpec } from "./types.ts";

export type SceneLayout = "hero" | "problem" | "split" | "stats" | "cards" | "showcase" | "quote" | "cta";

const LAYOUT_BY_TYPE: Record<MarketingSceneSpec["type"], SceneLayout> = {
  hook: "hero",
  problem: "problem",
  split: "split",
  stats: "stats",
  features: "cards",
  product: "showcase",
  solution: "showcase",
  quote: "quote",
  cta: "cta",
};

const BODY_LAYOUTS: SceneLayout[] = ["cards", "split", "stats", "showcase", "quote"];

function bulletsOf(scene: MarketingSceneSpec): string[] {
  return (scene.bulletPoints?.length ? scene.bulletPoints : scene.features) ?? [];
}

function fits(layout: SceneLayout, scene: MarketingSceneSpec): boolean {
  const bullets = bulletsOf(scene);
  switch (layout) {
    case "split":
      return bullets.length >= 2;
    case "stats":
      return bullets.some((b) => /\d/.test(b));
    case "quote":
      return Boolean(scene.subtitle?.trim());
    case "cards":
      return bullets.length > 0 || Boolean(scene.subtitle?.trim());
    default:
      return true;
  }
}

function contentAffinity(layout: SceneLayout, scene: MarketingSceneSpec): number {
  const bullets = bulletsOf(scene);
  if (layout === "stats") return bullets.filter((b) => /\d/.test(b)).length * 2 >= bullets.length ? 2 : 0;
  if (layout === "split") return bullets.length === 2 ? 1 : 0;
  return 0;
}

export function resolveSceneLayouts(scenes: MarketingSceneSpec[]): SceneLayout[] {
  const used = new Map<SceneLayout, number>();
  const layouts: SceneLayout[] = [];
  scenes.forEach((scene, index) => {
    const wanted = LAYOUT_BY_TYPE[scene.type] ?? "showcase";
    const previous = layouts[index - 1];
    let chosen = wanted;
    if (wanted === previous && BODY_LAYOUTS.includes(wanted)) {
      const candidates = BODY_LAYOUTS
        .filter((layout) => layout !== previous && fits(layout, scene))
        .sort((a, b) => (used.get(a) ?? 0) - (used.get(b) ?? 0)
          || contentAffinity(b, scene) - contentAffinity(a, scene));
      chosen = candidates[0] ?? "showcase";
    }
    used.set(chosen, (used.get(chosen) ?? 0) + 1);
    layouts.push(chosen);
  });
  return layouts;
}

export interface StatItem {
  value: number;
  prefix: string;
  suffix: string;
  label: string;
}

export function parseStat(text: string): StatItem | null {
  const [head, ...rest] = text.split(/\s*[|:–—-]\s+/);
  const match = (head ?? "").match(/^(.*?)(\d+(?:[.,]\d+)?)(.*)$/);
  if (!match) return null;
  const value = Number.parseFloat(match[2]!.replace(",", "."));
  if (!Number.isFinite(value)) return null;
  const tail = match[3]!.trim();
  const suffixMatch = tail.match(/^(%|x|\+|k|m|tr|tỷ|lần)(?=\s|$)/i);
  const suffix = suffixMatch ? suffixMatch[0] : "";
  const remainder = tail.slice(suffix.length).trim();
  const label = [remainder, rest.join(" ")].filter(Boolean).join(" ").trim();
  return { value, prefix: match[1]!.trim(), suffix, label: label || text };
}
