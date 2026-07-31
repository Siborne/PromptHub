import { describe, expect, it } from "vitest";

import {
  AGENT_PLATFORM_CAPABILITY_KEYS,
  AGENT_PLATFORM_DEPTH_CAPABILITIES,
  getAgentPlatformCapabilityInventory,
} from "@prompthub/shared/constants/agent-platform-capabilities";
import {
  SKILL_PLATFORMS,
  type SkillPlatform,
} from "@prompthub/shared/constants/platforms";

const expectedProviderAdapters = [
  "claude",
  "codex",
  "copilot",
  "gemini",
  "grok",
  "kimi",
  "kiro",
  "oh-my-pi",
  "openclaw",
  "opencode",
  "pi",
  "qwen",
];

const expectedSessionAdapters = [
  "claude",
  "codex",
  "gemini",
  "grok",
  "kimi",
  "oh-my-pi",
  "openclaw",
  "opencode",
  "pi",
  "qwen",
];

const expectedUsageAdapters = [
  "antigravity",
  "claude",
  "codex",
  "copilot",
  "gemini",
  "kimi",
];

function supportedPlatformIds(
  capability: "providerModel" | "sessions" | "usage",
): string[] {
  return SKILL_PLATFORMS.filter(
    (platform) =>
      getAgentPlatformCapabilityInventory(platform)[capability].status ===
      "supported",
  )
    .map((platform) => platform.id)
    .sort();
}

