#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { generateIntelligenceCommercialWorkflow } from "../server/marketing/studio.ts";

async function main() {
  const brandName = process.argv[2] || "RoMes AI Decision";
  const duration = Number(process.argv[3]) || 60;
  const assetsRoot = join(homedir(), ".openmausbot", "workspaces", "default", "marketing-assets");

  console.log(`🎬 Đang khởi tạo Render Commercial cho: "${brandName}" (${duration}s)...`);

  const result = await generateIntelligenceCommercialWorkflow(assetsRoot, {
    brandName,
    targetDurationSeconds: duration,
    campaignSlug: `commercial-test-${Date.now().toString(36)}`,
    template: "intelligence-commercial",
    ratio: "9:16",
    bgmTheme: "tech",
  });

  console.log("✅ Render hoàn tất thành công!");
  console.log(`📹 Video file: ${result.videoPath}`);
  console.log(`⏱️ Thời lượng: ${result.durationSeconds}s`);
  console.log(`🖼️ Scenes count: ${result.scenesCount}`);
}

main().catch((err) => {
  console.error("❌ Lỗi render:", err);
  process.exit(1);
});
