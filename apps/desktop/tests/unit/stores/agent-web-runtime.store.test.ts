import { beforeEach, describe, expect, it, vi } from "vitest";

const webAgent = {
  id: "custom:server-agent",
  name: "Server Agent",
  icon: "Bot",
  isCustom: true,
  isConfigured: true,
  isDetected: true,
  isPinned: false,
  launchable: false,
  status: "installed" as const,
  paths: {
    root: "/srv/agents/server-agent",
    skills: "/srv/agents/server-agent/skills",
    configFiles: [],
    configFileRelativePaths: [],
  },
  capabilities: {
    overview: { status: "supported" as const },
    provider: { status: "unsupported" as const },
    appearance: { status: "unsupported" as const },
    assets: { status: "unsupported" as const },
    configFiles: { status: "unsupported" as const },
    sessions: { status: "unsupported" as const },
    usage: { status: "unsupported" as const },
    maintenance: { status: "unsupported" as const },
  },
};

describe("Web Agent store", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    Reflect.set(window, "__PROMPTHUB_WEB__", true);
  });

  it("loads server inventory without Desktop platform discovery", async () => {
    const listManaged = vi.fn().mockResolvedValue({
      target: "server-host",
      agents: [webAgent],
      capabilities: {
        inventory: true,
        settings: true,
        hostDetection: true,
        filesystemMutation: false,
        configFiles: false,
        providers: false,
        sessions: false,
        launch: false,
        maintenance: false,
      },
    });
    const getSupportedPlatforms = vi.fn();
    const detectPlatforms = vi.fn();
    Reflect.set(window, "api", {
      agent: { listManaged },
      skill: { getSupportedPlatforms, detectPlatforms },
    });

    const { useAgentStore } = await import(
      "../../../src/renderer/stores/agent.store"
    );
    await useAgentStore.getState().refresh();

    expect(listManaged).toHaveBeenCalledTimes(1);
    expect(getSupportedPlatforms).not.toHaveBeenCalled();
    expect(detectPlatforms).not.toHaveBeenCalled();
    expect(useAgentStore.getState()).toMatchObject({
      agents: [webAgent],
      selectedAgentId: webAgent.id,
      error: null,
    });
  });
});
