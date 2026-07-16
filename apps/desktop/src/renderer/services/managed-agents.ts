import type {
  SkillPlatform,
  SkillPlatformOsKey,
} from "@prompthub/shared/constants/platforms";
import type {
  BuiltinAgentOverrideConfig,
  ManagedAgentCapability,
  ManagedAgentFilter,
  ManagedAgentSummary,
} from "@prompthub/shared/types";

const COMMON_AGENT_ORDER = [
  "claude",
  "codex",
  "gemini",
  "opencode",
  "cursor",
  "copilot",
  "windsurf",
  "cline",
  "openclaw",
] as const;

interface BuildManagedAgentsInput {
  platforms: SkillPlatform[];
  detectedPlatformIds: string[];
  pinnedPlatformIds: string[];
  builtinOverrides: Record<string, BuiltinAgentOverrideConfig>;
  osKey: SkillPlatformOsKey;
}

function joinPath(basePath: string, relativePath?: string): string | undefined {
  if (!relativePath?.trim()) return undefined;
  const separator = basePath.includes("\\") ? "\\" : "/";
  const base = basePath.replace(/[\\/]+$/, "");
  const combined = `${base}${separator}${relativePath.trim()}`;
  const segments = combined.split(/[\\/]+/).filter(Boolean);
  const normalized: string[] = [];
  const protectedDepth =
    base.startsWith("~") || base.startsWith("%") || /^[A-Za-z]:[\\/]/.test(base)
      ? 1
      : 0;

  for (const segment of segments) {
    if (segment === ".") continue;
    if (segment === ".." && normalized.length > protectedDepth) {
      normalized.pop();
      continue;
    }
    if (segment !== "..") normalized.push(segment);
  }

  const prefix = base.startsWith(separator) ? separator : "";
  return `${prefix}${normalized.join(separator)}`;
}

function capability(
  status: ManagedAgentCapability["status"],
  reason?: string,
): ManagedAgentCapability {
  return reason ? { status, reason } : { status };
}

const MODEL_CONFIG_AGENT_IDS = new Set([
  "claude",
  "codex",
  "gemini",
  "opencode",
  "openclaw",
]);

const SESSION_AGENT_IDS = new Set(["claude", "gemini", "opencode"]);

function buildCapabilities(
  platformId: string,
  configFileCount: number,
): ManagedAgentSummary["capabilities"] {
  return {
    overview: capability("supported"),
    provider: MODEL_CONFIG_AGENT_IDS.has(platformId)
      ? capability("partial", "model-config-only")
      : capability("planned", "adapter-pending"),
    assets: capability("partial", "asset-paths-only"),
    configFiles:
      configFileCount > 0
        ? capability("partial", "direct-file-editing")
        : capability("unsupported", "no-verified-config-path"),
    sessions: SESSION_AGENT_IDS.has(platformId)
      ? capability("supported")
      : capability("planned", "adapter-pending"),
    usage: capability("planned", "adapter-pending"),
    maintenance: capability("partial", "refresh-and-settings"),
  };
}

function rankAgent(agent: ManagedAgentSummary): [number, number, number] {
  const curatedIndex = COMMON_AGENT_ORDER.indexOf(
    agent.id as (typeof COMMON_AGENT_ORDER)[number],
  );
  return [
    agent.isPinned ? 0 : 1,
    agent.isDetected || agent.isConfigured ? 0 : 1,
    curatedIndex === -1 ? COMMON_AGENT_ORDER.length : curatedIndex,
  ];
}

export function sortManagedAgents(
  agents: ManagedAgentSummary[],
): ManagedAgentSummary[] {
  return [...agents].sort((left, right) => {
    const leftRank = rankAgent(left);
    const rightRank = rankAgent(right);
    for (let index = 0; index < leftRank.length; index += 1) {
      const delta = leftRank[index] - rightRank[index];
      if (delta !== 0) return delta;
    }
    return left.name.localeCompare(right.name);
  });
}

export function buildManagedAgents({
  platforms,
  detectedPlatformIds,
  pinnedPlatformIds,
  builtinOverrides,
  osKey,
}: BuildManagedAgentsInput): ManagedAgentSummary[] {
  const detected = new Set(detectedPlatformIds);
  const pinned = new Set(pinnedPlatformIds);

  return sortManagedAgents(
    platforms.map((platform) => {
      const override = builtinOverrides[platform.id] ?? {};
      const root = override.rootPath?.trim() || platform.rootDir[osKey];
      const isDetected = detected.has(platform.id);
      const isConfigured = Boolean(platform.isConfigured || platform.isCustom);
      const skillsRelativePath =
        override.skillsRelativePath || platform.skillsRelativePath;
      const configRelativePaths =
        override.configRelativePaths || platform.configFiles || [];

      return {
        id: platform.id,
        name: platform.name,
        icon: platform.icon,
        isCustom: Boolean(platform.isCustom),
        isConfigured,
        isDetected,
        isPinned: pinned.has(platform.id),
        status: isDetected
          ? "installed"
          : isConfigured
            ? "configured"
            : "not-detected",
        paths: {
          root,
          skills: joinPath(root, skillsRelativePath) || root,
          mcp: joinPath(
            root,
            override.mcpRelativePath || platform.mcpRelativePath,
          ),
          plugins: joinPath(
            root,
            override.pluginsRelativePath || platform.pluginsRelativePath,
          ),
          rules: joinPath(
            root,
            override.rulesRelativePath || platform.globalRuleFile,
          ),
          configFiles: configRelativePaths
            .map((relativePath) => joinPath(root, relativePath))
            .filter((path): path is string => Boolean(path)),
          configFileRelativePaths: configRelativePaths,
        },
        capabilities: buildCapabilities(
          platform.id,
          configRelativePaths.length,
        ),
      };
    }),
  );
}

function matchesFilter(
  agent: ManagedAgentSummary,
  filter: ManagedAgentFilter,
): boolean {
  if (filter === "installed") return agent.isDetected;
  if (filter === "configured") return agent.isConfigured;
  if (filter === "custom") return agent.isCustom;
  if (filter === "not-detected") return !agent.isDetected;
  if (filter === "needs-attention") {
    return agent.isConfigured && !agent.isDetected;
  }
  return true;
}

export function filterManagedAgents(
  agents: ManagedAgentSummary[],
  searchQuery: string,
  filter: ManagedAgentFilter,
): ManagedAgentSummary[] {
  const query = searchQuery.trim().toLocaleLowerCase();
  return agents.filter((agent) => {
    if (!matchesFilter(agent, filter)) return false;
    if (!query) return true;
    return [
      agent.name,
      agent.id,
      agent.paths.root,
      agent.paths.skills,
      agent.paths.mcp,
      agent.paths.plugins,
      agent.paths.rules,
      ...agent.paths.configFiles,
      ...agent.paths.configFileRelativePaths,
    ]
      .filter(Boolean)
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });
}
