import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDatabase } from "@prompthub/db";
import { Hono } from "hono";
import {
  AGENT_SERVICE_DOMAINS,
  DEFAULT_SETTINGS,
} from "@prompthub/shared/types";
import { issueSolvedCaptcha } from "../test-helpers/auth-captcha";
import { createAgentRoutes } from "./agents";

const originalDataRoot = process.env.DATA_ROOT;

async function createTestApp(dataRoot: string) {
  Object.assign(process.env, {
    JWT_SECRET: "test-secret-for-web-agent-routes-1234567890",
    DATA_ROOT: dataRoot,
    ALLOW_REGISTRATION: "true",
    LOG_LEVEL: "error",
  });
  const { createApp } = await import("../app");
  return createApp();
}

async function register(
  app: Awaited<ReturnType<typeof createTestApp>>,
  username: string,
) {
  const captcha = await issueSolvedCaptcha(app);
  const response = await app.request("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password: "debugpass001", ...captcha }),
  });
  const body = (await response.json()) as {
    data: { accessToken: string; user: { role: "admin" | "user" } };
  };
  return body.data;
}

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

describe("Web Agent routes", () => {
  beforeEach(() => vi.resetModules());

  afterEach(() => {
    closeDatabase();
    if (originalDataRoot === undefined) delete process.env.DATA_ROOT;
    else process.env.DATA_ROOT = originalDataRoot;
  });

  it("requires authentication and isolates host detection by role and user settings", async () => {
    const dataRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-web-agents-"),
    );
    const agentRoot = path.join(dataRoot, "server-agent");
    fs.mkdirSync(agentRoot);

    try {
      const app = await createTestApp(dataRoot);
      expect((await app.request("/api/agents")).status).toBe(401);

      const admin = await register(app, "agent-admin");
      const user = await register(app, "agent-user");
      expect(admin.user.role).toBe("admin");
      expect(user.user.role).toBe("user");

      for (const actor of [admin, user]) {
        const response = await app.request("/api/settings", {
          method: "PUT",
          headers: headers(actor.accessToken),
          body: JSON.stringify({
            customAgents: [
              {
                id: `custom:${actor.user.role}`,
                name: `${actor.user.role} Agent`,
                rootPath: agentRoot,
              },
            ],
          }),
        });
        expect(response.status).toBe(200);
      }

      const adminResponse = await app.request("/api/agents", {
        headers: headers(admin.accessToken),
      });
      const adminBody = (await adminResponse.json()) as {
        data: {
          target: string;
          agents: Array<{ id: string; isDetected: boolean }>;
        };
      };
      expect(adminResponse.status).toBe(200);
      expect(adminBody.data.target).toBe("server-host");
      expect(adminBody.data.agents).toContainEqual(
        expect.objectContaining({ id: "custom:admin", isDetected: true }),
      );
      expect(adminBody.data.agents).not.toContainEqual(
        expect.objectContaining({ id: "custom:user" }),
      );

      const userResponse = await app.request("/api/agents", {
        headers: headers(user.accessToken),
      });
      const userBody = (await userResponse.json()) as {
        data: {
          target: string;
          agents: Array<{ id: string; isDetected: boolean }>;
          capabilities: Record<string, boolean>;
        };
      };
      expect(userBody.data.target).toBe("logical-only");
      expect(userBody.data.capabilities.hostDetection).toBe(false);
      expect(userBody.data.capabilities.filesystemMutation).toBe(false);
      expect(userBody.data.agents).toContainEqual(
        expect.objectContaining({ id: "custom:user", isDetected: false }),
      );
      expect(userBody.data.agents).not.toContainEqual(
        expect.objectContaining({ id: "custom:admin" }),
      );
    } finally {
      fs.rmSync(dataRoot, { recursive: true, force: true });
    }
  }, 20_000);

  it("returns a stable internal error when inventory construction fails", async () => {
    const app = new Hono<{
      Variables: { userId: string; role: "admin" | "user" };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "user-1");
      c.set("role", "admin");
      await next();
    });
    app.route(
      "/api/agents",
      createAgentRoutes({
        inventoryService: {
          list: async () => {
            throw new Error("inventory failed");
          },
        },
        settingsService: { get: () => DEFAULT_SETTINGS },
      }),
    );

    const response = await app.request("/api/agents");
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
      },
    });
  });

  it("serves the complete self-hosted service manifest and domain results", async () => {
    const app = new Hono<{
      Variables: { userId: string; role: "admin" | "user" };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "admin-1");
      c.set("role", "admin");
      await next();
    });
    const agent = {
      id: "codex",
      name: "Codex",
    } as never;
    app.route(
      "/api/agents",
      createAgentRoutes({
        inventoryService: {
          list: async () => ({ agents: [agent] }) as never,
        },
        settingsService: { get: () => DEFAULT_SETTINGS },
        servicesService: {
          getManifest: async () => [
            { domain: "skills", serviceAvailable: true, status: "available" },
          ],
          get: async (_actor, _agent, domain) => ({
            agentId: "codex",
            domain,
            status: "available",
            items: [],
            total: 0,
            truncated: false,
            actions: { browse: "available" },
          }),
        },
      }),
    );

    const manifest = await app.request("/api/agents/codex/services");
    expect(manifest.status).toBe(200);
    await expect(manifest.json()).resolves.toMatchObject({
      data: [{ domain: "skills", serviceAvailable: true, status: "available" }],
    });

    for (const domain of AGENT_SERVICE_DOMAINS) {
      const response = await app.request(
        `/api/agents/codex/services/${domain}`,
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        data: { agentId: "codex", domain },
      });
    }

    expect(
      (await app.request("/api/agents/codex/services/not-real")).status,
    ).toBe(404);
    expect((await app.request("/api/agents/missing/services")).status).toBe(
      404,
    );
  });

  it("redacts service adapter errors at the HTTP boundary", async () => {
    const app = new Hono<{
      Variables: { userId: string; role: "admin" | "user" };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "admin-1");
      c.set("role", "admin");
      await next();
    });
    app.route(
      "/api/agents",
      createAgentRoutes({
        inventoryService: {
          list: async () => ({ agents: [{ id: "qwen" }] }) as never,
        },
        settingsService: { get: () => DEFAULT_SETTINGS },
        servicesService: {
          getManifest: async () => {
            throw new Error("secret=/srv/private token=abc");
          },
          get: async () => {
            throw new Error("secret=/srv/private token=abc");
          },
        },
      }),
    );

    for (const url of [
      "/api/agents/qwen/services",
      "/api/agents/qwen/services/configFiles",
    ]) {
      const response = await app.request(url);
      expect(response.status).toBe(500);
      expect(await response.text()).not.toMatch(/private|token|abc/u);
    }
  });

  it("exposes authenticated config-file list, read, and optimistic write operations", async () => {
    const app = new Hono<{
      Variables: { userId: string; role: "admin" | "user" };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "admin-1");
      c.set("role", "admin");
      await next();
    });
    const agent = {
      id: "codex",
      paths: {
        root: "/srv/codex",
        configFileRelativePaths: ["config.toml"],
      },
    } as never;
    const configFilesService = {
      list: vi.fn(async () => [
        { path: "config.toml", isDirectory: false, size: 12 },
      ]),
      read: vi.fn(async () => ({
        path: "config.toml",
        content: "model = 'gpt-5'",
        isDirectory: false,
        encoding: "text" as const,
        revision: "rev-1",
      })),
      write: vi.fn(async () => ({
        path: "config.toml",
        content: "model = 'gpt-5.1'",
        isDirectory: false,
        encoding: "text" as const,
        revision: "rev-2",
      })),
    };
    app.route(
      "/api/agents",
      createAgentRoutes({
        inventoryService: {
          list: async () => ({ agents: [agent] }) as never,
        },
        settingsService: { get: () => DEFAULT_SETTINGS },
        configFilesService,
      }),
    );

    const listed = await app.request("/api/agents/codex/config-files");
    expect(listed.status).toBe(200);
    await expect(listed.json()).resolves.toMatchObject({
      data: [{ path: "config.toml", size: 12 }],
    });

    const read = await app.request("/api/agents/codex/config-files/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePath: "config.toml" }),
    });
    expect(read.status).toBe(200);
    await expect(read.json()).resolves.toMatchObject({
      data: { content: "model = 'gpt-5'", revision: "rev-1" },
    });

    const written = await app.request("/api/agents/codex/config-files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relativePath: "config.toml",
        content: "model = 'gpt-5.1'",
        expectedRevision: "rev-1",
      }),
    });
    expect(written.status).toBe(200);
    await expect(written.json()).resolves.toMatchObject({
      data: { content: "model = 'gpt-5.1'", revision: "rev-2" },
    });
    const context = {
      agentId: "codex",
      rootPath: "/srv/codex",
      relativePaths: ["config.toml"],
    };
    expect(configFilesService.list).toHaveBeenCalledWith(context);
    expect(configFilesService.read).toHaveBeenCalledWith(
      context,
      "config.toml",
    );
    expect(configFilesService.write).toHaveBeenCalledWith(
      context,
      "config.toml",
      "model = 'gpt-5.1'",
      "rev-1",
    );
  });

  it("guards config-file mutations by role, request shape, and stable errors", async () => {
    let role: "admin" | "user" = "user";
    const app = new Hono<{
      Variables: { userId: string; role: "admin" | "user" };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "actor-1");
      c.set("role", role);
      await next();
    });
    const configFilesService = {
      list: vi.fn(async () => []),
      read: vi.fn(async () => null),
      write: vi.fn(async () => {
        throw new Error("AGENT_CONFIG_CONCURRENT_CHANGE");
      }),
    };
    app.route(
      "/api/agents",
      createAgentRoutes({
        inventoryService: {
          list: async () =>
            ({
              agents: [
                {
                  id: "codex",
                  paths: {
                    root: "/srv/codex",
                    configFileRelativePaths: ["config.toml"],
                  },
                },
              ],
            }) as never,
        },
        settingsService: { get: () => DEFAULT_SETTINGS },
        configFilesService,
      }),
    );

    expect((await app.request("/api/agents/codex/config-files")).status).toBe(
      403,
    );
    expect(configFilesService.list).not.toHaveBeenCalled();

    role = "admin";
    const malformed = await app.request("/api/agents/codex/config-files/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ relativePath: 42 }),
    });
    expect(malformed.status).toBe(400);
    expect(configFilesService.read).not.toHaveBeenCalled();

    const conflict = await app.request("/api/agents/codex/config-files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relativePath: "config.toml",
        content: "model = 'gpt-5.1'",
        expectedRevision: "stale",
      }),
    });
    expect(conflict.status).toBe(409);
    await expect(conflict.json()).resolves.toEqual({
      error: {
        code: "CONFLICT",
        message: "Agent config changed on disk; reload before saving",
      },
    });

    configFilesService.write.mockRejectedValueOnce(
      new Error("AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE"),
    );
    const unavailable = await app.request("/api/agents/codex/config-files", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relativePath: "config.toml",
        content: "model = 'gpt-5.1'",
      }),
    });
    expect(unavailable.status).toBe(503);
    await expect(unavailable.json()).resolves.toEqual({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Configure AGENT_SECRET_KEY before editing Agent config files",
      },
    });
  });

  it("manages provider profiles for the selected server Agent without exposing secrets", async () => {
    const app = new Hono<{
      Variables: { userId: string; role: "admin" | "user" };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "admin-1");
      c.set("role", "admin");
      await next();
    });
    const profile = {
      id: "profile-1",
      platformId: "codex",
      name: "Primary",
      secretState: "available",
      updatedAt: 7,
    } as never;
    const providerProfilesService = {
      list: vi.fn(async () => [profile]),
      create: vi.fn(async () => profile),
      update: vi.fn(async () => profile),
      archive: vi.fn(async () => profile),
      duplicate: vi.fn(async () => profile),
      export: vi.fn(() => ({
        version: 1 as const,
        profile: {
          platformId: "codex",
          name: "Primary",
          providerKind: "openai",
          protocol: "openai",
          endpoint: null,
          config: {},
          source: "manual" as const,
        },
        modelMappings: [],
        requiresSecret: true,
      })),
      delete: vi.fn(async () => undefined),
    };
    app.route(
      "/api/agents",
      createAgentRoutes({
        inventoryService: {
          list: async () =>
            ({
              agents: [
                {
                  id: "codex",
                  paths: { root: "/srv/codex", configFileRelativePaths: [] },
                },
              ],
            }) as never,
        },
        settingsService: { get: () => DEFAULT_SETTINGS },
        providerProfilesService,
      }),
    );

    const createRequest = {
      profile: {
        platformId: "codex",
        name: "Primary",
        providerKind: "openai",
        protocol: "openai",
        endpoint: "https://api.example.test/v1",
        config: {},
        source: "manual",
      },
      modelMappings: [],
      secret: "write-only-secret",
    };
    const updateRequest = {
      id: "profile-1",
      expectedUpdatedAt: 7,
      profile: { name: "Updated" },
      secretAction: "preserve",
    };

    expect(
      (await app.request("/api/agents/codex/provider-profiles")).status,
    ).toBe(200);
    expect(
      (
        await app.request("/api/agents/codex/provider-profiles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createRequest),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request("/api/agents/codex/provider-profiles/profile-1", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updateRequest),
        })
      ).status,
    ).toBe(200);
    for (const [suffix, body] of [
      ["archive", { expectedUpdatedAt: 7 }],
      ["duplicate", { name: "Copy" }],
    ] as const) {
      expect(
        (
          await app.request(
            `/api/agents/codex/provider-profiles/profile-1/${suffix}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            },
          )
        ).status,
      ).toBe(200);
    }
    expect(
      (
        await app.request(
          "/api/agents/codex/provider-profiles/profile-1/export",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await app.request("/api/agents/codex/provider-profiles/profile-1", {
          method: "DELETE",
        })
      ).status,
    ).toBe(200);

    expect(providerProfilesService.list).toHaveBeenCalledWith({
      platformId: "codex",
    });
    expect(providerProfilesService.create).toHaveBeenCalledWith(createRequest);
    expect(providerProfilesService.update).toHaveBeenCalledWith(updateRequest);
    expect(providerProfilesService.archive).toHaveBeenCalledWith(
      "profile-1",
      7,
    );
    expect(providerProfilesService.duplicate).toHaveBeenCalledWith(
      "profile-1",
      "Copy",
    );
    expect(providerProfilesService.export).toHaveBeenCalledWith("profile-1");
    expect(providerProfilesService.delete).toHaveBeenCalledWith("profile-1");
    expect(JSON.stringify(await providerProfilesService.list())).not.toContain(
      "write-only-secret",
    );
  });

  it("serves bounded indexed session pages and redacted details", async () => {
    const app = new Hono<{
      Variables: { userId: string; role: "admin" | "user" };
    }>();
    app.use("*", async (c, next) => {
      c.set("userId", "admin-1");
      c.set("role", "admin");
      await next();
    });
    const sessionsService = {
      list: vi.fn(() => ({
        agentId: "codex",
        adapter: "web-session-index-v1",
        sessions: [],
        total: 0,
        hasMore: false,
      })),
      read: vi.fn(() => ({
        agentId: "codex",
        adapter: "web-session-index-v1",
        sessionId: "session-1",
        entries: [
          {
            id: "preview",
            role: "unknown" as const,
            timestamp: null,
            text: "[REDACTED]",
          },
        ],
        parseErrors: 0,
        truncated: true,
      })),
      state: vi.fn(() => ({
        supported: false,
        enabled: true,
        lastStatus: "ok" as const,
        lastScannedAt: 1,
        lastErrorCode: null,
      })),
    };
    app.route(
      "/api/agents",
      createAgentRoutes({
        inventoryService: {
          list: async () => ({ agents: [{ id: "codex", paths: {} }] }) as never,
        },
        settingsService: { get: () => DEFAULT_SETTINGS },
        sessionsService,
      }),
    );

    expect(
      (
        await app.request(
          "/api/agents/codex/sessions?limit=25&offset=5&search=deploy",
        )
      ).status,
    ).toBe(200);
    expect((await app.request("/api/agents/codex/sessions/state")).status).toBe(
      200,
    );
    const detail = await app.request("/api/agents/codex/sessions/session-1");
    expect(detail.status).toBe(200);
    expect(await detail.text()).not.toContain("sourcePath");
    expect(sessionsService.list).toHaveBeenCalledWith("codex", 25, 5, "deploy");
    expect(sessionsService.read).toHaveBeenCalledWith("codex", "session-1");
  });
});
