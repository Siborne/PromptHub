import path from "node:path";
import { parse as parseJsonc, type ParseError } from "jsonc-parser";

import type { AgentProviderModelTestResult } from "@prompthub/shared/types";
import { inspectPiModelCatalog } from "./agent-pi-model-catalog";
import { fileExists, readTextConfig } from "./agent-model-config-io";
import {
  createProviderProbeDispatcher,
  type DirectProviderProtocol,
  type ProviderProbeInput,
} from "./agent-provider-probe-dispatch";

interface PiModelTestInput {
  providerId: string;
  modelId: string;
}

interface PiModelTestOptions {
  environment?: Readonly<Record<string, string | undefined>>;
  probe?: (
    input: ProviderProbeInput,
    signal: AbortSignal,
  ) => Promise<AgentProviderModelTestResult>;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseObject(raw: string): JsonRecord {
  const errors: ParseError[] = [];
  const value = parseJsonc(raw, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  return errors.length === 0 && isRecord(value) ? value : {};
}

async function readObject(filePath: string): Promise<JsonRecord> {
  if (!(await fileExists(filePath))) return {};
  return parseObject(await readTextConfig(filePath));
}

function managedCredential(
  auth: JsonRecord,
  providerId: string,
): string | null {
  const entry = auth[providerId];
  if (!isRecord(entry) || entry.type !== "api_key") return null;
  return typeof entry.key === "string" && entry.key.length > 0
    ? entry.key
    : null;
}

function environmentCredential(
  models: JsonRecord,
  providerId: string,
  environment: Readonly<Record<string, string | undefined>>,
): string | null {
  const providers = models.providers;
  if (!isRecord(providers)) return null;
  const provider = providers[providerId];
  if (!isRecord(provider) || typeof provider.apiKey !== "string") return null;
  const match = /^\$([A-Za-z_][A-Za-z0-9_]{0,127})$/.exec(provider.apiKey);
  return match ? (environment[match[1]] ?? null) : null;
}

function directProtocol(
  api: string | null | undefined,
): DirectProviderProtocol {
  if (api === "openai-responses") return "openai-responses";
  if (api === "anthropic-messages") return "anthropic-messages";
  if (api === "google-generative-ai") return "google-generative-ai";
  return "openai-chat";
}

export async function testPiModel(
  rootPath: string,
  input: PiModelTestInput,
  signal: AbortSignal,
  options: PiModelTestOptions = {},
): Promise<AgentProviderModelTestResult> {
  const catalog = await inspectPiModelCatalog(rootPath);
  const provider = catalog.find((item) => item.id === input.providerId);
  if (!provider) throw new Error("AGENT_PI_PROVIDER_NOT_FOUND");
  if (!provider.models.some((model) => model.id === input.modelId)) {
    throw new Error("AGENT_PI_MODEL_NOT_FOUND");
  }

  const [auth, models] = await Promise.all([
    readObject(path.join(rootPath, "auth.json")),
    readObject(path.join(rootPath, "models.json")),
  ]);
  const credential =
    managedCredential(auth, provider.id) ??
    environmentCredential(
      models,
      provider.id,
      options.environment ?? process.env,
    );
  const probe =
    options.probe ?? createProviderProbeDispatcher("pi", {}).testModel;
  return probe(
    {
      profileId: `pi:${provider.id}`,
      protocol: directProtocol(provider.api),
      endpoint: provider.endpoint ?? null,
      credential,
      model: input.modelId,
    },
    signal,
  );
}
