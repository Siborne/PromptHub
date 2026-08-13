import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type {
  AgentProviderConnectionTestResult,
  AgentProviderModelTestResult,
} from "@prompthub/shared";

import {
  createNativeCommandRunner,
  type NativeCommandRunner,
} from "./native-command";

export interface CodexNativeConnectionInput {
  codexHome: string;
  model: string;
}

export interface CodexNativeModelTestInput extends CodexNativeConnectionInput {
  signal: AbortSignal;
}

type NativeConnectionResult = Omit<
  AgentProviderConnectionTestResult,
  "platformId" | "profileId"
>;
type NativeModelResult = Omit<
  AgentProviderModelTestResult,
  "platformId" | "profileId"
>;

interface CodexNativeProviderProbeOptions {
  commandRunner?: NativeCommandRunner;
  now?: () => number;
  temporaryRoot?: string;
}

const LOGIN_TIMEOUT_MS = 10_000;
const MODEL_TIMEOUT_MS = 60_000;
const LOGIN_MAX_BUFFER = 16 * 1024;
const MODEL_MAX_BUFFER = 64 * 1024;
const MAX_OUTPUT_PREVIEW = 256;

function elapsed(startedAt: number, finishedAt: number): number {
  return Math.max(0, finishedAt - startedAt);
}

function commandErrorText(error: unknown): string {
  if (!error || typeof error !== "object") return String(error ?? "");
  const record = error as Record<string, unknown>;
  return [record.message, record.stdout, record.stderr, record.code]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.slice(0, 8_192))
    .join("\n")
    .toLowerCase();
}

function commandTimedOut(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "ETIMEDOUT" ||
    record.killed === true ||
    record.signal === "SIGTERM"
  );
}

function commandAborted(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (!error || typeof error !== "object") return false;
  return (error as Record<string, unknown>).name === "AbortError";
}

function isLoginRequired(text: string): boolean {
  return /not logged in|login required|please log in|sign in required/.test(
    text,
  );
}

function isAuthenticationFailure(text: string): boolean {
  return /\b401\b|unauthori[sz]ed|authentication failed|invalid token|token expired/.test(
    text,
  );
}

function connectionFailure(
  error: unknown,
): Pick<NativeConnectionResult, "status" | "errorCode"> {
  const text = commandErrorText(error);
  if (commandTimedOut(error)) {
    return { status: "timeout", errorCode: "codex-login-timeout" };
  }
  if (isLoginRequired(text)) {
    return { status: "no-credentials", errorCode: "codex-login-required" };
  }
  if (isAuthenticationFailure(text)) {
    return { status: "auth-error", errorCode: "codex-auth-failed" };
  }
  return { status: "protocol-error", errorCode: "codex-login-check-failed" };
}

function modelFailure(
  error: unknown,
  signal: AbortSignal,
): Pick<NativeModelResult, "status" | "errorCode"> {
  if (commandAborted(error, signal)) {
    return { status: "cancelled", errorCode: "codex-model-test-cancelled" };
  }
  if (commandTimedOut(error)) {
    return { status: "total-timeout", errorCode: "codex-model-test-timeout" };
  }
  const text = commandErrorText(error);
  if (isLoginRequired(text)) {
    return { status: "no-credentials", errorCode: "codex-login-required" };
  }
  if (isAuthenticationFailure(text)) {
    return { status: "auth-error", errorCode: "codex-auth-failed" };
  }
  if (/usage limit|quota|credits? exhausted|insufficient_quota/.test(text)) {
    return { status: "quota-error", errorCode: "codex-quota-unavailable" };
  }
  if (/\b429\b|rate.?limit|too many requests/.test(text)) {
    return { status: "rate-limited", errorCode: "codex-rate-limited" };
  }
  if (/model.*(not found|not supported|unavailable|unknown)/.test(text)) {
    return { status: "model-not-found", errorCode: "codex-model-not-found" };
  }
  if (
    /enotfound|econn|dns|network|connect tunnel|socket|tls|certificate/.test(
      text,
    )
  ) {
    return { status: "network-error", errorCode: "codex-network-failed" };
  }
  return { status: "protocol-error", errorCode: "codex-model-test-failed" };
}

function sanitizedPreview(value: string): string | null {
  const preview = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_OUTPUT_PREVIEW);
  return preview || null;
}

function nativeEnvironment(codexHome: string): NodeJS.ProcessEnv {
  return { ...process.env, CODEX_HOME: codexHome };
}

