import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/services/database-backup", () => ({
  downloadBackup: vi.fn(),
  downloadSelectiveExport: vi.fn(),
}));

vi.mock("../../../src/renderer/services/backup-status", () => ({
  recordManualBackup: vi.fn(),
}));

vi.mock("../../../src/renderer/services/upgrade-backup", () => ({
  createUpgradeBackup: vi.fn(),
}));

vi.mock("../../../src/renderer/services/webdav", () => ({
  autoSync: vi.fn(),
  downloadFromWebDAV: vi.fn(),
  testConnection: vi.fn(),
  uploadToWebDAV: vi.fn(),
}));

vi.mock("../../../src/renderer/services/self-hosted-sync", () => ({
  pullFromSelfHostedWeb: vi.fn(),
  pushToSelfHostedWeb: vi.fn(),
  testSelfHostedConnection: vi.fn(),
}));

vi.mock("../../../src/renderer/services/s3-sync", () => ({
  autoSync: vi.fn(),
  downloadFromS3: vi.fn(),
  testConnection: vi.fn(),
  uploadToS3: vi.fn(),
}));

import {
  runFullExportBackup,
  runS3AutoSync,
  runPreUpgradeBackup,
  runSelfHostedAutoSync,
  runWebDAVAutoSync,
} from "../../../src/renderer/services/backup-orchestrator";

import {
  downloadBackup,
  downloadSelectiveExport,
} from "../../../src/renderer/services/database-backup";
import { recordManualBackup } from "../../../src/renderer/services/backup-status";
import { createUpgradeBackup } from "../../../src/renderer/services/upgrade-backup";
import { autoSync } from "../../../src/renderer/services/webdav";
import {
  pullFromSelfHostedWeb,
  pushToSelfHostedWeb,
} from "../../../src/renderer/services/self-hosted-sync";
import { autoSync as autoSyncS3 } from "../../../src/renderer/services/s3-sync";

describe("backup-orchestrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("runs full backup as a full selective ZIP export with snapshot and manual backup record", async () => {
    vi.mocked(recordManualBackup).mockResolvedValue({
      lastManualBackupAt: "2026-05-10T00:00:00.000Z",
      lastManualBackupVersion: "0.5.5",
    });

    const result = await runFullExportBackup({
      currentVersion: "0.5.5",
      recordManualBackup: true,
    });

    expect(createUpgradeBackup).toHaveBeenCalledWith({ fromVersion: "0.5.5" });
    expect(downloadSelectiveExport).toHaveBeenCalledWith({
      prompts: true,
      folders: true,
      versions: true,
      images: true,
      videos: true,
      aiConfig: true,
      settings: true,
      rules: true,
      skills: true,
      mcp: true,
      plugins: true,
    });
    expect(downloadBackup).not.toHaveBeenCalled();
    expect(recordManualBackup).toHaveBeenCalledWith("0.5.5");
    expect(result?.lastManualBackupVersion).toBe("0.5.5");
  });

  it("runs full backup without currentVersion by skipping snapshot but still exporting ZIP", async () => {
    const result = await runFullExportBackup({
      recordManualBackup: false,
    });

    expect(createUpgradeBackup).toHaveBeenCalledWith(undefined);
    expect(downloadSelectiveExport).toHaveBeenCalledTimes(1);
    expect(recordManualBackup).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("runs full backup without manual record when disabled", async () => {
    const result = await runFullExportBackup({
      currentVersion: "0.5.5",
      recordManualBackup: false,
    });

    expect(createUpgradeBackup).toHaveBeenCalledWith({ fromVersion: "0.5.5" });
    expect(downloadSelectiveExport).toHaveBeenCalledTimes(1);
    expect(downloadBackup).not.toHaveBeenCalled();
    expect(recordManualBackup).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("runs pre-upgrade backup with legacy JSON backup and status update", async () => {
    vi.mocked(recordManualBackup).mockResolvedValue({
      lastManualBackupAt: "2026-05-10T00:00:00.000Z",
      lastManualBackupVersion: "0.5.5",
    });

    const status = await runPreUpgradeBackup("0.5.5");

    expect(createUpgradeBackup).toHaveBeenCalledWith({ fromVersion: "0.5.5" });
    expect(downloadSelectiveExport).toHaveBeenCalledWith({
      prompts: true,
      folders: true,
      versions: true,
      images: true,
      videos: true,
      aiConfig: true,
      settings: true,
      rules: true,
      skills: true,
      mcp: true,
      plugins: true,
    });
    expect(downloadBackup).not.toHaveBeenCalled();
    expect(recordManualBackup).toHaveBeenCalledWith("0.5.5");
    expect(status.lastManualBackupVersion).toBe("0.5.5");
  });

  it("delegates webdav auto sync call", async () => {
    vi.mocked(autoSync).mockResolvedValue({
      success: true,
      message: "ok",
      localChanged: false,
    });

    const result = await runWebDAVAutoSync({
      config: {
        url: "https://dav.example.com",
        username: "u",
        password: "p",
      },
      options: {
        incrementalSync: true,
      },
    });

    expect(autoSync).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.message).toBe("ok");
  });

  it("delegates s3 auto sync call", async () => {
    vi.mocked(autoSyncS3).mockResolvedValue({
      success: true,
      message: "ok",
      localChanged: false,
    });

    const result = await runS3AutoSync({
      config: {
        endpoint: "https://s3.example.com",
        region: "us-east-1",
        bucket: "prompthub-backups",
        accessKeyId: "access",
        secretAccessKey: "secret",
      },
      options: {
        incrementalSync: true,
      },
    });

    expect(autoSyncS3).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(true);
    expect(result.message).toBe("ok");
  });

  it("uses push for self-hosted interval auto sync", async () => {
    vi.mocked(pushToSelfHostedWeb).mockResolvedValue({
      prompts: 3,
      folders: 2,
      rules: 1,
      skills: 4,
    });

    const result = await runSelfHostedAutoSync("interval", {
      url: "https://example.com",
      username: "u",
      password: "p",
    });

    expect(pushToSelfHostedWeb).toHaveBeenCalledTimes(1);
    expect(pullFromSelfHostedWeb).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.localChanged).toBe(false);
  });

  it("uses replace pull for self-hosted startup auto sync", async () => {
    vi.mocked(pullFromSelfHostedWeb).mockResolvedValue({
      prompts: 5,
      folders: 2,
      rules: 1,
      skills: 4,
    });

    const result = await runSelfHostedAutoSync("startup", {
      url: "https://example.com",
      username: "u",
      password: "p",
    });

    expect(pullFromSelfHostedWeb).toHaveBeenCalledWith(
      {
        url: "https://example.com",
        username: "u",
        password: "p",
      },
      { mode: "replace" },
    );
    expect(pushToSelfHostedWeb).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.localChanged).toBe(true);
  });

  it("returns failure result when self-hosted sync throws", async () => {
    vi.mocked(pushToSelfHostedWeb).mockRejectedValue(
      new Error("network error"),
    );

    const result = await runSelfHostedAutoSync("interval", {
      url: "https://example.com",
      username: "u",
      password: "p",
    });

    expect(result.success).toBe(false);
    expect(result.localChanged).toBe(false);
    expect(result.message).toContain("network error");
  });
});
