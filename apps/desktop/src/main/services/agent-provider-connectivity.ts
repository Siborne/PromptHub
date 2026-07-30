import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";

import type {
  AgentProviderConnectionTestResult,
  AgentProviderConnectionTestStatus,
} from "@prompthub/shared";

import { getHttpRequestAgent } from "./network-proxy";
import {
  isBlockedHostname,
  isPrivateAddress,
  resolvePublicAddress,
} from "./skill-installer-remote";

type Protocol = "chat" | "responses";

export interface OpenAICompatibleConnectionInput {
  endpoint: string | null;
  credential: string | null;
  model: string | null;
  protocol: Protocol;
}

export interface OpenAICompatibleLookupHost {
  (hostname: string): Promise<Array<{ address: string; family: number }>>;
}

interface ConnectionTestOptions {
  timeoutMs?: number;
  maxBytes?: number;
  now?: () => number;
  lookupHost?: OpenAICompatibleLookupHost;
  requestAgent?: http.Agent | https.Agent | null;
  requestImpl?: (
    options: http.RequestOptions,
    listener: (response: http.IncomingMessage) => void,
  ) => http.ClientRequest;
}

export interface OpenAICompatibleValidatedTarget {
  endpointOrigin: string;
  endpointUrl: URL;
  resolvedAddress: { address: string; family: 4 | 6 };
}

export type OpenAICompatibleTargetValidationStatus =
  | "invalid-endpoint"
  | "blocked-address"
  | "network-error";

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_BYTES = 1024 * 1024;

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "::1"
  );
}

function emptyResult(
  input: OpenAICompatibleConnectionInput,
  status: AgentProviderConnectionTestStatus,
  now: () => number,
  endpointOrigin: string | null,
): Omit<AgentProviderConnectionTestResult, "platformId" | "profileId"> {
  const timestamp = now();
  return {
    protocol: input.protocol,
    endpointOrigin,
    model: input.model,
    status,
    startedAt: timestamp,
    finishedAt: timestamp,
    totalMs: 0,
    retryCount: 0,
    modelCount: null,
    modelAvailable: null,
  };
}

export async function validateOpenAICompatibleTarget(
  endpoint: string,
  lookupHost?: ConnectionTestOptions["lookupHost"],
): Promise<
  OpenAICompatibleValidatedTarget | OpenAICompatibleTargetValidationStatus
> {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return "invalid-endpoint";
  }
  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const loopback = isLoopbackHost(hostname);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback))
  ) {
    return "invalid-endpoint";
  }
  if (!loopback && isBlockedHostname(hostname)) return "blocked-address";

  let resolvedAddress: { address: string; family: 4 | 6 };
  if (loopback) {
    resolvedAddress = {
      address: hostname === "localhost" ? "127.0.0.1" : hostname,
      family: net.isIP(hostname) === 6 ? 6 : 4,
    };
  } else if (lookupHost) {
    let addresses: Array<{ address: string; family: number }>;
    try {
      addresses = await lookupHost(hostname);
    } catch {
      return "network-error";
    }
    if (
      addresses.length === 0 ||
      addresses.some((entry) => isPrivateAddress(entry.address))
    ) {
      return "blocked-address";
    }
    resolvedAddress = {
      address: addresses[0].address,
      family: addresses[0].family === 6 ? 6 : 4,
    };
  } else {
    try {
      resolvedAddress = await resolvePublicAddress(hostname, {
        allowProxyCompatibilityAddress:
          getHttpRequestAgent(parsed) !== undefined,
      });
    } catch (error) {
      return error instanceof Error &&
        /local network|internal network/i.test(error.message)
        ? "blocked-address"
        : "network-error";
    }
  }

  return {
    endpointOrigin: parsed.origin,
    endpointUrl: parsed,
    resolvedAddress,
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
    const ids: string[] = [];
    for (const item of data) {
      if (
        item &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof (item as Record<string, unknown>).id === "string"
      ) {
        ids.push((item as Record<string, string>).id);
      }
    }
    return ids;
  } catch {
    return null;
  }
}

function statusForHttp(statusCode: number): {
  status: AgentProviderConnectionTestStatus;
  errorCode?: string;
} {
  if (statusCode === 401 || statusCode === 403) {
    return { status: "auth-error", errorCode: `http-${statusCode}` };
  }
  return { status: "http-error", errorCode: `http-${statusCode}` };
}

export async function testOpenAICompatibleProviderConnection(
  input: OpenAICompatibleConnectionInput,
  options: ConnectionTestOptions = {},
): Promise<
  Omit<AgentProviderConnectionTestResult, "platformId" | "profileId">
> {
  const now = options.now ?? Date.now;
  if (!input.credential) {
    return emptyResult(input, "no-credentials", now, null);
  }
  if (!input.endpoint) {
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
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const modelsUrl = new URL(
    `${target.endpointUrl.toString().replace(/\/+$/, "")}/models`,
  );
  const requestModule = modelsUrl.protocol === "https:" ? https : http;
  const agent =
    options.requestAgent === undefined
      ? getHttpRequestAgent(modelsUrl)
      : (options.requestAgent ?? undefined);
  const requestImpl = options.requestImpl ?? requestModule.request;

  return new Promise((resolve) => {
    let settled = false;
    let totalTimer: NodeJS.Timeout | null = null;
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
      if (totalTimer) clearTimeout(totalTimer);
      const finishedAt = now();
      resolve({
        protocol: input.protocol,
        endpointOrigin: target.endpointOrigin,
        model: input.model,
        status,
        startedAt,
        finishedAt,
        totalMs: Math.max(0, finishedAt - startedAt),
        retryCount: 0,
        modelCount: values.modelCount ?? null,
        modelAvailable: values.modelAvailable ?? null,
        ...(values.errorCode ? { errorCode: values.errorCode } : {}),
      });
    };

    const request = requestImpl(
      {
        protocol: modelsUrl.protocol,
        hostname: agent ? modelsUrl.hostname : target.resolvedAddress.address,
        ...(agent ? {} : { family: target.resolvedAddress.family }),
        servername: modelsUrl.hostname,
        port: modelsUrl.port
          ? Number(modelsUrl.port)
          : modelsUrl.protocol === "https:"
            ? 443
            : 80,
        path: `${modelsUrl.pathname}${modelsUrl.search}`,
        method: "GET",
        headers: {
          Host: modelsUrl.host,
          Authorization: `Bearer ${input.credential}`,
          Accept: "application/json",
          "User-Agent": "PromptHub/provider-connectivity",
        },
        agent,
        timeout: timeoutMs,
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          const classified = statusForHttp(statusCode);
          finish(classified.status, { errorCode: classified.errorCode });
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
          const modelIds = parseModelIds(
            Buffer.concat(chunks).toString("utf8"),
          );
          if (!modelIds) {
            finish("protocol-error");
            return;
          }
          const modelAvailable = input.model
            ? modelIds.includes(input.model)
            : null;
          finish(modelAvailable === false ? "model-not-found" : "ok", {
            modelCount: modelIds.length,
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
    totalTimer = setTimeout(() => {
      finish("timeout");
      request.destroy();
    }, timeoutMs);
    request.end();
  });
}
