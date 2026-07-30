import * as http from "node:http";
import * as https from "node:https";

import type {
  AgentProviderModelTestResult,
  AgentProviderModelTestStatus,
} from "@prompthub/shared";

import { getHttpRequestAgent } from "./network-proxy";
import {
  type OpenAICompatibleLookupHost,
  validateOpenAICompatibleTarget,
} from "./agent-provider-connectivity";

type Protocol = "chat" | "responses";

export interface OpenAICompatibleModelTestInput {
  endpoint: string | null;
  credential: string | null;
  model: string | null;
  protocol: Protocol;
  signal: AbortSignal;
}

interface ModelTestOptions {
  connectTimeoutMs?: number;
  firstTokenTimeoutMs?: number;
  totalTimeoutMs?: number;
  retryDelayMs?: number;
  maxBytes?: number;
  maxPreviewChars?: number;
  maxRetries?: number;
  now?: () => number;
  lookupHost?: OpenAICompatibleLookupHost;
  requestAgent?: http.Agent | https.Agent | null;
  requestImpl?: (
    options: http.RequestOptions,
    listener: (response: http.IncomingMessage) => void,
  ) => http.ClientRequest;
}

interface AttemptResult {
  status: AgentProviderModelTestStatus;
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  outputPreview: string | null;
  errorCode?: string;
  retryable: boolean;
}

