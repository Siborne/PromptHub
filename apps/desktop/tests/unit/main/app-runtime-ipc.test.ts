/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const getCacheSizeMock = vi.fn();
const clearCacheMock = vi.fn();
let userDataPath = "";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) =>
      name === "userData" ? userDataPath : "/tmp/app-data",
    ),
  },
  ipcMain: {
    handle: handleMock,
  },
  session: {
    defaultSession: {
      getCacheSize: getCacheSizeMock,
      clearCache: clearCacheMock,
    },
  },
}));

vi.mock("../../../src/main/runtime-paths", () => ({
  getDataDir: () => path.join(userDataPath, "data"),
  getDatabasePath: () => path.join(userDataPath, "data", "prompthub.db"),
  getPromptsWorkspaceDir: () => path.join(userDataPath, "data", "prompts"),
  getRulesDir: () => path.join(userDataPath, "data", "rules"),
  getSkillsDir: () => path.join(userDataPath, "data", "skills"),
}));

type RegisteredHandler = (...args: unknown[]) => unknown;

async function setupHandlers(): Promise<Record<string, RegisteredHandler>> {
  vi.resetModules();
  handleMock.mockReset();
  const { registerAppRuntimeIPC } =
    await import("../../../src/main/ipc/app-runtime.ipc");
  registerAppRuntimeIPC();
  return Object.fromEntries(
    handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
  ) as Record<string, RegisteredHandler>;
}

describe("app runtime IPC", () => {
  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-runtime-"));
    getCacheSizeMock.mockReset().mockResolvedValue(321);
    clearCacheMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    fs.rmSync(userDataPath, { recursive: true, force: true });
  });

  it("returns cache results and clears the Electron session cache", async () => {
    const handlers = await setupHandlers();
    const { IPC_CHANNELS } =
      await import("@prompthub/shared/constants/ipc-channels");

    await expect(
      handlers[IPC_CHANNELS.APP_GET_CACHE_SIZE](null),
    ).resolves.toEqual({ size: 321 });
    await expect(handlers[IPC_CHANNELS.APP_CLEAR_CACHE](null)).resolves.toEqual(
      { success: true },
    );
    expect(clearCacheMock).toHaveBeenCalledTimes(1);
  });

  it("reports runtime paths from the configured user data root", async () => {
    const handlers = await setupHandlers();
    const { IPC_CHANNELS } =
      await import("@prompthub/shared/constants/ipc-channels");

    await expect(
      handlers[IPC_CHANNELS.APP_GET_RUNTIME_PATHS](null),
    ).resolves.toMatchObject({
      userDataPath,
      dataDir: path.join(userDataPath, "data"),
      databasePath: path.join(userDataPath, "data", "prompthub.db"),
      mcpDir: path.join(userDataPath, "data", "mcp"),
      backupsDir: path.join(userDataPath, "backups"),
      logsDir: path.join(userDataPath, "logs"),
    });
  });

  it("rejects malformed sync log entries without writing a file", async () => {
    const handlers = await setupHandlers();
    const { IPC_CHANNELS } =
      await import("@prompthub/shared/constants/ipc-channels");

    await expect(
      handlers[IPC_CHANNELS.APP_APPEND_AUTO_SYNC_LOG](null, {
        provider: "unknown",
      }),
    ).resolves.toEqual({
      success: false,
      error: "Invalid automatic sync log entry",
    });
    expect(fs.existsSync(path.join(userDataPath, "logs"))).toBe(false);
  });

  it("writes a validated entry while scrubbing URLs and email addresses", async () => {
    const handlers = await setupHandlers();
    const { IPC_CHANNELS } =
      await import("@prompthub/shared/constants/ipc-channels");

    const result = await handlers[IPC_CHANNELS.APP_APPEND_AUTO_SYNC_LOG](null, {
      id: "sync-1",
      provider: "webdav",
      reason: "startup",
      status: "failed",
      startedAt: "2026-07-11T00:00:00.000Z",
      finishedAt: "2026-07-11T00:00:01.000Z",
      message: "https://example.com/private user@example.com  failed",
      localChanged: false,
    });

    const logPath = path.join(userDataPath, "logs", "auto-sync.jsonl");
    expect(result).toEqual({ success: true, path: logPath });
    const record = JSON.parse(fs.readFileSync(logPath, "utf8").trim());
    expect(record).toMatchObject({
      id: "sync-1",
      provider: "webdav",
      reason: "startup",
      status: "failed",
      message: "[url] [email] failed",
      localChanged: false,
    });
  });
});
