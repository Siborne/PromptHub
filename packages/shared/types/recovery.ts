export type RecoveryCandidateType =
  | "current-residual"
  | "current-file-workspace"
  | "current-canonical-db"
  | "external-user-data"
  | "upgrade-backup"
  | "standalone-db-backup";

export type RecoveryDataSource =
  | "sqlite"
  | "workspace"
  | "browser-storage"
  | "skills"
  | "mcp"
  | "rules"
  | "plugins"
  | "config"
  | "media"
  | "other-data"
  | "legacy-layout";

export type RecoveryContentKind =
  | "mcp"
  | "rules"
  | "plugins"
  | "config"
  | "media"
  | "otherData";

export type RecoveryContentCounts = Partial<
  Record<RecoveryContentKind, number>
>;

export interface RecoveryCandidate {
  sourcePath: string;
  sourceType: RecoveryCandidateType;
  displayName: string;
  displayPath: string;
  promptCount: number;
  folderCount: number;
  skillCount: number;
  dbSizeBytes: number;
  lastModified: string | null;
  previewAvailable: boolean;
  dataSources: RecoveryDataSource[];
  contentCounts?: RecoveryContentCounts;
  description?: string | null;
  backupId?: string | null;
  fromVersion?: string | null;
  toVersion?: string | null;
}

export type RecoveryPreviewItemKind =
  | "prompt"
  | "folder"
  | "skill"
  | "mcp"
  | "rule"
  | "plugin"
  | "config"
  | "media"
  | "other-data";

export interface RecoveryPreviewItem {
  kind: RecoveryPreviewItemKind;
  id?: string;
  title: string;
  subtitle?: string | null;
  updatedAt?: string | null;
}

export interface RecoveryPreviewResult {
  sourcePath: string;
  previewAvailable: boolean;
  description?: string | null;
  items: RecoveryPreviewItem[];
  truncated: boolean;
}

export interface RecoveryScanOptions {
  extraPaths?: string[];
  ignoreDismissMarker?: boolean;
}
