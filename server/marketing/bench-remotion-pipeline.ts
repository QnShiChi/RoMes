import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { generateMarketingVideoWorkflow } from "./studio.ts";

async function runBenchmark(): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), "bench-remotion-"));
  const startAll = performance.now();

  try {
    const result = await generateMarketingVideoWorkflow(tempDir, {
      campaignSlug: "bench-campaign",
      script:
        "Muse AI giúp tự động gửi email và bảo mật thông tin tối đa chỉ với một câu lệnh đơn giản.",
      ratio: "9:16",
      bgmTheme: "tech",
      brandName: "Muse AI",
      scenes: [
        {
          type: "hook",
          title: "Đột phá cùng Muse AI",
          subtitle: "Trợ lý ảo thế hệ mới",
          animationType: "ai",
          floatingTags: ["Thông minh", "Thời gian thực"],
          durationMs: 2500,
        },
        {
          type: "features",
          title: "Tự động gửi email",
          subtitle: "Chỉ với 1 câu lệnh đơn giản",
          animationType: "email",
          floatingTags: ["Tiết kiệm 2h", "100% tự động"],
          durationMs: 3000,
        },
        {
          type: "features",
          title: "Bảo mật dữ liệu tuyệt đối",
          subtitle: "Chuẩn mã hoá quân sự",
          animationType: "security",
          floatingTags: ["Mã hoá E2E", "An toàn tuyệt đối"],
          durationMs: 3000,
        },
        {
          type: "cta",
          title: "Dùng thử miễn phí ngay",
          subtitle: "Bắt đầu chỉ trong 30 giây",
          animationType: "speed",
          floatingTags: ["Miễn phí 100%", "Không cần thẻ"],
          durationMs: 2500,
        },
      ],
    });

    const totalElapsedMs = performance.now() - startAll;

    if (!existsSync(result.videoPath)) {
      throw new Error(`Video file was not generated: ${result.videoPath}`);
    }

    const fileSize = statSync(result.videoPath).size;

    console.log(
      JSON.stringify(
        {
          status: "SUCCESS",
          totalElapsedMs: Math.round(totalElapsedMs),
          videoPath: result.videoPath,
          width: result.width,
          height: result.height,
          durationSeconds: result.durationSeconds,
          fileSizeBytes: fileSize,
          ratio: result.ratio,
        },
        null,
        2,
      ),
    );

    if (totalElapsedMs > 60_000) {
      throw new Error(`Pipeline took too long: ${totalElapsedMs}ms > 60000ms`);
    }

    if (fileSize < 50_000) {
      throw new Error(`Rendered video file is suspiciously small: ${fileSize} bytes`);
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

runBenchmark().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
