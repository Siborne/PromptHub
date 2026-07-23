import path from "node:path";

import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import type { AgentLaunchResult } from "@prompthub/shared/types";

interface AgentLaunchDependencies {
  platform: NodeJS.Platform;
  homePath: string;
  localAppDataPath?: string;
  pathExists(candidate: string): Promise<boolean>;
  openPath(candidate: string): Promise<string>;
}

function toPlatformKey(
  platform: NodeJS.Platform,
): "darwin" | "win32" | "linux" | null {
  if (platform === "darwin" || platform === "win32" || platform === "linux") {
    return platform;
  }
  return null;
}

function expandLaunchPath(
  template: string,
  dependencies: AgentLaunchDependencies,
): string | null {
  let expanded = template.trim();
  if (!expanded || expanded.includes("\0")) return null;
  if (expanded === "~" || expanded.startsWith("~/")) {
    expanded = path.join(dependencies.homePath, expanded.slice(2));
  }
  if (/^%LOCALAPPDATA%/i.test(expanded)) {
    if (!dependencies.localAppDataPath) return null;
    expanded = expanded.replace(
      /^%LOCALAPPDATA%/i,
      dependencies.localAppDataPath,
    );
  }
  return path.normalize(expanded);
}

export async function launchAgentPlatform(
  platform: SkillPlatform,
  dependencies: AgentLaunchDependencies,
): Promise<AgentLaunchResult> {
  const platformKey = toPlatformKey(dependencies.platform);
  const templates = platformKey ? platform.launchPaths?.[platformKey] : null;
  if (!templates?.length) {
    return { success: false, errorCode: "unsupported" };
  }

  for (const template of templates) {
    const candidate = expandLaunchPath(template, dependencies);
    if (!candidate || !(await dependencies.pathExists(candidate))) continue;
    try {
      const errorMessage = await dependencies.openPath(candidate);
      return errorMessage
        ? { success: false, errorCode: "launch-failed" }
        : { success: true };
    } catch {
      return { success: false, errorCode: "launch-failed" };
    }
  }

  return { success: false, errorCode: "not-installed" };
}
