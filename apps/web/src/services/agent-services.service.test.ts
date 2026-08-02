import { describe, expect, it } from "vitest";
import type { AgentInventoryItem } from "@prompthub/shared/types";
import { AgentServicesService } from "./agent-services.service.js";

const agent = {
  id: "qwen",
  name: "Qwen",
  isDetected: true,
  paths: {
    root: "/srv/codex",
    skills: "/srv/codex/skills",
    configFiles: ["/srv/codex/config.toml"],
    configFileRelativePaths: ["config.toml"],
  },
} as AgentInventoryItem;

function createDependencies() {
  return {
    listSkills: () => [
      { id: "skill-1", name: "Writer", description: "Writes content" },
    ],
    listRules: () => [
      { id: "rule-1", name: "AGENTS.md", description: "Global rules" },
    ],
    readAgentAssets: () => ({
      mcpLibrary: {
        servers: [{ id: "mcp-1", displayName: "Local MCP" }],
      },
      pluginLibrary: {
        plugins: [{ id: "plugin-1", displayName: "Writer Plugin" }],
      },
    }),
    listProviderProfiles: () => [
      { id: "provider-1", name: "OpenAI", providerKind: "openai" },
    ],
    inspectConfigFiles: async () => [
      { id: "config.toml", label: "config.toml", state: "available" },
    ],
    listAppearance: async () => [],
    listDefinitions: async () => [
      { id: "command:review.md", label: "review", state: "available" },
    ],
    listSessions: () => [
      { id: "session-1", label: "Fix Web parity", state: "present" },
    ],
  };
}

function createService() {
  return new AgentServicesService(createDependencies());
}

describe("AgentServicesService", () => {
  it("exposes every Desktop Agent service domain on self-hosted Web", async () => {
    const service = createService();
    const manifest = await service.getManifest(
      { userId: "user-1", role: "admin" },
      agent,
    );

    expect(manifest.map((entry) => entry.domain)).toEqual([
      "skills",
      "mcp",
      "plugins",
      "rules",
      "definitions",
      "provider",
      "appearance",
      "configFiles",
      "sessions",
      "usage",
      "maintenance",
    ]);
    expect(manifest.every((entry) => entry.serviceAvailable)).toBe(true);
    expect(manifest.find((entry) => entry.domain === "skills")?.status).toBe(
      "available",
    );
    expect(manifest.find((entry) => entry.domain === "sessions")?.status).toBe(
      "partial",
    );
    expect(manifest.find((entry) => entry.domain === "usage")?.status).toBe(
      "partial",
    );
    expect(
      (
        await service.get(
          { userId: "user-1", role: "admin" },
          agent,
          "definitions",
        )
      ).items,
    ).toEqual([
      { id: "command:review.md", label: "review", state: "available" },
    ]);
  });

  it("returns real shared inventories and separates unavailable native actions", async () => {
    const service = createService();
    const actor = { userId: "user-1", role: "admin" as const };

    await expect(service.get(actor, agent, "skills")).resolves.toMatchObject({
      total: 1,
      items: [{ id: "skill-1", label: "Writer" }],
      actions: { browse: "available", install: "unavailable" },
    });
    await expect(service.get(actor, agent, "mcp")).resolves.toMatchObject({
      items: [{ id: "mcp-1", label: "Local MCP" }],
      actions: { browse: "available", distribute: "unavailable" },
    });
    await expect(service.get(actor, agent, "provider")).resolves.toMatchObject({
      items: [{ id: "provider-1", label: "OpenAI" }],
      actions: {
        browse: "available",
        manage: "available",
        activate: "unavailable",
      },
    });
    await expect(
      service.get(actor, agent, "configFiles"),
    ).resolves.toMatchObject({
      items: [{ id: "config.toml", state: "available" }],
      actions: { browse: "available", edit: "available" },
    });
    await expect(
      service.get(actor, agent, "maintenance"),
    ).resolves.toMatchObject({
      status: "available",
      items: [{ id: "root", state: "available" }],
      actions: { inspect: "available", launch: "unavailable" },
    });
    await expect(service.get(actor, agent, "sessions")).resolves.toMatchObject({
      items: [{ id: "session-1", state: "present" }],
      actions: { browse: "available", resume: "unavailable" },
    });
  });

  it("bounds every service inventory returned to the browser", async () => {
    const service = new AgentServicesService({
      ...createDependencies(),
      listSkills: () =>
        Array.from({ length: 600 }, (_, index) => ({
          id: `skill-${index}`,
          name: `Skill ${index}`,
        })),
    });

    const result = await service.get(
      { userId: "user-1", role: "admin" },
      agent,
      "skills",
    );

    expect(result.total).toBe(600);
    expect(result.items).toHaveLength(200);
    expect(result.truncated).toBe(true);
  });
});
