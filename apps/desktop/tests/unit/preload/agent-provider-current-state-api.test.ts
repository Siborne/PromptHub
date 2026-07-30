import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("agent provider current-state preload API", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("routes the platform id through the fixed IPC channel", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);

    await agentApi.getProviderCurrentState("claude");

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_PROVIDER_CURRENT_STATE,
      "claude",
    );
  });
});
