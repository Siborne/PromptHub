import type { FormEvent } from "react";
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DataSettings } from "../../../src/renderer/components/settings/DataSettings";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";
import { restoreFromFile } from "../../../src/renderer/services/database-backup";
import { previewImportFile } from "../../../src/renderer/services/database-backup";
import { downloadSelectiveExport } from "../../../src/renderer/services/database-backup";
import {
  createUpgradeBackup,
  listUpgradeBackups,
  restoreUpgradeBackup,
} from "../../../src/renderer/services/upgrade-backup";
import {
  runFullExportBackup,
  runS3ConnectionCheck,
  runS3Download,
  runS3Upload,
  runSelfHostedConnectionCheck,
  runWebDAVConnectionCheck,
} from "../../../src/renderer/services/backup-orchestrator";

const useSettingsStoreMock = vi.fn();
const useToastMock = vi.fn();
const useSkillStoreMock = vi.fn();

vi.mock("../../../src/renderer/stores/settings.store", () => ({
  useSettingsStore: () => useSettingsStoreMock(),
}));

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => useToastMock(),
}));

vi.mock("../../../src/renderer/stores/skill.store", () => ({
  useSkillStore: (selector?: (state: unknown) => unknown) => {
    const state = {
      scanInstalledSkillSafety: useSkillStoreMock,
    };
    return typeof selector === "function" ? selector(state) : state;
  },
}));

vi.mock("../../../src/renderer/services/database-backup", () => ({
  BACKUP_IMPORT_ACCEPT: ".json,.phub,.gz,.zip",
  downloadBackup: vi.fn(),
  downloadCompressedBackup: vi.fn(),
  downloadSelectiveExport: vi.fn(),
  formatBackupImportError: (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("FOREIGN KEY constraint failed")) {
      return "备份中的文件夹或 Prompt 引用关系不完整，PromptHub 无法安全导入。建议重新导出一份新备份后再试。";
    }
    return message;
  },
  pickSupportedBackupFile: vi.fn(
    (files: FileList | File[]) => Array.from(files)[0] ?? null,
  ),
  previewImportFile: vi.fn(),
  restoreFromFile: vi.fn(),
}));

vi.mock("../../../src/renderer/services/database", () => ({
  clearDatabase: vi.fn(),
}));

vi.mock("../../../src/renderer/services/webdav", () => ({
  testConnection: vi.fn(),
  uploadToWebDAV: vi.fn(),
  downloadFromWebDAV: vi.fn(),
}));

vi.mock("../../../src/renderer/services/self-hosted-sync", () => ({
  testSelfHostedConnection: vi.fn(),
  pushToSelfHostedWeb: vi.fn(),
  pullFromSelfHostedWeb: vi.fn(),
}));

vi.mock("../../../src/renderer/services/backup-orchestrator", () => ({
  runFullExportBackup: vi.fn(),
  runS3ConnectionCheck: vi.fn(),
  runS3Download: vi.fn(),
  runS3Upload: vi.fn(),
  runSelfHostedConnectionCheck: vi.fn(),
  runSelfHostedPull: vi.fn(),
  runSelfHostedPush: vi.fn(),
  runWebDAVConnectionCheck: vi.fn(),
  runWebDAVDownload: vi.fn(),
  runWebDAVUpload: vi.fn(),
}));

vi.mock("../../../src/renderer/services/upgrade-backup", () => ({
  createUpgradeBackup: vi.fn(),
  listUpgradeBackups: vi.fn(),
  deleteUpgradeBackup: vi.fn(),
  restoreUpgradeBackup: vi.fn(),
}));

function expectButtonIconsHidden(button: HTMLElement) {
  for (const icon of button.querySelectorAll("svg")) {
    expect(
      icon.getAttribute("aria-hidden") === "true" ||
        Boolean(icon.closest("[aria-hidden='true']")),
    ).toBe(true);
  }
}

