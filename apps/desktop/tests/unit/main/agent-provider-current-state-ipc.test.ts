import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: { handle: handleMock },
}));

type Handler = (...args: unknown[]) => Promise<unknown>;

describe("Agent Provider current-state IPC", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    handleMock.mockReset();
  });

  it("validates the platform id and returns only the public projection", async () => {
    const [{ registerAgentProviderCurrentStateIPC }, { IPC_CHANNELS }] =
      await Promise.all([
        import("../../../src/main/ipc/agent-provider-current-state.ipc"),
        import("@prompthub/shared/constants/ipc-channels"),
      ]);
    const getCurrentState = vi.fn().mockResolvedValue({
      platformId: "claude",
      status: "verified",
      currentProfileId: "profile-1",
      checkedAt: 1_700_000_000_000,
    });
    registerAgentProviderCurrentStateIPC({ getCurrentState });
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>;

    await expect(
      handlers[IPC_CHANNELS.AGENT_PROVIDER_CURRENT_STATE](null, " claude "),
    ).resolves.toEqual({
      platformId: "claude",
      status: "verified",
      currentProfileId: "profile-1",
      checkedAt: 1_700_000_000_000,
    });
    expect(getCurrentState).toHaveBeenCalledWith("claude");
    expect(JSON.stringify(handleMock.mock.calls)).not.toContain("digest");

    await expect(
      handlers[IPC_CHANNELS.AGENT_PROVIDER_CURRENT_STATE](null, ""),
    ).rejects.toThrow("AGENT_PROVIDER_REQUEST_INVALID");
    await expect(
      handlers[IPC_CHANNELS.AGENT_PROVIDER_CURRENT_STATE](null, {
        agentId: "claude",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_REQUEST_INVALID");
  });

  it("redacts native failures behind a stable error", async () => {
    const [{ registerAgentProviderCurrentStateIPC }, { IPC_CHANNELS }] =
      await Promise.all([
        import("../../../src/main/ipc/agent-provider-current-state.ipc"),
        import("@prompthub/shared/constants/ipc-channels"),
      ]);
    registerAgentProviderCurrentStateIPC({
      getCurrentState: vi
        .fn()
        .mockRejectedValue(new Error("/private/path token=secret")),
    });
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>;

    await expect(
      handlers[IPC_CHANNELS.AGENT_PROVIDER_CURRENT_STATE](null, "claude"),
    ).rejects.toThrow("AGENT_PROVIDER_OPERATION_FAILED");
  });
});
