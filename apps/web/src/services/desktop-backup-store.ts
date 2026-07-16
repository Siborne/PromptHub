import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  SelfHostedBackupEnvelope,
  SelfHostedBackupMetadata,
  SelfHostedBackupSnapshot,
  SyncOperationSummary,
} from "@prompthub/shared";
import { SELF_HOSTED_BACKUP_PROTOCOL_VERSION } from "@prompthub/shared";
import { getBackupsDir } from "../runtime-paths.js";
import { writeJsonFileAtomicExclusive } from "./atomic-json-file.js";

const BACKUP_KIND = "prompthub-self-hosted-backup";
export const DEFAULT_DESKTOP_BACKUP_RETENTION = 10;

interface DesktopBackupStoreOptions {
  rootDir?: string;
  retentionLimit?: number;
  now?: () => Date;
  createId?: () => string;
}

interface CreateDesktopBackupInput {
  clientVersion: string;
  serverVersion: string;
  snapshot: SelfHostedBackupSnapshot;
}

export class DesktopBackupNotFoundError extends Error {
  constructor() {
    super("No self-hosted desktop backup is available");
    this.name = "DesktopBackupNotFoundError";
  }
}

export class DesktopBackupIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DesktopBackupIntegrityError";
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function buildSummary(
  snapshot: SelfHostedBackupSnapshot,
): SyncOperationSummary {
  return {
    prompts: snapshot.prompts.length,
    folders: snapshot.folders.length,
    rules: snapshot.rules?.length ?? 0,
    skills: snapshot.skills.length,
    promptRelations: snapshot.promptRelations?.length ?? 0,
    outputFormatItems: snapshot.outputFormatItems?.length ?? 0,
    mcpServers: snapshot.mcpLibrary?.servers.length ?? 0,
    plugins: snapshot.pluginLibrary?.plugins.length ?? 0,
  };
}

function isBackupEnvelope(value: unknown): value is SelfHostedBackupEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const envelope = value as Record<string, unknown>;
  return (
    envelope.kind === BACKUP_KIND &&
    envelope.protocolVersion === SELF_HOSTED_BACKUP_PROTOCOL_VERSION &&
    typeof envelope.id === "string" &&
    typeof envelope.createdAt === "string" &&
    typeof envelope.clientVersion === "string" &&
    typeof envelope.serverVersion === "string" &&
    typeof envelope.payloadSha256 === "string" &&
    Boolean(envelope.summary) &&
    typeof envelope.summary === "object" &&
    Boolean(envelope.snapshot) &&
    typeof envelope.snapshot === "object"
  );
}

function toMetadata(
  envelope: SelfHostedBackupEnvelope,
): SelfHostedBackupMetadata {
  return {
    id: envelope.id,
    createdAt: envelope.createdAt,
    clientVersion: envelope.clientVersion,
    serverVersion: envelope.serverVersion,
    protocolVersion: envelope.protocolVersion,
    summary: envelope.summary,
  };
}

