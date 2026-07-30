/**
 * Skill Platform Configuration
 * 技能平台配置
 *
 * Defines the skills directory paths for various AI coding tools
 * 定义各种 AI 编程工具的 skills 目录路径
 */

import type {
  AgentCliInstallSource,
  AgentProductLifecycle,
} from "@prompthub/shared/types/agent";

export interface AgentCliDescriptor {
  executableCandidates: string[];
  versionArgs: string[];
  evidence: string;
  update?: AgentCliUpdateDescriptor;
}

export interface AgentCliUpdateDescriptor {
  args: string[];
  command?: {
    executableCandidates: string[];
    supportedInstallSources: AgentCliInstallSource[];
  };
  rollbackArgsPrefix?: string[];
  rollbackTargetPrefix: string;
  evidence: string;
}

export interface SkillPlatform {
  id: string;
  name: string;
  icon: string; // lucide icon name
  rootDir: {
    darwin: string;
    win32: string;
    linux: string;
  };
  rootEnvironmentVariable?: string;
  environmentRootRelativeToCwd?: boolean;
  legacyRootEnvironmentVariable?: string;
  rootDirFallbacks?: Partial<Record<SkillPlatformOsKey, string[]>>;
  launchPaths?: Partial<Record<SkillPlatformOsKey, string[]>>;
  resolvedRootPath?: string;
  skillsRelativePath: string;
  mcpRelativePath?: string;
  pluginsRelativePath?: string;
  agentsRelativePath?: string;
  globalRuleFile?: string;
  configFiles?: string[];
  cli?: AgentCliDescriptor;
  isCustom?: boolean;
  isConfigured?: boolean;
  lifecycle?: AgentProductLifecycle;
  replacementPlatformId?: string;
}

export type SkillPlatformOsKey = "darwin" | "win32" | "linux";

function joinPlatformPath(basePath: string, relativePath: string): string {
  if (!relativePath.trim()) {
    return basePath;
  }

  const separator = basePath.includes("\\") ? "\\" : "/";
  const normalizedBase = basePath.replace(/[\\/]+$/, "");
  const normalizedRelative = relativePath
    .trim()
    .split(/[\\/]+/)
    .filter(Boolean)
    .join(separator);

  return normalizedRelative
    ? `${normalizedBase}${separator}${normalizedRelative}`
    : normalizedBase;
}

function stripTrailingRelativePath(
  fullPath: string,
  relativePath: string,
): string {
  const trimmed = fullPath.trim().replace(/[\\/]+$/, "");
  if (!trimmed || !relativePath.trim()) {
    return trimmed;
  }

  const pattern = relativePath
    .trim()
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment) => segment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[\\\\/]+");
  const nextValue = trimmed.replace(new RegExp(`[\\\\/]+${pattern}$`, "i"), "");

  return nextValue || trimmed;
}

export function getPlatformRootTemplate(
  platform: SkillPlatform,
  osKey: SkillPlatformOsKey,
): string {
  return platform.rootDir[osKey] || platform.rootDir.linux;
}

export function getPlatformSkillsTemplate(
  platform: SkillPlatform,
  osKey: SkillPlatformOsKey,
): string {
  return joinPlatformPath(
    getPlatformRootTemplate(platform, osKey),
    platform.skillsRelativePath,
  );
}

export function getPlatformGlobalRuleTemplate(
  platform: SkillPlatform,
  osKey: SkillPlatformOsKey,
): string | null {
  if (!platform.globalRuleFile) {
    return null;
  }

  return joinPlatformPath(
    getPlatformRootTemplate(platform, osKey),
    platform.globalRuleFile,
  );
}

export function normalizeLegacySkillPathToRootTemplate(
  platform: SkillPlatform,
  skillPath: string,
): string {
  return stripTrailingRelativePath(skillPath, platform.skillsRelativePath);
}

export function getPlatformMcpRelativePath(
  platformOrId: SkillPlatform | string | undefined,
): string | undefined {
  const platform =
    typeof platformOrId === "string"
      ? getPlatformById(platformOrId)
      : platformOrId;

  return platform?.mcpRelativePath;
}

export function getPlatformPluginsRelativePath(
  platformOrId: SkillPlatform | string | undefined,
): string | undefined {
  const platform =
    typeof platformOrId === "string"
      ? getPlatformById(platformOrId)
      : platformOrId;

  return platform?.pluginsRelativePath;
}

