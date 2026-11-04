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
        "mcp:marketing_studio:get_marketing_post",
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
    expect(byName.get("RoMes")?.tools?.allow).toEqual(expect.arrayContaining([
      "mcp:marketing_studio:save_marketing_post",
      "mcp:marketing_studio:get_marketing_post",
    ]));
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

  it("requires balanced consultation and a persisted post before visual work", () => {
    const poppy = readFileSync(fileURLToPath(new URL("./poppy.md", import.meta.url)), "utf8");
    const romes = readFileSync(fileURLToPath(new URL("./romes.md", import.meta.url)), "utf8");
    const finch = readFileSync(fileURLToPath(new URL("./finch.md", import.meta.url)), "utf8");

    expect(romes).toContain("ask_user");
    expect(romes).toMatch(/xác nhận brief|duyệt revision/i);
    expect(romes).toContain("save_marketing_post");
    expect(romes).toMatch(/Poppy.*trước.*Finch|chỉ giao Finch sau/is);
    expect(romes).not.toMatch(/gọi luôn approve_marketing_campaign|không dừng lại hỏi xin duyệt/i);
    expect(poppy).toContain("visualPrompts");
    expect(finch).toContain("POST_ARTIFACT_ID:");
    expect(finch).toContain("get_marketing_post");
  });
});
