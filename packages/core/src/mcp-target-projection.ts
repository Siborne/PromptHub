import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

export interface McpTargetProjectionCommit {
  filePath: string;
  previousContent?: string;
  nextContent: string;
  verify: () => void;
  persist: () => void;
}

export interface McpTargetProjectionCommitResult {
  changed: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function writeTextFileAtomic(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const mode = fs.existsSync(filePath) ? fs.statSync(filePath).mode : 0o600;
  const tempPath = `${filePath}.prompthub-tmp-${process.pid}-${randomUUID()}`;
  let descriptor: number | undefined;

  try {
    descriptor = fs.openSync(tempPath, "wx", mode);
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
    try {
      fs.closeSync(descriptor);
    } finally {
      descriptor = undefined;
    }
    fs.renameSync(tempPath, filePath);
  } finally {
    if (descriptor !== undefined) {
      fs.closeSync(descriptor);
    }
    fs.rmSync(tempPath, { force: true });
  }
}

function restoreProjection(filePath: string, content?: string): void {
  if (content === undefined) {
    fs.rmSync(filePath, { force: true });
    if (fs.existsSync(filePath)) {
      throw new Error("new target file still exists after rollback");
    }
    return;
  }

  writeTextFileAtomic(filePath, content);
  if (fs.readFileSync(filePath, "utf8") !== content) {
    throw new Error("target content differs after rollback");
  }
}

export function commitMcpTargetProjection(
  input: McpTargetProjectionCommit,
): McpTargetProjectionCommitResult {
  const changed = input.previousContent !== input.nextContent;
  let replaced = false;

  try {
    if (changed) {
      writeTextFileAtomic(input.filePath, input.nextContent);
      replaced = true;
    }
    input.verify();
    input.persist();
    return { changed };
  } catch (error) {
    if (replaced) {
      try {
        restoreProjection(input.filePath, input.previousContent);
      } catch (rollbackError) {
        throw new Error(
          `MCP target update failed (${errorMessage(error)}) and rollback failed (${errorMessage(rollbackError)})`,
        );
      }
    }
    throw error;
  }
}