function createSettingsState() {
  return {
    aiModels: [],
    dataPath: "/stale/path",
    setDataPath: vi.fn(),
    skillInstallMethod: "symlink",
    setSkillInstallMethod: vi.fn(),
    customPlatformRootPaths: {},
    setCustomPlatformRootPath: vi.fn(),
    resetCustomPlatformRootPath: vi.fn(),
    customSkillPlatformPaths: {},
    setCustomSkillPlatformPath: vi.fn(),
    resetCustomSkillPlatformPath: vi.fn(),
    skillPlatformOrder: [],
    setSkillPlatformOrder: vi.fn(),
    resetSkillPlatformOrder: vi.fn(),
    customSkillScanPaths: [],
    addCustomSkillScanPath: vi.fn(),
    removeCustomSkillScanPath: vi.fn(),
    webdavEnabled: false,
    setWebdavEnabled: vi.fn(),
    webdavUrl: "",
    setWebdavUrl: vi.fn(),
    webdavUsername: "",
    setWebdavUsername: vi.fn(),
    webdavPassword: "",
    setWebdavPassword: vi.fn(),
    webdavAutoSync: false,
    setWebdavAutoSync: vi.fn(),
    webdavSyncOnStartup: true,
    setWebdavSyncOnStartup: vi.fn(),
    webdavSyncOnSave: false,
    setWebdavSyncOnSave: vi.fn(),
    webdavIncrementalSync: true,
    setWebdavIncrementalSync: vi.fn(),
    webdavAutoSyncInterval: 0,
    setWebdavAutoSyncInterval: vi.fn(),
    webdavIncludeImages: true,
    setWebdavIncludeImages: vi.fn(),
    webdavEncryptionEnabled: false,
    setWebdavEncryptionEnabled: vi.fn(),
    webdavEncryptionPassword: "",
    setWebdavEncryptionPassword: vi.fn(),
    syncProvider: "manual",
    setSyncProvider: vi.fn(),
    selfHostedSyncEnabled: false,
    selfHostedSyncUrl: "",
    selfHostedSyncUsername: "",
    selfHostedSyncPassword: "",
    selfHostedSyncOnStartup: false,
    selfHostedSyncOnStartupDelay: 10,
    selfHostedAutoSyncInterval: 0,
    setSelfHostedSyncEnabled: vi.fn(),
    setSelfHostedSyncUrl: vi.fn(),
    setSelfHostedSyncUsername: vi.fn(),
    setSelfHostedSyncPassword: vi.fn(),
    setSelfHostedSyncOnStartup: vi.fn(),
    setSelfHostedSyncOnStartupDelay: vi.fn(),
    setSelfHostedAutoSyncInterval: vi.fn(),
    s3StorageEnabled: false,
    setS3StorageEnabled: vi.fn(),
    s3Endpoint: "",
    setS3Endpoint: vi.fn(),
    s3Region: "",
    setS3Region: vi.fn(),
    s3Bucket: "",
    setS3Bucket: vi.fn(),
    s3AccessKeyId: "",
    setS3AccessKeyId: vi.fn(),
    s3SecretAccessKey: "",
    setS3SecretAccessKey: vi.fn(),
    s3BackupPrefix: "",
    setS3BackupPrefix: vi.fn(),
    s3SyncOnStartup: false,
    setS3SyncOnStartup: vi.fn(),
    s3SyncOnStartupDelay: 10,
    setS3SyncOnStartupDelay: vi.fn(),
    s3AutoSyncInterval: 0,
    setS3AutoSyncInterval: vi.fn(),
    s3SyncOnSave: false,
    setS3SyncOnSave: vi.fn(),
    s3IncludeImages: true,
    setS3IncludeImages: vi.fn(),
    s3IncrementalSync: true,
    setS3IncrementalSync: vi.fn(),
    s3EncryptionEnabled: false,
    setS3EncryptionEnabled: vi.fn(),
    s3EncryptionPassword: "",
    setS3EncryptionPassword: vi.fn(),
  };
}

