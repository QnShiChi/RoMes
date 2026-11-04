import type { ProductImageCandidate } from "./types.ts";

export class ProductImageSearcher {
  private readonly fetchImpl: typeof fetch;

  constructor(fetchImpl?: typeof fetch) {
    this.fetchImpl = fetchImpl ?? fetch;
  }

  async search(query: string): Promise<ProductImageCandidate[]> {
    const encoded = encodeURIComponent(query.trim());
    const searchUrl = `https://www.bing.com/images/search?q=${encoded}&qft=+filterui:imagesize-large`;

    const response = await this.fetchImpl(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to search images: HTTP ${response.status}`);
    }

    const html = await response.text();
    return this.parseCandidates(html);
  }

  private parseCandidates(html: string): ProductImageCandidate[] {
    const candidates: ProductImageCandidate[] = [];

    const mAttributeRegex = /class="iusc"[^>]*?\sm="([^"]+)"/g;
    let match: RegExpExecArray | null;

    while ((match = mAttributeRegex.exec(html)) !== null) {
      const rawJson = match[1]!
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&#39;/g, "'");

      try {
        const parsed = JSON.parse(rawJson) as {
          murl?: string;
          t?: string;
          ow?: number;
          oh?: number;
          purl?: string;
        };

        if (parsed.murl && parsed.murl.startsWith("https://")) {
          candidates.push({
            url: parsed.murl,
            title: parsed.t ?? "",
            width: parsed.ow,
            height: parsed.oh,
            sourceUrl: parsed.purl,
          });
        }
      } catch {
        // Continue if single item JSON malformed
      }
    }

    if (candidates.length === 0) {
      const fallbackUrlRegex = /murl&quot;:&quot;(https:\/\/[^&"]+)&quot;/g;
      while ((match = fallbackUrlRegex.exec(html)) !== null) {
        candidates.push({
          url: match[1]!,
          title: "",
        });
      }
    }

    return candidates;
  }
}
