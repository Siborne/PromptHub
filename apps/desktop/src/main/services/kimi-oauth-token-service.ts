import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const KIMI_OAUTH_ENDPOINT = "https://auth.kimi.com/api/oauth/token";
const KIMI_CLIENT_ID = "17e5f671-d194-4dfb-9706-5516cb48c098";
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_REFRESH_ATTEMPTS = 3;
const DEFAULT_LOCK_ATTEMPTS = 20;
const LOCK_RETRY_MS = 250;
const LOCK_HEARTBEAT_MS = 2_000;

export type KimiAccessTokenResult =
  | { kind: "ok"; accessToken: string }
  | { kind: "no-credentials" }
  | { kind: "expired" }
  | { kind: "unavailable"; errorCode: string };

interface KimiCredential {
  accessToken: string;
  refreshToken: string | null;
  expiresAtMs: number | null;
  expiresIn: number;
  payload: Record<string, unknown>;
}

interface RefreshedToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}

type RefreshResult =
  | { kind: "ok"; token: RefreshedToken }
  | { kind: "expired" }
  | { kind: "unavailable"; errorCode: string };

export interface KimiOAuthTokenService {
  getAccessToken(
    configRoot: string,
    options?: { forceRefresh?: boolean },
  ): Promise<KimiAccessTokenResult>;
}

interface KimiOAuthTokenServiceOptions {
  fetchImpl?: typeof fetch;
  lockHeartbeatMs?: number;
  lockAttempts?: number;
  now?: () => number;
  platform?: NodeJS.Platform;
  readFile?: (filePath: string) => Promise<string>;
  sleep?: (ms: number) => Promise<void>;
  validateCredentialFile?: boolean;
  writeCredentials?: (filePath: string, content: string) => Promise<void>;
}

interface KimiOAuthRuntime {
  fetchImpl: typeof fetch;
  inFlight: Map<string, Promise<KimiAccessTokenResult>>;
  lockHeartbeatMs: number;
  lockAttempts: number;
  now: () => number;
  platform: NodeJS.Platform;
  readFile: (filePath: string) => Promise<string>;
  sleep: (ms: number) => Promise<void>;
  validateCredentialFile: boolean;
  writeCredentials: (filePath: string, content: string) => Promise<void>;
}

type RefreshAttemptResult =
  | RefreshResult
  | { kind: "retry"; errorCode: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseExpiry(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 10_000_000_000 ? value * 1_000 : value;
  }
  if (typeof value !== "string" || !value.trim()) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 10_000_000_000 ? numeric * 1_000 : numeric;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCredential(raw: string): KimiCredential | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const accessToken = parsed.access_token;
  if (typeof accessToken !== "string" || !accessToken.trim()) return null;
  const refreshToken = parsed.refresh_token;
  const expiresIn = Number(parsed.expires_in);
  return {
    accessToken,
    refreshToken:
      typeof refreshToken === "string" && refreshToken.trim()
        ? refreshToken
        : null,
    expiresAtMs: parseExpiry(parsed.expires_at),
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 0,
    payload: parsed,
  };
}

function shouldRefresh(
  credential: KimiCredential,
  now: number,
  forceRefresh: boolean,
): boolean {
  if (forceRefresh) return true;
  if (credential.expiresAtMs === null || credential.expiresAtMs === 0) {
    return false;
  }
  const thresholdSeconds = Math.max(300, credential.expiresIn * 0.5);
  return credential.expiresAtMs - now <= thresholdSeconds * 1_000;
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function atomicWritePrivateFile(
  filePath: string,
  content: string,
): Promise<void> {
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(temporaryPath, "wx", 0o600);
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temporaryPath, filePath);
    await fs.chmod(filePath, 0o600).catch(() => undefined);
  } finally {
    await handle?.close().catch(() => undefined);
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
  }
}

async function credentialFileSafety(
  filePath: string,
): Promise<"safe" | "missing" | "unsafe"> {
  try {
    const stats = await fs.lstat(filePath);
    return stats.isFile() && !stats.isSymbolicLink() ? "safe" : "unsafe";
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "missing"
      : "unsafe";
  }
}

function parseRefreshedToken(body: unknown): RefreshedToken | null {
  if (!isRecord(body)) return null;
  const accessToken = body.access_token;
  const refreshToken = body.refresh_token;
  const expiresIn = Number(body.expires_in);
  if (
    typeof accessToken !== "string" ||
    !accessToken ||
    typeof refreshToken !== "string" ||
    !refreshToken ||
    !Number.isFinite(expiresIn) ||
    expiresIn <= 0
  ) {
    return null;
  }
  return {
    accessToken,
    refreshToken,
    expiresIn,
    scope: typeof body.scope === "string" ? body.scope : "",
    tokenType: typeof body.token_type === "string" ? body.token_type : "Bearer",
  };
}