describe("DataSettings", { timeout: 60_000 }, () => {
  let originalCreateElement: typeof document.createElement;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    originalCreateElement = document.createElement.bind(document);
    useSkillStoreMock.mockResolvedValue({
      total: 0,
      blocked: 0,
      highRisk: 0,
      warn: 0,
    });

    installWindowMocks({
      api: {
        security: {
          status: vi.fn().mockResolvedValue({ configured: false }),
        },
      },
      electron: {
        getDataPathStatus: vi.fn().mockResolvedValue({
          configuredPath: "/next/data",
          currentPath: "/actual/data",
          needsRestart: true,
        }),
      },
    });

    useSettingsStoreMock.mockReturnValue(createSettingsState());
    useToastMock.mockReturnValue({ showToast: vi.fn() });
    vi.mocked(listUpgradeBackups).mockResolvedValue([]);
    vi.mocked(createUpgradeBackup).mockResolvedValue({
      created: true,
      skipped: false,
      backupId: "backup-1",
      backupPath: "/tmp/PromptHub/backups/backup-1",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (window as Window & { __PROMPTHUB_WEB__?: boolean })
      .__PROMPTHUB_WEB__;
  });

  it("imports a backup file through the import action with preview confirmation", async () => {
    const showToast = vi.fn();
    useToastMock.mockReturnValue({ showToast });
    vi.mocked(previewImportFile).mockResolvedValue({
      backup: {
        version: 1,
        exportedAt: "2026-04-17T00:00:00.000Z",
        prompts: [],
        folders: [],
        versions: [],
      },
      summary: {
        kind: "prompthub-backup",
        exportedAt: "2026-04-17T00:00:00.000Z",
        counts: {
          prompts: 0,
          folders: 0,
          versions: 0,
          outputFormatItems: 0,
          skills: 0,
          skillVersions: 0,
          skillFiles: 0,
          images: 0,
          videos: 0,
        },
        skipped: {
          folders: 0,
          prompts: 0,
          skillFiles: 0,
          skillVersions: 0,
          skills: 0,
          versions: 0,
        },
      },
    });
    vi.mocked(restoreFromFile).mockResolvedValue({
      folders: 0,
      prompts: 0,
      outputFormatItems: 0,
      skillFiles: 0,
      skillVersions: 0,
      skills: 0,
      versions: 0,
    });

    const input = {
      accept: "",
      click: vi.fn(),
      onchange: null as null | ((event: Event) => void | Promise<void>),
      type: "",
    };

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="backup" />, {
        language: "en",
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "input") {
          return input as unknown as HTMLInputElement;
        }
        return originalCreateElement(tagName);
      },
    );

    const importButton = screen.getByRole("button", { name: "Import Data" });
    expect(importButton).toHaveAttribute("aria-label", "Import Data");

    fireEvent.click(importButton);
    expect(input.type).toBe("file");
    expect(input.accept).toBe(".json,.phub,.gz,.zip");

    const file = { name: "prompthub-export.phub.gz" } as File;

    await act(async () => {
      await input.onchange?.({
        target: { files: [file] },
      } as unknown as Event);
    });

    expect(previewImportFile).toHaveBeenCalledWith(file);

    await waitFor(() => {
      expect(screen.getByText("Review import summary")).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Back up current data and import" }),
    );

    await waitFor(() => {
      expect(createUpgradeBackup).toHaveBeenCalled();
    });
    expect(restoreFromFile).toHaveBeenCalledWith(file);
    expect(showToast).toHaveBeenCalledWith(
      "Data imported successfully",
      "success",
    );
  });

  it("runs full backup export from the full backup button", async () => {
    const showToast = vi.fn();
    useToastMock.mockReturnValue({ showToast });

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="backup" />, {
        language: "zh",
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "全量备份" }));

    await waitFor(() => {
      expect(runFullExportBackup).toHaveBeenCalledWith({
        currentVersion: "0.4.5",
        recordManualBackup: true,
      });
    });
    expect(showToast).toHaveBeenCalledWith("数据导出成功", "success");
  });

  it("shows a friendly restore error message when import fails", async () => {
    const showToast = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    useToastMock.mockReturnValue({ showToast });
    vi.mocked(previewImportFile).mockRejectedValue(
      new Error(
        "Error invoking remote method 'folder:insertDirect': SQLite3Error: FOREIGN KEY constraint failed",
      ),
    );
    vi.mocked(restoreFromFile).mockRejectedValue(
      new Error(
        "Error invoking remote method 'folder:insertDirect': SQLite3Error: FOREIGN KEY constraint failed",
      ),
    );

    const input = {
      accept: "",
      click: vi.fn(),
      onchange: null as null | ((event: Event) => void | Promise<void>),
      type: "",
    };

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="backup" />, {
        language: "en",
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    vi.spyOn(document, "createElement").mockImplementation(
      (tagName: string) => {
        if (tagName === "input") {
          return input as unknown as HTMLInputElement;
        }
        return originalCreateElement(tagName);
      },
    );

    fireEvent.click(screen.getByRole("button", { name: "Import Data" }));

    await act(async () => {
      await input.onchange?.({
        target: { files: [{ name: "broken.phub.gz" }] },
      } as unknown as Event);
    });

    expect(showToast).toHaveBeenCalledWith(
      "Import failed: 备份中的文件夹或 Prompt 引用关系不完整，PromptHub 无法安全导入。建议重新导出一份新备份后再试。",
      "error",
    );
  });

  it("accepts dropping a backup file into the backup restore target", async () => {
    const beginImportFromFile = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();
    useToastMock.mockReturnValue({ showToast });

    await act(async () => {
      await renderWithI18n(
        <DataSettings
          activeSubsection="backup"
          backupImportController={{
            requestFileSelection: vi.fn(),
            beginImportFromFile,
          }}
        />,
        {
          language: "en",
        },
      );
    });

    const heading = screen.getByText("Drag to Restore Backup");
    const dropTarget = heading.closest(
      "div.rounded-xl",
    ) as HTMLDivElement | null;
    expect(dropTarget).not.toBeNull();

    const file = new File(["backup"], "prompthub-export.phub.gz", {
      type: "application/gzip",
    });

    fireEvent.dragEnter(dropTarget!, {
      dataTransfer: {
        items: [{ kind: "file", type: file.type }],
        files: [file],
      },
    });
    fireEvent.drop(dropTarget!, {
      dataTransfer: {
        items: [{ kind: "file", type: file.type }],
        files: [file],
      },
    });

    await waitFor(() => {
      expect(beginImportFromFile).toHaveBeenCalledWith(file);
    });
  });

  it("tests a self-hosted PromptHub connection from desktop settings", async () => {
    const showToast = vi.fn();
    useToastMock.mockReturnValue({ showToast });
    useSettingsStoreMock.mockReturnValue({
      ...createSettingsState(),
      selfHostedSyncEnabled: true,
      selfHostedSyncUrl: "https://backup.example.com",
      selfHostedSyncUsername: "owner",
      selfHostedSyncPassword: "secret",
    });
    vi.mocked(runSelfHostedConnectionCheck).mockResolvedValue({
      prompts: 3,
      folders: 2,
      rules: 4,
      skills: 1,
    });

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="selfHosted" />, {
        language: "en",
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(
      screen.getByRole("textbox", { name: "Self-Hosted PromptHub URL" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("textbox", { name: "Self-Hosted PromptHub Username" }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Test Connection" }));

    await waitFor(() => {
      expect(runSelfHostedConnectionCheck).toHaveBeenCalledWith({
        url: "https://backup.example.com",
        username: "owner",
        password: "secret",
      });
    });
    expect(showToast).toHaveBeenCalledWith(
      "Connection successful. Remote workspace currently stores 3 prompts, 2 folders, 4 rules, and 1 skills.",
      "success",
    );
  });

  it("lets users choose one active sync source while keeping multiple backup targets enabled", async () => {
    const settingsState = createSettingsState();
    settingsState.selfHostedSyncEnabled = true;
    settingsState.webdavEnabled = true;
    settingsState.s3StorageEnabled = true;
    settingsState.syncProvider = "manual";
    useSettingsStoreMock.mockReturnValue(settingsState);

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="selfHosted" />, {
        language: "en",
      });
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Current sync source" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "WebDAV" }));

    expect(settingsState.setSyncProvider).toHaveBeenCalledWith("webdav");
  });

  it("exposes sync cadence selects by their setting labels", async () => {
    const settingsState = createSettingsState();
    settingsState.selfHostedSyncEnabled = true;
    settingsState.webdavEnabled = true;
    settingsState.s3StorageEnabled = true;
    useSettingsStoreMock.mockReturnValue(settingsState);

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="selfHosted" />, {
        language: "en",
      });
    });

    expect(
      screen.getByRole("button", {
        name: "Self-Hosted PromptHub Automatic Sync",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "Self-Hosted PromptHub Run Once on Startup",
      }),
    ).toBeEnabled();

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="webdav" />, {
        language: "en",
      });
    });

    expect(
      screen.getByRole("button", { name: "WebDAV Auto Run" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "WebDAV Run Once on Startup" }),
    ).toBeEnabled();

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="s3" />, {
        language: "en",
      });
    });

    expect(
      screen.getByRole("button", {
        name: "S3 Compatible Storage Auto Run",
      }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", {
        name: "S3 Compatible Storage Run Once on Startup",
      }),
    ).toBeEnabled();
  });

  it("shows inactive sync-source guidance when a backup target is enabled but not selected", async () => {
    const settingsState = createSettingsState();
    settingsState.webdavEnabled = true;
    settingsState.syncProvider = "s3";
    useSettingsStoreMock.mockReturnValue(settingsState);

    await act(async () => {
      await renderWithI18n(<DataSettings activeSubsection="webdav" />, {
        language: "en",
      });
    });

    expect(
      screen.getByText(
        "This target stays available for manual backup and restore, but automatic sync only runs for the current sync source.",
      ),
    ).toBeInTheDocument();
  });
});
