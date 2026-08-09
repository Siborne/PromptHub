import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();

vi.mock("electron", () => ({ ipcMain: { handle: handleMock } }));

describe("Agent Provider source IPC", () => {
  beforeEach(() => {
    vi.resetModules();
    handleMock.mockReset();
  });

  it("registers redacted list and explicit import handlers", async () => {
    const [{ registerAgentProviderSourceIPC }, { IPC_CHANNELS }] =
      await Promise.all([
        import("../../../src/main/ipc/agent-provider-source.ipc"),
        import("@prompthub/shared/constants/ipc-channels"),
      ]);
    const service = {
      list: vi.fn(() => []),
      importSource: vi.fn(async () => ({ id: "profile-1" })),
      importPiSource: vi.fn(async () => ({ backupPath: null })),
      ensureOfficial: vi.fn(async () => ({ id: "official-1" })),
    };
    registerAgentProviderSourceIPC(service);
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    );
    const request = {
      platformId: "codex",
      sourceId: "provider-work",
      modelId: "model-work",
    };

    await handlers[IPC_CHANNELS.AGENT_PROVIDER_SOURCES_LIST](null, "codex");
    await handlers[IPC_CHANNELS.AGENT_PROVIDER_SOURCE_IMPORT](null, request);
    await handlers[IPC_CHANNELS.AGENT_PI_PROVIDER_SOURCE_IMPORT](null, {
      ...request,
      platformId: "pi",
    });
    await handlers[IPC_CHANNELS.AGENT_PROVIDER_OFFICIAL_ENSURE](null, "codex");

    expect(service.list).toHaveBeenCalledWith("codex");
    expect(service.importSource).toHaveBeenCalledWith(request);
    expect(service.importPiSource).toHaveBeenCalledWith({
      ...request,
      platformId: "pi",
    });
    expect(service.ensureOfficial).toHaveBeenCalledWith("codex");
  });

  it("preserves stable errors and redacts unexpected source failures", async () => {
    const [{ registerAgentProviderSourceIPC }, { IPC_CHANNELS }] =
      await Promise.all([
        import("../../../src/main/ipc/agent-provider-source.ipc"),
        import("@prompthub/shared/constants/ipc-channels"),
      ]);
    const service = {
      list: vi.fn(() => {
        throw new Error("path=/private token=source-secret");
      }),
      importSource: vi.fn(async () => {
        throw new Error("AGENT_PROVIDER_SOURCE_NOT_FOUND");
      }),
      importPiSource: vi.fn(async () => {
        throw new Error("AGENT_PROVIDER_SOURCE_MODEL_NOT_FOUND");
      }),
      ensureOfficial: vi.fn(async () => {
        throw new Error("AGENT_PROVIDER_OFFICIAL_RESTORE_UNSUPPORTED");
      }),
    };
    registerAgentProviderSourceIPC(service);
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    );

    await expect(
      handlers[IPC_CHANNELS.AGENT_PROVIDER_SOURCES_LIST](null, "codex"),
    ).rejects.toThrow("AGENT_PROVIDER_SOURCE_OPERATION_FAILED");
    await expect(
      handlers[IPC_CHANNELS.AGENT_PROVIDER_SOURCE_IMPORT](null, {}),
    ).rejects.toThrow("AGENT_PROVIDER_SOURCE_NOT_FOUND");
    await expect(
      handlers[IPC_CHANNELS.AGENT_PI_PROVIDER_SOURCE_IMPORT](null, {}),
    ).rejects.toThrow("AGENT_PROVIDER_SOURCE_MODEL_NOT_FOUND");
    await expect(
      handlers[IPC_CHANNELS.AGENT_PROVIDER_OFFICIAL_ENSURE](null, "opencode"),
    ).rejects.toThrow("AGENT_PROVIDER_OFFICIAL_RESTORE_UNSUPPORTED");
  });
});
