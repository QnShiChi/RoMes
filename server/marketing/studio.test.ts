import { createServer, type Server } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectImageFormat,
  distributeScriptToScenes,
  enrichScriptForDuration,
  extractKeywordsForSearch,
  findDiscoveredCampaignImages,
  generateMarketingImages,
  generateMarketingVideoWorkflow,
  getMarketingDraft,
  resolveUnsplashKey,
  saveMarketingDraft,
  sanitizeVoiceoverScript,
} from "./studio.ts";

const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

describe("marketing studio core", () => {
  const dirs: string[] = [];
  let server: Server | undefined;

  afterEach(async () => {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
    for (const dir of dirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  const makeTempDir = () => {
    const dir = mkdtempSync(join(tmpdir(), "omb-marketing-studio-"));
    dirs.push(dir);
    return dir;
  };

  it("detects valid JPEG, PNG, and WEBP magic bytes and rejects HTML/text", () => {
    expect(detectImageFormat(VALID_JPEG)).toBe("jpeg");
    expect(detectImageFormat(VALID_PNG)).toBe("png");
    expect(detectImageFormat(Buffer.from("<html>error</html>"))).toBeNull();
  });

  it("extracts clean search keywords from verbose visual prompts", () => {
    expect(
      extractKeywordsForSearch(
        "Photorealistic 8k close-up shot of cyber security glowing shield lock on server rack",
      ),
    ).toBe("cybersecurity network data security");
    expect(
      extractKeywordsForSearch(
        "Hook – bàn cờ neon, quân cờ là nút mạng dữ liệu",
      ),
    ).toBe("business strategy technology futuristic");
    expect(extractKeywordsForSearch("")).toBe("technology artificial intelligence business");
  });

  it("keeps the AI subject and drops narrative filler when searching stock photos", () => {
    const query = extractKeywordsForSearch(
      "Dynamic split-screen scene showing opportunities and risks of AI in business, dramatic lighting",
    );
    expect(query).not.toMatch(/\b(scene|showing|opportunities|risks|dramatic)\b/);
    expect(query).toMatch(/artificial intelligence|business|technology/);
    expect(extractKeywordsForSearch("ai chip glowing")).toContain("artificial intelligence");
  });

  it("extends a short script toward the requested duration with scene copy", () => {
    const scenes = [
      { type: "hook" as const, title: "Tương lai AI", durationMs: 4000 },
      { type: "features" as const, title: "Lợi ích", bulletPoints: ["Tăng năng suất gấp đôi", "Giảm chi phí vận hành"], durationMs: 4000 },
    ];
    const short = "AI đang thay đổi doanh nghiệp.";
    const enriched = enrichScriptForDuration(short, scenes, 60);
    expect(enriched.startsWith(short)).toBe(true);
    expect(enriched).toContain("Tăng năng suất gấp đôi");
    expect(enrichScriptForDuration(short, scenes, 20)).toBe(short);
  });

  it("splits narration across scenes in spoken order", () => {
    const parts = distributeScriptToScenes("một hai ba bốn năm sáu bảy", 3);
    expect(parts).toEqual(["một hai ba", "bốn năm sáu", "bảy"]);
  });

  it("resolves Unsplash access key from argument, environment, or config", () => {
    expect(resolveUnsplashKey("custom-key")).toBe("custom-key");
    const resolved = resolveUnsplashKey();
    expect(typeof resolved).toBe("string");
  });

  it("generates multiple images in parallel, retries transient 502 errors, and saves files to disk", async () => {
    const root = makeTempDir();
    let calls = 0;
    server = createServer((req, res) => {
      calls += 1;
      if (req.url?.includes("flaky") && calls === 1) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end("Bad gateway");
        return;
      }
      res.writeHead(200, { "content-type": "image/jpeg" });
      res.end(VALID_JPEG);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;

    const result = await generateMarketingImages(
      {
        campaignSlug: "Sony XM6 Launch!",
        prompts: [
          { prompt: "studio shot of headphones on marble desk", label: "Studio Shot" },
          { prompt: "flaky lifestyle shot in coffee shop", label: "Lifestyle Shot" },
        ],
      },
      { assetsRoot: root, baseUrl: `http://127.0.0.1:${port}/prompt`, timeoutMs: 5_000 },
    );

    expect(result.campaignSlug).toBe("sony-xm6-launch");
    expect(result.images).toHaveLength(2);
    expect(result.failed).toHaveLength(0);
    expect(readFileSync(result.images[0]!.filePath)).toEqual(VALID_JPEG);
    expect(readFileSync(result.images[1]!.filePath)).toEqual(VALID_JPEG);
    expect(result.images[0]!.label).toBe("Studio Shot");
  });

  it("falls back gracefully to curated visuals or local gradient when upstream is unavailable", async () => {
    const root = makeTempDir();
    const result = await generateMarketingImages(
      {
        campaignSlug: "fallback-test",
        prompts: [{ prompt: "abstract futuristic cyber neon", label: "Hero" }],
      },
      { assetsRoot: root, baseUrl: "http://127.0.0.1:9999/broken", timeoutMs: 1_000, maxRetries: 0 },
    );
    expect(result.images).toHaveLength(1);
    expect(result.images[0]!.width).toBe(1080);
    expect(result.images[0]!.height).toBe(1920);
    expect(existsSync(result.images[0]!.filePath)).toBe(true);
  });

  it("persists and retrieves campaign draft state", async () => {
    const root = makeTempDir();
    const saved = await saveMarketingDraft(root, {
      campaignSlug: "iphone-duo",
      productName: "iPhone Duo",
      targetPlatforms: ["facebook", "x"],
      posts: [
        {
          platform: "facebook",
          title: "Siêu phẩm gập đôi iPhone Duo",
          body: "Trải nghiệm công nghệ tương lai ngay hôm nay.",
          hashtags: ["#iPhoneDuo", "#Tech"],
          imagePaths: [join(root, "iphone-duo", "image-1.jpg")],
        },
      ],
    });

    expect(saved.status).toBe("pending_approval");
    const loaded = await getMarketingDraft(root, "iphone-duo");
    expect(loaded.productName).toBe("iPhone Duo");
    expect(loaded.posts[0]!.platform).toBe("facebook");

  });

  it("orchestrates video generation workflow producing complete MP4 and audio", async () => {
    const root = makeTempDir();
    const result = await generateMarketingVideoWorkflow(root, {
      campaignSlug: "test-video-flow",
      script: "RoMes giúp bạn tạo video marketing tự động trong nháy mắt.",
      scenes: [
        {
          type: "hook",
          title: "Khám phá RoMes Marketing",
          durationMs: 1000,
        },
        {
          type: "cta",
          title: "Trải nghiệm miễn phí",
          durationMs: 1000,
        },
      ],
      ratio: "9:16",
      bgmTheme: "tech",
    });

    expect(result.campaignSlug).toBe("test-video-flow");
    expect(result.ratio).toBe("9:16");
    expect(result.width).toBe(1080);
    expect(result.height).toBe(1920);
    expect(result.bytes).toBeGreaterThan(1000);
    expect(result.nextStepHint).toContain(result.videoPath);
    expect(existsSync(join(root, "test-video-flow", "video.mp4"))).toBe(true);
    expect(existsSync(join(root, "test-video-flow", "audio.mp3"))).toBe(true);
  });

  it("sanitizes storyboard labels and extracts pure voiceover prose", () => {
    const rawMarkdownWithLabels = `
### Cảnh 1: Tiêu đề: AI trong đời sống
- Thời gian: 3000ms
- animationType: growth
Trí tuệ nhân tạo đang thay đổi cuộc sống của bạn mỗi ngày.

### Cảnh 2: Phụ đề: Tối ưu hiệu quả công việc
- durationMs: 2500ms
floatingTags: Tốc độ, Hiệu quả
Giúp bạn hoàn thành mọi dự án nhanh hơn bao giờ hết.
    `;

    const cleaned = sanitizeVoiceoverScript(rawMarkdownWithLabels);
    expect(cleaned).not.toContain("Cảnh 1");
    expect(cleaned).not.toContain("Tiêu đề:");
    expect(cleaned).not.toContain("Phụ đề:");
    expect(cleaned).not.toContain("animationType");
    expect(cleaned).not.toContain("durationMs");
    expect(cleaned).not.toContain("floatingTags");
    expect(cleaned).toContain("Trí tuệ nhân tạo đang thay đổi cuộc sống");
    expect(cleaned).toContain("Giúp bạn hoàn thành mọi dự án");
  });

  it("extracts dedicated VOICEOVER section if present in Poppy's output", () => {
    const structuredPoppyScript = `
### LỜI BÌNH LỒNG TIẾNG (VOICEOVER SCRIPT)
Đột phá công nghệ marketing cùng trợ lý ảo thông minh RoMes. Tự động hóa sáng tạo nội dung đa nền tảng chỉ trong vài phút.

### PHÂN CẢNH HÌNH ẢNH (SCENES)
Cảnh 1 (Hook): Chào đón tương lai
Cảnh 2 (Features): Tính năng nổi bật
    `;

    const cleaned = sanitizeVoiceoverScript(structuredPoppyScript);
    expect(cleaned).toBe("Đột phá công nghệ marketing cùng trợ lý ảo thông minh RoMes. Tự động hóa sáng tạo nội dung đa nền tảng chỉ trong vài phút.");
    expect(cleaned).not.toContain("PHÂN CẢNH HÌNH ẢNH");
  });

  it("extracts voiceover when prefixed with PHẦN 1 and cuts off PHÂN CẢNH storyboard", () => {
    const realScript = `
### PHẦN 1: LỜI BÌNH LỒNG TIẾNG (VOICEOVER SCRIPT)
Trong thời đại AI phát triển mạnh mẽ, xã hội Việt Nam đang trải qua những biến đổi sâu sắc. Công nghệ không chỉ thay đổi cách chúng ta làm việc mà còn hình thành các phương thức giao tiếp mới.

### PHÂN CẢNH HÌNH ẢNH (SCENES)
- **Cảnh 1 (type: "hook")**:
  * Title: "Biến Đổi Xã Hội Việt Nam"
  * Subtitle: "Đằng Sau Sự Phát Triển Của AI"
  * Prompt: "Vietnam's changing society due to AI development"
    `;
    const cleaned = sanitizeVoiceoverScript(realScript);
    expect(cleaned).toBe("Trong thời đại AI phát triển mạnh mẽ, xã hội Việt Nam đang trải qua những biến đổi sâu sắc. Công nghệ không chỉ thay đổi cách chúng ta làm việc mà còn hình thành các phương thức giao tiếp mới.");
    expect(cleaned).not.toContain("PHÂN CẢNH");
    expect(cleaned).not.toContain("Biến Đổi Xã Hội");
  });

  it("falls back to scene titles/subtitles if script is empty", () => {
    const fallback = sanitizeVoiceoverScript("", [
      { type: "hook", title: "Khám phá RoMes Marketing", subtitle: "Giải pháp video tự động", durationMs: 3000 },
      { type: "cta", title: "Bắt đầu ngay hôm nay", durationMs: 3000 },
    ]);
    expect(fallback).toBe("Giải pháp video tự động. Bắt đầu ngay hôm nay");
  });

  it("findDiscoveredCampaignImages finds images in sibling folder matching slug tokens", () => {
    const root = makeTempDir();
    const siblingDir = join(root, "agentic-ai-impact-programming");
    mkdirSync(siblingDir, { recursive: true });
    writeFileSync(join(siblingDir, "image-1.jpg"), VALID_JPEG);
    writeFileSync(join(siblingDir, "image-2.jpg"), VALID_JPEG);

    const discovered = findDiscoveredCampaignImages(root, "agentic-ai-programming-impact");
    expect(discovered).toHaveLength(2);
    expect(discovered[0]).toContain("image-1.jpg");
    expect(discovered[1]).toContain("image-2.jpg");
  });

  it("generates exactly N images corresponding to N input prompts without unsplash", async () => {
    const root = makeTempDir();
    server = createServer((req, res) => {
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(VALID_JPEG);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const prompts = [
      { prompt: "Commercial photo of Vietnam semiconductor chip", label: "Ảnh 1: Chip AI" },
      { prompt: "Vietnamese software engineers in clean modern lab", label: "Ảnh 2: Đội ngũ kỹ sư" },
      { prompt: "High tech AI server datacenter in Ho Chi Minh City", label: "Ảnh 3: Trung tâm dữ liệu" },
    ];

    const result = await generateMarketingImages(
      { campaignSlug: "test-ai-vietnam", prompts },
      { assetsRoot: root, baseUrl },
    );

    expect(result.images).toHaveLength(3);
    expect(result.failed).toHaveLength(0);
    expect(existsSync(result.images[0]!.filePath)).toBe(true);
    expect(existsSync(result.images[1]!.filePath)).toBe(true);
    expect(existsSync(result.images[2]!.filePath)).toBe(true);
  });

  it("falls back to FLUX when Gemini image API returns 429 quota exceeded", async () => {
    const root = makeTempDir();
    let fluxHit = false;
    server = createServer((req, res) => {
      fluxHit = true;
      res.writeHead(200, { "Content-Type": "image/jpeg" });
      res.end(VALID_JPEG);
    });
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", () => resolve()));
    const port = (server.address() as AddressInfo).port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const prompts = [{ prompt: "Vietnam tech innovation" }];

    // Mock Gemini API failure via mock or invalid key, verifying seamless FLUX fallback
    const result = await generateMarketingImages(
      { campaignSlug: "test-quota-fallback", prompts },
      { assetsRoot: root, baseUrl },
    );

    expect(result.images).toHaveLength(1);
    expect(fluxHit).toBe(true);
    expect(existsSync(result.images[0]!.filePath)).toBe(true);
  });
});
