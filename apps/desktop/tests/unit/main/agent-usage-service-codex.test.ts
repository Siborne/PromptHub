import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AgentUsageQuota } from "@prompthub/shared/types";
import type { NativeCommandRunner } from "../../../src/main/services/native-command";
import { createAgentUsageService } from "../../../src/main/services/agent-usage-service";

const TOKEN = "codex-oauth-access-token-for-tests";
const CODEX_ROOT = "/Users/tester/.codex";
const INITIAL_CLOCK = 1_800_000_000_000;
const ENDPOINT = "https://chatgpt.com/backend-api/wham/usage";

interface Harness {
  service: ReturnType<typeof createAgentUsageService>;
  fetchImpl: ReturnType<typeof vi.fn>;
  readFile: ReturnType<typeof vi.fn>;
  setAuthJson: (raw: string | null) => void;
  setConfigToml: (raw: string | null) => void;
  setClock: (value: number) => void;
}

function authPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tokens: {
      access_token: TOKEN,
      account_id: "acct-123",
      ...overrides,
    },
  });
}

function windowPayload(
  usedPercent: number,
  resetAt: number,
  windowSeconds: number,
) {
  return {
    used_percent: usedPercent,
    reset_at: resetAt,
    limit_window_seconds: windowSeconds,
  };
}

function usagePayload(overrides: Record<string, unknown> = {}) {
  return {
    plan_type: "plus",
    rate_limit: {
      primary_window: windowPayload(25, 1_800_003_600, 18_000),
      secondary_window: windowPayload(60, 1_800_604_800, 604_800),
    },
    ...overrides,
  };
}

// The fetch mock only needs the Response surface the service consumes;
// the cast keeps the fixture minimal without pulling in a full Response.
function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function createHarness(): Harness {
  let clock = INITIAL_CLOCK;
  let authJson: string | null = authPayload();
  let configToml: string | null = null;
  const runnerResolve = vi.fn().mockResolvedValue("/usr/bin/security");
  const runnerRun = vi.fn();
  const fetchImpl = vi.fn();
  const commandRunner: NativeCommandRunner = {
    resolve: runnerResolve,
    run: runnerRun,
  };
  const readFile = vi.fn(async (filePath: string): Promise<string> => {
    if (filePath === path.join(CODEX_ROOT, "config.toml")) {
      if (configToml === null) throw new Error("ENOENT");
      return configToml;
    }
    if (filePath === path.join(CODEX_ROOT, "auth.json")) {
      if (authJson === null) throw new Error("ENOENT");
      return authJson;
    }
    throw new Error(`unexpected readFile: ${filePath}`);
  });
  const service = createAgentUsageService({
    resolveConfigRoot: (agentId: string) => {
      if (agentId === "codex") return CODEX_ROOT;
      if (agentId === "cursor") return "/Users/tester/.cursor";
      throw new Error(`Unknown Agent platform: ${agentId}`);
    },
    commandRunner,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    readFile,
    pathExists: vi.fn(async () => true),
    now: () => clock,
    platform: "darwin",
  });
  return {
    service,
    fetchImpl,
    readFile,
    setAuthJson: (raw) => {
      authJson = raw;
    },
    setConfigToml: (raw) => {
      configToml = raw;
    },
    setClock: (value) => {
      clock = value;
    },
  };
}

function expectNoTokenLeak(value: unknown): void {
  expect(JSON.stringify(value)).not.toContain(TOKEN);
}

function metricById(quota: AgentUsageQuota, id: string) {
  return quota.metrics.find((metric) => metric.id === id);
}

