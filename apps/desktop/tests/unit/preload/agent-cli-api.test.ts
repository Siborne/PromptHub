import { beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.fn();

vi.mock("electron", () => ({
  ipcRenderer: {
    invoke: invokeMock,
    on: vi.fn(),
    removeListener: vi.fn(),
  },
}));

describe("Agent CLI internal boundary", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("does not expose CLI diagnostics or lifecycle commands to the renderer", async () => {
    const { agentApi } = await import("../../../src/preload/api/agent");

    expect(agentApi).not.toHaveProperty("diagnoseCli");
    expect(agentApi).not.toHaveProperty("planCliUpdate");
    expect(agentApi).not.toHaveProperty("applyCliUpdate");
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
