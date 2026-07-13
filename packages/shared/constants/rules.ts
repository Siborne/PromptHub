import { getPlatformById } from "./platforms";

function requirePlatform(platformId: string) {
  const platform = getPlatformById(platformId);
  if (!platform) {
    throw new Error(`Missing rule platform metadata for: ${platformId}`);
  }
  return platform;
}

const claudePlatform = requirePlatform("claude");
const codexPlatform = requirePlatform("codex");
const zcodePlatform = requirePlatform("zcode");
const grokPlatform = requirePlatform("grok");
const geminiPlatform = requirePlatform("gemini");
const opencodePlatform = requirePlatform("opencode");
const windsurfPlatform = requirePlatform("windsurf");
const openclawPlatform = requirePlatform("openclaw");
const hermesPlatform = requirePlatform("hermes");
const ampPlatform = requirePlatform("amp");
const kiloPlatform = requirePlatform("kilo");

export const RULE_FILE_GROUPS = ["workspace", "assistant", "tooling"] as const;

export const RULE_PLATFORM_ORDER = [
  "claude",
  "codex",
  "zcode",
  "grok",
  "gemini",
  "opencode",
  "windsurf",
  "openclaw",
  "hermes",
  "amp",
  "kilo",
] as const;

export const KNOWN_RULE_FILE_TEMPLATES = {
  "claude-global": {
    id: "claude-global",
    platformId: "claude",
    platformName: claudePlatform.name,
    platformIcon: claudePlatform.icon,
    platformDescription:
      "Global Claude Code rules stored next to the managed Claude skills directory.",
    name: "CLAUDE.md",
    description: "Global Claude rules loaded from the local Claude configuration.",
    group: "assistant",
  },
  "codex-global": {
    id: "codex-global",
    platformId: "codex",
    platformName: codexPlatform.name,
    platformIcon: codexPlatform.icon,
    platformDescription:
      "Global Codex instructions stored next to the managed Codex settings directory.",
    name: "AGENTS.md",
    description: "Global Codex instructions loaded from the local Codex configuration.",
    group: "assistant",
  },
  "zcode-global": {
    id: "zcode-global",
    platformId: "zcode",
    platformName: zcodePlatform.name,
    platformIcon: zcodePlatform.icon,
    platformDescription:
      "Global ZCode Agent instructions stored next to the managed ZCode skills directory.",
    name: "AGENTS.md",
    description: "Global ZCode Agent instructions loaded from the local ZCode configuration.",
    group: "assistant",
  },
  "grok-global": {
    id: "grok-global",
    platformId: "grok",
    platformName: grokPlatform.name,
    platformIcon: grokPlatform.icon,
    platformDescription:
      "Global Grok Build instructions stored in the local Grok configuration directory.",
    name: "AGENTS.md",
    description: "Global Grok Build instructions loaded for every project.",
    group: "assistant",
  },
  "gemini-global": {
    id: "gemini-global",
    platformId: "gemini",
    platformName: geminiPlatform.name,
    platformIcon: geminiPlatform.icon,
    platformDescription:
      "Global Gemini CLI context stored next to the managed Gemini settings directory.",
    name: "GEMINI.md",
    description: "Global Gemini CLI context loaded from the local Gemini configuration.",
    group: "assistant",
  },
  "opencode-global": {
    id: "opencode-global",
    platformId: "opencode",
    platformName: opencodePlatform.name,
    platformIcon: opencodePlatform.icon,
    platformDescription:
      "Global OpenCode rules stored next to the managed OpenCode skills directory.",
    name: "AGENTS.md",
    description: "Global OpenCode rules loaded from the local OpenCode configuration.",
    group: "tooling",
  },
  "windsurf-global": {
    id: "windsurf-global",
    platformId: "windsurf",
    platformName: windsurfPlatform.name,
    platformIcon: windsurfPlatform.icon,
    platformDescription:
      "Global Windsurf rules stored in the local Cascade memories directory.",
    name: "global_rules.md",
    description:
      "Global Windsurf rules loaded from the local Windsurf configuration.",
    group: "tooling",
  },
  "openclaw-global": {
    id: "openclaw-global",
    platformId: "openclaw",
    platformName: openclawPlatform.name,
    platformIcon: openclawPlatform.icon,
    platformDescription:
      "OpenClaw workspace persona and tone file injected into every session.",
    name: "SOUL.md",
    description:
      "Global OpenClaw persona rules loaded from the local workspace bootstrap directory.",
    group: "assistant",
  },
  "hermes-global": {
    id: "hermes-global",
    platformId: "hermes",
    platformName: hermesPlatform.name,
    platformIcon: hermesPlatform.icon,
    platformDescription:
      "Global Hermes Agent instructions stored in the local Hermes configuration directory.",
    name: "AGENTS.md",
    description:
      "Global Hermes Agent rules loaded from the local Hermes configuration.",
    group: "assistant",
  },
  "amp-global": {
    id: "amp-global",
    platformId: "amp",
    platformName: ampPlatform.name,
    platformIcon: ampPlatform.icon,
    platformDescription:
      "Global Amp instructions stored in the local Amp configuration directory (~/.config/amp/).",
    name: "AGENTS.md",
    description:
      "Global Amp rules loaded from the local Amp configuration. Amp also checks $HOME/.config/AGENTS.md as a fallback.",
    group: "tooling",
  },
  "kilo-global": {
    id: "kilo-global",
    platformId: "kilo",
    platformName: kiloPlatform.name,
    platformIcon: kiloPlatform.icon,
    platformDescription:
      "Global Kilo Code rules stored in the local Kilo Code rules directory.",
    name: "global.md",
    description:
      "Global Kilo Code rules loaded from the local Kilo Code configuration. Kilo Code reads all .md files in ~/.kilo/rules/.",
    group: "tooling",
  },
} as const;
