import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  on: vi.fn(),
  removeListener: vi.fn(),
}));

vi.mock("electron", () => ({ ipcRenderer: mocks }));

import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import { agentApi } from "../../../src/preload/api/agent";

describe("Agent Provider source preload API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("forwards source listing and explicit import through fixed channels", async () => {
    const request = {
      platformId: "codex",
      sourceId: "provider-work",
      modelId: "model-work",
    };

    await agentApi.listProviderSources("codex");
    await agentApi.importProviderSource(request);
    await agentApi.importPiProviderSource({ ...request, platformId: "pi" });
    await agentApi.importCurrentPiProvider({ agentId: "pi" });
    await agentApi.ensureOfficialProviderProfile("codex");

    expect(mocks.invoke.mock.calls).toEqual([
      [IPC_CHANNELS.AGENT_PROVIDER_SOURCES_LIST, "codex"],
      [IPC_CHANNELS.AGENT_PROVIDER_SOURCE_IMPORT, request],
      [
        IPC_CHANNELS.AGENT_PI_PROVIDER_SOURCE_IMPORT,
        { ...request, platformId: "pi" },
      ],
      [IPC_CHANNELS.AGENT_PI_PROVIDER_IMPORT_CURRENT, { agentId: "pi" }],
      [IPC_CHANNELS.AGENT_PROVIDER_OFFICIAL_ENSURE, "codex"],
    ]);
  });
});
