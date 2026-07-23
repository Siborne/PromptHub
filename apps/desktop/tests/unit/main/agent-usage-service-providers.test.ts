import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import type { AgentUsageQuota } from "@prompthub/shared/types";
import type { AntigravityLocalUsageResult } from "../../../src/main/services/agent-usage-antigravity-local";
import { createAgentUsageService } from "../../../src/main/services/agent-usage-service";

const HOME = "/Users/tester";
const KIMI_ROOT = "/Users/tester/.kimi-code";
const INITIAL_CLOCK = 1_800_000_000_000;

const KIMI_TOKEN = "kimi-access-token-for-tests";
const ANTIGRAVITY_TOKEN = "antigravity-access-token-for-tests";
const GEMINI_TOKEN = "gemini-access-token-for-tests";
const COPILOT_TOKEN = "ghu_copilot-token-for-tests";

const ANTIGRAVITY_TOKEN_PATH = path.join(
  HOME,
  ".gemini",
  "antigravity-cli",
  "antigravity-oauth-token",
);
const GEMINI_CREDENTIALS_PATH = path.join(HOME, ".gemini", "oauth_creds.json");
const GH_HOSTS_PATH = path.join(HOME, ".config", "gh", "hosts.yml");
const COPILOT_HOSTS_PATH = path.join(
  HOME,
  ".config",
  "github-copilot",
  "hosts.json",
);
const CLOUDCODE_BASE = "https://cloudcode-pa.googleapis.com/v1internal";

interface Harness {
  service: ReturnType<typeof createAgentUsageService>;
  fetchImpl: ReturnType<typeof vi.fn>;
  commandRunner: {
    resolve: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
  };
  setFile: (filePath: string, raw: string | null) => void;
  setDir: (dirPath: string, entries: string[] | null) => void;
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

function createHarness(
  options: {
    platform?: NodeJS.Platform;
    antigravityLocalResult?: AntigravityLocalUsageResult;
  } = {},
): Harness {
  const files = new Map<string, string>();
  const dirs = new Map<string, string[]>();
  const fetchImpl = vi.fn();
  const commandRunner = {
    resolve: vi.fn(async () => null),
    run: vi.fn(async () => ({ stdout: "", stderr: "" })),
  };
  const readFile = vi.fn(async (filePath: string): Promise<string> => {
    const raw = files.get(filePath);
    if (raw === undefined) throw new Error("ENOENT");
    return raw;
  });
  const readDir = vi.fn(async (dirPath: string): Promise<string[]> => {
    const entries = dirs.get(dirPath);
    if (entries === undefined) throw new Error("ENOENT");
    return entries;
  });
  const service = createAgentUsageService({
    resolveConfigRoot: (agentId: string) => {
      const roots: Record<string, string> = {
        kimi: KIMI_ROOT,
        antigravity: "/Users/tester/.config/antigravity",
        gemini: "/Users/tester/.gemini",
        copilot: "/Users/tester/.config/github-copilot",
      };
      const root = roots[agentId];
      if (!root) throw new Error(`Unknown Agent platform: ${agentId}`);
      return root;
    },
    fetchImpl: fetchImpl as unknown as typeof fetch,
    commandRunner,
    readFile,
    readDir,
    now: () => INITIAL_CLOCK,
    homeDir: HOME,
    platform: options.platform ?? "linux",
    antigravityLocalClient: {
      getUsage: vi.fn(
        async (): Promise<AntigravityLocalUsageResult> =>
          options.antigravityLocalResult ?? { kind: "not-running" },
      ),
    },
  });
  return {
    service,
    fetchImpl,
    commandRunner,
    setFile: (filePath, raw) => {
      if (raw === null) files.delete(filePath);
      else files.set(filePath, raw);
    },
    setDir: (dirPath, entries) => {
      if (entries === null) dirs.delete(dirPath);
      else dirs.set(dirPath, entries);
    },
  };
}

function expectNoTokenLeak(value: unknown, token: string): void {
  expect(JSON.stringify(value)).not.toContain(token);
}

function metricById(quota: AgentUsageQuota, id: string) {
  return quota.metrics.find((metric) => metric.id === id);
}

function abortError(): Error {
  const error = new Error("The operation was aborted");
  error.name = "AbortError";
  return error;
}

function kimiCredentialsPayload(
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    access_token: KIMI_TOKEN,
    expires_at: "2027-06-01T00:00:00.000Z",
    ...overrides,
  });
}