function refreshPayload(
  credential: KimiCredential,
  token: RefreshedToken,
  now: number,
): string {
  return `${JSON.stringify(
    {
      ...credential.payload,
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expires_at: Math.floor(now / 1_000) + token.expiresIn,
      expires_in: token.expiresIn,
      scope: token.scope,
      token_type: token.tokenType,
    },
    null,
    2,
  )}\n`;
}

async function readCredential(
  runtime: KimiOAuthRuntime,
  filePath: string,
): Promise<KimiCredential | null> {
  try {
    return parseCredential(await runtime.readFile(filePath));
  } catch {
    return null;
  }
}

function lockRelease(
  lockPath: string,
  heartbeatMs: number,
): () => Promise<void> {
  const heartbeat = setInterval(() => {
    const timestamp = new Date();
    void fs.utimes(lockPath, timestamp, timestamp).catch(() => undefined);
  }, heartbeatMs);
  heartbeat.unref();
  return async () => {
    clearInterval(heartbeat);
    await fs.rmdir(lockPath).catch(() => undefined);
  };
}

async function acquireLock(
  runtime: KimiOAuthRuntime,
  configRoot: string,
): Promise<(() => Promise<void>) | null> {
  if (runtime.platform === "win32") return async () => undefined;
  const oauthDir = path.join(configRoot, "oauth");
  const targetPath = path.join(oauthDir, "kimi-code");
  const lockPath = `${targetPath}.lock`;
  await fs.mkdir(oauthDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(targetPath, "", { flag: "a", mode: 0o600 });
  for (let attempt = 0; attempt < runtime.lockAttempts; attempt += 1) {
    try {
      await fs.mkdir(lockPath);
      return lockRelease(lockPath, runtime.lockHeartbeatMs);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      if (attempt < runtime.lockAttempts - 1) {
        await runtime.sleep(LOCK_RETRY_MS);
      }
    }
  }
  return null;
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

function classifyRefreshResponse(
  response: Response,
  body: unknown,
): RefreshAttemptResult {
  const errorCode = isRecord(body) ? body.error : null;
  if (
    response.status === 401 ||
    response.status === 403 ||
    errorCode === "invalid_grant"
  ) {
    return { kind: "expired" };
  }
  if (response.ok) {
    const token = parseRefreshedToken(body);
    return token
      ? { kind: "ok", token }
      : { kind: "unavailable", errorCode: "invalid-response" };
  }
  return [429, 500, 502, 503, 504].includes(response.status)
    ? { kind: "retry", errorCode: "http-error" }
    : { kind: "unavailable", errorCode: "http-error" };
}

async function requestRefreshOnce(
  runtime: KimiOAuthRuntime,
  refreshToken: string,
): Promise<RefreshAttemptResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await runtime.fetchImpl(KIMI_OAUTH_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: KIMI_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
      signal: controller.signal,
    });
    const result = classifyRefreshResponse(
      response,
      await responseBody(response),
    );
    clearTimeout(timer);
    return result;
  } catch (error) {
    clearTimeout(timer);
    return {
      kind: "retry",
      errorCode:
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "network-error",
    };
  }
}

async function requestRefresh(
  runtime: KimiOAuthRuntime,
  refreshToken: string,
): Promise<RefreshResult> {
  let lastErrorCode = "network-error";
  for (let attempt = 0; attempt < MAX_REFRESH_ATTEMPTS; attempt += 1) {
    const result = await requestRefreshOnce(runtime, refreshToken);
    if (result.kind !== "retry") return result;
    lastErrorCode = result.errorCode;
    if (attempt < MAX_REFRESH_ATTEMPTS - 1) {
      await runtime.sleep(250 * 2 ** attempt);
    }
  }
  return { kind: "unavailable", errorCode: lastErrorCode };
}

async function persistRefreshedToken(
  runtime: KimiOAuthRuntime,
  filePath: string,
  credential: KimiCredential,
  token: RefreshedToken,
): Promise<KimiAccessTokenResult> {
  if (
    runtime.validateCredentialFile &&
    (await credentialFileSafety(filePath)) !== "safe"
  ) {
    return { kind: "unavailable", errorCode: "unsafe-credential-file" };
  }
  try {
    await runtime.writeCredentials(
      filePath,
      refreshPayload(credential, token, runtime.now()),
    );
    return { kind: "ok", accessToken: token.accessToken };
  } catch {
    return { kind: "unavailable", errorCode: "credential-write-error" };
  }
}

