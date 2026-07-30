import * as http from "node:http";
import * as https from "node:https";
import { isIP } from "node:net";

import type {
  AgentProviderConnectionTestResult,
  AgentProviderConnectionTestStatus,
  AgentProviderModelTestResult,
  AgentProviderModelTestStatus,
} from "@prompthub/shared";

import {
  type OpenAICompatibleLookupHost,
  validateOpenAICompatibleTarget,
} from "./agent-provider-connectivity";
import { getHttpRequestAgent } from "./network-proxy";

type Protocol = "google-generative-ai";

export interface GoogleGeminiProviderConnectionInput {
  endpoint: string | null;
  credential: string | null;
  model: string | null;
  protocol: Protocol;
}

export interface GoogleGeminiProviderModelTestInput extends GoogleGeminiProviderConnectionInput {
  signal: AbortSignal;
}

interface NetworkOptions {
  now?: () => number;
  lookupHost?: OpenAICompatibleLookupHost;
  requestAgent?: http.Agent | https.Agent | null;
  requestImpl?: (
    options: http.RequestOptions,
    listener: (response: http.IncomingMessage) => void,
  ) => http.ClientRequest;
}

export interface GoogleGeminiConnectionTestOptions extends NetworkOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface GoogleGeminiModelTestOptions extends NetworkOptions {
  connectTimeoutMs?: number;
  firstTokenTimeoutMs?: number;
  totalTimeoutMs?: number;
  retryDelayMs?: number;
  maxBytes?: number;
  maxPreviewChars?: number;
  maxRetries?: number;
}

interface StreamState {
  buffer: string;
  preview: string[];
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

interface AttemptResult {
  status: AgentProviderModelTestStatus;
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  outputPreview: string | null;
  retryable: boolean;
  errorCode?: string;
}

const DEFAULT_CONNECTION_TIMEOUT_MS = 8_000;
const DEFAULT_CONNECTION_MAX_BYTES = 1024 * 1024;
const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 8_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_MODEL_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_PREVIEW_CHARS = 256;
const DEFAULT_MAX_RETRIES = 1;
const TOTAL_TIMEOUT_REASON = "AGENT_PROVIDER_MODEL_TEST_TOTAL_TIMEOUT";

function apiBase(endpoint: URL): string {
  return endpoint
    .toString()
    .replace(/\/+$/, "")
    .replace(/\/v1beta$/, "");
}

function modelsUrl(endpoint: URL): URL {
  return new URL(`${apiBase(endpoint)}/v1beta/models`);
}

function normalizedModel(value: string): string {
  return value.replace(/^models\//, "");
}

function validModel(model: string): boolean {
  const normalized = normalizedModel(model).trim();
  return (
    Boolean(normalized) &&
    normalized.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized)
  );
}

function inferenceUrl(endpoint: URL, model: string): URL {
  const normalized = normalizedModel(model).trim();
  return new URL(
    `${apiBase(endpoint)}/v1beta/models/${encodeURIComponent(normalized)}:streamGenerateContent?alt=sse`,
  );
}

function requestOptions(
  url: URL,
  target: {
    resolvedAddress: { address: string; family: 4 | 6 };
  },
  agent: http.Agent | https.Agent | undefined,
): http.RequestOptions {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  return {
    protocol: url.protocol,
    hostname: agent ? url.hostname : target.resolvedAddress.address,
    ...(agent ? {} : { family: target.resolvedAddress.family }),
    ...(isIP(hostname) ? {} : { servername: hostname }),
    port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
    path: `${url.pathname}${url.search}`,
    agent,
  };
}

function connectionResult(
  input: GoogleGeminiProviderConnectionInput,
  status: AgentProviderConnectionTestStatus,
  now: () => number,
  endpointOrigin: string | null,
  values: {
    startedAt?: number;
    modelCount?: number | null;
    modelAvailable?: boolean | null;
    errorCode?: string;
  } = {},
): Omit<AgentProviderConnectionTestResult, "platformId" | "profileId"> {
  const finishedAt = now();
  const startedAt = values.startedAt ?? finishedAt;
  return {
    protocol: input.protocol,
    endpointOrigin,
    model: input.model,
    status,
    startedAt,
    finishedAt,
    totalMs: Math.max(0, finishedAt - startedAt),
    retryCount: 0,
    modelCount: values.modelCount ?? null,
    modelAvailable: values.modelAvailable ?? null,
    ...(values.errorCode ? { errorCode: values.errorCode } : {}),
  };
}

function parseModelIds(body: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const models = (parsed as Record<string, unknown>).models;
    if (!Array.isArray(models)) return null;
    return models.flatMap((item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).name === "string"
        ? [normalizedModel((item as { name: string }).name)]
        : [],
    );
  } catch {
    return null;
  }
}

