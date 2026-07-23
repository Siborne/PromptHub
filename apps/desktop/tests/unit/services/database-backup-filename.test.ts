import { describe, expect, it } from "vitest";

import {
  formatBackupImportError,
  isPotentialSqliteBackupFileName,
} from "../../../src/renderer/services/database-backup";

describe("SQLite backup filename detection", () => {
  it.each([
    "prompthub.db",
    "prompthub.db.backup-2026-07-15T13-19-16-810Z",
    "prompthub.db.backup-before-0.5.3.2026-07-15.db",
    "prompthub.db.pre-recovery-2026-07-15T13-19-14-753Z",
    "prompthub.db.integrity-backup-2026-07-15T13-19-14-753Z",
    "prompthub.db.legacy-conflict-2026-07-15.db",
  ])("accepts %s", (fileName) => {
    expect(isPotentialSqliteBackupFileName(fileName)).toBe(true);
  });

  it.each(["notes.db", "prompthub-export.zip", "prompthub.db.txt"])(
    "rejects %s",
    (fileName) => {
      expect(isPotentialSqliteBackupFileName(fileName)).toBe(false);
    },
  );
});

describe("backup import errors", () => {
  it.each([
    "JSON Parse error: Unterminated string",
    "Unexpected end of JSON input",
  ])("formats truncated JSON import errors for users: %s", (message) => {
    expect(formatBackupImportError(new Error(message))).toBe(
      "备份文件不是完整 JSON，可能在导出、复制或上传过程中被截断。请重新从 PromptHub 导出完整的 JSON、PHUB 或 ZIP 文件后再导入。",
    );
  });
});