interface StreamState {
  buffer: string;
  previewParts: string[];
  sawToken: boolean;
  firstTokenMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

const DEFAULT_CONNECT_TIMEOUT_MS = 5_000;
const DEFAULT_FIRST_TOKEN_TIMEOUT_MS = 8_000;
const DEFAULT_TOTAL_TIMEOUT_MS = 20_000;
const DEFAULT_RETRY_DELAY_MS = 250;
const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_PREVIEW_CHARS = 256;
const DEFAULT_MAX_RETRIES = 1;
const TOTAL_TIMEOUT_REASON = "AGENT_PROVIDER_MODEL_TEST_TOTAL_TIMEOUT";

function emptyResult(
  input: OpenAICompatibleModelTestInput,
  status: AgentProviderModelTestStatus,
  now: () => number,
  endpointOrigin: string | null,
): Omit<AgentProviderModelTestResult, "platformId" | "profileId"> {
  const timestamp = now();
  return {
    protocol: input.protocol,
    endpointOrigin,
    model: input.model,
    status,
    startedAt: timestamp,
    finishedAt: timestamp,
    totalMs: 0,
    firstTokenMs: null,
    retryCount: 0,
    inputTokens: null,
    outputTokens: null,
    outputPreview: null,
  };
}

function requestPayload(input: OpenAICompatibleModelTestInput): object {
  if (input.protocol === "responses") {
    return {
      model: input.model,
      input: "Reply with exactly: OK",
      stream: true,
      max_output_tokens: 8,
    };
  }
  return {
    model: input.model,
    messages: [{ role: "user", content: "Reply with exactly: OK" }],
    stream: true,
    max_tokens: 8,
  };
}

function inferenceUrl(endpoint: URL, protocol: Protocol): URL {
  const path = protocol === "responses" ? "responses" : "chat/completions";
  return new URL(`${endpoint.toString().replace(/\/+$/, "")}/${path}`);
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function updateUsage(
  candidate: unknown,
  state: StreamState,
  protocol: Protocol,
): void {
  const root = readRecord(candidate);
  if (!root) return;
  const response = readRecord(root.response);
  const usage = readRecord(response?.usage ?? root.usage);
  if (!usage) return;
  state.inputTokens = readNumber(
    protocol === "responses" ? usage.input_tokens : usage.prompt_tokens,
  );
  state.outputTokens = readNumber(
    protocol === "responses" ? usage.output_tokens : usage.completion_tokens,
  );
}

function outputDelta(candidate: unknown, protocol: Protocol): string | null {
  const root = readRecord(candidate);
  if (!root) return null;
  if (protocol === "responses") {
    return root.type === "response.output_text.delta" &&
      typeof root.delta === "string"
      ? root.delta
      : null;
  }
  const choices = Array.isArray(root.choices) ? root.choices : [];
  const choice = readRecord(choices[0]);
  const delta = readRecord(choice?.delta);
  return typeof delta?.content === "string" ? delta.content : null;
}

function appendPreview(state: StreamState, delta: string): void {
  state.previewParts.push(delta);
}

function consumeSseLine(
  line: string,
  state: StreamState,
  input: OpenAICompatibleModelTestInput,
  startedAt: number,
  now: () => number,
): boolean {
  const trimmed = line.trim();
  if (!trimmed.startsWith("data:")) return false;
  const data = trimmed.slice(5).trim();
  if (data === "[DONE]") return true;
  let candidate: unknown;
  try {
    candidate = JSON.parse(data);
  } catch {
    return false;
  }
  updateUsage(candidate, state, input.protocol);
  const delta = outputDelta(candidate, input.protocol);
  if (!delta) return false;
  if (!state.sawToken) {
    state.sawToken = true;
    state.firstTokenMs = Math.max(0, now() - startedAt);
  }
  appendPreview(state, delta);
  return false;
}

function consumeSseChunk(
  chunk: string,
  state: StreamState,
  input: OpenAICompatibleModelTestInput,
  startedAt: number,
  now: () => number,
): boolean {
  state.buffer += chunk;
  const lines = state.buffer.split(/\r?\n/);
  state.buffer = lines.pop()!;
  return lines.some((line) =>
    consumeSseLine(line, state, input, startedAt, now),
  );
}

function consumeTerminalSseBuffer(
  state: StreamState,
  input: OpenAICompatibleModelTestInput,
  startedAt: number,
  now: () => number,
): void {
  if (!state.buffer) return;
  consumeSseLine(state.buffer, state, input, startedAt, now);
  state.buffer = "";
}

function safePreview(
  preview: string,
  credential: string,
  maxPreviewChars: number,
): string | null {
  const redacted = preview
    .split(credential)
    .join("[redacted]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, maxPreviewChars);
  return redacted || null;
}

function errorStatus(
  statusCode: number,
  body: string,
): Pick<AttemptResult, "status" | "errorCode" | "retryable"> {
  const normalized = body.toLowerCase();
  if (statusCode === 401 || statusCode === 403) {
    return {
      status: "auth-error",
      errorCode: `http-${statusCode}`,
      retryable: false,
    };
  }
  if (
    statusCode === 402 ||
    /insufficient[_ -]?quota|billing[_ -]?hard[_ -]?limit/.test(normalized)
  ) {
    return {
      status: "quota-error",
      errorCode: `http-${statusCode}`,
      retryable: false,
    };
  }
  if (statusCode === 429) {
    return {
      status: "rate-limited",
      errorCode: "http-429",
      retryable: true,
    };
  }
  if (
    (statusCode === 400 || statusCode === 404) &&
    /model.{0,48}(not found|does not exist|unknown|invalid)/.test(normalized)
  ) {
    return {
      status: "model-not-found",
      errorCode: `http-${statusCode}`,
      retryable: false,
    };
  }
  return {
    status: "http-error",
    errorCode: `http-${statusCode}`,
    retryable: [502, 503, 504].includes(statusCode),
  };
}

function baseAttempt(
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

function waitForRetry(delayMs: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(true), delayMs);
    const onAbort = () => finish(false);
    const finish = (ready: boolean) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", onAbort);
      resolve(ready);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function statusFromAbort(signal: AbortSignal): AgentProviderModelTestStatus {
  return signal.reason === TOTAL_TIMEOUT_REASON ? "total-timeout" : "cancelled";
}

async function runAttempt(
  input: OpenAICompatibleModelTestInput,
  target: Awaited<ReturnType<typeof validateOpenAICompatibleTarget>> & object,
  startedAt: number,
  options: Required<
    Pick<
      ModelTestOptions,
      | "connectTimeoutMs"
      | "firstTokenTimeoutMs"
      | "maxBytes"
      | "maxPreviewChars"
      | "now"
    >
  > &
    Pick<ModelTestOptions, "requestAgent" | "requestImpl">,
  signal: AbortSignal,
): Promise<AttemptResult> {
  const url = inferenceUrl(target.endpointUrl, input.protocol);
  const requestModule = url.protocol === "https:" ? https : http;
  const agent =
    options.requestAgent === undefined
      ? getHttpRequestAgent(url)
      : (options.requestAgent ?? undefined);
  const requestImpl = options.requestImpl ?? requestModule.request;
  const body = JSON.stringify(requestPayload(input));

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
    const onAbort = () => {
      response?.destroy();
      request.destroy();
      finish(baseAttempt(statusFromAbort(signal)));
    };
    const request = requestImpl(
      {
        protocol: url.protocol,
        hostname: agent ? url.hostname : target.resolvedAddress.address,
        ...(agent ? {} : { family: target.resolvedAddress.family }),
        servername: url.hostname,
        port: url.port
          ? Number(url.port)
          : url.protocol === "https:"
            ? 443
            : 80,
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          Host: url.host,
          Authorization: `Bearer ${input.credential}`,
          Accept: "text/event-stream",
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": "PromptHub/provider-model-test",
        },
        agent,
      },
      (incoming) => {
        response = incoming;
        if (connectTimer) clearTimeout(connectTimer);
        const statusCode = incoming.statusCode ?? 0;
        const contentLength = Number.parseInt(
          String(incoming.headers["content-length"] ?? ""),
          10,
        );
        if (
          Number.isFinite(contentLength) &&
          contentLength > options.maxBytes
        ) {
          incoming.resume();
          finish(baseAttempt("response-too-large"));
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          const chunks: Buffer[] = [];
          let received = 0;
          incoming.on("data", (chunk: Buffer) => {
            received += chunk.length;
            if (received > options.maxBytes) {
              incoming.destroy();
              finish(baseAttempt("response-too-large"));
              return;
            }
            chunks.push(chunk);
          });
          incoming.on("end", () => {
            if (settled) return;
            const classified = errorStatus(
              statusCode,
              Buffer.concat(chunks).toString("utf8"),
            );
            finish(baseAttempt(classified.status, classified));
          });
          incoming.on("error", () =>
            finish(baseAttempt("network-error", { retryable: true })),
          );
          return;
        }

        const stream: StreamState = {
          buffer: "",
          previewParts: [],
          sawToken: false,
          firstTokenMs: null,
          inputTokens: null,
          outputTokens: null,
        };
        firstTokenTimer = setTimeout(() => {
          incoming.destroy();
          request.destroy();
          finish(baseAttempt("first-token-timeout"));
        }, options.firstTokenTimeoutMs);
        let received = 0;
        incoming.setEncoding("utf8");
        incoming.on("data", (chunk: string) => {
          received += Buffer.byteLength(chunk);
          if (received > options.maxBytes) {
            incoming.destroy();
            request.destroy();
            finish(baseAttempt("response-too-large"));
            return;
          }
          const done = consumeSseChunk(
            chunk,
            stream,
            input,
            startedAt,
            options.now,
          );
          if (stream.sawToken && firstTokenTimer) {
            clearTimeout(firstTokenTimer);
            firstTokenTimer = null;
          }
          if (done) incoming.destroy();
        });
        incoming.on("end", () => {
          if (settled) return;
          consumeTerminalSseBuffer(stream, input, startedAt, options.now);
          if (!stream.sawToken) {
            finish(baseAttempt("protocol-error"));
            return;
          }
          finish(
            baseAttempt("ok", {
              firstTokenMs: stream.firstTokenMs,
              inputTokens: stream.inputTokens,
              outputTokens: stream.outputTokens,
              outputPreview: safePreview(
                stream.previewParts.join(""),
                input.credential!,
                options.maxPreviewChars,
              ),
            }),
          );
        });
        incoming.on("error", () => {
          if (!settled) {
            finish(
              baseAttempt("network-error", { retryable: !stream.sawToken }),
            );
          }
        });
      },
    );
    signal.addEventListener("abort", onAbort, { once: true });
    connectTimer = setTimeout(() => {
      request.destroy();
      finish(baseAttempt("connect-timeout", { retryable: true }));
    }, options.connectTimeoutMs);
    request.on("error", () => {
      if (!settled) {
        finish(baseAttempt("network-error", { retryable: true }));
      }
    });
    request.write(body);
    request.end();
  });
}

export async function testOpenAICompatibleProviderModel(
  input: OpenAICompatibleModelTestInput,
  options: ModelTestOptions = {},
): Promise<Omit<AgentProviderModelTestResult, "platformId" | "profileId">> {
  const now = options.now ?? Date.now;
  if (input.signal.aborted) {
    return emptyResult(input, "cancelled", now, null);
  }
  if (!input.credential) {
    return emptyResult(input, "no-credentials", now, null);
  }
  if (!input.endpoint || !input.model) {
    return emptyResult(input, "invalid-endpoint", now, null);
  }
  const target = await validateOpenAICompatibleTarget(
    input.endpoint,
    options.lookupHost,
  );
  if (typeof target === "string") {
    return emptyResult(input, target, now, null);
  }

  const startedAt = now();
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort("cancelled");
  input.signal.addEventListener("abort", onExternalAbort, { once: true });
  const totalTimer = setTimeout(
    () => controller.abort(TOTAL_TIMEOUT_REASON),
    options.totalTimeoutMs ?? DEFAULT_TOTAL_TIMEOUT_MS,
  );
  const maxRetries = Math.max(
    0,
    Math.min(DEFAULT_MAX_RETRIES, options.maxRetries ?? DEFAULT_MAX_RETRIES),
  );
  let attempt = 0;
  let outcome = baseAttempt("network-error");
  try {
    while (attempt <= maxRetries) {
      outcome = await runAttempt(
        input,
        target,
        startedAt,
        {
          connectTimeoutMs:
            options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS,
          firstTokenTimeoutMs:
            options.firstTokenTimeoutMs ?? DEFAULT_FIRST_TOKEN_TIMEOUT_MS,
          maxBytes: options.maxBytes ?? DEFAULT_MAX_BYTES,
          maxPreviewChars: options.maxPreviewChars ?? DEFAULT_MAX_PREVIEW_CHARS,
          now,
          requestAgent: options.requestAgent,
          requestImpl: options.requestImpl,
        },
        controller.signal,
      );
      if (!outcome.retryable || attempt === maxRetries) break;
      attempt += 1;
      const ready = await waitForRetry(
        options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
        controller.signal,
      );
      if (!ready) {
        outcome = baseAttempt(statusFromAbort(controller.signal));
        break;
      }
    }
  } finally {
    clearTimeout(totalTimer);
    input.signal.removeEventListener("abort", onExternalAbort);
  }
  const finishedAt = now();
  return {
    protocol: input.protocol,
    endpointOrigin: target.endpointOrigin,
    model: input.model,
    status: outcome.status,
    startedAt,
    finishedAt,
    totalMs: Math.max(0, finishedAt - startedAt),
    firstTokenMs: outcome.firstTokenMs,
    retryCount: attempt,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
    outputPreview: outcome.outputPreview,
    ...(outcome.errorCode ? { errorCode: outcome.errorCode } : {}),
  };
}