function connectionHttpStatus(statusCode: number): {
  status: AgentProviderConnectionTestStatus;
  errorCode: string;
} {
  return {
    status:
      statusCode === 401 || statusCode === 403 ? "auth-error" : "http-error",
    errorCode: `http-${statusCode}`,
  };
}

export async function testGoogleGeminiProviderConnection(
  input: GoogleGeminiProviderConnectionInput,
  options: GoogleGeminiConnectionTestOptions = {},
): Promise<
  Omit<AgentProviderConnectionTestResult, "platformId" | "profileId">
> {
  const now = options.now ?? Date.now;
  if (!input.credential) {
    return connectionResult(input, "no-credentials", now, null);
  }
  if (!input.endpoint) {
    return connectionResult(input, "invalid-endpoint", now, null);
  }
  const target = await validateOpenAICompatibleTarget(
    input.endpoint,
    options.lookupHost,
  );
  if (typeof target === "string") {
    return connectionResult(input, target, now, null);
  }

  const startedAt = now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_CONNECTION_MAX_BYTES;
  const url = modelsUrl(target.endpointUrl);
  const agent =
    options.requestAgent === undefined
      ? getHttpRequestAgent(url)
      : (options.requestAgent ?? undefined);
  const requestImpl =
    options.requestImpl ?? (url.protocol === "https:" ? https : http).request;

  return new Promise((resolve) => {
    let settled = false;
    let timer: NodeJS.Timeout | null = null;
    const finish = (
      status: AgentProviderConnectionTestStatus,
      values: {
        modelCount?: number | null;
        modelAvailable?: boolean | null;
        errorCode?: string;
      } = {},
    ) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(
        connectionResult(input, status, now, target.endpointOrigin, {
          startedAt,
          ...values,
        }),
      );
    };
    const request = requestImpl(
      {
        ...requestOptions(url, target, agent),
        method: "GET",
        headers: {
          Host: url.host,
          Accept: "application/json",
          "User-Agent": "PromptHub/google-gemini-connectivity",
          "x-goog-api-key": input.credential!,
        },
        timeout: timeoutMs,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          const result = connectionHttpStatus(statusCode);
          finish(result.status, { errorCode: result.errorCode });
          return;
        }
        const contentLength = Number.parseInt(
          String(response.headers["content-length"] ?? ""),
          10,
        );
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          response.resume();
          finish("response-too-large");
          return;
        }
        const chunks: Buffer[] = [];
        let received = 0;
        response.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            response.destroy();
            finish("response-too-large");
            return;
          }
          chunks.push(chunk);
        });
        response.on("end", () => {
          if (settled) return;
          const ids = parseModelIds(Buffer.concat(chunks).toString("utf8"));
          if (!ids) {
            finish("protocol-error");
            return;
          }
          const modelAvailable = input.model
            ? ids.includes(normalizedModel(input.model))
            : null;
          finish(modelAvailable === false ? "model-not-found" : "ok", {
            modelCount: ids.length,
            modelAvailable,
          });
        });
        response.on("error", () => finish("network-error"));
      },
    );
    request.on("timeout", () => {
      finish("timeout");
      request.destroy();
    });
    request.on("error", () => finish("network-error"));
    timer = setTimeout(() => {
      finish("timeout");
      request.destroy();
    }, timeoutMs);
    request.end();
  });
}

