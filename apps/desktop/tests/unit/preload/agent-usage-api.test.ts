import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("Agent usage preload API", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("forwards only the typed refresh option through the usage channel", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);

    await agentApi.getUsage("codex", { forceRefresh: true });

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_USAGE_GET,
      "codex",
      { forceRefresh: true },
    );
  });
});