describe("Agent platform capability inventory", () => {
  it("declares depth-adapter evidence for every built-in platform exactly once", () => {
    const registryIds = SKILL_PLATFORMS.map((platform) => platform.id).sort();
    const inventoryIds = Object.keys(AGENT_PLATFORM_DEPTH_CAPABILITIES).sort();

    expect(new Set(registryIds).size).toBe(35);
    expect(inventoryIds).toEqual(registryIds);
  });

  it("keeps the requested local Claw platforms as independent planned identities", () => {
    const expectedRoots = {
      copaw: {
        primary: "~/.qwenpaw",
        fallbacks: ["~/.copaw"],
      },
      autoclaw: {
        primary: "~/.autoclaw",
        fallbacks: ["~/.openclaw-autoclaw"],
      },
      nanoclaw: {
        primary: "~/.nanoclaw",
        fallbacks: ["~/nanoclaw", "~/nanoclaw-v2"],
      },
    } as const;

    for (const platformId of Object.keys(expectedRoots) as Array<
      keyof typeof expectedRoots
    >) {
      const platform = SKILL_PLATFORMS.find(
        (candidate) => candidate.id === platformId,
      );
      expect(platform, platformId).toBeDefined();
      expect(platform?.rootDir.darwin, platformId).toBe(
        expectedRoots[platformId].primary,
      );
      expect(platform?.rootDirFallbacks?.darwin, platformId).toEqual(
        expectedRoots[platformId].fallbacks,
      );

      const inventory = getAgentPlatformCapabilityInventory(platform!);
      expect(inventory.providerModel.status, platformId).toBe("planned");
      expect(inventory.sessions.status, platformId).toBe("planned");
      expect(inventory.usage.status, platformId).toBe("planned");
      expect(inventory.maintenanceCli.status, platformId).toBe("planned");
      expect(inventory.skills.status, platformId).toBe("partial");
    }
  });

  it("provides a status and evidence for every capability on every platform", () => {
    for (const platform of SKILL_PLATFORMS) {
      const inventory = getAgentPlatformCapabilityInventory(platform);
      expect(Object.keys(inventory).sort(), platform.id).toEqual(
        [...AGENT_PLATFORM_CAPABILITY_KEYS].sort(),
      );

      for (const key of AGENT_PLATFORM_CAPABILITY_KEYS) {
        expect(
          inventory[key].evidence.trim(),
          `${platform.id}.${key}`,
        ).not.toBe("");
      }
    }
  });

  it("matches the adapters that are currently implemented and verified", () => {
    expect(supportedPlatformIds("providerModel")).toEqual([
      "claude",
      "codex",
      "gemini",
      "grok",
      "kimi",
      "opencode",
      "qwen",
    ]);
    expect(
      SKILL_PLATFORMS.filter((platform) => {
        const status =
          getAgentPlatformCapabilityInventory(platform).providerModel.status;
        return status === "supported" || status === "partial";
      })
        .map((platform) => platform.id)
        .sort(),
    ).toEqual(expectedProviderAdapters);
    expect(supportedPlatformIds("sessions")).toEqual(expectedSessionAdapters);
    expect(supportedPlatformIds("usage")).toEqual(expectedUsageAdapters);
  });

  it("keeps Grok Build rooted in its documented environment override", () => {
    expect(
      SKILL_PLATFORMS.find((platform) => platform.id === "grok"),
    ).toMatchObject({
      rootEnvironmentVariable: "GROK_HOME",
      mcpRelativePath: "config.toml",
      configFiles: expect.arrayContaining(["config.toml"]),
    });
  });

  it("derives path-owned capabilities without claiming missing protocols", () => {
    const custom: SkillPlatform = {
      id: "custom",
      name: "Custom",
      icon: "Bot",
      rootDir: {
        darwin: "~/.custom",
        win32: "%USERPROFILE%\\.custom",
        linux: "~/.custom",
      },
      skillsRelativePath: "skills",
      isCustom: true,
    };

    expect(getAgentPlatformCapabilityInventory(custom)).toMatchObject({
      installationPath: {
        status: "partial",
        evidence: "platform-root-declaration",
      },
      skills: {
        status: "partial",
        evidence: "skills-relative-path",
      },
      mcp: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      providerModel: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      sessions: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      usage: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      maintenanceCli: {
        status: "planned",
        evidence: "lifecycle-adapter-pending",
      },
    });
  });

  it("keeps Cursor depth adapters planned while exposing verified asset paths", () => {
    const cursor = SKILL_PLATFORMS.find((platform) => platform.id === "cursor");
    expect(cursor).toBeDefined();

    expect(getAgentPlatformCapabilityInventory(cursor!)).toEqual({
      installationPath: {
        status: "partial",
        evidence: "platform-root-declaration",
      },
      providerModel: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      skills: {
        status: "partial",
        evidence: "skills-relative-path",
      },
      mcp: {
        status: "partial",
        evidence: "mcp-relative-path",
      },
      rules: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      plugins: {
        status: "partial",
        evidence: "plugins-relative-path",
      },
      configFiles: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      sessions: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      usage: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      launch: {
        status: "supported",
        evidence: "platform-launch-allowlist",
      },
      maintenanceCli: {
        status: "planned",
        evidence: "lifecycle-adapter-pending",
      },
      backupExportImport: {
        status: "partial",
        evidence: "non-secret-agent-settings-backup",
      },
      secretRuntimeExclusion: {
        status: "partial",
        evidence: "runtime-and-secret-exclusion-policy",
      },
      appearance: {
        status: "unsupported",
        evidence: "appearance-adapter-unavailable",
      },
    });
  });

  it("derives CLI maintenance only from canonical platform descriptors", () => {
    const diagnosticIds = SKILL_PLATFORMS.filter(
      (platform) =>
        getAgentPlatformCapabilityInventory(platform).maintenanceCli.status ===
        "partial",
    )
      .map((platform) => platform.id)
      .sort();

    expect(diagnosticIds).toEqual([
      "claude",
      "codex",
      "kimi",
      "oh-my-pi",
      "openclaw",
      "opencode",
      "pi",
      "qwen",
    ]);
    for (const platform of SKILL_PLATFORMS) {
      const capability =
        getAgentPlatformCapabilityInventory(platform).maintenanceCli;
      expect(capability.status === "partial").toBe(Boolean(platform.cli));
      if (platform.cli) {
        expect(platform.cli.executableCandidates.length).toBeGreaterThan(0);
        expect(platform.cli.versionArgs.length).toBeGreaterThan(0);
        expect(platform.cli.evidence.trim()).not.toBe("");
        expect(capability.evidence).toBe(platform.cli.evidence);
      }
    }
  });

  it("uses the documented OpenCode update and exact rollback contract", () => {
    const opencode = SKILL_PLATFORMS.find(
      (platform) => platform.id === "opencode",
    );

    expect(opencode?.cli).toEqual({
      executableCandidates: ["opencode"],
      versionArgs: ["--version"],
      evidence: "official-opencode-cli",
      update: {
        args: ["upgrade"],
        rollbackTargetPrefix: "v",
        evidence: "official-opencode-cli-upgrade",
      },
    });
  });

  it("uses the documented OpenClaw CLI version contract", () => {
    const openclaw = SKILL_PLATFORMS.find(
      (platform) => platform.id === "openclaw",
    );

    expect(openclaw?.cli).toEqual({
      executableCandidates: ["openclaw"],
      versionArgs: ["--version"],
      evidence: "official-openclaw-cli",
    });
    expect(
      getAgentPlatformCapabilityInventory(openclaw!).maintenanceCli,
    ).toEqual({
      status: "partial",
      evidence: "official-openclaw-cli",
    });
  });

  it("keeps Cherry Studio database-owned capabilities planned", () => {
    const cherryStudio = SKILL_PLATFORMS.find(
      (platform) => platform.id === "cherry-studio",
    );
    expect(cherryStudio).toBeDefined();

    expect(getAgentPlatformCapabilityInventory(cherryStudio!)).toMatchObject({
      installationPath: {
        status: "partial",
        evidence: "platform-root-declaration",
      },
      providerModel: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      skills: {
        status: "partial",
        evidence: "skills-relative-path",
      },
      mcp: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      rules: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      plugins: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      configFiles: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      sessions: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      usage: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      launch: {
        status: "supported",
        evidence: "platform-launch-allowlist",
      },
      maintenanceCli: {
        status: "planned",
        evidence: "lifecycle-adapter-pending",
      },
      appearance: {
        status: "unsupported",
        evidence: "appearance-adapter-unavailable",
      },
    });
  });

  it("keeps Windsurf deep capabilities bounded to public transcript history", () => {
    const windsurf = SKILL_PLATFORMS.find(
      (platform) => platform.id === "windsurf",
    );
    expect(windsurf).toBeDefined();

    expect(getAgentPlatformCapabilityInventory(windsurf!)).toEqual({
      installationPath: {
        status: "partial",
        evidence: "platform-root-declaration",
      },
      providerModel: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      skills: {
        status: "partial",
        evidence: "skills-relative-path",
      },
      mcp: {
        status: "partial",
        evidence: "mcp-relative-path",
      },
      rules: {
        status: "partial",
        evidence: "global-rule-path",
      },
      plugins: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      configFiles: {
        status: "planned",
        evidence: "protocol-evidence-pending",
      },
      sessions: {
        status: "partial",
        evidence: "verified-transcript-hook-adapter",
      },
      usage: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      launch: {
        status: "supported",
        evidence: "platform-launch-allowlist",
      },
      maintenanceCli: {
        status: "planned",
        evidence: "lifecycle-adapter-pending",
      },
      backupExportImport: {
        status: "partial",
        evidence: "non-secret-agent-settings-backup",
      },
      secretRuntimeExclusion: {
        status: "partial",
        evidence: "runtime-and-secret-exclusion-policy",
      },
      appearance: {
        status: "unsupported",
        evidence: "appearance-adapter-unavailable",
      },
    });
  });

  it("keeps Kiro bounded to model settings and read-only local sessions", () => {
    const kiro = SKILL_PLATFORMS.find((platform) => platform.id === "kiro");
    expect(kiro).toBeDefined();
    expect(getAgentPlatformCapabilityInventory(kiro!)).toMatchObject({
      providerModel: {
        status: "partial",
        evidence: "model-config-adapter",
      },
      sessions: {
        status: "partial",
        evidence: "verified-local-session-adapter",
      },
      usage: {
        status: "planned",
        evidence: "adapter-evidence-pending",
      },
      launch: {
        status: "supported",
        evidence: "platform-launch-allowlist",
      },
    });
  });
});
