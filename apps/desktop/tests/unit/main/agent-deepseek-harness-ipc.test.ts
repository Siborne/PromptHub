import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();

vi.mock("electron", () => ({ ipcMain: { handle: handleMock } }));

describe("DeepSeek Harness IPC", () => {
  beforeEach(() => {
    vi.resetModules();
    handleMock.mockReset();
  });

  it("registers profile reads and strictly validated plugin mutations", async () => {
    const [{ registerAgentDeepSeekHarnessIPC }, { IPC_CHANNELS }] =
      await Promise.all([
        import("../../../src/main/ipc/agent-deepseek-harness.ipc"),
        import("@prompthub/shared/constants/ipc-channels"),
      ]);
    const service = {
      listProfiles: vi.fn(async () => ({
        agentId: "deepseek-harness" as const,
        cliAvailable: true,
        profiles: [],
      })),
      readProfile: vi.fn(async () => ({ name: "web" })),
      mutatePlugin: vi.fn(async () => ({
        success: false as const,
        errorCode: "command-failed" as const,
      })),
    };
    registerAgentDeepSeekHarnessIPC(service as never);
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    );
    const request = {
      agentId: "deepseek-harness",
      operation: "install",
      profileName: "web",
      packageSpec: "@demo/search@latest",
      acknowledgeLifecycleScripts: true,
    };

    await handlers[IPC_CHANNELS.AGENT_HARNESS_PROFILES_LIST]();
    await handlers[IPC_CHANNELS.AGENT_HARNESS_PROFILE_READ](null, "web");
    await handlers[IPC_CHANNELS.AGENT_HARNESS_PLUGIN_MUTATE](null, request);

    expect(service.listProfiles).toHaveBeenCalledOnce();
    expect(service.readProfile).toHaveBeenCalledWith("web");
    expect(service.mutatePlugin).toHaveBeenCalledWith(request);
  });

  it("rejects extra fields and operation-specific package fields", async () => {
    const [{ registerAgentDeepSeekHarnessIPC }, { IPC_CHANNELS }] =
      await Promise.all([
        import("../../../src/main/ipc/agent-deepseek-harness.ipc"),
        import("@prompthub/shared/constants/ipc-channels"),
      ]);
    const service = {
      listProfiles: vi.fn(),
      readProfile: vi.fn(),
      mutatePlugin: vi.fn(),
    };
    registerAgentDeepSeekHarnessIPC(service as never);
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    );
    const mutate = handlers[IPC_CHANNELS.AGENT_HARNESS_PLUGIN_MUTATE];

    await expect(
      mutate(null, {
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "@demo/search",
        packageName: "unexpected",
        acknowledgeLifecycleScripts: true,
      }),
    ).rejects.toThrow("AGENT_HARNESS_REQUEST_INVALID");
    await expect(
      mutate(null, {
        agentId: "deepseek-harness",
        operation: "remove",
        profileName: "web",
        packageName: "@demo/search",
        acknowledgeLifecycleScripts: true,
        extra: true,
      }),
    ).rejects.toThrow("AGENT_HARNESS_REQUEST_INVALID");
    await expect(
      handlers[IPC_CHANNELS.AGENT_HARNESS_PROFILE_READ](null, {}),
    ).rejects.toThrow("AGENT_HARNESS_REQUEST_INVALID");
    expect(service.mutatePlugin).not.toHaveBeenCalled();
  });
});
