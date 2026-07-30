import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("Agent definition preload API", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("passes only typed definition requests to main", async () => {
    const [{ agentApi }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/preload/api/agent"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
    const listRequest = {
      agentId: "qwen" as const,
      scope: "project" as const,
      projectId: "project-1",
    };
    const openRequest = {
      ...listRequest,
      kind: "command" as const,
      relativePath: "review/frontend.md",
    };

    agentApi.listDefinitions(listRequest);
    agentApi.openDefinition(openRequest);

    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_DEFINITIONS_LIST,
      listRequest,
    );
    expect(invokeMock).toHaveBeenCalledWith(
      IPC_CHANNELS.AGENT_DEFINITION_OPEN,
      openRequest,
    );
  });
});
