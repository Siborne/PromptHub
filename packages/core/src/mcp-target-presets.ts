import os from "os";
import path from "path";

import type {
  McpTargetKind,
  McpTargetScope,
} from "@prompthub/shared/types/mcp";

export interface McpTargetPreset {
  id: string;
  target: McpTargetKind;
  scope: McpTargetScope;
  label: string;
  path: string;
  /**
   * Skill platform id used for brand icon rendering in the renderer.
   * 用于渲染端品牌图标的平台 id（对应 Skills 平台体系）。
   */
  platformId?: string;
}

/**
 * Global MCP config targets for every supported agent platform.
 * Workspace/project-level files are handled through the custom-path target
 * because a packaged desktop app has no meaningful working directory.
 * 各支持平台的全局 MCP 配置目标。项目级文件通过自定义路径目标处理，
 * 因为打包后的桌面应用没有有意义的工作目录。
 */
export function getMcpTargetPresets(
  homeDir = os.homedir(),
  platform: NodeJS.Platform = process.platform,
  environment: NodeJS.ProcessEnv = process.env,
): McpTargetPreset[] {
  const qwenHome = resolveQwenHome(homeDir, environment.QWEN_HOME);
  const claudeDesktopPath =
    platform === "darwin"
      ? path.join(
          homeDir,
          "Library",
          "Application Support",
          "Claude",
          "claude_desktop_config.json",
        )
      : platform === "win32"
        ? path.join(
            homeDir,
            "AppData",
            "Roaming",
            "Claude",
            "claude_desktop_config.json",
          )
        : path.join(homeDir, ".config", "Claude", "claude_desktop_config.json");
  const vscodeUserPath =
    platform === "darwin"
      ? path.join(
          homeDir,
          "Library",
          "Application Support",
          "Code",
          "User",
          "mcp.json",
        )
      : platform === "win32"
        ? path.join(homeDir, "AppData", "Roaming", "Code", "User", "mcp.json")
        : path.join(homeDir, ".config", "Code", "User", "mcp.json");

  return [
    {
      id: "claude",
      target: "claude",
      scope: "global",
      label: "Claude Code",
      path: path.join(homeDir, ".claude.json"),
      platformId: "claude",
    },
    {
      id: "codex",
      target: "codex",
      scope: "global",
      label: "Codex",
      path: path.join(homeDir, ".codex", "config.toml"),
      platformId: "codex",
    },
    {
      id: "kimi",
      target: "kimi",
      scope: "global",
      label: "Kimi Code",
      path: path.join(homeDir, ".kimi", "mcp.json"),
      platformId: "kimi",
    },
    {
      id: "augment",
      target: "augment",
      scope: "global",
      label: "Augment",
      path: path.join(homeDir, ".augment", "settings.json"),
      platformId: "augment",
    },
    {
      id: "qwen",
      target: "qwen",
      scope: "global",
      label: "Qwen Code",
      path: path.join(qwenHome, "settings.json"),
      platformId: "qwen",
    },
    {
      id: "gemini",
      target: "gemini",
      scope: "global",
      label: "Gemini CLI",
      path: path.join(homeDir, ".gemini", "settings.json"),
      platformId: "gemini",
    },
    {
      id: "opencode",
      target: "opencode",
      scope: "global",
      label: "OpenCode",
      path: path.join(homeDir, ".config", "opencode", "opencode.json"),
      platformId: "opencode",
    },
    {
      id: "zcode",
      target: "zcode",
      scope: "global",
      label: "智谱 ZCode",
      path: path.join(homeDir, ".zcode", "cli", "config.json"),
      platformId: "zcode",
    },
    {
      id: "kilo",
      target: "kilo",
      scope: "global",
      label: "Kilo Code",
      path: path.join(homeDir, ".config", "kilo", "kilo.json"),
      platformId: "kilo",
    },
    {
      id: "cursor",
      target: "cursor",
      scope: "global",
      label: "Cursor",
      path: path.join(homeDir, ".cursor", "mcp.json"),
      platformId: "cursor",
    },
    {
      id: "claude-desktop",
      target: "claude-desktop",
      scope: "global",
      label: "Claude Desktop",
      path: claudeDesktopPath,
      platformId: "claude",
    },
    {
      id: "vscode",
      target: "vscode",
      scope: "global",
      label: "VS Code",
      path: vscodeUserPath,
      platformId: "copilot",
    },
    {
      id: "windsurf",
      target: "windsurf",
      scope: "global",
      label: "Windsurf",
      path: path.join(homeDir, ".codeium", "windsurf", "mcp_config.json"),
      platformId: "windsurf",
    },
    {
      id: "kiro",
      target: "kiro",
      scope: "global",
      label: "Kiro",
      path: path.join(homeDir, ".kiro", "settings", "mcp.json"),
      platformId: "kiro",
    },
    {
      id: "cline",
      target: "cline",
      scope: "global",
      label: "Cline",
      path: path.join(
        homeDir,
        ".cline",
        "data",
        "settings",
        "cline_mcp_settings.json",
      ),
      platformId: "cline",
    },
    {
      id: "workbuddy",
      target: "workbuddy",
      scope: "global",
      label: "Tencent WorkBuddy",
      path: path.join(homeDir, ".workbuddy", "mcp.json"),
      platformId: "workbuddy",
    },
    {
      id: "codebuddy",
      target: "codebuddy",
      scope: "global",
      label: "CodeBuddy",
      path: path.join(homeDir, ".codebuddy", ".mcp.json"),
      platformId: "codebuddy",
    },
  ];
}

function resolveQwenHome(
  homeDir: string,
  configured: string | undefined,
): string {
  const value = configured?.trim();
  if (!value || value.includes("\0")) return path.join(homeDir, ".qwen");
  const expanded = value.replace(/^~(?=$|[\\/])/, homeDir);
  return path.isAbsolute(expanded)
    ? path.normalize(expanded)
    : path.resolve(expanded);
}