export class DesktopBackupStore {
  readonly retentionLimit: number;
  private readonly backupBaseDir: string;
  private readonly rootDir: string;
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(options: DesktopBackupStoreOptions = {}) {
    this.backupBaseDir = options.rootDir ?? getBackupsDir();
    this.rootDir = path.join(this.backupBaseDir, "desktop");
    this.retentionLimit = Math.max(
      1,
      Math.floor(options.retentionLimit ?? DEFAULT_DESKTOP_BACKUP_RETENTION),
    );
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  create(
    userId: string,
    input: CreateDesktopBackupInput,
  ): SelfHostedBackupMetadata {
    const userDir = this.ensureUserDirectory(userId);
    const createdAt = this.now().toISOString();
    const id = this.createId();
    if (!/^[A-Za-z0-9-]+$/.test(id)) {
      throw new Error("Generated backup ID contains unsupported characters");
    }

    const payloadSha256 = sha256(JSON.stringify(input.snapshot));
    const envelope: SelfHostedBackupEnvelope = {
      kind: BACKUP_KIND,
      id,
      createdAt,
      clientVersion: input.clientVersion,
      serverVersion: input.serverVersion,
      protocolVersion: SELF_HOSTED_BACKUP_PROTOCOL_VERSION,
      payloadSha256,
      summary: buildSummary(input.snapshot),
      snapshot: input.snapshot,
    };
    const filePath = path.join(
      userDir,
      `${createdAt.replace(/[^0-9]/g, "")}-${id}.json`,
    );

    writeJsonFileAtomicExclusive(filePath, envelope);
    this.pruneAfterSuccessfulWrite(userDir);
    return toMetadata(envelope);
  }

  list(userId: string): SelfHostedBackupMetadata[] {
    return this.listSnapshotFiles(userId).map((filePath) =>
      toMetadata(this.readEnvelope(filePath)),
    );
  }

  readLatest(userId: string): SelfHostedBackupEnvelope {
    const [latestPath] = this.listSnapshotFiles(userId);
    if (!latestPath) {
      throw new DesktopBackupNotFoundError();
    }
    return this.readEnvelope(latestPath);
  }

  private getUserDirectory(userId: string): string {
    if (!userId.trim()) {
      throw new Error("Backup user ID is required");
    }
    return path.join(this.rootDir, sha256(userId));
  }

  private ensureUserDirectory(userId: string): string {
    const userDir = this.getUserDirectory(userId);
    this.ensureRealDirectory(this.backupBaseDir, true);
    this.ensureRealDirectory(this.rootDir, false);
    this.ensureRealDirectory(userDir, false);
    return userDir;
  }

  private listSnapshotFiles(userId: string): string[] {
    const userDir = this.getUserDirectory(userId);
    if (!this.validateExistingDirectory(this.backupBaseDir)) {
      return [];
    }
    if (!this.validateExistingDirectory(this.rootDir)) {
      return [];
    }
    if (!this.validateExistingDirectory(userDir)) {
      return [];
    }

    return fs
      .readdirSync(userDir)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => path.join(userDir, entry))
      .filter((filePath) => {
        const fileStat = fs.lstatSync(filePath);
        return fileStat.isFile() && !fileStat.isSymbolicLink();
      })
      .sort((left, right) =>
        path.basename(right).localeCompare(path.basename(left)),
      );
  }

  private ensureRealDirectory(directoryPath: string, recursive: boolean): void {
    if (!this.validateExistingDirectory(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive, mode: 0o700 });
      this.validateExistingDirectory(directoryPath);
    }
  }

  private validateExistingDirectory(directoryPath: string): boolean {
    let stat: fs.Stats;
    try {
      stat = fs.lstatSync(directoryPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return false;
      }
      throw error;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("Desktop backup directory must be a real directory");
    }
    return true;
  }

  private readEnvelope(filePath: string): SelfHostedBackupEnvelope {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      throw new DesktopBackupIntegrityError(
        "Self-hosted backup file is not valid JSON",
      );
    }
    if (!isBackupEnvelope(parsed)) {
      throw new DesktopBackupIntegrityError(
        "Self-hosted backup envelope is invalid",
      );
    }
    const actualHash = sha256(JSON.stringify(parsed.snapshot));
    if (actualHash !== parsed.payloadSha256) {
      throw new DesktopBackupIntegrityError(
        "Self-hosted backup checksum mismatch",
      );
    }
    return parsed;
  }

  private pruneAfterSuccessfulWrite(userDir: string): void {
    const files = fs
      .readdirSync(userDir)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => path.join(userDir, entry))
      .filter((filePath) => {
        const stat = fs.lstatSync(filePath);
        return stat.isFile() && !stat.isSymbolicLink();
      })
      .sort((left, right) =>
        path.basename(right).localeCompare(path.basename(left)),
      );
    for (const stalePath of files.slice(this.retentionLimit)) {
      fs.rmSync(stalePath, { force: true });
    }
  }
}