describe("Agent usage service (Codex adapter)", () => {
  describe("credential resolution", () => {
    it("returns no-credentials without a network call when auth.json is missing", async () => {
      const h = createHarness();
      h.setAuthJson(null);

      const quota = await h.service.getUsage("codex");

      expect(quota).toMatchObject({
        agentId: "codex",
        adapter: "codex-oauth-v1",
        status: "no-credentials",
        metrics: [],
        plan: null,
        fetchedAt: INITIAL_CLOCK,
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("returns no-credentials when auth.json has no tokens object", async () => {
      const h = createHarness();
      h.setAuthJson(JSON.stringify({ OPENAI_API_KEY: "sk-ignored" }));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("returns no-credentials when the access token is blank", async () => {
      const h = createHarness();
      h.setAuthJson(authPayload({ access_token: "   " }));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("returns no-credentials for malformed auth.json", async () => {
      const h = createHarness();
      h.setAuthJson("{ not-json");

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("request headers", () => {
    it("sends Bearer and ChatGPT-Account-Id headers when account_id is present", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      await h.service.getUsage("codex");

      expect(h.fetchImpl).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            Accept: "application/json",
            "ChatGPT-Account-Id": "acct-123",
          },
        }),
      );
    });

    it("omits ChatGPT-Account-Id when account_id is absent", async () => {
      const h = createHarness();
      h.setAuthJson(JSON.stringify({ tokens: { access_token: TOKEN } }));
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("ok");
      const [, init] = h.fetchImpl.mock.calls[0] as [
        string,
        { headers: Record<string, string> },
      ];
      expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
      expect(init.headers).not.toHaveProperty("ChatGPT-Account-Id");
    });
  });

  describe("usage response mapping", () => {
    it("maps plan_type and both windows from a 200 response", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      const quota = await h.service.getUsage("codex");

      expect(quota).toEqual({
        schemaVersion: 2,
        agentId: "codex",
        adapter: "codex-oauth-v1",
        status: "ok",
        source: "provider",
        metrics: [
          {
            id: "fiveHour",
            label: "5-hour window",
            scope: { kind: "account" },
            period: { kind: "rolling", durationSeconds: 18_000 },
            value: { kind: "percentage", remainingPercent: 75 },
            resetsAt: 1_800_003_600_000,
          },
          {
            id: "sevenDay",
            label: "7-day window",
            scope: { kind: "account" },
            period: { kind: "rolling", durationSeconds: 604_800 },
            value: { kind: "percentage", remainingPercent: 40 },
            resetsAt: 1_800_604_800_000,
          },
        ],
        plan: "plus",
        fetchedAt: INITIAL_CLOCK,
      });
    });

    it("classifies windows by limit_window_seconds, not by slot order", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(
        fakeResponse(
          200,
          usagePayload({
            rate_limit: {
              // 7-day window in the primary slot, 5-hour window in the
              // secondary slot; slots alone must not drive classification.
              primary_window: windowPayload(60, 1_800_604_800, 604_800),
              secondary_window: windowPayload(25, 1_800_003_600, 18_000),
            },
          }),
        ),
      );

      const quota = await h.service.getUsage("codex");

      expect(metricById(quota, "fiveHour")).toEqual({
        id: "fiveHour",
        label: "5-hour window",
        scope: { kind: "account" },
        period: { kind: "rolling", durationSeconds: 18_000 },
        value: { kind: "percentage", remainingPercent: 75 },
        resetsAt: 1_800_003_600_000,
      });
      expect(metricById(quota, "sevenDay")).toEqual({
        id: "sevenDay",
        label: "7-day window",
        scope: { kind: "account" },
        period: { kind: "rolling", durationSeconds: 604_800 },
        value: { kind: "percentage", remainingPercent: 40 },
        resetsAt: 1_800_604_800_000,
      });
    });

    it("keeps the larger window when both slots share a classification", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(
        fakeResponse(
          200,
          usagePayload({
            rate_limit: {
              primary_window: windowPayload(80, 1_800_604_800, 604_800),
              secondary_window: windowPayload(40, 1_800_345_600, 172_800),
            },
          }),
        ),
      );

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("ok");
      expect(quota.errorCode).toBeUndefined();
      expect(metricById(quota, "sevenDay")).toEqual({
        id: "sevenDay",
        label: "7-day window",
        scope: { kind: "account" },
        period: { kind: "rolling", durationSeconds: 604_800 },
        value: { kind: "percentage", remainingPercent: 20 },
        resetsAt: 1_800_604_800_000,
      });
      expect(metricById(quota, "fiveHour")).toBeUndefined();
    });

    it("maps a missing plan_type and missing windows to null", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(200, {}));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("ok");
      expect(quota.plan).toBeNull();
      expect(quota.metrics).toEqual([]);
    });

    it("maps a non-numeric reset_at to a null resetsAt", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(
        fakeResponse(200, {
          plan_type: "pro",
          rate_limit: {
            primary_window: {
              used_percent: 10,
              reset_at: "not-a-timestamp",
              limit_window_seconds: 18_000,
            },
          },
        }),
      );

      const quota = await h.service.getUsage("codex");

      expect(quota.plan).toBe("pro");
      expect(metricById(quota, "fiveHour")).toEqual({
        id: "fiveHour",
        label: "5-hour window",
        scope: { kind: "account" },
        period: { kind: "rolling", durationSeconds: 18_000 },
        value: { kind: "percentage", remainingPercent: 90 },
        resetsAt: null,
      });
    });
  });

  describe("error mapping", () => {
    it.each([401, 403])("maps HTTP %i to expired", async (status) => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(status, {}));

      const quota = await h.service.getUsage("codex");

      expect(quota).toMatchObject({
        status: "expired",
        adapter: "codex-oauth-v1",
      });
      expectNoTokenLeak(quota);
    });

    it("maps HTTP 500 to unavailable with http-error", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(500, {}));

      const quota = await h.service.getUsage("codex");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "http-error",
      });
    });

    it("maps a rejected fetch to unavailable with network-error", async () => {
      const h = createHarness();
      h.fetchImpl.mockRejectedValue(new Error("socket hang up"));

      const quota = await h.service.getUsage("codex");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "network-error",
      });
    });

    it("maps an abort to unavailable with timeout", async () => {
      const h = createHarness();
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";
      h.fetchImpl.mockRejectedValue(abortError);

      const quota = await h.service.getUsage("codex");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "timeout",
      });
    });
  });

  describe("custom model_provider short-circuit", () => {
    it("returns custom-provider-active without any network call for a third-party provider", async () => {
      const h = createHarness();
      h.setConfigToml('model_provider = "azure"\nmodel = "gpt-5"\n');

      const quota = await h.service.getUsage("codex");

      expect(quota).toMatchObject({
        agentId: "codex",
        adapter: "codex-oauth-v1",
        status: "unavailable",
        errorCode: "custom-provider-active",
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("queries normally when model_provider is openai", async () => {
      const h = createHarness();
      h.setConfigToml('model_provider = "openai"\n');
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("queries normally when config.toml has no model_provider key", async () => {
      const h = createHarness();
      h.setConfigToml('model = "gpt-5"\n');
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("queries normally when config.toml does not exist", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("queries normally when config.toml cannot be parsed", async () => {
      const h = createHarness();
      h.setConfigToml("model_provider = = = not toml");
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      const quota = await h.service.getUsage("codex");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    });
  });

  describe("result cache", () => {
    it("serves a cached result within 60 seconds without a second request", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      const first = await h.service.getUsage("codex");
      const second = await h.service.getUsage("codex");

      expect(second).toBe(first);
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("refetches once the cache entry is older than 60 seconds", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      await h.service.getUsage("codex");
      h.setClock(INITIAL_CLOCK + 60_001);
      const refreshed = await h.service.getUsage("codex");

      expect(h.fetchImpl).toHaveBeenCalledTimes(2);
      expect(refreshed.fetchedAt).toBe(INITIAL_CLOCK + 60_001);
    });

    it("bypasses the cache when forceRefresh is set", async () => {
      const h = createHarness();
      h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload()));

      await h.service.getUsage("codex");
      await h.service.getUsage("codex", { forceRefresh: true });

      expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    });
  });

  describe("agent id routing", () => {
    it("still returns unsupported-agent for registered agents without an adapter", async () => {
      const h = createHarness();

      const quota = await h.service.getUsage("cursor");

      expect(quota).toMatchObject({
        agentId: "cursor",
        adapter: "unsupported",
        status: "unavailable",
        errorCode: "unsupported-agent",
      });
      expect(h.readFile).not.toHaveBeenCalled();
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("secret isolation", () => {
    it("never exposes the token in returned quotas across every status", async () => {
      const scenarios: Array<(h: Harness) => void> = [
        (h) => h.fetchImpl.mockResolvedValue(fakeResponse(200, usagePayload())),
        (h) => h.fetchImpl.mockResolvedValue(fakeResponse(401, {})),
        (h) => h.fetchImpl.mockRejectedValue(new Error("connection reset")),
        (h) => h.setAuthJson(null),
      ];

      for (const arrange of scenarios) {
        const h = createHarness();
        arrange(h);
        const quota = await h.service.getUsage("codex");
        expectNoTokenLeak(quota);
      }
    });
  });
});