function kimiUsagePayload(overrides: Record<string, unknown> = {}) {
  return {
    usage: {
      limit: 100,
      used: 42,
      remaining: 58,
      resetTime: "2027-01-15T00:00:00.000Z",
    },
    limits: [
      {
        detail: { used: 10, limit: 50 },
        window: { duration: 5, timeUnit: "hours" },
        resetTime: "2027-01-08T12:00:00.000Z",
      },
    ],
    user: { membership: { level: "LEVEL_INTERMEDIATE" } },
    ...overrides,
  };
}

describe("Agent usage service (Kimi adapter)", () => {
  describe("credential resolution", () => {
    it("returns no-credentials without a network call when no credential file exists", async () => {
      const h = createHarness();

      const quota = await h.service.getUsage("kimi");

      expect(quota).toMatchObject({
        agentId: "kimi",
        adapter: "kimi-oauth-v1",
        status: "no-credentials",
        metrics: [],
        plan: null,
        fetchedAt: INITIAL_CLOCK,
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("returns no-credentials for malformed credential JSON", async () => {
      const h = createHarness();
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        "{ nope",
      );

      const quota = await h.service.getUsage("kimi");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("returns no-credentials when access_token is blank", async () => {
      const h = createHarness();
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        kimiCredentialsPayload({ access_token: "   " }),
      );

      const quota = await h.service.getUsage("kimi");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("falls back to json files under the oauth directory", async () => {
      const h = createHarness();
      h.setDir(path.join(KIMI_ROOT, "oauth"), ["notes.txt", "kimi-code.json"]);
      h.setFile(
        path.join(KIMI_ROOT, "oauth", "kimi-code.json"),
        kimiCredentialsPayload(),
      );
      h.fetchImpl.mockResolvedValue(fakeResponse(200, kimiUsagePayload()));

      const quota = await h.service.getUsage("kimi");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
    });

    it("short-circuits to expired when expires_at is in the past, without a network call", async () => {
      const h = createHarness();
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        kimiCredentialsPayload({ expires_at: "2020-01-01T00:00:00.000Z" }),
      );

      const quota = await h.service.getUsage("kimi");

      expect(quota).toMatchObject({ status: "expired", metrics: [] });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("accepts expires_at as epoch seconds", async () => {
      const h = createHarness();
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        kimiCredentialsPayload({ expires_at: INITIAL_CLOCK / 1000 + 3600 }),
      );
      h.fetchImpl.mockResolvedValue(fakeResponse(200, kimiUsagePayload()));

      const quota = await h.service.getUsage("kimi");

      expect(quota.status).toBe("ok");
    });
  });

  describe("request and response mapping", () => {
    it("requests the usages endpoint with a Bearer header", async () => {
      const h = createHarness();
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        kimiCredentialsPayload(),
      );
      h.fetchImpl.mockResolvedValue(fakeResponse(200, kimiUsagePayload()));

      await h.service.getUsage("kimi");

      expect(h.fetchImpl).toHaveBeenCalledWith(
        "https://api.kimi.com/coding/v1/usages",
        expect.objectContaining({
          method: "GET",
          headers: { Authorization: `Bearer ${KIMI_TOKEN}` },
        }),
      );
    });

    it("maps the live usage shape to weekly and rolling metrics plus plan", async () => {
      const h = createHarness();
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        kimiCredentialsPayload(),
      );
      h.fetchImpl.mockResolvedValue(fakeResponse(200, kimiUsagePayload()));

      const quota = await h.service.getUsage("kimi");

      expect(quota).toMatchObject({
        agentId: "kimi",
        adapter: "kimi-oauth-v1",
        status: "ok",
        plan: "LEVEL_INTERMEDIATE",
        fetchedAt: INITIAL_CLOCK,
      });
      expect(metricById(quota, "weekly")).toEqual({
        id: "weekly",
        label: "Weekly quota",
        kind: "quota",
        utilization: 42,
        resetsAt: Date.parse("2027-01-15T00:00:00.000Z"),
        usedAmount: 42,
        totalAmount: 100,
        unit: "%",
      });
      expect(metricById(quota, "rolling")).toEqual({
        id: "rolling",
        label: "Rolling window",
        kind: "window",
        utilization: 20,
        resetsAt: Date.parse("2027-01-08T12:00:00.000Z"),
      });
    });

    it("omits amounts and reports zero utilization when the weekly limit is 0", async () => {
      const h = createHarness();
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        kimiCredentialsPayload(),
      );
      h.fetchImpl.mockResolvedValue(
        fakeResponse(200, kimiUsagePayload({ usage: { limit: 0, used: 0 } })),
      );

      const quota = await h.service.getUsage("kimi");

      const weekly = metricById(quota, "weekly");
      expect(weekly).toMatchObject({ utilization: 0, unit: "%" });
      expect(weekly).not.toHaveProperty("usedAmount");
      expect(weekly).not.toHaveProperty("totalAmount");
    });
  });

  describe("error mapping and secret isolation", () => {
    function seedCredentials(h: Harness): void {
      h.setFile(
        path.join(KIMI_ROOT, "credentials", "kimi-code.json"),
        kimiCredentialsPayload(),
      );
    }

    it.each([401, 403])("maps HTTP %i to expired", async (status) => {
      const h = createHarness();
      seedCredentials(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(status, {}));

      const quota = await h.service.getUsage("kimi");

      expect(quota).toMatchObject({ status: "expired" });
      expectNoTokenLeak(quota, KIMI_TOKEN);
    });

    it("maps HTTP 500 to unavailable with http-error", async () => {
      const h = createHarness();
      seedCredentials(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(500, {}));

      const quota = await h.service.getUsage("kimi");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "http-error",
      });
    });

    it("maps a rejected fetch to network-error and an abort to timeout", async () => {
      const h = createHarness();
      seedCredentials(h);
      h.fetchImpl.mockRejectedValueOnce(new Error("socket hang up"));

      const network = await h.service.getUsage("kimi");
      expect(network).toMatchObject({
        status: "unavailable",
        errorCode: "network-error",
      });

      h.fetchImpl.mockRejectedValueOnce(abortError());
      const timeout = await h.service.getUsage("kimi", {
        forceRefresh: true,
      });
      expect(timeout).toMatchObject({
        status: "unavailable",
        errorCode: "timeout",
      });
    });

    it("never exposes the token in returned quotas", async () => {
      const h = createHarness();
      seedCredentials(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(200, kimiUsagePayload()));

      const quota = await h.service.getUsage("kimi");

      expectNoTokenLeak(quota, KIMI_TOKEN);
    });
  });
});

function antigravityTokenPayload(
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    token: {
      access_token: ANTIGRAVITY_TOKEN,
      expiry: "2027-06-01T00:00:00.000Z",
      ...overrides,
    },
  });
}

