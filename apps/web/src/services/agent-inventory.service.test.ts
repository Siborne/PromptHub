import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "@prompthub/shared/types";
import { SKILL_PLATFORMS } from "@prompthub/shared/constants/platforms";
import { AgentInventoryService } from "./agent-inventory.service.js";

function largeSettings() {
  return {
    ...DEFAULT_SETTINGS,
    customAgents: Array.from({ length: 32 }, (_, index) => ({
      id: `agent_${index}`,
      name: `Agent ${index}`,
      rootPath: `/srv/agents/agent-${index}`,
    })),
  };
}

describe("AgentInventoryService", () => {
  it("keeps inventory bounded, cached, and advertises server service adapters", async () => {
    const probe = vi.fn(async () => true);
    const service = new AgentInventoryService(probe);
    const startedAt = performance.now();

    const first = await service.list(largeSettings(), true);
    const firstDuration = performance.now() - startedAt;
    const firstProbeCount = probe.mock.calls.length;
    const cachedStartedAt = performance.now();
    const second = await service.list(largeSettings(), true);
    const cachedDuration = performance.now() - cachedStartedAt;

    expect(firstDuration).toBeLessThan(1_000);
    expect(cachedDuration).toBeLessThan(250);
    expect(first.agents).toHaveLength(second.agents.length);
    expect(first.agents).toHaveLength(SKILL_PLATFORMS.length + 32);
    expect(firstProbeCount).toBe(first.agents.length);
    expect(probe).toHaveBeenCalledTimes(firstProbeCount);
    expect(first.agents.every((agent) => !agent.launchable)).toBe(true);
    expect(
      first.agents.every(
        (agent) => agent.capabilities.sessions.status === "partial",
      ),
    ).toBe(true);
    expect(first.capabilities).toMatchObject({
      configFiles: true,
      providers: true,
      sessions: true,
      maintenance: true,
    });
  });

  it("never probes server paths for logical-only users", async () => {
    const probe = vi.fn(async () => true);
    const result = await new AgentInventoryService(probe).list(
      largeSettings(),
      false,
    );

    expect(result.target).toBe("logical-only");
    expect(result.capabilities.hostDetection).toBe(false);
    expect(result.agents.every((agent) => !agent.isDetected)).toBe(true);
    expect(probe).not.toHaveBeenCalled();
  });

  it("uses safe defaults for malformed legacy Agent collections", async () => {
    const probe = vi.fn(async () => false);
    const settings = {
      ...DEFAULT_SETTINGS,
      builtinAgentOverrides: undefined,
      customAgents: null,
      disabledPlatformIds: null,
    } as unknown as typeof DEFAULT_SETTINGS;

    const result = await new AgentInventoryService(probe).list(settings, true);

    expect(result.agents).toHaveLength(SKILL_PLATFORMS.length);
  });

  it("evicts old path results when the cache reaches its fixed bound", async () => {
    const probe = vi.fn(async () => true);
    const service = new AgentInventoryService(probe);

    for (let batch = 0; batch < 8; batch += 1) {
      const settings = largeSettings();
      settings.customAgents = settings.customAgents.map((agent) => ({
        ...agent,
        rootPath: `${agent.rootPath}-batch-${batch}`,
      }));
      await service.list(settings, true);
    }

    expect(probe.mock.calls.length).toBeGreaterThan(256);
  });
});
