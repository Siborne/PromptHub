import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

function readRendererSource(relativePath: string): string {
  return readFileSync(
    path.join(process.cwd(), "src", "renderer", relativePath),
    "utf8",
  );
}

describe("renderer lazy workspace boundaries", () => {
  it("keeps the application shell out of the App orchestration chunk", () => {
    const source = readRendererSource("App.tsx");

    expect(source).toContain('import("./components/app/AppWorkspaceShell")');
    expect(source).not.toMatch(/from "\.\/components\/layout"/);
    expect(source).not.toMatch(/import\s+\{[^}]*\}\s+from "@dnd-kit\/core"/);
    expect(source).not.toMatch(/from "\.\/components\/ui\/BackgroundImageBackdrop"/);
    expect(source).not.toMatch(/from "\.\/components\/app\/DesktopAppCommandBridge"/);
  });

  it("loads each Agent workspace panel only when its tab is opened", () => {
    const source = readRendererSource(
      "components/agent/AgentsWorkspace.tsx",
    );
    const panelModules = [
      "AgentAppearancePanel",
      "AgentAssetsWorkspace",
      "AgentConfigFilesPanel",
      "AgentDefinitionsPanel",
      "AgentOverviewPanel",
      "AgentProviderModelWorkbench",
      "AgentSessionsPanel",
      "AgentSettingsDialog",
      "WebAgentServicesWorkspace",
    ];

    for (const moduleName of panelModules) {
      expect(source).toContain(`import("./${moduleName}")`);
      expect(source).not.toMatch(
        new RegExp(`import\\s+\\{[^}]*${moduleName}[^}]*\\}\\s+from\\s+"\\./${moduleName}"`),
      );
    }
  });
});
