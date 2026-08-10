import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";

import type { AgentUsageMetric } from "@prompthub/shared/types";
import {
  boundUsageMetrics,
  percentageFromRemaining,
} from "./agent-usage-contract";
import type { NativeCommandRunner } from "./native-command";

const GET_USER_STATUS_PATH =
  "/exa.language_server_pb.LanguageServerService/GetUserStatus";
const GET_QUOTA_SUMMARY_PATH =
  "/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary";
const COMMAND_TIMEOUT_MS = 5_000;
const COMMAND_MAX_BUFFER = 512 * 1024;
const REQUEST_TIMEOUT_MS = 4_000;
const HELPER_REQUEST_TIMEOUT_MS = 15_000;
const RESPONSE_MAX_BYTES = 1024 * 1024;
const HELPER_START_TIMEOUT_MS = 15_000;
const HELPER_STOP_TIMEOUT_MS = 1_000;
const HELPER_OUTPUT_MAX_BYTES = 256 * 1024;
const HELPER_QUERY_TIMEOUT_MS = 15_000;
const HELPER_RETRY_DELAY_MS = 400;
const APP_VERSION_TIMEOUT_MS = 2_000;
const APP_VERSION_MAX_BUFFER = 16 * 1024;
const ANTIGRAVITY_PROTOCOL_FALLBACK_VERSION = "2.0.0";

interface AntigravityProcessInfo {
  pid: number;
  csrfToken: string;
  extensionPort: number | null;
}

export interface AntigravityLocalUsageSnapshot {
  plan: string | null;
  metrics: AgentUsageMetric[];
}

export type AntigravityLocalUsageResult =
  | ({ kind: "ok" } & AntigravityLocalUsageSnapshot)
  | { kind: "not-running" }
  | { kind: "unavailable"; errorCode: string };

export type AntigravityLocalRequestResult =
  | { kind: "ok"; body: unknown }
  | { kind: "unavailable"; errorCode: string };

export interface AntigravityLocalUsageClient {
  getUsage(): Promise<AntigravityLocalUsageResult>;
}

interface AntigravityHelperProcess {
  exitCode: number | null;
  stdin: { end(): void };
  stdout: NodeJS.ReadableStream;
  stderr: NodeJS.ReadableStream;
  kill(signal?: NodeJS.Signals): boolean;
  once(event: "error" | "exit", listener: (...args: unknown[]) => void): this;
}

interface AntigravityBackgroundUsageProbeOptions {
  platform?: NodeJS.Platform;
  homeDir?: string;
  fileExists?: (candidate: string) => Promise<boolean>;
  reservePort?: () => Promise<number>;
  randomToken?: () => string;
  resolveAppVersion?: (binaryPath: string) => Promise<string | null>;
  spawnProcess?: (
    binaryPath: string,
    args: string[],
  ) => AntigravityHelperProcess;
  request?: (input: {
    port: number;
    csrfToken: string;
    path: string;
  }) => Promise<AntigravityLocalRequestResult>;
  startupTimeoutMs?: number;
  stopTimeoutMs?: number;
  queryTimeoutMs?: number;
  retryDelayMs?: number;
}

