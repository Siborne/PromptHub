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

type CredentialKind = "api-key" | "auth-token";
type Protocol = "anthropic-messages";

export interface AnthropicProviderConnectionInput {
  endpoint: string | null;
  credential: string | null;
  credentialKind: CredentialKind;
  model: string | null;
  protocol: Protocol;
}

export interface AnthropicProviderModelTestInput extends AnthropicProviderConnectionInput {
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

export interface AnthropicConnectionTestOptions extends NetworkOptions {
  timeoutMs?: number;
  maxBytes?: number;
}

export interface AnthropicModelTestOptions extends NetworkOptions {
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

function endpointUrl(endpoint: URL, resource: "models" | "messages"): URL {
  const base = endpoint.toString().replace(/\/+$/, "");
  return new URL(
    base.endsWith("/v1") ? `${base}/${resource}` : `${base}/v1/${resource}`,
  );
}

function authHeaders(
  credential: string,
  credentialKind: CredentialKind,
): Record<string, string> {
  return credentialKind === "api-key"
    ? { "x-api-key": credential }
    : { Authorization: `Bearer ${credential}` };
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
  input: AnthropicProviderConnectionInput,
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
    const data = (parsed as Record<string, unknown>).data;
    if (!Array.isArray(data)) return null;
    return data.flatMap((item) =>
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      typeof (item as Record<string, unknown>).id === "string"
        ? [(item as { id: string }).id]
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

export async function testAnthropicProviderConnection(
  input: AnthropicProviderConnectionInput,
  options: AnthropicConnectionTestOptions = {},
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
  const url = endpointUrl(target.endpointUrl, "models");
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
          "anthropic-version": "2023-06-01",
          "User-Agent": "PromptHub/anthropic-connectivity",
          ...authHeaders(input.credential!, input.credentialKind),
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
          const modelAvailable = input.model ? ids.includes(input.model) : null;
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
  input: AnthropicProviderModelTestInput,
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
  if (event.type === "message_start") {
    state.inputTokens = readTokenCount(
      readRecord(readRecord(event.message)?.usage)?.input_tokens,
    );
  }
  if (event.type === "message_delta") {
    state.outputTokens = readTokenCount(readRecord(event.usage)?.output_tokens);
  }
  if (event.type === "content_block_delta") {
    const delta = readRecord(event.delta);
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      if (state.firstTokenMs === null) {
        state.firstTokenMs = Math.max(0, now() - startedAt);
      }
      state.preview.push(delta.text);
    }
  }
  return event.type === "message_stop";
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
  if (statusCode === 401 || statusCode === 403) {
    return attempt("auth-error", { errorCode: `http-${statusCode}` });
  }
  if (
    statusCode === 402 ||
    /insufficient[_ -]?quota|billing[_ -]?hard[_ -]?limit/.test(normalized)
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
    /model.{0,48}(not found|does not exist|unknown|invalid)/.test(normalized)
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
  input: AnthropicProviderModelTestInput,
  target: {
    endpointUrl: URL;
    resolvedAddress: { address: string; family: 4 | 6 };
  },
  startedAt: number,
  options: Required<
    Pick<
      AnthropicModelTestOptions,
      | "connectTimeoutMs"
      | "firstTokenTimeoutMs"
      | "maxBytes"
      | "maxPreviewChars"
      | "now"
    >
  > &
    Pick<AnthropicModelTestOptions, "requestAgent" | "requestImpl">,
  signal: AbortSignal,
): Promise<AttemptResult> {
  const url = endpointUrl(target.endpointUrl, "messages");
  const agent =
    options.requestAgent === undefined
      ? getHttpRequestAgent(url)
      : (options.requestAgent ?? undefined);
  const requestImpl =
    options.requestImpl ?? (url.protocol === "https:" ? https : http).request;
  const body = JSON.stringify({
    model: input.model,
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
    stream: true,
    max_tokens: 8,
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
          "anthropic-version": "2023-06-01",
          "User-Agent": "PromptHub/anthropic-model-test",
          ...authHeaders(input.credential!, input.credentialKind),
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
          const done = consumeChunk(
            chunk.toString("utf8"),
            state,
            startedAt,
            options.now,
          );
          if (state.firstTokenMs !== null && firstTokenTimer) {
            clearTimeout(firstTokenTimer);
            firstTokenTimer = null;
          }
          if (done) {
            incoming.destroy();
            if (state.firstTokenMs === null) {
              finish(attempt("protocol-error"));
              return;
            }
            finish(
              attempt("ok", {
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

export async function testAnthropicProviderModel(
  input: AnthropicProviderModelTestInput,
  options: AnthropicModelTestOptions = {},
): Promise<Omit<AgentProviderModelTestResult, "platformId" | "profileId">> {
  const now = options.now ?? Date.now;
  if (input.signal.aborted) {
    return modelResult(input, abortStatus(input.signal), now, null);
  }
  if (!input.credential) {
    return modelResult(input, "no-credentials", now, null);
  }
  if (!input.endpoint || !input.model) {
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
