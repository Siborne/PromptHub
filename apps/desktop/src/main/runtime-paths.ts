import os from "os";
import path from "path";

import {
  configureRuntimePaths as configureCoreRuntimePaths,
  getAppDataPath as getCoreAppDataPath,
  getAssetsDir,
  getAttachmentsDir,
  getBackupsDir,
  getCacheDir,
  getConfigDir,
  getDatabasePath,
  getDataDir,
  getGeneratedImagesDir,
  getGenerationsDir,
  getImagesDir,
  getLegacyDatabasePath,
  getLegacyGeneratedImagesDir,
  getLegacyImagesDir,
  getLegacyPromptsWorkspaceDir,
  getLegacySkillsDir,
  getLegacyVideosDir,
  getLegacyWorkspaceDir,
  getLogsDir,
  getOperationsDir,
  getPromptsDir,
  getPromptsWorkspaceDir,
  getRulesDir,
  getRuntimeStorageContext,
  refreshRuntimeStorageContext,
  getSecretsDir,
  getSkillsDir,
  getUserDataPath as getCoreUserDataPath,
  getVideosDir,
  getWorkspaceDir,
  resetRuntimePaths as resetCoreRuntimePaths,
} from "@prompthub/core/runtime-paths";
import { resolveInitialUserDataPath } from "./data-path";

const DEFAULT_PRODUCT_NAME = "PromptHub";

export interface RuntimePathOverrides {
  appDataPath?: string;
  userDataPath?: string;
  productName?: string;
  exePath?: string;
  isPackaged?: boolean;
  platform?: NodeJS.Platform;
}

let runtimePathOverrides: RuntimePathOverrides = {};

function getPlatform(): NodeJS.Platform {
  return runtimePathOverrides.platform ?? process.platform;
}

function getDefaultAppDataPath(platform: NodeJS.Platform): string {
  const homeDir = os.homedir();
  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support");
  }
  if (platform === "win32") {
    return process.env.APPDATA || path.join(homeDir, "AppData", "Roaming");
  }
  return process.env.XDG_CONFIG_HOME || path.join(homeDir, ".config");
}

function resolveDesktopUserDataPath(): string {
  if (runtimePathOverrides.userDataPath) {
    return path.resolve(runtimePathOverrides.userDataPath);
  }
  const appDataPath = path.resolve(
    runtimePathOverrides.appDataPath ?? getDefaultAppDataPath(getPlatform()),
  );
  const productName = runtimePathOverrides.productName ?? DEFAULT_PRODUCT_NAME;
  return resolveInitialUserDataPath({
    appDataPath,
    defaultUserDataPath: path.join(appDataPath, productName),
    exePath: runtimePathOverrides.exePath ?? process.execPath,
    isPackaged: runtimePathOverrides.isPackaged ?? false,
    platform: getPlatform(),
  });
}

function applyCoreRuntimePaths(): void {
  configureCoreRuntimePaths({
    ...runtimePathOverrides,
    userDataPath: resolveDesktopUserDataPath(),
  });
}

export function configureRuntimePaths(overrides: RuntimePathOverrides): void {
  runtimePathOverrides = { ...runtimePathOverrides, ...overrides };
  applyCoreRuntimePaths();
}

export function resetRuntimePaths(): void {
  runtimePathOverrides = {};
  resetCoreRuntimePaths();
}

export function getAppDataPath(): string {
  if (Object.keys(runtimePathOverrides).length === 0) {
    return getCoreAppDataPath();
  }
  return path.resolve(
    runtimePathOverrides.appDataPath ?? getDefaultAppDataPath(getPlatform()),
  );
}

export function getUserDataPath(): string {
  if (Object.keys(runtimePathOverrides).length === 0) {
    return getCoreUserDataPath();
  }
  return resolveDesktopUserDataPath();
}

export {
  getAssetsDir,
  getAttachmentsDir,
  getBackupsDir,
  getCacheDir,
  getConfigDir,
  getDatabasePath,
  getDataDir,
  getGeneratedImagesDir,
  getGenerationsDir,
  getImagesDir,
  getLegacyDatabasePath,
  getLegacyGeneratedImagesDir,
  getLegacyImagesDir,
  getLegacyPromptsWorkspaceDir,
  getLegacySkillsDir,
  getLegacyVideosDir,
  getLegacyWorkspaceDir,
  getLogsDir,
  getOperationsDir,
  getPromptsDir,
  getPromptsWorkspaceDir,
  getRulesDir,
  getRuntimeStorageContext,
  refreshRuntimeStorageContext,
  getSecretsDir,
  getSkillsDir,
  getVideosDir,
  getWorkspaceDir,
};

export type { RuntimeStorageContext } from "@prompthub/core/runtime-paths";
