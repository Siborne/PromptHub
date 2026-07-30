import path from "path";
import type {
  Menu,
  MenuItemConstructorOptions,
  NativeImage,
  Tray,
} from "electron";
import type { AppCommand } from "@prompthub/shared/types";

import { loadMacTrayTemplateIcon, resolveMacTrayIconPaths } from "./tray-icon";
import { buildTrayMenuTemplate, getTrayMenuLabels } from "./tray-menu";
import type { AgentProviderTrayGroup } from "./services/agent-provider-tray-service";

interface TrayControllerOptions {
  agentManagementEnabled: boolean;
  buildMenu: (template: MenuItemConstructorOptions[]) => Menu;
  createFromPath: (filePath: string) => NativeImage;
  createTray: (icon: NativeImage) => Tray;
  dirname: string;
  getLocale: () => string;
  getResourcesPath: () => string;
  getStoredLanguage: () => string | null;
  getWindowVisibility: () => boolean;
  isDev: boolean;
  loadAgentProviderGroups?: () => Promise<AgentProviderTrayGroup[]>;
  onAgentProviderProfile?: (agentId: string, profileId: string) => void;
  onCommand: (command: AppCommand) => void;
  onQuit: () => void;
  onToggleWindow: () => void;
  platform: NodeJS.Platform;
}

export interface TrayController {
  create: () => void;
  destroy: () => void;
  refresh: () => void;
  reloadAgentProviders: () => Promise<void>;
}

function loadPlatformTrayIcon(options: TrayControllerOptions): NativeImage {
  const resourcesPath = options.getResourcesPath();
  if (options.platform === "darwin") {
    const { templatePath } = resolveMacTrayIconPaths({
      dirname: options.dirname,
      isDev: options.isDev,
      resourcesPath,
    });
    return loadMacTrayTemplateIcon({
      createFromPath: options.createFromPath,
      templatePath,
    });
  }

  const iconPath = options.isDev
    ? path.join(options.dirname, "../../resources/icon.ico")
    : path.join(resourcesPath, "icon.ico");
  let icon = options.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = options.createFromPath(
      path.join(resourcesPath, "app.asar.unpacked", "resources", "icon.ico"),
    );
  }
  if (icon.isEmpty()) {
    throw new Error("platform tray icon is missing");
  }
  return icon.resize({ width: 16, height: 16 });
}

function loadFallbackTrayIcon(options: TrayControllerOptions): NativeImage {
  const { fallbackPath } = resolveMacTrayIconPaths({
    dirname: options.dirname,
    isDev: options.isDev,
    resourcesPath: options.getResourcesPath(),
  });
  return options.createFromPath(fallbackPath).resize({ width: 18, height: 18 });
}

export function createTrayController(
  options: TrayControllerOptions,
): TrayController {
  let tray: Tray | null = null;
  let agentProviderGroups: AgentProviderTrayGroup[] = [];
  let providerLoadGeneration = 0;

  const refresh = () => {
    if (!tray) return;
    const locale = options.getStoredLanguage() ?? options.getLocale();
    const template = buildTrayMenuTemplate({
      agentManagementEnabled: options.agentManagementEnabled,
      agentProviderGroups,
      isWindowVisible: options.getWindowVisibility(),
      labels: getTrayMenuLabels(locale),
      onAgentProviderProfile: options.onAgentProviderProfile,
      onCommand: options.onCommand,
      onQuit: options.onQuit,
      onToggleWindow: options.onToggleWindow,
    });
    tray.setContextMenu(options.buildMenu(template));
  };

  const reloadAgentProviders = async () => {
    if (!tray || !options.loadAgentProviderGroups) return;
    const generation = ++providerLoadGeneration;
    try {
      const groups = await options.loadAgentProviderGroups();
      if (!tray || generation !== providerLoadGeneration) return;
      agentProviderGroups = groups;
      refresh();
    } catch {
      console.error("Failed to refresh Agent provider tray state");
    }
  };

  const create = () => {
    if (tray) return;
    let icon: NativeImage;
    try {
      icon = loadPlatformTrayIcon(options);
    } catch (error) {
      console.error("Failed to load tray icon:", error);
      icon = loadFallbackTrayIcon(options);
    }

    tray = options.createTray(icon);
    tray.setToolTip("PromptHub");
    refresh();
    void reloadAgentProviders();
    if (options.platform === "darwin") {
      tray.on("mouse-down", () => {
        refresh();
        void reloadAgentProviders();
      });
    } else {
      tray.on("click", options.onToggleWindow);
    }
  };

  const destroy = () => {
    providerLoadGeneration += 1;
    tray?.destroy();
    tray = null;
  };

  return { create, destroy, refresh, reloadAgentProviders };
}
