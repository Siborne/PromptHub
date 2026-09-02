import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { buildManagedAgents } from "@prompthub/core";
import {
  DEFAULT_SKILL_PLATFORM_ORDER,
  getPlatformById,
} from "@prompthub/shared/constants/platforms";
import { detectInstalledPlatforms } from "../../../src/main/services/skill-installer-platform";

describe("Doubao Work platform support", () => {
  it("uses the verified user Skill workspace without exposing built-in Skills", () => {
    const platform = getPlatformById("doubao");

    expect(platform).toMatchObject({
      id: "doubao",
      name: "Doubao Work",
      icon: "Bot",
      rootDir: {
        darwin:
          "~/Library/Application Support/Doubao/Default/.doubao/agent_mode/workspace",
        win32: "%APPDATA%\\Doubao\\Default\\.doubao\\agent_mode\\workspace",
        linux: "~/.config/Doubao/Default/.doubao/agent_mode/workspace",
      },
      skillsRelativePath: ".user_skills",
      launchPaths: {
        darwin: ["/Applications/Doubao.app", "~/Applications/Doubao.app"],
      },
    });
    expect(platform).not.toHaveProperty("mcpRelativePath");
    expect(platform).not.toHaveProperty("pluginsRelativePath");
    expect(platform).not.toHaveProperty("globalRuleFile");
    expect(platform).not.toHaveProperty("configFiles");
    expect(DEFAULT_SKILL_PLATFORM_ORDER).toContain("doubao");
  });

  it("projects only the verified user Skill path and conservative capabilities", () => {
    const platform = getPlatformById("doubao");
    const [agent] = buildManagedAgents({
      platforms: [platform!],
      detectedPlatformIds: ["doubao"],
      pinnedPlatformIds: [],
      builtinOverrides: {},
      osKey: "darwin",
    });

    expect(agent).toMatchObject({
      id: "doubao",
      status: "installed",
      launchable: true,
      paths: {
        root: "~/Library/Application Support/Doubao/Default/.doubao/agent_mode/workspace",
        skills:
          "~/Library/Application Support/Doubao/Default/.doubao/agent_mode/workspace/.user_skills",
        configFiles: [],
        configFileRelativePaths: [],
      },
      capabilities: {
        provider: { status: "planned", reason: "adapter-pending" },
        assets: { status: "partial", reason: "asset-paths-only" },
        sessions: { status: "planned", reason: "adapter-pending" },
        usage: { status: "planned", reason: "adapter-pending" },
      },
    });
    expect(agent.paths.mcp).toBeUndefined();
    expect(agent.paths.plugins).toBeUndefined();
    expect(agent.paths.rules).toBeUndefined();
  });

  it("detects Doubao from the native workspace parent", async () => {
    const workspace = path.join(
      process.env.HOME || "",
      "Library/Application Support/Doubao/Default/.doubao/agent_mode/workspace",
    );
    const pathExists = vi.fn(
      async (candidate: string) => candidate === workspace,
    );
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    try {
      const detected = await detectInstalledPlatforms({
        pathExists,
        resolveExecutable: vi.fn().mockResolvedValue(null),
      });

      expect(detected).toContain("doubao");
      expect(pathExists).toHaveBeenCalledWith(workspace);
    } finally {
      warn.mockRestore();
    }
  });
});