interface AntigravityLocalUsageClientOptions {
  commandRunner: NativeCommandRunner;
  platform?: NodeJS.Platform;
  request?: (input: {
    port: number;
    csrfToken: string;
    path: string;
  }) => Promise<AntigravityLocalRequestResult>;
  probeBackgroundUsage?: () => Promise<AntigravityLocalUsageResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validPort(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 65_535;
}

export function getAntigravityHelperBinaryCandidates(
  platform: NodeJS.Platform,
  homeDir: string,
): string[] {
  if (platform !== "darwin") return [];
  return [
    "/Applications/Antigravity.app/Contents/Resources/bin/language_server",
    path.join(
      homeDir,
      "Applications",
      "Antigravity.app",
      "Contents",
      "Resources",
      "bin",
      "language_server",
    ),
  ];
}

export function parseAntigravityHelperReadyPort(output: string): number | null {
  const match = output.match(/listening on \w+ port at (\d+) for HTTP\b/i);
  if (!match) return null;
  const port = Number(match[1]);
  return validPort(port) ? port : null;
}

function normalizeAntigravityAppVersion(value: string): string | null {
  const version = value.trim();
  return /^\d+(?:\.\d+){1,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(version)
    ? version
    : null;
}

async function resolveInstalledAntigravityVersion(
  binaryPath: string,
): Promise<string | null> {
  const infoPlistPath = path.join(
    path.dirname(binaryPath),
    "..",
    "..",
    "Info.plist",
  );
  return new Promise((resolve) => {
    execFile(
      "/usr/bin/plutil",
      ["-extract", "CFBundleShortVersionString", "raw", infoPlistPath],
      {
        encoding: "utf8",
        timeout: APP_VERSION_TIMEOUT_MS,
        maxBuffer: APP_VERSION_MAX_BUFFER,
      },
      (error, stdout) => {
        resolve(error ? null : normalizeAntigravityAppVersion(stdout));
      },
    );
  });
}

export function parseAntigravityProcessList(
  stdout: string,
): AntigravityProcessInfo[] {
  const processes: AntigravityProcessInfo[] = [];
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const commandLine = match[2];
    const lower = commandLine.toLowerCase();
    const isLanguageServer = /(?:^|[\\/\s])language_server[^\s]*/i.test(
      commandLine,
    );
    const isAntigravity =
      lower.includes("antigravity.app") ||
      lower.includes("/antigravity/") ||
      lower.includes("\\antigravity\\") ||
      /--app_data_dir(?:=|\s+)["']?antigravity(?:["']?)(?:\s|$)/i.test(
        commandLine,
      );
    const tokenMatch = commandLine.match(
      /--csrf_token(?:=|\s+)([a-z0-9_-]{16,512})(?:\s|$)/i,
    );
    if (
      !Number.isSafeInteger(pid) ||
      pid <= 0 ||
      !isLanguageServer ||
      !isAntigravity ||
      !tokenMatch
    ) {
      continue;
    }
    const portMatch = commandLine.match(
      /--extension_server_port(?:=|\s+)(\d+)(?:\s|$)/,
    );
    const extensionPort = portMatch ? Number(portMatch[1]) : null;
    processes.push({
      pid,
      csrfToken: tokenMatch[1],
      extensionPort:
        extensionPort !== null && validPort(extensionPort)
          ? extensionPort
          : null,
    });
  }
  return processes;
}

export function parseLoopbackListeningPorts(stdout: string): number[] {
  const ports = new Set<number>();
  for (const line of stdout.split(/\r?\n/)) {
    const match = line.match(
      /TCP\s+(?:127\.0\.0\.1|localhost|\[::1\]):(\d+).*\(LISTEN\)/i,
    );
    if (!match) continue;
    const port = Number(match[1]);
    if (validPort(port)) ports.add(port);
  }
  return [...ports].sort((left, right) => left - right);
}

export function mapAntigravityLocalUsage(
  body: unknown,
): AntigravityLocalUsageSnapshot | null {
  if (!isRecord(body) || !isRecord(body.userStatus)) return null;
  const userStatus = body.userStatus;
  const tier = isRecord(userStatus.userTier) ? userStatus.userTier : null;
  return {
    plan: nonEmptyString(tier?.name),
    metrics: [],
  };
}

export function mapAntigravityQuotaSummary(body: unknown): AgentUsageMetric[] {
  if (!isRecord(body)) return [];
  const response = isRecord(body.response) ? body.response : body;
  const groups = Array.isArray(response.groups) ? response.groups : [];
  const metrics: AgentUsageMetric[] = [];
  const seenIds = new Set<string>();

  for (const [groupIndex, group] of groups.entries()) {
    if (!isRecord(group)) continue;
    const label = nonEmptyString(group.displayName);
    const buckets = Array.isArray(group.buckets) ? group.buckets : [];
    if (!label) continue;
    for (const bucket of buckets) {
      if (!isRecord(bucket)) continue;
      const bucketId = nonEmptyString(bucket.bucketId);
      const window = nonEmptyString(bucket.window);
      const remaining = finiteNumber(bucket.remainingFraction);
      if (!bucketId || !window || remaining === null) continue;
      const id = `antigravity:${bucketId}:${window}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      metrics.push({
        id,
        label:
          window === "weekly"
            ? "Weekly quota"
            : window === "5h"
              ? "5-hour window"
              : window,
        scope: {
          kind: "model-group",
          id: `group-${groupIndex}`,
          label,
        },
        period:
          window === "weekly"
            ? { kind: "calendar", unit: "week" }
            : {
                kind: "rolling",
                durationSeconds: window === "5h" ? 18_000 : null,
              },
        value: percentageFromRemaining(remaining * 100),
        resetsAt: parseTimestamp(bucket.resetTime),
      });
    }
  }

  return boundUsageMetrics(metrics);
}

function classifyRequestError(error: unknown): string {
  if (!isRecord(error)) return "local-session-unavailable";
  if (error.name === "AbortError" || error.code === "ETIMEDOUT") {
    return "timeout";
  }
  if (error.code === "ECONNREFUSED" || error.code === "ECONNRESET") {
    return "connection-refused";
  }
  return "local-session-unavailable";
}

function requestLocalUsageWithClient(
  client: typeof https | typeof http,
  port: number,
  csrfToken: string,
  requestPath: string,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<AntigravityLocalRequestResult> {
  return new Promise((resolve) => {
    const requestBody = JSON.stringify({
      metadata: {
        ideName: "antigravity",
        extensionName: "antigravity",
        locale: "en",
      },
    });
    const request = client.request(
      {
        hostname: "127.0.0.1",
        port,
        path: requestPath,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
          "Connect-Protocol-Version": "1",
          "X-Codeium-Csrf-Token": csrfToken,
        },
        rejectUnauthorized: false,
        timeout: timeoutMs,
      },
      (response) => {
        let size = 0;
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.byteLength;
          if (size > RESPONSE_MAX_BYTES) {
            request.destroy();
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          if (size > RESPONSE_MAX_BYTES) {
            resolve({ kind: "unavailable", errorCode: "response-too-large" });
            return;
          }
          if (response.statusCode !== 200) {
            resolve({ kind: "unavailable", errorCode: "local-http-error" });
            return;
          }
          try {
            resolve({
              kind: "ok",
              body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
            });
          } catch {
            resolve({ kind: "unavailable", errorCode: "invalid-response" });
          }
        });
      },
    );
    request.on("timeout", () => request.destroy(new Error("request timeout")));
    request.on("error", (error) => {
      resolve({ kind: "unavailable", errorCode: classifyRequestError(error) });
    });
    request.end(requestBody);
  });
}

async function requestAntigravityLocalUsage(input: {
  port: number;
  csrfToken: string;
  path: string;
}): Promise<AntigravityLocalRequestResult> {
  const secure = await requestLocalUsageWithClient(
    https,
    input.port,
    input.csrfToken,
    input.path,
  );
  if (
    secure.kind === "unavailable" &&
    secure.errorCode === "local-session-unavailable"
  ) {
    return requestLocalUsageWithClient(
      http,
      input.port,
      input.csrfToken,
      input.path,
    );
  }
  return secure;
}

async function requestAntigravityBackgroundUsage(input: {
  port: number;
  csrfToken: string;
  path: string;
}): Promise<AntigravityLocalRequestResult> {
  return requestLocalUsageWithClient(
    http,
    input.port,
    input.csrfToken,
    input.path,
    HELPER_REQUEST_TIMEOUT_MS,
  );
}

async function reserveLoopbackPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) reject(error);
        else if (validPort(port)) resolve(port);
        else reject(new Error("Failed to reserve Antigravity helper port"));
      });
    });
  });
}

async function stopAntigravityHelper(
  child: AntigravityHelperProcess,
  timeoutMs: number,
): Promise<void> {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    child.once("exit", finish);
    timer = setTimeout(finish, timeoutMs);
  });
  if (child.exitCode === null) child.kill("SIGKILL");
}

function waitForAntigravityHelper(
  child: AntigravityHelperProcess,
  timeoutMs: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let output = "";
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;
    const finish = (error: Error | null, port?: number) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(port!);
    };
    const consume = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (Buffer.byteLength(output) > HELPER_OUTPUT_MAX_BYTES) {
        finish(new Error("Antigravity helper output exceeded limit"));
        return;
      }
      const port = parseAntigravityHelperReadyPort(output);
      if (port !== null) finish(null, port);
    };
    child.stdout.on("data", consume);
    child.stderr.on("data", consume);
    child.once("error", () =>
      finish(new Error("Antigravity helper failed to start")),
    );
    child.once("exit", () =>
      finish(new Error("Antigravity helper exited before ready")),
    );
    timer = setTimeout(
      () => finish(new Error("Antigravity helper startup timed out")),
      timeoutMs,
    );
  });
}

function isRetryableHelperRequestError(errorCode: string): boolean {
  return [
    "connection-refused",
    "local-http-error",
    "local-session-unavailable",
    "timeout",
  ].includes(errorCode);
}

async function requestBackgroundQuotaWithRetry(
  request: NonNullable<AntigravityBackgroundUsageProbeOptions["request"]>,
  input: { port: number; csrfToken: string; path: string },
  timeoutMs: number,
  retryDelayMs: number,
): Promise<AntigravityLocalRequestResult> {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  while (true) {
    const result = await request(input);
    if (result.kind === "ok") return result;
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0 || !isRetryableHelperRequestError(result.errorCode)) {
      return result;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, Math.min(Math.max(0, retryDelayMs), remainingMs)),
    );
  }
}

export async function probeAntigravityBackgroundUsage(
  options: AntigravityBackgroundUsageProbeOptions = {},
): Promise<AntigravityLocalUsageResult> {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();
  const fileExists =
    options.fileExists ??
    (async (candidate: string) => {
      try {
        await fs.access(candidate);
        return true;
      } catch {
        return false;
      }
    });
  const candidates = getAntigravityHelperBinaryCandidates(platform, homeDir);
  let binaryPath: string | null = null;
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      binaryPath = candidate;
      break;
    }
  }
  if (!binaryPath) return { kind: "not-running" };

  const reservePort = options.reservePort ?? reserveLoopbackPort;
  const randomToken =
    options.randomToken ?? (() => randomBytes(24).toString("hex"));
  const resolveAppVersion =
    options.resolveAppVersion ?? resolveInstalledAntigravityVersion;
  const spawnProcess =
    options.spawnProcess ??
    ((binary: string, args: string[]) =>
      spawn(binary, args, {
        env: process.env,
        stdio: ["pipe", "pipe", "pipe"],
      }) as unknown as AntigravityHelperProcess);
  const request = options.request ?? requestAntigravityBackgroundUsage;
  let requestedPort: number;
  let csrfToken: string;
  let child: AntigravityHelperProcess;
  try {
    requestedPort = await reservePort();
    csrfToken = randomToken();
    const appVersion =
      normalizeAntigravityAppVersion(
        (await resolveAppVersion(binaryPath).catch(() => null)) ?? "",
      ) ?? ANTIGRAVITY_PROTOCOL_FALLBACK_VERSION;
    child = spawnProcess(binaryPath, [
      "--standalone",
      "--override_ide_name",
      "antigravity",
      "--subclient_type",
      "hub",
      "--override_ide_version",
      appVersion,
      "--override_user_agent_name",
      "antigravity",
      "--disable_telemetry",
      "--use_ls_chrome_devtools_mcp=false",
      "--http_server_port",
      String(requestedPort),
      "--csrf_token",
      csrfToken,
      "--app_data_dir",
      "antigravity",
      "--api_server_url",
      "https://generativelanguage.googleapis.com",
      "--cloud_code_endpoint",
      "https://daily-cloudcode-pa.googleapis.com",
    ]);
  } catch {
    return { kind: "unavailable", errorCode: "background-helper-unavailable" };
  }
  try {
    child.stdin.end();
    const port = await waitForAntigravityHelper(
      child,
      options.startupTimeoutMs ?? HELPER_START_TIMEOUT_MS,
    );
    const summary = await requestBackgroundQuotaWithRetry(
      request,
      {
        port,
        csrfToken,
        path: GET_QUOTA_SUMMARY_PATH,
      },
      options.queryTimeoutMs ?? HELPER_QUERY_TIMEOUT_MS,
      options.retryDelayMs ?? HELPER_RETRY_DELAY_MS,
    );
    if (summary.kind === "unavailable") return summary;

    const status = await request({
      port,
      csrfToken,
      path: GET_USER_STATUS_PATH,
    });
    const snapshot =
      status.kind === "ok" ? mapAntigravityLocalUsage(status.body) : null;
    const metrics = boundUsageMetrics([
      ...(snapshot?.metrics ?? []),
      ...mapAntigravityQuotaSummary(summary.body),
    ]);
    if (metrics.length === 0) {
      return { kind: "unavailable", errorCode: "invalid-response" };
    }
    return {
      kind: "ok",
      plan: snapshot?.plan ?? null,
      metrics,
    };
  } catch {
    return { kind: "unavailable", errorCode: "background-helper-unavailable" };
  } finally {
    await stopAntigravityHelper(
      child,
      options.stopTimeoutMs ?? HELPER_STOP_TIMEOUT_MS,
    );
  }
}

async function resolveListeningPorts(
  commandRunner: NativeCommandRunner,
  processInfo: AntigravityProcessInfo,
): Promise<number[]> {
  const ports = new Set<number>();
  if (processInfo.extensionPort !== null) ports.add(processInfo.extensionPort);
  const lsof = await commandRunner.resolve("lsof");
  if (!lsof) return [...ports];
  try {
    const result = await commandRunner.run(
      lsof,
      ["-Pan", "-p", String(processInfo.pid), "-iTCP", "-sTCP:LISTEN"],
      { timeout: COMMAND_TIMEOUT_MS, maxBuffer: COMMAND_MAX_BUFFER },
    );
    for (const port of parseLoopbackListeningPorts(result.stdout)) {
      ports.add(port);
    }
  } catch {
    // The command-line extension port remains a useful bounded fallback.
  }
  return [...ports];
}

export function createAntigravityLocalUsageClient(
  options: AntigravityLocalUsageClientOptions,
): AntigravityLocalUsageClient {
  const platform = options.platform ?? process.platform;
  const request = options.request ?? requestAntigravityLocalUsage;
  const probeBackgroundUsage =
    options.probeBackgroundUsage ??
    (() =>
      probeAntigravityBackgroundUsage({
        platform,
        request: options.request,
      }));

  return {
    async getUsage(): Promise<AntigravityLocalUsageResult> {
      if (platform === "win32") return probeBackgroundUsage();
      const ps = await options.commandRunner.resolve("ps");
      if (!ps) return probeBackgroundUsage();
      let processOutput: string;
      try {
        const result = await options.commandRunner.run(
          ps,
          ["-ww", "-axo", "pid=,command="],
          { timeout: COMMAND_TIMEOUT_MS, maxBuffer: COMMAND_MAX_BUFFER },
        );
        processOutput = result.stdout;
      } catch {
        return probeBackgroundUsage();
      }
      const processes = parseAntigravityProcessList(processOutput);
      if (processes.length === 0) return probeBackgroundUsage();

      let lastError = "local-session-unavailable";
      for (const processInfo of processes) {
        const ports = await resolveListeningPorts(
          options.commandRunner,
          processInfo,
        );
        for (const port of ports) {
          const response = await request({
            port,
            csrfToken: processInfo.csrfToken,
            path: GET_USER_STATUS_PATH,
          });
          if (response.kind === "unavailable") {
            lastError = response.errorCode;
            continue;
          }
          const snapshot = mapAntigravityLocalUsage(response.body);
          if (snapshot) {
            const summary = await request({
              port,
              csrfToken: processInfo.csrfToken,
              path: GET_QUOTA_SUMMARY_PATH,
            });
            return {
              kind: "ok",
              ...snapshot,
              metrics: boundUsageMetrics([
                ...snapshot.metrics,
                ...(summary.kind === "ok"
                  ? mapAntigravityQuotaSummary(summary.body)
                  : []),
              ]),
            };
          }
          lastError = "invalid-response";
        }
      }
      return { kind: "unavailable", errorCode: lastError };
    },
  };
}