function antigravityKeychainPayload(
  overrides: Record<string, unknown> = {},
): string {
  const payload = antigravityTokenPayload(overrides);
  return `account-reference:${Buffer.from(payload).toString("base64url")}`;
}

function loadCodeAssistPayload(overrides: Record<string, unknown> = {}) {
  return {
    cloudaicompanionProject: "projects/proj-123",
    currentTier: { id: "tier-pro", name: "Pro" },
    ...overrides,
  };
}

function antigravityModelsPayload() {
  return {
    models: {
      "gemini-2.5-pro": {
        quotaInfo: {
          remainingFraction: 0.25,
          resetTime: "2027-01-02T00:00:00.000Z",
        },
      },
      "gemini-2.5-flash": {
        quotaInfo: { remainingFraction: 1 },
      },
    },
  };
}

describe("Agent usage service (Antigravity adapter)", () => {
  describe("credential resolution", () => {
    it("prefers the running Antigravity desktop session over stale stored tokens", async () => {
      const h = createHarness({
        platform: "darwin",
        antigravityLocalResult: {
          kind: "ok",
          plan: "Pro",
          metrics: [
            {
              id: "promptCredits",
              label: "Monthly prompt credits",
              kind: "quota",
              utilization: 25,
              resetsAt: null,
            },
          ],
        },
      });
      h.commandRunner.resolve.mockResolvedValue("/usr/bin/security");
      h.commandRunner.run.mockResolvedValue({
        stdout: antigravityKeychainPayload({
          expiry: "2020-01-01T00:00:00.000Z",
        }),
        stderr: "",
      });

      const quota = await h.service.getUsage("antigravity");

      expect(quota).toMatchObject({
        status: "ok",
        adapter: "antigravity-local-v1",
        plan: "Pro",
      });
      expect(metricById(quota, "promptCredits")).toMatchObject({
        utilization: 25,
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
      expect(h.commandRunner.resolve).not.toHaveBeenCalled();
    });

    it("keeps the open-app fallback when the local helper is unavailable for a renewable session", async () => {
      const h = createHarness({
        platform: "darwin",
        antigravityLocalResult: { kind: "not-running" },
      });
      h.commandRunner.resolve.mockResolvedValue("/usr/bin/security");
      h.commandRunner.run.mockResolvedValue({
        stdout: antigravityKeychainPayload({
          expiry: "2020-01-01T00:00:00.000Z",
          refresh_token: "refresh-token-for-tests",
        }),
        stderr: "",
      });

      const quota = await h.service.getUsage("antigravity");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "antigravity-not-running",
      });
      expect(JSON.stringify(quota)).not.toContain("refresh-token-for-tests");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("uses the current Antigravity macOS Keychain session before stale legacy files", async () => {
      const h = createHarness({ platform: "darwin" });
      h.commandRunner.resolve.mockResolvedValue("/usr/bin/security");
      h.commandRunner.run.mockResolvedValue({
        stdout: antigravityKeychainPayload(),
        stderr: "",
      });
      h.setFile(
        ANTIGRAVITY_TOKEN_PATH,
        antigravityTokenPayload({ expiry: "2020-01-01T00:00:00.000Z" }),
      );
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, antigravityModelsPayload()));

      const quota = await h.service.getUsage("antigravity");

      expect(quota.status).toBe("ok");
      expect(h.commandRunner.run).toHaveBeenCalledWith(
        "/usr/bin/security",
        ["find-generic-password", "-s", "gemini", "-a", "antigravity", "-w"],
        expect.objectContaining({ timeout: 10_000 }),
      );
      expectNoTokenLeak(quota, ANTIGRAVITY_TOKEN);
    });

    it("continues past an expired legacy token to a valid shared credential", async () => {
      const h = createHarness();
      h.setFile(
        ANTIGRAVITY_TOKEN_PATH,
        antigravityTokenPayload({ expiry: "2020-01-01T00:00:00.000Z" }),
      );
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, antigravityModelsPayload()));

      const quota = await h.service.getUsage("antigravity");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledTimes(2);
    });

    it("falls back when the Keychain item is malformed instead of claiming the session expired", async () => {
      const h = createHarness({ platform: "darwin" });
      h.commandRunner.resolve.mockResolvedValue("/usr/bin/security");
      h.commandRunner.run.mockResolvedValue({
        stdout: "account-reference:not-valid-json",
        stderr: "",
      });
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, antigravityModelsPayload()));

      const quota = await h.service.getUsage("antigravity");

      expect(quota.status).toBe("ok");
    });

    it("returns no-credentials without a network call when the token file is missing", async () => {
      const h = createHarness();

      const quota = await h.service.getUsage("antigravity");

      expect(quota).toMatchObject({
        agentId: "antigravity",
        adapter: "antigravity-oauth-v1",
        status: "no-credentials",
        metrics: [],
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("returns no-credentials for a token file without token.access_token", async () => {
      const h = createHarness();
      h.setFile(ANTIGRAVITY_TOKEN_PATH, JSON.stringify({ token: {} }));

      const quota = await h.service.getUsage("antigravity");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("short-circuits to expired when the token expiry has passed, without a network call", async () => {
      const h = createHarness();
      h.setFile(
        ANTIGRAVITY_TOKEN_PATH,
        antigravityTokenPayload({ expiry: "2020-01-01T00:00:00.000Z" }),
      );

      const quota = await h.service.getUsage("antigravity");

      expect(quota).toMatchObject({ status: "expired", metrics: [] });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("falls back to the shared Gemini credential file for Antigravity 2.0 installs", async () => {
      const h = createHarness();
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, antigravityModelsPayload()));

      const quota = await h.service.getUsage("antigravity");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledTimes(2);
      expect(h.fetchImpl).toHaveBeenNthCalledWith(
        1,
        `${CLOUDCODE_BASE}:loadCodeAssist`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${GEMINI_TOKEN}`,
          }),
        }),
      );
    });

    it("returns no-credentials when both the Antigravity token and the shared Gemini file are missing", async () => {
      const h = createHarness();

      const quota = await h.service.getUsage("antigravity");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("request and response mapping", () => {
    it("calls loadCodeAssist then fetchAvailableModels with Bearer auth", async () => {
      const h = createHarness();
      h.setFile(ANTIGRAVITY_TOKEN_PATH, antigravityTokenPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, antigravityModelsPayload()));

      await h.service.getUsage("antigravity");

      expect(h.fetchImpl).toHaveBeenCalledTimes(2);
      expect(h.fetchImpl).toHaveBeenNthCalledWith(
        1,
        `${CLOUDCODE_BASE}:loadCodeAssist`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${ANTIGRAVITY_TOKEN}`,
          }),
          body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
        }),
      );
      expect(h.fetchImpl).toHaveBeenNthCalledWith(
        2,
        `${CLOUDCODE_BASE}:fetchAvailableModels`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ project: "projects/proj-123" }),
        }),
      );
    });

    it("maps the models dict to per-model quota metrics and the tier to plan", async () => {
      const h = createHarness();
      h.setFile(ANTIGRAVITY_TOKEN_PATH, antigravityTokenPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, antigravityModelsPayload()));

      const quota = await h.service.getUsage("antigravity");

      expect(quota).toMatchObject({
        agentId: "antigravity",
        adapter: "antigravity-oauth-v1",
        status: "ok",
        plan: "Pro",
      });
      expect(metricById(quota, "model:gemini-2.5-pro")).toEqual({
        id: "model:gemini-2.5-pro",
        label: "gemini-2.5-pro",
        kind: "quota",
        utilization: 75,
        resetsAt: Date.parse("2027-01-02T00:00:00.000Z"),
      });
      expect(metricById(quota, "model:gemini-2.5-flash")).toEqual({
        id: "model:gemini-2.5-flash",
        label: "gemini-2.5-flash",
        kind: "quota",
        utilization: 0,
        resetsAt: null,
      });
    });

    it("accepts a project object and a models list defensively", async () => {
      const h = createHarness();
      h.setFile(ANTIGRAVITY_TOKEN_PATH, antigravityTokenPayload());
      h.fetchImpl
        .mockResolvedValueOnce(
          fakeResponse(
            200,
            loadCodeAssistPayload({
              cloudaicompanionProject: { id: "proj-obj" },
              currentTier: { id: "tier-free" },
            }),
          ),
        )
        .mockResolvedValueOnce(
          fakeResponse(200, {
            models: [
              { name: "gemini-2.5-pro", quotaInfo: { remainingFraction: 0.5 } },
            ],
          }),
        );

      const quota = await h.service.getUsage("antigravity");

      expect(quota.status).toBe("ok");
      expect(quota.plan).toBe("tier-free");
      expect(metricById(quota, "model:gemini-2.5-pro")).toMatchObject({
        utilization: 50,
      });
      expect(h.fetchImpl).toHaveBeenNthCalledWith(
        2,
        `${CLOUDCODE_BASE}:fetchAvailableModels`,
        expect.objectContaining({
          body: JSON.stringify({ project: "proj-obj" }),
        }),
      );
    });
  });

  describe("error mapping and secret isolation", () => {
    it("maps a 401 from loadCodeAssist to expired", async () => {
      const h = createHarness();
      h.setFile(ANTIGRAVITY_TOKEN_PATH, antigravityTokenPayload());
      h.fetchImpl.mockResolvedValueOnce(fakeResponse(401, {}));

      const quota = await h.service.getUsage("antigravity");

      expect(quota).toMatchObject({ status: "expired" });
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
      expectNoTokenLeak(quota, ANTIGRAVITY_TOKEN);
    });

    it("maps an HTTP 500 from fetchAvailableModels to unavailable with http-error", async () => {
      const h = createHarness();
      h.setFile(ANTIGRAVITY_TOKEN_PATH, antigravityTokenPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(500, {}));

      const quota = await h.service.getUsage("antigravity");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "http-error",
      });
    });

    it("maps a rejected fetch to network-error and an abort to timeout", async () => {
      const h = createHarness();
      h.setFile(ANTIGRAVITY_TOKEN_PATH, antigravityTokenPayload());
      h.fetchImpl.mockRejectedValueOnce(new Error("socket hang up"));

      const network = await h.service.getUsage("antigravity");
      expect(network).toMatchObject({
        status: "unavailable",
        errorCode: "network-error",
      });

      h.fetchImpl.mockRejectedValueOnce(abortError());
      const timeout = await h.service.getUsage("antigravity", {
        forceRefresh: true,
      });
      expect(timeout).toMatchObject({
        status: "unavailable",
        errorCode: "timeout",
      });
    });
  });
});