function modelResult(
  input: GoogleGeminiProviderModelTestInput,
  status: AgentProviderModelTestStatus,
  now: () => number,
  endpointOrigin: string | null,
  values: {
    startedAt?: number;
    firstTokenMs?: number | null;
    retryCount?: number;
    inputTokens?: number | null;
    outputTokens?: number | null;
    outputPreview?: string | null;
    errorCode?: string;
  } = {},
): Omit<AgentProviderModelTestResult, "platformId" | "profileId"> {
  const finishedAt = now();
  const startedAt = values.startedAt ?? finishedAt;
  return {
    protocol: input.protocol,
    endpointOrigin,
    model: input.model,
    status,
    startedAt,
    finishedAt,
    totalMs: Math.max(0, finishedAt - startedAt),
    firstTokenMs: values.firstTokenMs ?? null,
    retryCount: values.retryCount ?? 0,
    inputTokens: values.inputTokens ?? null,
    outputTokens: values.outputTokens ?? null,
    outputPreview: values.outputPreview ?? null,
    ...(values.errorCode ? { errorCode: values.errorCode } : {}),
  };
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readTokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

function consumeEvent(
  line: string,
  state: StreamState,
  startedAt: number,
  now: () => number,
): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return false;
  let event: Record<string, unknown> | null = null;
  try {
    event = readRecord(JSON.parse(trimmed.slice(5).trim()));
  } catch {
    return false;
  }
  if (!event) return false;
  const usage = readRecord(event.usageMetadata);
  const inputTokens = readTokenCount(usage?.promptTokenCount);
  const outputTokens = readTokenCount(usage?.candidatesTokenCount);
  if (inputTokens !== null) state.inputTokens = inputTokens;
  if (outputTokens !== null) state.outputTokens = outputTokens;

  const candidates = Array.isArray(event.candidates) ? event.candidates : [];
  for (const candidate of candidates) {
    const content = readRecord(readRecord(candidate)?.content);
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      const text = readRecord(part)?.text;
      if (typeof text !== "string" || !text) continue;
      if (state.firstTokenMs === null) {
        state.firstTokenMs = Math.max(0, now() - startedAt);
      }
      state.preview.push(text);
    }
  }
  return false;
}

function consumeChunk(
  chunk: string,
  state: StreamState,
  startedAt: number,
  now: () => number,
): boolean {
  state.buffer += chunk;
  const lines = state.buffer.split(/\r?\n/);
  state.buffer = lines.pop()!;
  return lines.some((line) => consumeEvent(line, state, startedAt, now));
}

function safePreview(
  value: string,
  credential: string,
  maxChars: number,
): string | null {
  const redacted = value
    .split(credential)
    .join("[redacted]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxChars);
  return redacted || null;
}

function attempt(
  status: AgentProviderModelTestStatus,
  values: Partial<AttemptResult> = {},
): AttemptResult {
  return {
    status,
    firstTokenMs: null,
    inputTokens: null,
    outputTokens: null,
    outputPreview: null,
    retryable: false,
    ...values,
  };
}

function errorAttempt(statusCode: number, body: string): AttemptResult {
  const normalized = body.toLowerCase();
  if (
    statusCode === 401 ||
    statusCode === 403 ||
    (statusCode === 400 && /api key.{0,48}(invalid|not valid)/.test(normalized))
  ) {
    return attempt("auth-error", { errorCode: `http-${statusCode}` });
  }
  if (
    statusCode === 402 ||
    /insufficient[_ -]?quota|billing[_ -]?hard[_ -]?limit|quota.{0,32}(exceeded|exhausted)/.test(
      normalized,
    )
  ) {
    return attempt("quota-error", { errorCode: `http-${statusCode}` });
  }
  if (statusCode === 429) {
    return attempt("rate-limited", {
      errorCode: "http-429",
      retryable: true,
    });
  }
  if (
    (statusCode === 400 || statusCode === 404) &&
    /model.{0,48}(not found|does not exist|unknown|invalid|is not found)/.test(
      normalized,
    )
  ) {
    return attempt("model-not-found", {
      errorCode: `http-${statusCode}`,
    });
  }
  return attempt("http-error", {
    errorCode: `http-${statusCode}`,
    retryable: [502, 503, 504].includes(statusCode),
  });
}

function abortStatus(signal: AbortSignal): AgentProviderModelTestStatus {
  return signal.reason === TOTAL_TIMEOUT_REASON ? "total-timeout" : "cancelled";
}

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(true), delayMs);
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(ready);
    };
    const onAbort = () => finish(false);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

