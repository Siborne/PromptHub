import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AgentUsageQuota } from "@prompthub/shared/types";
import { createAgentUsageService } from "../../../src/main/services/agent-usage-service";

const GROK_ROOT = "/Users/tester/.grok";
const GROK_AUTH_PATH = path.join(GROK_ROOT, "auth.json");
const GROK_USER_ENDPOINT =
  "https://cli-chat-proxy.grok.com/v1/user?include=subscription";
const GROK_BILLING_ENDPOINT =
  "https://cli-chat-proxy.grok.com/v1/billing?format=credits";
const GROK_TOKEN = "grok-access-token-for-tests";
const INITIAL_CLOCK = 1_800_000_000_000;

interface Harness {
  service: ReturnType<typeof createAgentUsageService>;
  fetchImpl: ReturnType<typeof vi.fn>;
  setAuth: (raw: string | null) => void;
}

function fakeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function createHarness(): Harness {
  let auth: string | null = null;
  const fetchImpl = vi.fn();
  const service = createAgentUsageService({
    resolveConfigRoot: () => GROK_ROOT,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    pathExists: vi.fn(async () => true),
    readFile: vi.fn(async (filePath: string) => {
      if (filePath !== GROK_AUTH_PATH || auth === null)
        throw new Error("ENOENT");
      return auth;
    }),
    now: () => INITIAL_CLOCK,
  });
  return {
    service,
    fetchImpl,
    setAuth: (raw) => {
      auth = raw;
    },
  };
}

function grokAuthPayload(
  overrides: Record<string, unknown> = {},
  host = "https://auth.x.ai::grok-build-client",
): string {
  return JSON.stringify({
    [host]: {
      key: GROK_TOKEN,
      auth_mode: "oidc",
      expires_at: "2027-01-16T00:00:00.000Z",
      ...overrides,
    },
  });
}

function grokUserPayload(overrides: Record<string, unknown> = {}) {
  return { subscriptionTier: "XPremium", ...overrides };
}

function grokBillingPayload(overrides: Record<string, unknown> = {}) {
  return {
    config: {
      currentPeriod: {
        type: "USAGE_PERIOD_TYPE_WEEKLY",
        start: "2027-01-08T12:00:00.000Z",
        end: "2027-01-15T12:00:00.000Z",
      },
      creditUsagePercent: 15,
      ...overrides,
    },
  };
}

function metricById(quota: AgentUsageQuota, id: string) {
  return quota.metrics.find((metric) => metric.id === id);
}

function expectNoTokenLeak(value: unknown): void {
  expect(JSON.stringify(value)).not.toContain(GROK_TOKEN);
}