export const DEFAULT_SKILL_PLATFORM_ORDER = [
  "claude",
  "codex",
  "kimi",
  "reasonix",
  "augment",
  "zcode",
  "antigravity",
  "gemini",
  "opencode",
  "pi",
  "oh-my-pi",
  "cline",
  "cursor",
  "grok",
  "qwen",
  "cherry-studio",
  "windsurf",
  "kiro",
  "kilo",
  "trae",
  "trae-work",
  "trae-cn",
  "trae-work-cn",
  "openclaw",
  "qclaw",
  "qoder",
  "qoderwork",
  "workbuddy",
  "codebuddy",
  "hermes",
] as const;

/**
 * Agent product family for UI grouping.
 * - code-work: coding IDE / CLI workbenches (Claude Code, Codex, Cursor, …)
 * - claw: Claw-family agent runtimes (OpenClaw, QClaw, …) — aka 龙虾系
 */
export type AgentPlatformFamily = "code-work" | "claw";

export const CLAW_PLATFORM_IDS = ["openclaw", "qclaw"] as const;

const CLAW_PLATFORM_ID_SET = new Set<string>(CLAW_PLATFORM_IDS);

export function getAgentPlatformFamily(
  platformId: string,
): AgentPlatformFamily {
  if (!platformId) {
    return "code-work";
  }

  if (CLAW_PLATFORM_ID_SET.has(platformId) || /claw$/i.test(platformId)) {
    return "claw";
  }

  return "code-work";
}

export function isClawPlatformId(platformId: string): boolean {
  return getAgentPlatformFamily(platformId) === "claw";
}

/**
 * Supported skill platforms
 * 支持的技能平台列表
 */