function geminiCredentialsPayload(
  overrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    access_token: GEMINI_TOKEN,
    expiry_date: INITIAL_CLOCK + 3_600_000,
    ...overrides,
  });
}

function geminiQuotaPayload() {
  return {
    buckets: [
      {
        modelId: "gemini-2.5-pro",
        remainingFraction: 0.5,
        resetTime: "2027-01-02T00:00:00.000Z",
      },
      { modelId: "gemini-2.5-flash", remainingFraction: 0.75 },
    ],
  };
}

describe("Agent usage service (Gemini CLI adapter)", () => {
  describe("credential resolution", () => {
    it("returns no-credentials without a network call when oauth_creds.json is missing", async () => {
      const h = createHarness();

      const quota = await h.service.getUsage("gemini");

      expect(quota).toMatchObject({
        agentId: "gemini",
        adapter: "gemini-oauth-v1",
        status: "no-credentials",
        metrics: [],
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("returns no-credentials for malformed oauth_creds.json", async () => {
      const h = createHarness();
      h.setFile(GEMINI_CREDENTIALS_PATH, "{ not-json");

      const quota = await h.service.getUsage("gemini");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("short-circuits to expired when expiry_date is in the past, without a network call", async () => {
      const h = createHarness();
      h.setFile(
        GEMINI_CREDENTIALS_PATH,
        geminiCredentialsPayload({ expiry_date: INITIAL_CLOCK - 1 }),
      );

      const quota = await h.service.getUsage("gemini");

      expect(quota).toMatchObject({ status: "expired", metrics: [] });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("request and response mapping", () => {
    it("calls loadCodeAssist with an empty body then retrieveUserQuota", async () => {
      const h = createHarness();
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, geminiQuotaPayload()));

      await h.service.getUsage("gemini");

      expect(h.fetchImpl).toHaveBeenNthCalledWith(
        1,
        `${CLOUDCODE_BASE}:loadCodeAssist`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: `Bearer ${GEMINI_TOKEN}`,
          }),
          body: "{}",
        }),
      );
      expect(h.fetchImpl).toHaveBeenNthCalledWith(
        2,
        `${CLOUDCODE_BASE}:retrieveUserQuota`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ project: "projects/proj-123" }),
        }),
      );
    });

    it("maps buckets to per-model quota metrics and the tier to plan", async () => {
      const h = createHarness();
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(200, geminiQuotaPayload()));

      const quota = await h.service.getUsage("gemini");

      expect(quota).toMatchObject({
        agentId: "gemini",
        adapter: "gemini-oauth-v1",
        status: "ok",
        plan: "Pro",
      });
      expect(metricById(quota, "model:gemini-2.5-pro")).toEqual({
        id: "model:gemini-2.5-pro",
        label: "gemini-2.5-pro",
        kind: "quota",
        utilization: 50,
        resetsAt: Date.parse("2027-01-02T00:00:00.000Z"),
      });
      expect(metricById(quota, "model:gemini-2.5-flash")).toEqual({
        id: "model:gemini-2.5-flash",
        label: "gemini-2.5-flash",
        kind: "quota",
        utilization: 25,
        resetsAt: null,
      });
    });
  });

  describe("error mapping and secret isolation", () => {
    it("maps a 403 from loadCodeAssist to expired", async () => {
      const h = createHarness();
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl.mockResolvedValueOnce(fakeResponse(403, {}));

      const quota = await h.service.getUsage("gemini");

      expect(quota).toMatchObject({ status: "expired" });
      expect(h.fetchImpl).toHaveBeenCalledTimes(1);
      expectNoTokenLeak(quota, GEMINI_TOKEN);
    });

    it("maps an HTTP 500 from retrieveUserQuota to unavailable with http-error", async () => {
      const h = createHarness();
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl
        .mockResolvedValueOnce(fakeResponse(200, loadCodeAssistPayload()))
        .mockResolvedValueOnce(fakeResponse(500, {}));

      const quota = await h.service.getUsage("gemini");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "http-error",
      });
    });

    it("maps a rejected fetch to network-error and an abort to timeout", async () => {
      const h = createHarness();
      h.setFile(GEMINI_CREDENTIALS_PATH, geminiCredentialsPayload());
      h.fetchImpl.mockRejectedValueOnce(new Error("socket hang up"));

      const network = await h.service.getUsage("gemini");
      expect(network).toMatchObject({
        status: "unavailable",
        errorCode: "network-error",
      });

      h.fetchImpl.mockRejectedValueOnce(abortError());
      const timeout = await h.service.getUsage("gemini", {
        forceRefresh: true,
      });
      expect(timeout).toMatchObject({
        status: "unavailable",
        errorCode: "timeout",
      });
    });
  });
});

