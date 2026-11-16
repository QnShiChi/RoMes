import type { ProductVideoCandidate, StockVideoSearchOptions } from "./types.ts";

export function extractStockSearchQuery(raw: string): string {
  let cleaned = (raw || "").trim();
  cleaned = cleaned.replace(/(?:;\s*)?(?:requiredTerms|excludedTerms|aspectRatio|negativeFilter|resolution|ratio)\s*[:=][^;\n]*/gi, " ");
  cleaned = cleaned.replace(/[;"'[\]{}()]/g, " ");
  cleaned = cleaned.replace(/\b(?:4k|1080p|hd|vertical|portrait|cinematic|commercial|high quality|stock video|video)\b/gi, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  // Normalize diacritics first for consistent concept matching
  const normalized = cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Concept mapping for natural language queries across various domains
  const concepts: Array<{ pattern: RegExp; term: string }> = [
    { pattern: /\b(hoa|hoa tuoi|bong hoa|tiem hoa|cam hoa|flower|flowers|florist|rose|bouquet)\b/i, term: "flowers" },
    { pattern: /\b(ca phe|cafe|coffee|barista|tra sua|milktea|quan ca phe|quan cafe)\b/i, term: "coffee" },
    { pattern: /\b(ban phim|ban phim co|keyboard|mechanical keyboard|typing|setup)\b/i, term: "keyboard" },
    { pattern: /\b(thoi trang|quan ao|fashion|clothing|dress|model|outfit)\b/i, term: "fashion" },
    { pattern: /\b(am thuc|mon an|nau an|food|cooking|restaurant|chef|nha hang)\b/i, term: "food" },
    { pattern: /\b(cong nghe|technology|laptop|computer|coding|lap trinh|ai|software)\b/i, term: "technology" },
    { pattern: /\b(du lich|travel|nature|thien nhien|bien|beach|nui|mountain)\b/i, term: "nature" },
    { pattern: /\b(tap gym|the thao|fitness|gym|workout|running|chay bo)\b/i, term: "fitness" },
    { pattern: /\b(lam dep|spa|skincare|my pham|beauty|cosmetics|cham soc da)\b/i, term: "beauty" },
    { pattern: /\b(bat dong san|can ho|nha dep|real estate|house|interior|noi that)\b/i, term: "interior" },
  ];

  for (const c of concepts) {
    if (c.pattern.test(normalized)) {
      return c.term;
    }
  }

  const firstToken = normalized.split(" ")[0];
  return firstToken || "lifestyle";
}

export class StockVideoSearcher {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async search(query: string, options?: StockVideoSearchOptions): Promise<ProductVideoCandidate[]> {
    const term = extractStockSearchQuery(query);
    const timeoutMs = options?.timeoutMs ?? 15_000;
    const limit = options?.limit ?? 10;

    const candidates: ProductVideoCandidate[] = [];

    // 1. Check if Pixabay API key is configured
    const pixabayKey = process.env.PIXABAY_API_KEY?.trim();
    if (pixabayKey) {
      try {
        const pixabayUrl = `https://pixabay.com/api/videos/?key=${pixabayKey}&q=${encodeURIComponent(term)}&per_page=${limit}`;
        const res = await this.fetchImpl(pixabayUrl, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: { Accept: "application/json" },
        });
        if (res.ok) {
          const data = (await res.json()) as {
            hits?: Array<{
              id: number;
              tags?: string;
              duration?: number;
              videos?: {
                large?: { url: string; width: number; height: number };
                medium?: { url: string; width: number; height: number };
                small?: { url: string; width: number; height: number };
              };
            }>;
          };
          if (Array.isArray(data.hits)) {
            for (const hit of data.hits) {
              const video = hit.videos?.large || hit.videos?.medium || hit.videos?.small;
              if (video?.url) {
                candidates.push({
                  url: video.url,
                  title: hit.tags ?? term,
                  durationSeconds: hit.duration,
                  width: video.width,
                  height: video.height,
                  provider: "pixabay",
                });
              }
            }
          }
        }
      } catch {
        // Fallback to Mixkit
      }
    }

    if (candidates.length >= limit) {
      return candidates.slice(0, limit);
    }

    // 2. Mixkit Open Stock Search (Public, high quality, no API key needed)
    try {
      const searchUrl = `https://mixkit.co/free-stock-video/${encodeURIComponent(term)}/`;
      let res = await this.fetchImpl(searchUrl, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });

      if (!res.ok) {
        const fallbackUrl = `https://mixkit.co/free-stock-video/tag/${encodeURIComponent(term)}/`;
        res = await this.fetchImpl(fallbackUrl, {
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        }).catch(() => res);
      }

      if (res.ok) {
        const html = await res.text();
        const mixkitCandidates = this.parseMixkitHtml(html, term);
        for (const mc of mixkitCandidates) {
          if (!candidates.some((c) => c.url === mc.url)) {
            candidates.push(mc);
          }
        }
      }
    } catch {
      // Ignore network errors on secondary provider
    }

    return candidates.slice(0, limit);
  }

  parseMixkitHtml(html: string, fallbackTitle: string): ProductVideoCandidate[] {
    const candidates: ProductVideoCandidate[] = [];
    const seenIds = new Set<string>();

    // Matches assets.mixkit.co/videos/<id>/<id>-<res>.mp4
    const regex = /https:\/\/assets\.mixkit\.co\/videos\/(\d+)\/\1-(?:1080|720|360)\.mp4/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(html)) !== null) {
      const videoId = match[1];
      if (!videoId || seenIds.has(videoId)) continue;
      seenIds.add(videoId);

      // Prefer 1080p stream
      const highResUrl = `https://assets.mixkit.co/videos/${videoId}/${videoId}-1080.mp4`;
      candidates.push({
        url: highResUrl,
        title: `${fallbackTitle} clip ${videoId}`,
        width: 1080,
        height: 1920,
        provider: "mixkit",
      });
    }

    return candidates;
  }
}