async function runModelAttempt(
  input: GoogleGeminiProviderModelTestInput,
  target: {
    endpointUrl: URL;
    resolvedAddress: { address: string; family: 4 | 6 };
  },
  startedAt: number,
  options: Required<
    Pick<
      GoogleGeminiModelTestOptions,
      | "connectTimeoutMs"
      | "firstTokenTimeoutMs"
      | "maxBytes"
      | "maxPreviewChars"
      | "now"
    >
  > &
    Pick<GoogleGeminiModelTestOptions, "requestAgent" | "requestImpl">,
  signal: AbortSignal,
): Promise<AttemptResult> {
  const url = inferenceUrl(target.endpointUrl, input.model!);
  const agent =
    options.requestAgent === undefined
      ? getHttpRequestAgent(url)
      : (options.requestAgent ?? undefined);
  const requestImpl =
    options.requestImpl ?? (url.protocol === "https:" ? https : http).request;
  const body = JSON.stringify({
    contents: [{ role: "user", parts: [{ text: "Reply with exactly: OK" }] }],
    generationConfig: { maxOutputTokens: 8 },
  });

  return new Promise((resolve) => {
    let settled = false;
    let response: http.IncomingMessage | null = null;
    let connectTimer: NodeJS.Timeout | null = null;
    let firstTokenTimer: NodeJS.Timeout | null = null;
    const finish = (result: AttemptResult) => {
      if (settled) return;
      settled = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (firstTokenTimer) clearTimeout(firstTokenTimer);
      signal.removeEventListener("abort", onAbort);
      resolve(result);
    };
    const request = requestImpl(
      {
        ...requestOptions(url, target, agent),
        method: "POST",
        headers: {
          Host: url.host,
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "PromptHub/google-gemini-model-test",
          "x-goog-api-key": input.credential!,
        },
      },
      (incoming) => {
        response = incoming;
        if (connectTimer) clearTimeout(connectTimer);
        const statusCode = incoming.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          const chunks: Buffer[] = [];
          let received = 0;
          incoming.on("data", (chunk: Buffer) => {
            received += chunk.length;
            if (received > options.maxBytes) {
              incoming.destroy();
              finish(attempt("response-too-large"));
              return;
            }
            chunks.push(chunk);
          });
          incoming.on("end", () => {
            if (!settled) {
              finish(
                errorAttempt(
                  statusCode,
                  Buffer.concat(chunks).toString("utf8"),
                ),
              );
            }
          });
          incoming.on("error", () => finish(attempt("network-error")));
          return;
        }

        const state: StreamState = {
          buffer: "",
          preview: [],
          firstTokenMs: null,
          inputTokens: null,
          outputTokens: null,
        };
        let received = 0;
        firstTokenTimer = setTimeout(() => {
          incoming.destroy();
          request.destroy();
          finish(attempt("first-token-timeout"));
        }, options.firstTokenTimeoutMs);
        incoming.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > options.maxBytes) {
            incoming.destroy();
            finish(attempt("response-too-large"));
            return;
          }
          consumeChunk(chunk.toString("utf8"), state, startedAt, options.now);
          if (state.firstTokenMs !== null && firstTokenTimer) {
            clearTimeout(firstTokenTimer);
            firstTokenTimer = null;
          }
        });
        incoming.on("end", () => {
          if (settled) return;
          if (state.buffer) {
            consumeEvent(state.buffer, state, startedAt, options.now);
          }
          finish(
            state.firstTokenMs === null
              ? attempt("protocol-error")
              : attempt("ok", {
                  firstTokenMs: state.firstTokenMs,
                  inputTokens: state.inputTokens,
                  outputTokens: state.outputTokens,
                  outputPreview: safePreview(
                    state.preview.join(""),
                    input.credential!,
                    options.maxPreviewChars,
                  ),
                }),
          );
        });
        incoming.on("error", () => finish(attempt("network-error")));
      },
    );
    const onAbort = () => {
      response?.destroy();
      request.destroy();
      finish(attempt(abortStatus(signal)));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    request.on("error", () =>
      finish(attempt("network-error", { retryable: true })),
    );
    connectTimer = setTimeout(() => {
      request.destroy();
      finish(attempt("connect-timeout", { retryable: true }));
    }, options.connectTimeoutMs);
    request.write(body);
    request.end();
  });
}

