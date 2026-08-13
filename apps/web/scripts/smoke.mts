import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          reject(new Error("Failed to resolve free port"));
        });
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

async function waitForHealth(url: string, attempts = 50): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Health check did not become ready: ${url}`);
}

async function expectJson<T>(
  response: Response,
  expectedStatus: number,
): Promise<T> {
  const body = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected ${expectedStatus}, got ${response.status}: ${body}`,
    );
  }

  return JSON.parse(body) as T;
}

async function main(): Promise<void> {
  const port = await getFreePort();
  const dataDir = mkdtempSync(path.join(os.tmpdir(), "prompthub-web-smoke-"));
  const username = `smokeuser_${Date.now()}`;
  const password = "smokepass001";

  const server = spawn("node", ["dist/server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      JWT_SECRET: "smoke-secret-for-web-server-1234567890",
      JWT_ACCESS_TTL: "900",
      JWT_REFRESH_TTL: "604800",
      DATA_ROOT: dataDir,
      ALLOW_REGISTRATION: "true",
      AUTH_CAPTCHA_ENABLED: "false",
      LOG_LEVEL: "debug",
    },
    stdio: "inherit",
  });

  try {
    await waitForHealth(`http://127.0.0.1:${port}/health`);

    const registerResponse = await fetch(
      `http://127.0.0.1:${port}/api/auth/register`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      },
    );

    const registerPayload = await expectJson<{
      data: {
        user: { username: string; role: "admin" | "user" };
        accessToken: string;
        refreshToken: string;
      };
    }>(registerResponse, 201);

    if (registerPayload.data.user.username !== username) {
      throw new Error("Registered username did not match request");
    }

    const loginResponse = await fetch(
      `http://127.0.0.1:${port}/api/auth/login`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      },
    );

    const loginPayload = await expectJson<{
      data: {
        user: { username: string };
        accessToken: string;
        refreshToken: string;
      };
    }>(loginResponse, 200);

    if (loginPayload.data.user.username !== username) {
      throw new Error("Logged-in username did not match registered user");
    }

    if (!loginPayload.data.accessToken || !loginPayload.data.refreshToken) {
      throw new Error("Login did not return a full token pair");
    }

    process.stdout.write(`Smoke passed on http://127.0.0.1:${port}\n`);
  } finally {
    await stopServer(server);
    rmSync(dataDir, { recursive: true, force: true });
  }
}

async function stopServer(server: ReturnType<typeof spawn>): Promise<void> {
  if (server.exitCode !== null || server.signalCode !== null) return;
  await new Promise<void>((resolve) => {
    const forceTimer = setTimeout(() => server.kill("SIGKILL"), 5000);
    server.once("exit", () => {
      clearTimeout(forceTimer);
      resolve();
    });
    server.kill("SIGTERM");
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
