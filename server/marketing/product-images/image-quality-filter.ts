import type { ProductImageCandidate } from "./types.ts";

const BLOCKED_DOMAINS = [
  "shutterstock.com",
  "alamy.com",
  "gettyimages.com",
  "istockphoto.com",
  "dreamstime.com",
  "stock.adobe.com",
  "123rf.com",
  "depositphotos.com",
  "ytimg.com",
  "youtube.com",
  "vimeo.com",
  "tiktok.com",
  "ext_tw_video_thumb",
  "bilibili.com",
  "dailymotion.com",
  "gravatar.com",
  "avatar",
  "profile_images",
];

const BLOCKED_TITLE_KEYWORDS = [
  "reaction",
  "vlog",
  "girlfriend",
  "boyfriend",
  "dating",
  "tinder",
  "scam",
  "prank",
  "youtuber",
];

export function filterCandidates(
  candidates: ProductImageCandidate[],
  minWidth: number = 600,
  minHeight: number = 400,
): ProductImageCandidate[] {
  const seen = new Set<string>();
  const filtered: ProductImageCandidate[] = [];

  for (const item of candidates) {
    if (!item.url || !item.url.startsWith("https://")) continue;

    if (seen.has(item.url)) continue;

    const lower = item.url.toLowerCase();
    if (BLOCKED_DOMAINS.some((domain) => lower.includes(domain))) continue;

    const titleLower = (item.title || "").toLowerCase();
    if (BLOCKED_TITLE_KEYWORDS.some((kw) => titleLower.includes(kw))) continue;

    if (item.width && item.width < minWidth) continue;
    if (item.height && item.height < minHeight) continue;

    seen.add(item.url);
    filtered.push(item);
  }

  return filtered;
}
