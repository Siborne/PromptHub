import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("Agent Provider test preload API", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("routes connection tests through the fixed typed IPC channel", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
    const request = { agentId: "claude", profileId: "profile-1" };

    await agentApi.testProviderConnection(request);

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_PROVIDER_TEST_CONNECTION,
      request,
    );
  });

  it("routes current-native tests without inventing a persisted profile id", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);

    await agentApi.testCurrentProviderConnection({ agentId: "codex" });
    await agentApi.testCurrentProviderModel({
      agentId: "codex",
      requestId: "native-request-1234",
    });

    expect(invokeMock).toHaveBeenNthCalledWith(
      1,
      IPC_CHANNELS.AGENT_PROVIDER_TEST_CURRENT_CONNECTION,
      { agentId: "codex" },
    );
    expect(invokeMock).toHaveBeenNthCalledWith(
      2,
      IPC_CHANNELS.AGENT_PROVIDER_TEST_CURRENT_MODEL,
      { agentId: "codex", requestId: "native-request-1234" },
    );
  });

  it("routes cancellable model tests without reshaping their identity", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
    const request = {
      agentId: "claude",
      profileId: "profile-1",
      requestId: "request-1234",
    };

    await agentApi.testProviderModel(request);

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_PROVIDER_TEST_MODEL,
      request,
    );
  });

  it("routes model-test cancellation by request id only", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
    const request = { requestId: "request-1234" };

    await agentApi.cancelProviderModelTest(request);

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_PROVIDER_CANCEL_MODEL_TEST,
      request,
    );
  });
});