export async function testGoogleGeminiProviderModel(
  input: GoogleGeminiProviderModelTestInput,
  options: GoogleGeminiModelTestOptions = {},
): Promise<Omit<AgentProviderModelTestResult, "platformId" | "profileId">> {
  const now = options.now ?? Date.now;
  if (input.signal.aborted) {
    return modelResult(input, abortStatus(input.signal), now, null);
  }
  if (!input.credential) {
    return modelResult(input, "no-credentials", now, null);
  }
  if (!input.endpoint || !input.model || !validModel(input.model)) {
    return modelResult(input, "invalid-endpoint", now, null);
  }
  const target = await validateOpenAICompatibleTarget(
    input.endpoint,
    options.lookupHost,
  );
  if (typeof target === "string") {
    return modelResult(input, target, now, null);
  }

  const startedAt = now();
  const totalController = new AbortController();
  const forwardAbort = () => totalController.abort(input.signal.reason);
  input.signal.addEventListener("abort", forwardAbort, { once: true });
  const totalTimer = setTimeout(
    () => totalController.abort(TOTAL_TIMEOUT_REASON),
    options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS,
  );
  const runOptions = {
    connectTimeoutMs: options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
    firstTokenTimeoutMs:
      options.firstTokenTimeoutMs ?? DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
    maxBytes: options.maxBytes ?? DEFAULT_MODEL_MAX_BYTES,
    maxPreviewChars: options.maxPreviewChars ?? DEFAULT_MAX_PREVIEW_CHARS,
    now,
    requestAgent: options.requestAgent,
    requestImpl: options.requestImpl,
  };
  const maxRetries = Math.min(
    1,
    Math.max(0, options.maxRetries ?? DEFAULT_MAX_RETRIES),
  );
  let retryCount = 0;
  let result: AttemptResult;
  try {
    result = await runModelAttempt(
      input,
      target,
      startedAt,
      runOptions,
      totalController.signal,
    );
    while (
      result.retryable &&
      retryCount < maxRetries &&
      !totalController.signal.aborted
    ) {
      const ready = await waitForRetry(
        options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
        totalController.signal,
      );
      if (!ready) break;
      retryCount += 1;
      result = await runModelAttempt(
        input,
        target,
        startedAt,
        runOptions,
        totalController.signal,
      );
    }
    if (totalController.signal.aborted) {
      result = attempt(abortStatus(totalController.signal));
    }
  } finally {
    clearTimeout(totalTimer);
    input.signal.removeEventListener("abort", forwardAbort);
  }
  return modelResult(input, result!.status, now, target.endpointOrigin, {
    startedAt,
    firstTokenMs: result!.firstTokenMs,
    retryCount,
    inputTokens: result!.inputTokens,
    outputTokens: result!.outputTokens,
    outputPreview: result!.outputPreview,
    ...(result!.errorCode ? { errorCode: result!.errorCode } : {}),
  });
}
