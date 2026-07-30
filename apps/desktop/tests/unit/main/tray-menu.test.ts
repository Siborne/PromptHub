/**
 * @vitest-environment node
 */
import type { MenuItemConstructorOptions } from "electron";
import { describe, expect, it, vi } from "vitest";

import type { AppCommand } from "@prompthub/shared/types";
import {
  buildTrayMenuTemplate,
  getTrayMenuLabels,
  normalizeTrayMenuLanguage,
  SUPPORTED_TRAY_MENU_LANGUAGES,
} from "../../../src/main/tray-menu";

function getSubmenu(
  template: MenuItemConstructorOptions[],
  label: string,
): MenuItemConstructorOptions[] {
  const item = template.find((entry) => entry.label === label);
  expect(item).toBeDefined();
  expect(Array.isArray(item?.submenu)).toBe(true);
  return item?.submenu as MenuItemConstructorOptions[];
}

function clickItem(
  template: MenuItemConstructorOptions[],
  label: string,
): void {
  const item = template.find((entry) => entry.label === label);
  expect(item?.click).toBeTypeOf("function");
  (item?.click as () => void)();
}

describe("tray asset menu", () => {
  it("routes every current Agent asset through its product-correct command", () => {
    const labels = getTrayMenuLabels("zh");
    const onCommand = vi.fn<(command: AppCommand) => void>();
    const template = buildTrayMenuTemplate({
      agentManagementEnabled: false,
      isWindowVisible: true,
      labels,
      onCommand,
      onQuit: vi.fn(),
      onToggleWindow: vi.fn(),
    });

    const assetMenu = getSubmenu(template, labels.addAgentAsset);
    clickItem(assetMenu, labels.createPrompt);
    clickItem(assetMenu, labels.createOrImportSkill);
    clickItem(assetMenu, labels.addMcpServer);
    clickItem(assetMenu, labels.addPlugin);
    clickItem(assetMenu, labels.manageRules);

    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: "asset:create", asset: "prompt" },
      { type: "asset:create", asset: "skill" },
      { type: "asset:create", asset: "mcp" },
      { type: "asset:create", asset: "plugin" },
      { type: "asset:manage", asset: "rule" },
    ]);
  });

  it("opens both existing Quick Add modes and native app surfaces", () => {
    const labels = getTrayMenuLabels("en");
    const onCommand = vi.fn<(command: AppCommand) => void>();
    const onToggleWindow = vi.fn();
    const onQuit = vi.fn();
    const template = buildTrayMenuTemplate({
      agentManagementEnabled: false,
      isWindowVisible: false,
      labels,
      onCommand,
      onQuit,
      onToggleWindow,
    });

    const quickAddMenu = getSubmenu(template, labels.quickAddPrompt);
    clickItem(quickAddMenu, labels.analyzePrompt);
    clickItem(quickAddMenu, labels.generatePrompt);
    clickItem(template, labels.showPromptHub);
    clickItem(template, labels.checkUpdates);
    clickItem(template, labels.settings);
    clickItem(template, labels.quitPromptHub);

    expect(onCommand.mock.calls.map(([command]) => command)).toEqual([
      { type: "prompt:quick-add", mode: "analyze" },
      { type: "prompt:quick-add", mode: "generate" },
      { type: "updater:open" },
      { type: "settings:open" },
    ]);
    expect(onToggleWindow).toHaveBeenCalledOnce();
    expect(onQuit).toHaveBeenCalledOnce();
  });

  it("uses a dynamic visibility label", () => {
    const labels = getTrayMenuLabels("en");
    const common = {
      agentManagementEnabled: false,
      labels,
      onCommand: vi.fn(),
      onQuit: vi.fn(),
      onToggleWindow: vi.fn(),
    };

    const visible = buildTrayMenuTemplate({
      ...common,
      isWindowVisible: true,
    });
    const hidden = buildTrayMenuTemplate({
      ...common,
      isWindowVisible: false,
    });

    expect(visible.some((entry) => entry.label === labels.hidePromptHub)).toBe(
      true,
    );
    expect(hidden.some((entry) => entry.label === labels.showPromptHub)).toBe(
      true,
    );
  });

  it("hides future Agent management until its capability is enabled", () => {
    const labels = getTrayMenuLabels("en");
    const onCommand = vi.fn<(command: AppCommand) => void>();
    const common = {
      isWindowVisible: true,
      labels,
      onCommand,
      onQuit: vi.fn(),
      onToggleWindow: vi.fn(),
    };

    const disabled = buildTrayMenuTemplate({
      ...common,
      agentManagementEnabled: false,
    });
    expect(disabled.some((entry) => entry.label === labels.manageAgents)).toBe(
      false,
    );

    const enabled = buildTrayMenuTemplate({
      ...common,
      agentManagementEnabled: true,
    });
    clickItem(enabled, labels.manageAgents);
    expect(onCommand).toHaveBeenLastCalledWith({ type: "agent:manage" });
  });

  it("projects verified provider profiles and routes only alternate choices", () => {
    const labels = getTrayMenuLabels("en");
    const onCommand = vi.fn<(command: AppCommand) => void>();
    const onAgentProviderProfile = vi.fn();
    const template = buildTrayMenuTemplate({
      agentManagementEnabled: true,
      agentProviderGroups: [
        {
          agentId: "claude",
          name: "Claude Code",
          currentProfileId: "profile-1",
          profiles: [
            {
              id: "profile-1",
              name: "Primary",
              model: "claude-opus-4",
              isCurrent: true,
            },
            {
              id: "profile-2",
              name: "Backup",
              model: null,
              isCurrent: false,
            },
          ],
        },
      ],
      isWindowVisible: true,
      labels,
      onAgentProviderProfile,
      onCommand,
      onQuit: vi.fn(),
      onToggleWindow: vi.fn(),
    });

    const agentsMenu = getSubmenu(template, labels.agents);
    const claudeMenu = getSubmenu(agentsMenu, "Claude Code");
    const current = claudeMenu.find(
      (entry) => entry.label === "Primary · claude-opus-4",
    );
    expect(current).toMatchObject({
      checked: true,
      enabled: false,
      type: "checkbox",
    });

    clickItem(claudeMenu, "Backup");
    clickItem(claudeMenu, labels.openAgent);
    clickItem(agentsMenu, labels.manageAgents);
    expect(onAgentProviderProfile).toHaveBeenCalledWith("claude", "profile-2");
    expect(onCommand).toHaveBeenCalledTimes(2);
    expect(onCommand).toHaveBeenLastCalledWith({ type: "agent:manage" });
  });

  it("keeps an omitted provider callback safe for cached menu entries", () => {
    const labels = getTrayMenuLabels("en");
    const template = buildTrayMenuTemplate({
      agentManagementEnabled: true,
      agentProviderGroups: [
        {
          agentId: "claude",
          name: "Claude Code",
          currentProfileId: null,
          profiles: [
            {
              id: "profile-1",
              name: "Primary",
              model: null,
              isCurrent: false,
            },
          ],
        },
      ],
      isWindowVisible: true,
      labels,
      onCommand: vi.fn(),
      onQuit: vi.fn(),
      onToggleWindow: vi.fn(),
    });

    const agentsMenu = getSubmenu(template, labels.agents);
    const claudeMenu = getSubmenu(agentsMenu, "Claude Code");
    expect(() => clickItem(claudeMenu, "Primary")).not.toThrow();
  });
});

describe("tray menu localization", () => {
  it("keeps every supported language dictionary complete and non-empty", () => {
    const referenceKeys = Object.keys(getTrayMenuLabels("en")).sort();

    for (const language of SUPPORTED_TRAY_MENU_LANGUAGES) {
      const labels = getTrayMenuLabels(language);
      expect(Object.keys(labels).sort()).toEqual(referenceKeys);
      expect(
        Object.values(labels).every((label) => label.trim().length > 0),
      ).toBe(true);
    }
  });

  it.each([
    ["zh-CN", "zh"],
    ["zh-Hant-HK", "zh-TW"],
    ["zh-TW", "zh-TW"],
    ["ja-JP", "ja"],
    ["fr-CA", "fr"],
    ["de-DE", "de"],
    ["es-MX", "es"],
    ["pt-BR", "en"],
    ["", "en"],
  ] as const)("normalizes %s to %s", (locale, expected) => {
    expect(normalizeTrayMenuLanguage(locale)).toBe(expected);
  });
});
