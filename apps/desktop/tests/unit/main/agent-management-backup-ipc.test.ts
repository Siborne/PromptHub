import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: { handle: handleMock },
}));

type Handler = (...args: unknown[]) => Promise<unknown>;

async function setup() {
  vi.resetModules();
  handleMock.mockReset();
  const [{ registerAgentManagementBackupIPC }, { IPC_CHANNELS }] =
    await Promise.all([
      import("../../../src/main/ipc/agent-management-backup.ipc"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
  const service = {
    exportBackup: vi.fn(async () => ({
      version: 1 as const,
      providerProfiles: [],
      snapshots: [],
    })),
    restoreBackup: vi.fn(async () => ({
      profileCount: 0,
      snapshotCount: 0,
      availableSecretProfileIds: [],
      missingSecretProfileIds: [],
      restoredSessionPreferenceCount: 0,
      unresolvedSessionPreferenceKeys: [],
    })),
  };
  registerAgentManagementBackupIPC(service);
  return {
    IPC_CHANNELS,
    service,
    handlers: Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>,
  };
}

describe("Agent management backup IPC", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("registers the export and restore boundary", async () => {
    const { handlers, IPC_CHANNELS, service } = await setup();
    const backup = {
      version: 1 as const,
      providerProfiles: [],
      snapshots: [],
    };

    await expect(
      handlers[IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_EXPORT]({}),
    ).resolves.toEqual(backup);
    await expect(
      handlers[IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_RESTORE]({}, backup),
    ).resolves.toMatchObject({ profileCount: 0 });
    expect(service.exportBackup).toHaveBeenCalledTimes(1);
    expect(service.restoreBackup).toHaveBeenCalledWith(backup);
  });

  it("returns stable errors without leaking backup contents", async () => {
    const { handlers, IPC_CHANNELS, service } = await setup();
    service.restoreBackup.mockRejectedValueOnce(
      new Error("literal-api-key-from-invalid-payload"),
    );

    await expect(
      handlers[IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_RESTORE](
        {},
        { apiKey: "literal-api-key-from-invalid-payload" },
      ),
    ).rejects.toThrow("AGENT_MANAGEMENT_BACKUP_OPERATION_FAILED");
  });

  it("preserves only allowlisted validation errors on both operations", async () => {
    const { handlers, IPC_CHANNELS, service } = await setup();
    service.exportBackup.mockRejectedValueOnce(new Error("filesystem detail"));
    service.restoreBackup.mockRejectedValueOnce(
      new Error("AGENT_MANAGEMENT_BACKUP_INVALID"),
    );

    await expect(
      handlers[IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_EXPORT]({}),
    ).rejects.toThrow("AGENT_MANAGEMENT_BACKUP_OPERATION_FAILED");
    await expect(
      handlers[IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_RESTORE]({}, {}),
    ).rejects.toThrow("AGENT_MANAGEMENT_BACKUP_INVALID");
  });
});