async function refreshUnderLock(
  runtime: KimiOAuthRuntime,
  filePath: string,
  forceRefresh: boolean,
  initialAccessToken: string,
): Promise<KimiAccessTokenResult> {
  const credential = await readCredential(runtime, filePath);
  if (!credential) return { kind: "no-credentials" };
  const forceAfterLock =
    forceRefresh && credential.accessToken === initialAccessToken;
  if (!shouldRefresh(credential, runtime.now(), forceAfterLock)) {
    return { kind: "ok", accessToken: credential.accessToken };
  }
  if (!credential.refreshToken) return { kind: "expired" };
  const refreshed = await requestRefresh(runtime, credential.refreshToken);
  return refreshed.kind === "ok"
    ? persistRefreshedToken(runtime, filePath, credential, refreshed.token)
    : refreshed;
}

async function refreshCredential(
  runtime: KimiOAuthRuntime,
  configRoot: string,
  filePath: string,
  forceRefresh: boolean,
  initialAccessToken: string,
): Promise<KimiAccessTokenResult> {
  if (
    runtime.validateCredentialFile &&
    (await credentialFileSafety(filePath)) !== "safe"
  ) {
    return { kind: "unavailable", errorCode: "unsafe-credential-file" };
  }
  let release = async () => undefined;
  try {
    const acquired = await acquireLock(runtime, configRoot);
    if (!acquired) {
      return { kind: "unavailable", errorCode: "refresh-lock-timeout" };
    }
    release = acquired;
    const result = await refreshUnderLock(
      runtime,
      filePath,
      forceRefresh,
      initialAccessToken,
    );
    await release();
    return result;
  } catch {
    await release();
    return { kind: "unavailable", errorCode: "refresh-lock-error" };
  }
}

async function loadOrRefresh(
  runtime: KimiOAuthRuntime,
  configRoot: string,
  forceRefresh: boolean,
): Promise<KimiAccessTokenResult> {
  const filePath = path.join(configRoot, "credentials", "kimi-code.json");
  if (runtime.validateCredentialFile) {
    const safety = await credentialFileSafety(filePath);
    if (safety === "missing") return { kind: "no-credentials" };
    if (safety === "unsafe") {
      return { kind: "unavailable", errorCode: "unsafe-credential-file" };
    }
  }
  const credential = await readCredential(runtime, filePath);
  if (!credential) return { kind: "no-credentials" };
  if (!shouldRefresh(credential, runtime.now(), forceRefresh)) {
    return { kind: "ok", accessToken: credential.accessToken };
  }
  if (!credential.refreshToken) return { kind: "expired" };
  return refreshCredential(
    runtime,
    configRoot,
    filePath,
    forceRefresh,
    credential.accessToken,
  );
}

function getCoalescedToken(
  runtime: KimiOAuthRuntime,
  configRoot: string,
  forceRefresh: boolean,
): Promise<KimiAccessTokenResult> {
  const key = path.resolve(configRoot);
  const current = runtime.inFlight.get(key);
  if (current) return current;
  const pending = loadOrRefresh(runtime, configRoot, forceRefresh).finally(
    () => {
      if (runtime.inFlight.get(key) === pending) runtime.inFlight.delete(key);
    },
  );
  runtime.inFlight.set(key, pending);
  return pending;
}

export function createKimiOAuthTokenService(
  options: KimiOAuthTokenServiceOptions = {},
): KimiOAuthTokenService {
  const runtime: KimiOAuthRuntime = {
    fetchImpl: options.fetchImpl ?? fetch,
    inFlight: new Map(),
    lockHeartbeatMs: options.lockHeartbeatMs ?? LOCK_HEARTBEAT_MS,
    lockAttempts: options.lockAttempts ?? DEFAULT_LOCK_ATTEMPTS,
    now: options.now ?? Date.now,
    platform: options.platform ?? process.platform,
    readFile: options.readFile ?? ((filePath) => fs.readFile(filePath, "utf8")),
    sleep: options.sleep ?? defaultSleep,
    validateCredentialFile: options.validateCredentialFile ?? true,
    writeCredentials: options.writeCredentials ?? atomicWritePrivateFile,
  };
  return {
    getAccessToken: (configRoot, { forceRefresh = false } = {}) =>
      getCoalescedToken(runtime, configRoot, forceRefresh),
  };
}
