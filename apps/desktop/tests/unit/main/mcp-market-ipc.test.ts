/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  fetchRemoteContent: vi.fn(),
  handle: vi.fn(),
  readSources: vi.fn(),
  replaceSources: vi.fn(),
}));

vi.mock("electron", () => ({
  ipcMain: { handle: mocks.handle },
}));

vi.mock("@prompthub/core/mcp-market-source-registry", () => ({
  authorizeMcpMarketFetch: mocks.authorize,
  readRegisteredMcpMarketSources: mocks.readSources,
  replaceCustomMcpMarketSources: mocks.replaceSources,
}));

vi.mock("../../../src/main/services/skill-installer", () => ({
  SkillInstaller: { fetchRemoteContent: mocks.fetchRemoteContent },
}));

type IpcHandler = (...args: unknown[]) => Promise<unknown>;

async function setupHandlers(): Promise<Record<string, IpcHandler>> {
  const [{ registerMcpIPC }, { IPC_CHANNELS }] = await Promise.all([
    import("../../../src/main/ipc/mcp.ipc"),
    import("@prompthub/shared/constants/ipc-channels"),
  ]);
  registerMcpIPC({} as never);
  return Object.fromEntries(
    mocks.handle.mock.calls.map(([channel, handler]) => [channel, handler]),
  ) as Record<string, IpcHandler> & { IPC_CHANNELS?: typeof IPC_CHANNELS };
}

describe("MCP market IPC", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("fetches only through the main-process registered-source authorization", async () => {
    mocks.authorize.mockReturnValue({
      source: {
        id: "lan-catalog",
        label: "LAN Catalog",
        url: "http://192.168.1.20/mcp/catalog.json",
        trustLevel: "community",
      },
      url: "http://192.168.1.20/mcp/catalog.json?q=git",
      allowPrivateNetwork: true,
      allowInsecurePrivateNetworkHttp: true,
    });
    mocks.fetchRemoteContent.mockResolvedValue('{"servers":[]}');
    const handlers = await setupHandlers();
    const { IPC_CHANNELS } =
      await import("@prompthub/shared/constants/ipc-channels");

    await expect(
      handlers[IPC_CHANNELS.MCP_FETCH_REMOTE_CONTENT](null, {
        sourceId: "lan-catalog",
        url: "http://192.168.1.20/mcp/catalog.json?q=git",
      }),
    ).resolves.toBe('{"servers":[]}');

    expect(mocks.authorize).toHaveBeenCalledWith(
      "lan-catalog",
      "http://192.168.1.20/mcp/catalog.json?q=git",
    );
    expect(mocks.fetchRemoteContent).toHaveBeenCalledWith(
      "http://192.168.1.20/mcp/catalog.json?q=git",
      {
        allowPrivateNetwork: true,
        allowInsecurePrivateNetworkHttp: true,
      },
    );
  });

  it("rejects malformed fetch requests before authorization", async () => {
    const handlers = await setupHandlers();
    const { IPC_CHANNELS } =
      await import("@prompthub/shared/constants/ipc-channels");

    await expect(
      handlers[IPC_CHANNELS.MCP_FETCH_REMOTE_CONTENT](null, {
        sourceId: "lan-catalog",
        url: "",
      }),
    ).rejects.toThrow(/non-empty url/i);
    expect(mocks.authorize).not.toHaveBeenCalled();
    expect(mocks.fetchRemoteContent).not.toHaveBeenCalled();
  });
});