export const SKILL_PLATFORMS: SkillPlatform[] = [
  {
    id: "claude",
    name: "Claude Code",
    icon: "Sparkles",
    rootDir: {
      darwin: "~/.claude",
      win32: "%USERPROFILE%\\.claude",
      linux: "~/.claude",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "../.claude.json",
    pluginsRelativePath: "plugins/cache/prompthub",
    globalRuleFile: "CLAUDE.md",
    configFiles: ["settings.json"],
    launchPaths: {
      darwin: ["/Applications/Claude.app", "~/Applications/Claude.app"],
    },
    cli: {
      executableCandidates: ["claude"],
      versionArgs: ["--version"],
      evidence: "official-claude-cli",
    },
  },
  {
    id: "copilot",
    name: "GitHub Copilot",
    icon: "Github",
    rootDir: {
      darwin: "~/.copilot",
      win32: "%USERPROFILE%\\.copilot",
      linux: "~/.copilot",
    },
    rootEnvironmentVariable: "COPILOT_HOME",
    skillsRelativePath: "skills",
    mcpRelativePath: "mcp-config.json",
    pluginsRelativePath: "installed-plugins",
    globalRuleFile: "copilot-instructions.md",
    agentsRelativePath: "agents",
    configFiles: ["settings.json"],
  },
  {
    id: "cursor",
    name: "Cursor",
    icon: "Terminal",
    rootDir: {
      darwin: "~/.cursor",
      win32: "%USERPROFILE%\\.cursor",
      linux: "~/.cursor",
    },
    skillsRelativePath: "skills",
    agentsRelativePath: "agents",
    mcpRelativePath: "mcp.json",
    pluginsRelativePath: "plugins",
    launchPaths: {
      darwin: ["/Applications/Cursor.app", "~/Applications/Cursor.app"],
    },
  },
  {
    id: "cherry-studio",
    name: "Cherry Studio",
    icon: "Bot",
    rootDir: {
      darwin: "~/Library/Application Support/CherryStudio",
      win32: "%APPDATA%\\CherryStudio",
      linux: "~/.config/CherryStudio",
    },
    skillsRelativePath: "Data/Skills",
    launchPaths: {
      darwin: [
        "/Applications/Cherry Studio.app",
        "~/Applications/Cherry Studio.app",
      ],
    },
  },
  {
    id: "windsurf",
    name: "Windsurf",
    icon: "Wind",
    rootDir: {
      darwin: "~/.codeium/windsurf",
      win32: "%USERPROFILE%\\.codeium\\windsurf",
      linux: "~/.codeium/windsurf",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "mcp_config.json",
    globalRuleFile: "memories/global_rules.md",
    launchPaths: {
      darwin: ["/Applications/Windsurf.app", "~/Applications/Windsurf.app"],
    },
  },
  {
    id: "kiro",
    name: "Kiro",
    icon: "Sparkle",
    rootEnvironmentVariable: "KIRO_HOME",
    rootDir: {
      darwin: "~/.kiro",
      win32: "%USERPROFILE%\\.kiro",
      linux: "~/.kiro",
    },
    skillsRelativePath: "skills",
    agentsRelativePath: "agents",
    mcpRelativePath: "settings/mcp.json",
    pluginsRelativePath: "powers",
    configFiles: ["settings/cli.json"],
    launchPaths: {
      darwin: ["/Applications/Kiro.app", "~/Applications/Kiro.app"],
    },
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: "Sparkles",
    lifecycle: "enterprise-legacy",
    replacementPlatformId: "antigravity",
    rootDir: {
      darwin: "~/.gemini",
      win32: "%USERPROFILE%\\.gemini",
      linux: "~/.gemini",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "settings.json",
    pluginsRelativePath: "config/plugins",
    globalRuleFile: "GEMINI.md",
    configFiles: ["settings.json"],
  },
  {
    id: "antigravity",
    name: "Antigravity",
    icon: "Sparkles",
    lifecycle: "current",
    rootDir: {
      darwin: "~/.gemini/config",
      win32: "%USERPROFILE%\\.gemini\\config",
      linux: "~/.gemini/config",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "mcp_config.json",
    pluginsRelativePath: "plugins",
    globalRuleFile: "../GEMINI.md",
    launchPaths: {
      darwin: [
        "/Applications/Antigravity.app",
        "~/Applications/Antigravity.app",
      ],
    },
  },
  {
    id: "trae",
    name: "TRAE IDE",
    icon: "Zap",
    rootDir: {
      darwin: "~/.trae",
      win32: "%USERPROFILE%\\.trae",
      linux: "~/.trae",
    },
    skillsRelativePath: "skills",
  },
  {
    id: "trae-cn",
    name: "TRAE IDE CN",
    icon: "Zap",
    rootDir: {
      darwin: "~/.trae-cn",
      win32: "%USERPROFILE%\\.trae-cn",
      linux: "~/.trae-cn",
    },
    skillsRelativePath: "skills",
  },
  {
    id: "trae-work",
    name: "TRAE Work",
    icon: "Zap",
    rootDir: {
      darwin: "~/.trae-work",
      win32: "%USERPROFILE%\\.trae-work",
      linux: "~/.trae-work",
    },
    skillsRelativePath: "skills",
  },
  {
    id: "trae-work-cn",
    name: "TRAE Work CN",
    icon: "Zap",
    rootDir: {
      darwin: "~/.trae-work-cn",
      win32: "%USERPROFILE%\\.trae-work-cn",
      linux: "~/.trae-work-cn",
    },
    skillsRelativePath: "skills",
  },
  {
    id: "opencode",
    name: "OpenCode",
    icon: "Terminal",
    rootDir: {
      darwin: "~/.config/opencode",
      win32: "%USERPROFILE%\\.config\\opencode",
      linux: "~/.config/opencode",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "opencode.json",
    globalRuleFile: "AGENTS.md",
    configFiles: ["opencode.jsonc", "opencode.json", "config.json"],
    cli: {
      executableCandidates: ["opencode"],
      versionArgs: ["--version"],
      evidence: "official-opencode-cli",
      update: {
        args: ["upgrade"],
        rollbackTargetPrefix: "v",
        evidence: "official-opencode-cli-upgrade",
      },
    },
  },
  {
    id: "pi",
    name: "Pi",
    icon: "CircleDot",
    rootDir: {
      darwin: "~/.pi/agent",
      win32: "%USERPROFILE%\\.pi\\agent",
      linux: "~/.pi/agent",
    },
    rootEnvironmentVariable: "PI_CODING_AGENT_DIR",
    skillsRelativePath: "skills",
    pluginsRelativePath: "extensions",
    globalRuleFile: "AGENTS.md",
    configFiles: ["settings.json", "models.json", "AGENTS.md"],
    cli: {
      executableCandidates: ["pi"],
      versionArgs: ["--version"],
      evidence: "official-pi-cli",
    },
  },
  {
    id: "oh-my-pi",
    name: "Oh My Pi",
    icon: "Terminal",
    rootDir: {
      darwin: "~/.omp/agent",
      win32: "%USERPROFILE%\\.omp\\agent",
      linux: "~/.omp/agent",
    },
    rootEnvironmentVariable: "PI_CODING_AGENT_DIR",
    skillsRelativePath: "skills",
    mcpRelativePath: "mcp.json",
    // Oh My Pi installs plugin packages in the sibling user-level plugin root.
    pluginsRelativePath: "../plugins",
    globalRuleFile: "RULES.md",
    configFiles: [
      "config.yml",
      "config.yaml",
      "settings.json",
      "mcp.json",
      ".mcp.json",
      "RULES.md",
    ],
    cli: {
      executableCandidates: ["omp"],
      versionArgs: ["--version"],
      evidence: "official-oh-my-pi-cli",
    },
  },
  {
    id: "cline",
    name: "Cline",
    icon: "Terminal",
    rootDir: {
      darwin: "~/.cline",
      win32: "%USERPROFILE%\\.cline",
      linux: "~/.cline",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "data/settings/cline_mcp_settings.json",
    configFiles: [
      "data/settings/global-settings.json",
      "data/settings/cline_mcp_settings.json",
    ],
  },
  {
    id: "codex",
    name: "Codex",
    icon: "Terminal",
    rootDir: {
      darwin: "~/.codex",
      win32: "%USERPROFILE%\\.codex",
      linux: "~/.codex",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "config.toml",
    pluginsRelativePath: "plugins/cache/prompthub",
    globalRuleFile: "AGENTS.md",
    configFiles: ["config.toml"],
    launchPaths: {
      darwin: ["/Applications/Codex.app", "~/Applications/Codex.app"],
    },
    cli: {
      executableCandidates: ["codex"],
      versionArgs: ["--version"],
      evidence: "official-codex-cli",
      update: {
        args: ["install", "-g", "@openai/codex@latest"],
        command: {
          executableCandidates: ["npm"],
          supportedInstallSources: ["npm", "node-version-manager"],
        },
        rollbackArgsPrefix: ["install", "-g"],
        rollbackTargetPrefix: "@openai/codex@",
        evidence: "official-codex-npm-install",
      },
    },
  },
  {
    id: "kimi",
    name: "Kimi Code",
    icon: "Sparkles",
    rootDir: {
      darwin: "~/.kimi-code",
      win32: "%USERPROFILE%\\.kimi-code",
      linux: "~/.kimi-code",
    },
    rootEnvironmentVariable: "KIMI_CODE_HOME",
    legacyRootEnvironmentVariable: "KIMI_SHARE_DIR",
    rootDirFallbacks: {
      darwin: ["~/.kimi"],
      win32: ["%USERPROFILE%\\.kimi"],
      linux: ["~/.kimi"],
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "mcp.json",
    pluginsRelativePath: "plugins",
    globalRuleFile: "AGENTS.md",
    configFiles: ["config.toml", "tui.toml", "mcp.json"],
    cli: {
      executableCandidates: ["kimi"],
      versionArgs: ["--version"],
      evidence: "official-kimi-code-cli",
    },
  },
  {
    id: "reasonix",
    name: "Reasonix",
    icon: "Code",
    rootDir: {
      darwin: "~/.reasonix",
      win32: "%APPDATA%\\reasonix",
      linux: "~/.reasonix",
    },
    skillsRelativePath: "skills",
    // Reasonix stores MCP/plugin declarations in TOML, but its schema is not
    // compatible with the Codex TOML writer. Keep this path discovery-only.
    mcpRelativePath: "config.toml",
    configFiles: ["config.toml", "settings.json", "trust.json"],
  },
  {
    id: "augment",
    name: "Augment",
    icon: "Sparkle",
    rootDir: {
      darwin: "~/.augment",
      win32: "%USERPROFILE%\\.augment",
      linux: "~/.augment",
    },
    skillsRelativePath: "skills",
    // Auggie persists MCP servers in settings.json; no generic MCP writer is
    // exposed until the settings schema has a dedicated target adapter.
    mcpRelativePath: "settings.json",
    configFiles: ["settings.json"],
  },
  {
    id: "zcode",
    name: "智谱 ZCode",
    icon: "Bot",
    rootDir: {
      darwin: "~/.zcode",
      win32: "%USERPROFILE%\\.zcode",
      linux: "~/.zcode",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "cli/config.json",
    globalRuleFile: "AGENTS.md",
    configFiles: ["cli/config.json"],
  },
  {
    id: "grok",
    name: "Grok Build",
    icon: "Terminal",
    rootDir: {
      darwin: "~/.grok",
      win32: "%USERPROFILE%\\.grok",
      linux: "~/.grok",
    },
    rootEnvironmentVariable: "GROK_HOME",
    skillsRelativePath: "skills",
    mcpRelativePath: "config.toml",
    pluginsRelativePath: "plugins",
    globalRuleFile: "AGENTS.md",
    configFiles: [
      "config.toml",
      "pager.toml",
      "settings.json",
      "lsp.json",
      "sandbox.toml",
    ],
  },
  {
    id: "qwen",
    name: "Qwen Code",
    icon: "Bot",
    rootDir: {
      darwin: "~/.qwen",
      win32: "%USERPROFILE%\\.qwen",
      linux: "~/.qwen",
    },
    rootEnvironmentVariable: "QWEN_HOME",
    environmentRootRelativeToCwd: true,
    skillsRelativePath: "skills",
    mcpRelativePath: "settings.json",
    pluginsRelativePath: "extensions",
    globalRuleFile: "QWEN.md",
    cli: {
      executableCandidates: ["qwen"],
      versionArgs: ["--version"],
      evidence: "official-qwen-code-cli",
      update: {
        args: ["install", "-g", "@qwen-code/qwen-code@latest"],
        command: {
          executableCandidates: ["npm"],
          supportedInstallSources: ["npm", "node-version-manager"],
        },
        rollbackArgsPrefix: ["install", "-g"],
        rollbackTargetPrefix: "@qwen-code/qwen-code@",
        evidence: "official-qwen-code-npm-install",
      },
    },
  },
  {
    id: "kilo",
    name: "Kilo Code",
    icon: "Bot",
    rootDir: {
      darwin: "~/.kilo",
      win32: "%USERPROFILE%\\.kilo",
      linux: "~/.kilo",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "../.config/kilo/kilo.json",
    globalRuleFile: "rules/global.md",
  },
  {
    id: "amp",
    name: "Amp",
    icon: "Zap",
    rootDir: {
      darwin: "~/.config/amp",
      win32: "%USERPROFILE%\\.config\\amp",
      linux: "~/.config/amp",
    },
    rootDirFallbacks: {
      win32: ["%APPDATA%\\amp"],
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "settings.json",
    globalRuleFile: "AGENTS.md",
  },
  {
    id: "openclaw",
    name: "OpenClaw",
    icon: "Bot",
    rootDir: {
      darwin: "~/.openclaw",
      win32: "%USERPROFILE%\\.openclaw",
      linux: "~/.openclaw",
    },
    skillsRelativePath: "skills",
    globalRuleFile: "workspace/SOUL.md",
    configFiles: ["openclaw.json"],
    cli: {
      executableCandidates: ["openclaw"],
      versionArgs: ["--version"],
      evidence: "official-openclaw-cli",
    },
  },
  {
    id: "qclaw",
    name: "QClaw",
    icon: "Bot",
    rootDir: {
      darwin: "~/.qclaw",
      win32: "%USERPROFILE%\\.qclaw",
      linux: "~/.qclaw",
    },
    skillsRelativePath: "skills",
    globalRuleFile: "workspace/SOUL.md",
  },
  {
    id: "qoder",
    name: "Qoder",
    icon: "Bot",
    rootDir: {
      darwin: "~/.qoder",
      win32: "%USERPROFILE%\\.qoder",
      linux: "~/.qoder",
    },
    skillsRelativePath: "skills",
  },
  {
    id: "qoderwork",
    name: "QoderWorker",
    icon: "Code",
    rootDir: {
      darwin: "~/.qoderwork",
      win32: "%USERPROFILE%\\.qoderwork",
      linux: "~/.qoderwork",
    },
    skillsRelativePath: "skills",
  },
  {
    id: "hermes",
    name: "Hermes Agent",
    icon: "Bot",
    rootDir: {
      darwin: "~/.hermes",
      win32: "%LOCALAPPDATA%\\hermes",
      linux: "~/.hermes",
    },
    skillsRelativePath: "skills",
    globalRuleFile: "AGENTS.md",
  },
  {
    id: "codebuddy",
    name: "CodeBuddy",
    icon: "Code",
    rootDir: {
      darwin: "~/.codebuddy",
      win32: "%USERPROFILE%\\.codebuddy",
      linux: "~/.codebuddy",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: ".mcp.json",
    globalRuleFile: "CODEBUDDY.md",
    configFiles: ["settings.json", ".mcp.json", "CODEBUDDY.md"],
  },
  {
    id: "workbuddy",
    name: "Tencent WorkBuddy",
    icon: "Bot",
    rootDir: {
      darwin: "~/.workbuddy",
      win32: "%USERPROFILE%\\.workbuddy",
      linux: "~/.workbuddy",
    },
    skillsRelativePath: "skills",
    mcpRelativePath: "mcp.json",
    configFiles: ["mcp.json"],
  },
];

/**
 * Get platform by ID
 * 根据 ID 获取平台配置
 */
export function getPlatformById(id: string): SkillPlatform | undefined {
  return SKILL_PLATFORMS.find((p) => p.id === id);
}
