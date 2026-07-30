import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const getSupportedPlatformsMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
}));

vi.mock("../../../src/main/services/skill-installer", () => ({
  SkillInstaller: {
    getSupportedPlatforms: getSupportedPlatformsMock,
  },
}));

type Handler = (
  event: { sender: { id: number } },
  input: unknown,
) => Promise<unknown>;

describe("Agent CLI lifecycle IPC", () => {
  beforeEach(() => {
    handleMock.mockReset();
    getSupportedPlatformsMock.mockReset();
    getSupportedPlatformsMock.mockReturnValue([
      {
        id: "opencode",
        name: "OpenCode",
        cli: {
          executableCandidates: ["opencode"],
          versionArgs: ["--version"],
          evidence: "official-opencode-cli",
          update: {
            args: ["upgrade"],
            rollbackTargetPrefix: "v",
            evidence: "official-opencode-cli-upgrade",
          },
        },
      },
    ]);
  });

  it("accepts only ids and binds plan/application to the sender", async () => {
    const planUpdate = vi.fn().mockResolvedValue({ id: "plan-1" });
    const applyUpdate = vi.fn().mockResolvedValue({ status: "applied" });
    const [{ registerAgentCliLifecycleIPC }, { IPC_CHANNELS }] =
      await Promise.all([
        import("../../../src/main/ipc/agent-cli-lifecycle.ipc"),
        import("@prompthub/shared/constants/ipc-channels"),
      ]);
    registerAgentCliLifecycleIPC({ planUpdate, applyUpdate });
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>;
    const event = { sender: { id: 42 } };

    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_UPDATE_PLAN](event, "opencode"),
    ).resolves.toEqual({ id: "plan-1" });
    expect(planUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "opencode" }),
      42,
    );

    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_UPDATE_APPLY](event, "plan-1"),
    ).resolves.toEqual({ status: "applied" });
    expect(applyUpdate).toHaveBeenCalledWith("plan-1", 42);

    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_UPDATE_PLAN](event, {
        agentId: "opencode",
        command: "rm -rf /",
      }),
    ).rejects.toThrow("non-empty agentId");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_UPDATE_APPLY](event, ""),
    ).rejects.toThrow("non-empty planId");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_UPDATE_PLAN](event, "missing"),
    ).rejects.toThrow("Unknown Agent platform");
  });
});