describe("Agent usage service (Grok Build adapter)", () => {
  function seedGrokAuth(h: Harness, raw = grokAuthPayload()): void {
    h.setAuth(raw);
  }

  function respondWithGrokAccount(h: Harness): void {
    h.fetchImpl.mockImplementation(async (url: string) => {
      if (url === GROK_USER_ENDPOINT) {
        return fakeResponse(200, grokUserPayload());
      }
      if (url === GROK_BILLING_ENDPOINT) {
        return fakeResponse(200, grokBillingPayload());
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
  }

  it("returns no-credentials for missing, malformed, oversized, or unofficial auth", async () => {
    const fixtures = [
      null,
      "{ invalid-json",
      `${grokAuthPayload()}${" ".repeat(256 * 1024)}`,
      grokAuthPayload({}, "https://example.com::grok-build-client"),
    ];

    for (const raw of fixtures) {
      const h = createHarness();
      h.setAuth(raw);

      const quota = await h.service.getUsage("grok");

      expect(quota).toMatchObject({
        agentId: "grok",
        adapter: "grok-oauth-v1",
        status: "no-credentials",
        plan: null,
        metrics: [],
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    }
  });

  it("short-circuits an expired official credential", async () => {
    const h = createHarness();
    seedGrokAuth(
      h,
      grokAuthPayload({ expires_at: "2020-01-01T00:00:00.000Z" }),
    );

    const quota = await h.service.getUsage("grok");

    expect(quota.status).toBe("expired");
    expect(h.fetchImpl).not.toHaveBeenCalled();
  });

  it("maps the official subscription and weekly billing period", async () => {
    const h = createHarness();
    seedGrokAuth(h);
    respondWithGrokAccount(h);

    const quota = await h.service.getUsage("grok");

    expect(quota).toMatchObject({
      agentId: "grok",
      adapter: "grok-oauth-v1",
      status: "ok",
      plan: "XPremium",
      fetchedAt: INITIAL_CLOCK,
    });
    expect(metricById(quota, "weekly")).toEqual({
      id: "weekly",
      label: "Weekly quota",
      scope: { kind: "account" },
      period: { kind: "calendar", unit: "week" },
      value: { kind: "percentage", remainingPercent: 85 },
      resetsAt: Date.parse("2027-01-15T12:00:00.000Z"),
    });
    expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    for (const endpoint of [GROK_USER_ENDPOINT, GROK_BILLING_ENDPOINT]) {
      expect(h.fetchImpl).toHaveBeenCalledWith(
        endpoint,
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: `Bearer ${GROK_TOKEN}`,
            Accept: "application/json",
            "User-Agent": "prompthub-desktop",
            "x-grok-client-mode": "build",
          },
        }),
      );
    }
    expectNoTokenLeak(quota);
  });

  it("keeps weekly usage when subscription metadata is unavailable", async () => {
    const h = createHarness();
    seedGrokAuth(h);
    h.fetchImpl.mockImplementation(async (url: string) =>
      url === GROK_USER_ENDPOINT
        ? fakeResponse(500, {})
        : fakeResponse(200, grokBillingPayload()),
    );

    const quota = await h.service.getUsage("grok");

    expect(quota).toMatchObject({ status: "ok", plan: null });
    expect(metricById(quota, "weekly")).toMatchObject({
      value: { kind: "percentage", remainingPercent: 85 },
    });
  });

  it("keeps the plan but reports unavailable when billing fails", async () => {
    const h = createHarness();
    seedGrokAuth(h);
    h.fetchImpl.mockImplementation(async (url: string) =>
      url === GROK_USER_ENDPOINT
        ? fakeResponse(200, grokUserPayload())
        : fakeResponse(500, {}),
    );

    const quota = await h.service.getUsage("grok");

    expect(quota).toMatchObject({
      status: "unavailable",
      plan: "XPremium",
      errorCode: "http-error",
      metrics: [],
    });
  });

  it.each([401, 403])(
    "maps rejected billing HTTP %i to expired",
    async (status) => {
      const h = createHarness();
      seedGrokAuth(h);
      h.fetchImpl.mockImplementation(async (url: string) =>
        url === GROK_USER_ENDPOINT
          ? fakeResponse(200, grokUserPayload())
          : fakeResponse(status, {}),
      );

      const quota = await h.service.getUsage("grok");

      expect(quota).toMatchObject({ status: "expired", plan: "XPremium" });
      expectNoTokenLeak(quota);
    },
  );

  it("maps malformed billing values to an empty but successful provider report", async () => {
    const h = createHarness();
    seedGrokAuth(h);
    h.fetchImpl.mockImplementation(async (url: string) =>
      url === GROK_USER_ENDPOINT
        ? fakeResponse(200, grokUserPayload())
        : fakeResponse(
            200,
            grokBillingPayload({
              creditUsagePercent: "not-a-number",
              currentPeriod: { end: "not-a-date" },
            }),
          ),
    );

    const quota = await h.service.getUsage("grok");

    expect(quota).toMatchObject({
      status: "ok",
      plan: "XPremium",
      metrics: [],
    });
  });
});
