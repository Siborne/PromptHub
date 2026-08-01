import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentScannedSkill,
  PluginLibraryEntry,
  PluginTargetCompatibility,
  PluginTargetInstalledPlugin,
} from "@prompthub/shared/types";
import { AgentPluginDetailPage } from "../../../src/renderer/components/plugin/AgentPluginDetailPage";
import { AgentSkillDetailPage } from "../../../src/renderer/components/skill/AgentSkillDetailPage";
import {
  createScannedSkillFixture,
  createSkillFixture,
} from "../../fixtures/skills";
import { installWindowMocks } from "../../helpers/window";

const { pluginDetailSpy, skillDetailSpy } = vi.hoisted(() => ({
  pluginDetailSpy: vi.fn(),
  skillDetailSpy: vi.fn(),
}));

vi.mock("../../../src/renderer/components/skill/SkillFullDetailPage", () => ({
  SkillFullDetailPage: (props: unknown) => {
    skillDetailSpy(props);
    return <div data-testid="skill-detail" />;
  },
}));

vi.mock("../../../src/renderer/components/plugin/PluginFullDetailPage", () => ({
  PluginFullDetailPage: (props: unknown) => {
    pluginDetailSpy(props);
    return <div data-testid="plugin-detail" />;
  },
}));

function createAgentSkill(
  overrides: Partial<AgentScannedSkill> = {},
): AgentScannedSkill {
  const localPath = overrides.localPath ?? "/tmp/agent-skill";
  return {
    ...createScannedSkillFixture({
      filePath: `${localPath}/SKILL.md`,
      localPath,
    }),
    installMode: "copy",
    platformSkillPath: localPath,
    ...overrides,
  };
}

const target: PluginTargetCompatibility = {
  id: "codex",
  displayName: "Codex",
  enabled: true,
  status: "native",
};

const targetPlugin: PluginTargetInstalledPlugin = {
  id: "agent-formatter",
  name: "formatter",
  displayName: "Formatter",
  sourcePath: "/tmp/codex/plugins/formatter",
  inventory: {
    agents: 0,
    apps: 0,
    assets: 0,
    commands: 0,
    docs: 1,
    hooks: 0,
    lspServers: 0,
    mcpServers: 0,
    scripts: 0,
    skills: 1,
  },
};

describe("shared Agent asset detail adapters", () => {
  beforeEach(() => {
    installWindowMocks();
    pluginDetailSpy.mockClear();
    skillDetailSpy.mockClear();
  });

  it("maps read-only external Skills without exposing managed or uninstall actions", async () => {
    const scannedSkill = createAgentSkill({ isReadOnlyDiscovery: true });
    const onImport = vi.fn();
    const onUninstall = vi.fn();

    render(
      <AgentSkillDetailPage
        detailSkill={createSkillFixture()}
        isImporting={false}
        isUninstalling={false}
        managedSkill={null}
        platformId="codex"
        platformName="Codex"
        scannedSkill={scannedSkill}
        onBack={vi.fn()}
        onImport={onImport}
        onOpenManagedSkill={vi.fn()}
        onUninstall={onUninstall}
      />,
    );

    const props = skillDetailSpy.mock.lastCall?.[0];
    expect(props.agentContext).toMatchObject({
      installMode: "copy",
      isManaged: false,
      platformId: "codex",
      platformName: "Codex",
      sourcePath: scannedSkill.localPath,
    });
    expect(props.agentActions.onImport).toBe(onImport);
    expect(props.agentActions.onOpenManagedSkill).toBeUndefined();
    expect(props.agentActions.onUninstall).toBeUndefined();

    await props.agentActions.onOpenFolder();
    expect(window.electron.openPath).toHaveBeenCalledWith(
      scannedSkill.localPath,
    );
  });

  it("maps managed Skills and target-installed Plugins through shared full detail pages", () => {
    const managedSkill = createSkillFixture({ id: "managed-skill" });
    const onOpenManagedSkill = vi.fn();
    const onOpenStore = vi.fn();
    const managedPlugin = {
      id: "managed-plugin",
      name: "formatter",
      displayName: "Formatter",
    } as PluginLibraryEntry;

    render(
      <AgentSkillDetailPage
        detailSkill={managedSkill}
        managedSkill={managedSkill}
        platformId="codex"
        platformName="Codex"
        scannedSkill={createAgentSkill()}
        onBack={vi.fn()}
        onImport={vi.fn()}
        onOpenManagedSkill={onOpenManagedSkill}
        onUninstall={vi.fn()}
      />,
    );
    const skillProps = skillDetailSpy.mock.lastCall?.[0];
    expect(skillProps.agentActions.onImport).toBeUndefined();
    expect(skillProps.agentActions.onOpenManagedSkill).toBe(onOpenManagedSkill);
    expect(skillProps.agentActions.onUninstall).toEqual(expect.any(Function));

    render(
      <AgentPluginDetailPage
        isImporting={false}
        managedPlugin={managedPlugin}
        plugin={targetPlugin}
        target={target}
        onBack={vi.fn()}
        onImport={vi.fn()}
        onOpenFolder={vi.fn()}
        onOpenManagedPlugin={vi.fn()}
        onOpenStore={onOpenStore}
      />,
    );
    const pluginProps = pluginDetailSpy.mock.lastCall?.[0];
    expect(pluginProps.agentContext).toEqual({
      isManaged: true,
      platformId: "codex",
      platformName: "Codex",
      sourcePath: targetPlugin.sourcePath,
    });
    expect(pluginProps.agentActions.onImport).toBeUndefined();
    expect(pluginProps.onOpenStore).toBe(onOpenStore);
    expect(pluginProps.targetMatrix).toEqual([]);
  });

  it("keeps external Plugin import and navigation actions available", () => {
    const onImport = vi.fn();
    const onOpenFolder = vi.fn();
    const onOpenManagedPlugin = vi.fn();
    const onOpenStore = vi.fn();

    render(
      <AgentPluginDetailPage
        managedPlugin={null}
        plugin={targetPlugin}
        target={target}
        onBack={vi.fn()}
        onImport={onImport}
        onOpenFolder={onOpenFolder}
        onOpenManagedPlugin={onOpenManagedPlugin}
        onOpenStore={onOpenStore}
      />,
    );

    const props = pluginDetailSpy.mock.lastCall?.[0];
    expect(props.agentContext.isManaged).toBe(false);
    expect(props.agentActions.onImport).toBe(onImport);
    expect(props.agentActions.onOpenFolder).toBe(onOpenFolder);
    expect(props.agentActions.onOpenManagedPlugin).toBeUndefined();
    expect(props.onOpenStore).toBe(onOpenStore);
  });
});