export function createCodexNativeProviderProbe(
  options: CodexNativeProviderProbeOptions = {},
): {
  testConnection(
    input: CodexNativeConnectionInput,
  ): Promise<NativeConnectionResult>;
  testModel(input: CodexNativeModelTestInput): Promise<NativeModelResult>;
} {
  const commandRunner = options.commandRunner ?? createNativeCommandRunner();
  const now = options.now ?? Date.now;
  const temporaryRoot = options.temporaryRoot ?? os.tmpdir();

  return {
    async testConnection(input) {
      const startedAt = now();
      const executable = await commandRunner.resolve("codex");
      if (!executable) {
        const finishedAt = now();
        return {
          protocol: "platform-native",
          endpointOrigin: null,
          model: input.model,
          status: "unsupported",
          startedAt,
          finishedAt,
          totalMs: elapsed(startedAt, finishedAt),
          retryCount: 0,
          modelCount: null,
          modelAvailable: null,
          errorCode: "codex-cli-not-found",
        };
      }
      let failure: Pick<NativeConnectionResult, "status" | "errorCode"> | null =
        null;
      try {
        await commandRunner.run(executable, ["login", "status"], {
          timeout: LOGIN_TIMEOUT_MS,
          maxBuffer: LOGIN_MAX_BUFFER,
          env: nativeEnvironment(input.codexHome),
        });
      } catch (error) {
        failure = connectionFailure(error);
      }
      const finishedAt = now();
      return {
        protocol: "platform-native",
        endpointOrigin: null,
        model: input.model,
        status: failure?.status ?? "ok",
        startedAt,
        finishedAt,
        totalMs: elapsed(startedAt, finishedAt),
        retryCount: 0,
        modelCount: null,
        modelAvailable: null,
        ...(failure ? { errorCode: failure.errorCode } : {}),
      };
    },

    async testModel(input) {
      const startedAt = now();
      const executable = await commandRunner.resolve("codex");
      if (!executable) {
        const finishedAt = now();
        return {
          protocol: "platform-native",
          endpointOrigin: null,
          model: input.model,
          status: "unsupported",
          startedAt,
          finishedAt,
          totalMs: elapsed(startedAt, finishedAt),
          firstTokenMs: null,
          retryCount: 0,
          inputTokens: null,
          outputTokens: null,
          outputPreview: null,
          errorCode: "codex-cli-not-found",
        };
      }

      let workRoot: string | null = null;
      let failure: Pick<NativeModelResult, "status" | "errorCode"> | null =
        input.signal.aborted
          ? {
              status: "cancelled",
              errorCode: "codex-model-test-cancelled",
            }
          : null;
      let outputPreview: string | null = null;
      try {
        if (!failure) {
          workRoot = await fs.mkdtemp(
            path.join(temporaryRoot, "prompthub-codex-probe-"),
          );
          const outputPath = path.join(workRoot, "final-message.txt");
          await commandRunner.run(
            executable,
            [
              "exec",
              "--ephemeral",
              "--ignore-user-config",
              "--ignore-rules",
              "--skip-git-repo-check",
              "--sandbox",
              "read-only",
              "--cd",
              workRoot,
              "--output-last-message",
              outputPath,
              "--model",
              input.model,
              "Reply with exactly OK.",
            ],
            {
              timeout: MODEL_TIMEOUT_MS,
              maxBuffer: MODEL_MAX_BUFFER,
              env: nativeEnvironment(input.codexHome),
              signal: input.signal,
            },
          );
          outputPreview = sanitizedPreview(
            await fs.readFile(outputPath, "utf8"),
          );
          if (!outputPreview) {
            failure = {
              status: "protocol-error",
              errorCode: "codex-model-response-empty",
            };
          }
        }
      } catch (error) {
        failure = modelFailure(error, input.signal);
      } finally {
        if (workRoot) {
          await fs
            .rm(workRoot, { recursive: true, force: true })
            .catch(() => {});
        }
      }
      const finishedAt = now();
      return {
        protocol: "platform-native",
        endpointOrigin: null,
        model: input.model,
        status: failure?.status ?? "ok",
        startedAt,
        finishedAt,
        totalMs: elapsed(startedAt, finishedAt),
        firstTokenMs: null,
        retryCount: 0,
        inputTokens: null,
        outputTokens: null,
        outputPreview: failure ? null : outputPreview,
        ...(failure ? { errorCode: failure.errorCode } : {}),
      };
    },
  };
}

const defaultProbe = createCodexNativeProviderProbe();

export const testCodexNativeProviderConnection =
  defaultProbe.testConnection.bind(defaultProbe);
export const testCodexNativeProviderModel =
  defaultProbe.testModel.bind(defaultProbe);
