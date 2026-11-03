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
});
