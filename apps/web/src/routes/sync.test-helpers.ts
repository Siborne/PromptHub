import { afterEach, beforeEach, vi } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { closeDatabase } from "@prompthub/db";
import { issueSolvedCaptcha } from "../test-helpers/auth-captcha";

const ENV_KEYS = [
  "PORT",
  "HOST",
  "JWT_SECRET",
  "JWT_ACCESS_TTL",
  "JWT_REFRESH_TTL",
  "DATA_ROOT",
  "ALLOW_REGISTRATION",
  "LOG_LEVEL",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);

export interface WebDavMockSet {
  testWebDavConnection?: ReturnType<typeof vi.fn>;
  pushWebDavFile?: ReturnType<typeof vi.fn>;
  pullWebDavFile?: ReturnType<typeof vi.fn>;
  mkcolWebDavDirectory?: ReturnType<typeof vi.fn>;
}

export function getMockCall(
  mockFn: ReturnType<typeof vi.fn>,
  index: number,
): unknown[] {
  return (mockFn.mock.calls as unknown[][])[index] ?? [];
}

export function ensureTestMediaDir(
  dataDir: string,
  userId: string,
  kind: "images" | "videos",
): string {
  const dirPath = path.join(dataDir, "data", "assets", userId, kind);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

function isSafeWebDavRemotePathMock(value: string): boolean {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, "");
  if (trimmed.includes("\\") || /[\u0000-\u001F\u007F]/u.test(trimmed)) {
    return false;
  }
  return !trimmed
    .split("/")
    .some((segment) => segment === "." || segment === "..");
}

function isHttpsWebDavEndpointMock(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function mediaManifestEntry(base64Data: string, uploadedAt: string) {
  return {
    hash: createHash("sha256").update(base64Data).digest("hex"),
    size: Buffer.from(base64Data, "base64").length,
    uploadedAt,
  };
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function createTestApp(
  dataDir: string,
  webDavMocks?: WebDavMockSet,
) {
  process.env.PORT = "3991";
  process.env.HOST = "127.0.0.1";
  process.env.JWT_SECRET = "test-secret-for-web-sync-flow-1234567890";
  process.env.JWT_ACCESS_TTL = "900";
  process.env.JWT_REFRESH_TTL = "604800";
  process.env.DATA_ROOT = dataDir;
  process.env.ALLOW_REGISTRATION = "true";
  process.env.LOG_LEVEL = "debug";

  vi.doMock("../services/webdav.server.js", () => ({
    testWebDavConnection:
      webDavMocks?.testWebDavConnection ??
      vi.fn(async () => ({ ok: true, status: 207 })),
    pushWebDavFile:
      webDavMocks?.pushWebDavFile ??
      vi.fn(async () => ({ ok: true, status: 201 })),
    pullWebDavFile:
      webDavMocks?.pullWebDavFile ??
      vi.fn(async () => ({ ok: true, status: 200, body: "{}" })),
    mkcolWebDavDirectory:
      webDavMocks?.mkcolWebDavDirectory ??
      vi.fn(async () => ({ ok: true, status: 201 })),
    isHttpsWebDavEndpoint: isHttpsWebDavEndpointMock,
    isSafeWebDavRemotePath: isSafeWebDavRemotePathMock,
  }));

  const [{ createApp }] = await Promise.all([import("../app")]);
  return createApp();
}

export async function registerUser(
  app: Awaited<ReturnType<typeof createTestApp>>,
  username: string,
  password: string,
) {
  const captcha = await issueSolvedCaptcha(app);
  const response = await app.request(
    new Request("http://local/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, ...captcha }),
    }),
  );

  const payload = (await response.json()) as {
    data: {
      user: { id: string; username: string; role: "admin" | "user" };
      accessToken: string;
    };
  };

  return { response, payload };
}

export function authHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function createFolder(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  body: Record<string, unknown>,
) {
  return app.request(
    new Request("http://local/api/folders", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

export async function createPrompt(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  body: Record<string, unknown>,
) {
  return app.request(
    new Request("http://local/api/prompts", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

export async function createSkill(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  body: Record<string, unknown>,
) {
  return app.request(
    new Request("http://local/api/skills", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );
}

// Sync route tests use real SQLite, archive, and password hashing workflows.
export const SYNC_ROUTE_TEST_TIMEOUT = 60000;

export function setupSyncRouteTestLifecycle(): void {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.doUnmock("../services/webdav.server.js");
  });

  afterEach(() => {
    closeDatabase();
    vi.doUnmock("../services/webdav.server.js");
    for (const key of ENV_KEYS) {
      const value = originalEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}