function copilotUserPayload(overrides: Record<string, unknown> = {}) {
  return {
    copilot_plan: "pro",
    quota_reset_date: "2027-02-01T00:00:00.000Z",
    quota_snapshots: {
      premium_interactions: {
        entitlement: 300,
        remaining: 150,
        percent_used: 50,
        unlimited: false,
      },
      chat: {
        entitlement: 1000,
        remaining: 250,
        percent_used: 75,
        unlimited: false,
      },
    },
    ...overrides,
  };
}

describe("Agent usage service (Copilot adapter)", () => {
  describe("credential resolution", () => {
    it("returns no-credentials without a network call when neither store exists", async () => {
      const h = createHarness();

      const quota = await h.service.getUsage("copilot");

      expect(quota).toMatchObject({
        agentId: "copilot",
        adapter: "copilot-oauth-v1",
        status: "no-credentials",
        metrics: [],
      });
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });

    it("reads the token from gh hosts.yml first", async () => {
      const h = createHarness();
      h.setFile(
        GH_HOSTS_PATH,
        `github.com:\n  oauth_token: ${COPILOT_TOKEN}\n  user: tester\n`,
      );
      h.setFile(
        COPILOT_HOSTS_PATH,
        JSON.stringify({ "github.com": { oauth_token: "ghu_other-token" } }),
      );
      h.fetchImpl.mockResolvedValue(fakeResponse(200, copilotUserPayload()));

      const quota = await h.service.getUsage("copilot");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledWith(
        "https://api.github.com/copilot_internal/user",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `token ${COPILOT_TOKEN}`,
          }),
        }),
      );
    });

    it("falls back to github-copilot hosts.json when hosts.yml has no token", async () => {
      const h = createHarness();
      h.setFile(GH_HOSTS_PATH, "github.com:\n  user: tester\n");
      h.setFile(
        COPILOT_HOSTS_PATH,
        JSON.stringify({ "github.com": { oauth_token: COPILOT_TOKEN } }),
      );
      h.fetchImpl.mockResolvedValue(fakeResponse(200, copilotUserPayload()));

      const quota = await h.service.getUsage("copilot");

      expect(quota.status).toBe("ok");
      expect(h.fetchImpl).toHaveBeenCalledWith(
        "https://api.github.com/copilot_internal/user",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `token ${COPILOT_TOKEN}`,
          }),
        }),
      );
    });

    it("returns no-credentials when hosts.json is malformed", async () => {
      const h = createHarness();
      h.setFile(COPILOT_HOSTS_PATH, "{ not-json");

      const quota = await h.service.getUsage("copilot");

      expect(quota.status).toBe("no-credentials");
      expect(h.fetchImpl).not.toHaveBeenCalled();
    });
  });

  describe("request and response mapping", () => {
    function seedGhToken(h: Harness): void {
      h.setFile(
        GH_HOSTS_PATH,
        `github.com:\n  oauth_token: ${COPILOT_TOKEN}\n`,
      );
    }

    it("sends the GitHub API headers including the token auth scheme", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(200, copilotUserPayload()));

      await h.service.getUsage("copilot");

      expect(h.fetchImpl).toHaveBeenCalledWith(
        "https://api.github.com/copilot_internal/user",
        expect.objectContaining({
          method: "GET",
          headers: {
            Authorization: `token ${COPILOT_TOKEN}`,
            Accept: "application/vnd.github+json",
            "User-Agent": "prompthub-desktop",
          },
        }),
      );
    });

    it("maps premium and chat snapshots, reset date, and plan", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(200, copilotUserPayload()));

      const quota = await h.service.getUsage("copilot");

      expect(quota).toMatchObject({
        agentId: "copilot",
        adapter: "copilot-oauth-v1",
        status: "ok",
        plan: "pro",
      });
      expect(metricById(quota, "premium")).toEqual({
        id: "premium",
        label: "Premium requests",
        kind: "quota",
        utilization: 50,
        resetsAt: Date.parse("2027-02-01T00:00:00.000Z"),
        usedAmount: 150,
        totalAmount: 300,
        unit: "requests",
      });
      expect(metricById(quota, "chat")).toEqual({
        id: "chat",
        label: "Chat requests",
        kind: "quota",
        utilization: 75,
        resetsAt: Date.parse("2027-02-01T00:00:00.000Z"),
        usedAmount: 750,
        totalAmount: 1000,
        unit: "requests",
      });
    });

    it("derives utilization from entitlement and remaining when percent_used is absent", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(
        fakeResponse(
          200,
          copilotUserPayload({
            quota_snapshots: {
              premium_interactions: { entitlement: 200, remaining: 50 },
            },
          }),
        ),
      );

      const quota = await h.service.getUsage("copilot");

      expect(metricById(quota, "premium")).toMatchObject({
        utilization: 75,
        usedAmount: 150,
        totalAmount: 200,
      });
      expect(metricById(quota, "chat")).toBeUndefined();
    });

    it("skips snapshots marked unlimited", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(
        fakeResponse(
          200,
          copilotUserPayload({
            quota_snapshots: {
              premium_interactions: { unlimited: true },
              chat: { entitlement: 100, remaining: 90, percent_used: 10 },
            },
          }),
        ),
      );

      const quota = await h.service.getUsage("copilot");

      expect(quota.status).toBe("ok");
      expect(metricById(quota, "premium")).toBeUndefined();
      expect(metricById(quota, "chat")).toMatchObject({ utilization: 10 });
    });

    it("returns ok with empty metrics when no snapshots are reported", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(
        fakeResponse(200, { copilot_plan: "free" }),
      );

      const quota = await h.service.getUsage("copilot");

      expect(quota).toMatchObject({
        status: "ok",
        plan: "free",
        metrics: [],
      });
    });
  });

  describe("error mapping and secret isolation", () => {
    function seedGhToken(h: Harness): void {
      h.setFile(
        GH_HOSTS_PATH,
        `github.com:\n  oauth_token: ${COPILOT_TOKEN}\n`,
      );
    }

    it.each([401, 403])("maps HTTP %i to expired", async (status) => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(status, {}));

      const quota = await h.service.getUsage("copilot");

      expect(quota).toMatchObject({ status: "expired" });
      expectNoTokenLeak(quota, COPILOT_TOKEN);
    });

    it("maps HTTP 500 to unavailable with http-error", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(500, {}));

      const quota = await h.service.getUsage("copilot");

      expect(quota).toMatchObject({
        status: "unavailable",
        errorCode: "http-error",
      });
    });

    it("maps a rejected fetch to network-error and an abort to timeout", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockRejectedValueOnce(new Error("socket hang up"));

      const network = await h.service.getUsage("copilot");
      expect(network).toMatchObject({
        status: "unavailable",
        errorCode: "network-error",
      });

      h.fetchImpl.mockRejectedValueOnce(abortError());
      const timeout = await h.service.getUsage("copilot", {
        forceRefresh: true,
      });
      expect(timeout).toMatchObject({
        status: "unavailable",
        errorCode: "timeout",
      });
    });

    it("never exposes the token in returned quotas", async () => {
      const h = createHarness();
      seedGhToken(h);
      h.fetchImpl.mockResolvedValue(fakeResponse(200, copilotUserPayload()));

      const quota = await h.service.getUsage("copilot");

      expectNoTokenLeak(quota, COPILOT_TOKEN);
    });
  });
});
