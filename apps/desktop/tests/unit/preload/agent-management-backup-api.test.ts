import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("Agent management backup preload API", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("routes portable export and restore through fixed IPC channels", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
    const backup = {
      version: 1 as const,
      providerProfiles: [],
      snapshots: [],
    };

    await agentApi.exportManagementBackup();
    await agentApi.restoreManagementBackup(backup);

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_EXPORT,
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.AGENT_MANAGEMENT_BACKUP_RESTORE,
      backup,
    );
  });
});
