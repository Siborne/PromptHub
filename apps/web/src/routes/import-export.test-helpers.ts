import { issueSolvedCaptcha } from "../test-helpers/auth-captcha";

export const ENV_KEYS = [
  "PORT",
  "HOST",
  "JWT_SECRET",
  "JWT_ACCESS_TTL",
  "JWT_REFRESH_TTL",
  "DATA_ROOT",
  "ALLOW_REGISTRATION",
  "LOG_LEVEL",
] as const;

export const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
);
export const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export async function createTestApp(dataDir: string) {
  process.env.PORT = "3992";
  process.env.HOST = "127.0.0.1";
  process.env.JWT_SECRET = "test-secret-for-web-import-export-flow-1234567890";
  process.env.JWT_ACCESS_TTL = "900";
  process.env.JWT_REFRESH_TTL = "604800";
  process.env.DATA_ROOT = dataDir;
  process.env.ALLOW_REGISTRATION = "true";
  process.env.LOG_LEVEL = "debug";

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

export function streamedOversizedMultipartImportRequest(
  token: string,
): Request {
  const boundary = "----prompthub-import-stream-boundary";
  const encoder = new TextEncoder();
  const header = encoder.encode(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="file"; filename="backup.zip"\r\n' +
      "Content-Type: application/zip\r\n\r\n",
  );
  const footer = encoder.encode(`\r\n--${boundary}--\r\n`);
  const oversizedChunk = new Uint8Array(50 * 1024 * 1024 + 1);

  return new Request("http://local/api/import", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(header);
        controller.enqueue(oversizedChunk);
        controller.enqueue(footer);
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

export async function createFolder(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  body: Record<string, unknown>,
) {
  const response = await app.request(
    new Request("http://local/api/folders", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );

  const payload = (await response.json()) as {
    data?: { id: string; name: string; parentId?: string };
  };

  return { response, payload };
}

export async function createPrompt(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  body: Record<string, unknown>,
) {
  const response = await app.request(
    new Request("http://local/api/prompts", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );

  const payload = (await response.json()) as {
    data?: {
      id: string;
      title: string;
      currentVersion: number;
      folderId?: string | null;
    };
  };

  return { response, payload };
}

export async function uploadMedia(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  kind: "images" | "videos",
  fileName: string,
  content: string,
) {
  const response = await app.request(
    new Request(`http://local/api/media/${kind}/base64`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        fileName,
        base64Data: Buffer.from(content, "utf8").toString("base64"),
      }),
    }),
  );

  const payload = (await response.json()) as { data: string };
  return { response, payload };
}

export async function createSkill(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
  body: Record<string, unknown>,
) {
  const response = await app.request(
    new Request("http://local/api/skills", {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }),
  );

  const payload = (await response.json()) as {
    data?: {
      id: string;
      name: string;
      content?: string;
      instructions?: string;
    };
  };

  return { response, payload };
}

export async function exportPayload(
  app: Awaited<ReturnType<typeof createTestApp>>,
  token: string,
) {
  const response = await app.request(
    new Request("http://local/api/export", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );

  const payload = JSON.parse(await response.text()) as {
    version: string;
    exportedAt: string;
    prompts: Array<Record<string, unknown>>;
    promptVersions: Array<Record<string, unknown>>;
    versions: Array<Record<string, unknown>>;
    folders: Array<Record<string, unknown>>;
    rules?: Array<Record<string, unknown>>;
    skills: Array<Record<string, unknown>>;
    skillVersions: Array<Record<string, unknown>>;
    skillFiles?: Record<
      string,
      Array<{ relativePath: string; content: string }>
    >;
    images?: Record<string, string>;
    videos?: Record<string, string>;
    settings: Record<string, unknown>;
  };

  return { response, payload };
}
