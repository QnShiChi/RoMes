import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadTeamFile } from "../../headless/team-file.ts";

describe("RoMes marketing swarm team file", () => {
  it("has one chief and least-privilege tools", () => {
    const team = loadTeamFile(fileURLToPath(new URL("./team.yaml", import.meta.url)));
    const byName = new Map(team.bots.map((bot) => [bot.name, bot]));
    expect(byName.get("RoMes")).toMatchObject({ chief: true, manages: ["Marketing"] });
    for (const bot of team.bots) expect(bot.tools?.allow).toContain("native:*");
    expect(byName.get("Poppy")?.tools).toEqual({ allow: ["native:*"] });
    expect(byName.get("Finch")?.tools).toEqual({
      allow: [
        "native:*",
        "mcp:marketing_studio:get_marketing_campaign",
        "mcp:marketing_studio:generate_marketing_images",
      ],
    });
    expect(byName.get("Momo")?.tools).toEqual({
      allow: [
        "native:*",
        "mcp:marketing_studio:get_marketing_campaign",
        "mcp:marketing_studio:generate_marketing_video",
      ],
    });
    expect(byName.get("RoMes")?.tools?.allow).not.toContain("mcp:marketing_studio:generate_marketing_video");
  });

  it("keeps publishing and rendering in different roles", () => {
    const team = loadTeamFile(fileURLToPath(new URL("./team.yaml", import.meta.url)));
    const romes = team.bots.find((bot) => bot.name === "RoMes")!;
    const momo = team.bots.find((bot) => bot.name === "Momo")!;
    expect(romes.tools?.allow).toContain("mcp:marketing_studio:publish_marketing_artifact");
    expect(momo.tools?.allow).not.toContain("mcp:marketing_studio:publish_marketing_artifact");
  });

  it("requires an approved campaign id in every production handoff", () => {
    const romes = readFileSync(fileURLToPath(new URL("./romes.md", import.meta.url)), "utf8");
    const finch = readFileSync(fileURLToPath(new URL("./finch.md", import.meta.url)), "utf8");
    const momo = readFileSync(fileURLToPath(new URL("./momo.md", import.meta.url)), "utf8");

    expect(romes).toContain("CAMPAIGN_ID:");
    expect(romes).toContain("approve_marketing_campaign");
    expect(romes).toContain("không giao việc");
    expect(finch).toContain("CAMPAIGN_ID:");
    expect(finch).toMatch(/requestId|request ID/);
    expect(momo).toContain("CAMPAIGN_ID:");
  });

  it("enforces autonomous execution without redundant user questions", () => {
    const poppy = readFileSync(fileURLToPath(new URL("./poppy.md", import.meta.url)), "utf8");
    const romes = readFileSync(fileURLToPath(new URL("./romes.md", import.meta.url)), "utf8");

    expect(poppy).toMatch(/tuyệt đối không hỏi|không hỏi lại|tự chủ/i);
    expect(romes).toMatch(/gọi luôn approve_marketing_campaign|không dừng lại hỏi xin duyệt|tự động gọi.*approve_marketing_campaign/i);
    expect(romes).toMatch(/tuyệt đối không tự ý bịa đặt chủ đề|khi người dùng chưa cung cấp chủ đề/i);
  });
});
