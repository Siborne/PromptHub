const MANUAL_RECOVERY_PATHS_STORAGE_KEY = "prompthub-manual-recovery-paths";

export const DEFAULT_VISIBLE_UPGRADE_BACKUPS = 3;
export const EXPANDED_UPGRADE_BACKUP_MAX_HEIGHT = 420;
export const WEBDAV_SYNC_ON_SAVE_AVAILABLE = true;

export type DataPathChangeAction = "migrate" | "switch" | "overwrite";
export type DataSettingsSubsectionId =
  | "local"
  | "recovery"
  | "selfHosted"
  | "webdav"
  | "s3"
  | "backup";
export type ExportScopeKey =
  | "prompts"
  | "folders"
  | "images"
  | "videos"
  | "aiConfig"
  | "settings"
  | "versions"
  | "rules"
  | "skills"
  | "mcp"
  | "plugins";

export type ExportScope = Record<ExportScopeKey, boolean>;

export interface RuntimePaths {
  userDataPath: string;
  dataDir: string;
  databasePath: string;
  promptsDir: string;
  rulesDir: string;
  skillsDir: string;
  mcpDir: string;
  backupsDir: string;
  logsDir: string;
  autoSyncLogPath: string;
}

export interface DataPathChangePreview {
  success: boolean;
  error?: string;
  targetPath?: string;
  exists?: boolean;
  hasPromptHubData?: boolean;
  isCurrentPath?: boolean;
  markers?: Array<{ name: string }>;
  targetSummary?: {
    promptCount: number;
    folderCount: number;
    skillCount: number;
    available: boolean;
  };
}

export interface BackupImportControllerLike {
  requestFileSelection: () => void;
  beginImportFromFile: (file: File) => Promise<void>;
}

export interface DataSettingsControllerOptions {
  activeSubsection: DataSettingsSubsectionId;
  backupImportController?: BackupImportControllerLike;
}

export function loadManualRecoveryPaths(): string[] {
  try {
    const raw = localStorage.getItem(MANUAL_RECOVERY_PATHS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        )
      : [];
  } catch {
    return [];
  }
}

export function persistManualRecoveryPaths(paths: string[]): void {
  try {
    localStorage.setItem(
      MANUAL_RECOVERY_PATHS_STORAGE_KEY,
      JSON.stringify(paths),
    );
  } catch {
    // Manual recovery paths are an optional convenience.
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Unknown error";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function getSyncProviderOptionLabel(
  provider: "manual" | "webdav" | "self-hosted" | "s3",
  translate: (key: string, fallback: string) => string,
): string {
  switch (provider) {
    case "webdav":
      return translate("settings.webdavSyncMenu", "WebDAV");
    case "self-hosted":
      return translate("settings.selfHostedSyncMenu", "Self-Hosted PromptHub");
    case "s3":
      return translate("settings.s3SyncMenu", "S3 Compatible Storage");
    default:
      return translate("settings.syncProviderManual", "Manual only");
  }
}
