import type { DesktopHomeModule } from "../stores/settings.store";

const WEB_DESKTOP_HOME_MODULES: readonly DesktopHomeModule[] = [
  "prompt",
  "skill",
  "rules",
];

function isLegacyDefault(modules: readonly DesktopHomeModule[]): boolean {
  return (
    modules.includes("prompt") &&
    modules.includes("skill") &&
    modules.includes("rules") &&
    (!modules.includes("mcp") || !modules.includes("plugin"))
  );
}

function addLegacyModules(
  modules: readonly DesktopHomeModule[],
): DesktopHomeModule[] {
  const next = [...modules];
  if (!next.includes("mcp")) {
    const skillIndex = next.indexOf("skill");
    next.splice(skillIndex === -1 ? next.length : skillIndex + 1, 0, "mcp");
  }
  if (!next.includes("plugin")) {
    const mcpIndex = next.indexOf("mcp");
    next.splice(mcpIndex === -1 ? next.length : mcpIndex + 1, 0, "plugin");
  }
  return next;
}

export function resolveVisibleDesktopHomeModules(
  modules: readonly DesktopHomeModule[],
  webRuntime: boolean,
): DesktopHomeModule[] {
  if (webRuntime) {
    return modules.filter((moduleId) =>
      WEB_DESKTOP_HOME_MODULES.includes(moduleId),
    );
  }

  return isLegacyDefault(modules) ? addLegacyModules(modules) : [...modules];
}
