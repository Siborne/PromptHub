import path from "node:path";

import { app, dialog, ipcMain } from "electron";

import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type { ApplyAgentThemeInput } from "@prompthub/shared/types";
import { getDataDir } from "../runtime-paths";
import { AgentAppearanceService } from "../services/agent-appearance-service";
import { CodexDreamSkinEngine } from "../services/codex-dream-skin-engine";
import { SkillInstaller } from "../services/skill-installer";
import { getPlatformRootDir } from "../services/skill-installer-utils";

interface AgentAppearanceIpcOptions {
  createService?: () => AgentAppearanceService;
}

function requireCodexAgent(agentId: unknown): void {
  if (agentId !== "codex") {
    throw new Error("Agent appearance is currently only supported for Codex");
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function createDefaultService(): AgentAppearanceService {
  const platform = SkillInstaller.getSupportedPlatforms().find(
    (candidate) => candidate.id === "codex",
  );
  if (!platform) throw new Error("Codex platform is unavailable");
  const dataRoot = getDataDir();
  const runtimeRoot = app.isPackaged
    ? path.join(process.resourcesPath, "codex-dream-skin")
    : path.join(__dirname, "../../resources", "codex-dream-skin");
  return new AgentAppearanceService({
    dataRoot,
    codexRoot: getPlatformRootDir(platform),
    engine: new CodexDreamSkinEngine({
      runtimeRoot,
      stateRoot: path.join(dataRoot, "agent-appearance", "dream-skin-runtime"),
    }),
  });
}

function normalizeApplyInput(value: unknown): ApplyAgentThemeInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Theme apply input must be an object");
  }
  const raw = value as Record<string, unknown>;
  requireCodexAgent(raw.agentId);
  const themeId = requireString(raw.themeId, "themeId");
  if (
    raw.restartExisting !== undefined &&
    typeof raw.restartExisting !== "boolean"
  ) {
    throw new Error("restartExisting must be a boolean");
  }
  return {
    agentId: "codex",
    themeId,
    restartExisting: raw.restartExisting as boolean | undefined,
  };
}

export function registerAgentAppearanceIPC(
  options: AgentAppearanceIpcOptions = {},
): void {
  const createService = options.createService ?? createDefaultService;

  ipcMain.handle(IPC_CHANNELS.AGENT_APPEARANCE_GET, async (_, agentId) => {
    requireCodexAgent(agentId);
    return createService().getOverview();
  });

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_IMPORT_THEME,
    async (_, agentId) => {
      requireCodexAgent(agentId);
      const result = await dialog.showOpenDialog({
        title: "Import Codex Dream Skin",
        properties: ["openDirectory"],
      });
      const sourcePath = result.filePaths[0];
      if (result.canceled || !sourcePath) return null;
      return createService().importTheme(sourcePath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_APPLY_THEME,
    async (_, input) => {
      const payload = normalizeApplyInput(input);
      return createService().applyTheme(
        payload.themeId,
        payload.restartExisting ?? false,
      );
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_RESTORE_THEME,
    async (_, agentId) => {
      requireCodexAgent(agentId);
      return createService().restoreTheme();
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_DELETE_THEME,
    async (_, agentId, themeId) => {
      requireCodexAgent(agentId);
      return createService().deleteTheme(requireString(themeId, "themeId"));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_EXPORT_THEME,
    async (_, agentId, themeId) => {
      requireCodexAgent(agentId);
      const normalizedThemeId = requireString(themeId, "themeId");
      const result = await dialog.showOpenDialog({
        title: "Export Codex Dream Skin",
        properties: ["openDirectory", "createDirectory"],
      });
      const destinationPath = result.filePaths[0];
      if (result.canceled || !destinationPath) return null;
      return createService().exportTheme(normalizedThemeId, destinationPath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_THEME_PREVIEW,
    async (_, agentId, themeId) => {
      requireCodexAgent(agentId);
      return createService().getThemePreview(requireString(themeId, "themeId"));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_IMPORT_PET,
    async (_, agentId) => {
      requireCodexAgent(agentId);
      const result = await dialog.showOpenDialog({
        title: "Import Codex Pet",
        properties: ["openDirectory"],
      });
      const sourcePath = result.filePaths[0];
      if (result.canceled || !sourcePath) return null;
      return createService().importPet(sourcePath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_EXPORT_PET,
    async (_, agentId, petId) => {
      requireCodexAgent(agentId);
      const normalizedPetId = requireString(petId, "Pet id");
      const result = await dialog.showOpenDialog({
        title: "Export Codex Pet",
        properties: ["openDirectory", "createDirectory"],
      });
      const destinationPath = result.filePaths[0];
      if (result.canceled || !destinationPath) return null;
      return createService().exportPet(normalizedPetId, destinationPath);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_DELETE_PET,
    async (_, agentId, petId) => {
      requireCodexAgent(agentId);
      return createService().deletePet(requireString(petId, "Pet id"));
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.AGENT_APPEARANCE_PET_PREVIEW,
    async (_, agentId, petId) => {
      requireCodexAgent(agentId);
      return createService().getPetPreview(requireString(petId, "Pet id"));
    },
  );
}
