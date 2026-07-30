import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("Agent CLI preload API", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("exposes only ids for diagnostics and lifecycle operations", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);

    agentApi.diagnoseCli("codex");
    agentApi.planCliUpdate("opencode");
    agentApi.applyCliUpdate("plan-1");

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_CLI_DIAGNOSE,
      "codex",
    );
    expect(invokeMock).not.toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_CLI_DIAGNOSE,
      expect.objectContaining({ command: expect.anything() }),
    );
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_CLI_UPDATE_PLAN,
      "opencode",
    );
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_CLI_UPDATE_APPLY,
      "plan-1",
    );
    expect(invokeMock).not.toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_CLI_UPDATE_APPLY,
      expect.objectContaining({ args: expect.anything() }),
    );
  });
});
