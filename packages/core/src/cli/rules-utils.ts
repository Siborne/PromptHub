import type {
  RuleBackupRecord,
  RuleFileDescriptor,
  RuleRewriteRequest,
  RuleVersionSnapshot,
} from "@prompthub/shared/types";

import {
  ensureNoUnknownOptions,
  readTextOption,
  takeOption,
  type CliRulesBundle,
} from "./args";
import { CliError, EXIT_CODES } from "./types";

export function resolveRulesFileOption(
  args: string[],
  commandName: "export" | "import",
): string {
  const filePath = takeOption(args, "--file");
  if (!filePath?.trim()) {
    throw new CliError(
      "USAGE_ERROR",
      `rules ${commandName} 需要 --file`,
      EXIT_CODES.USAGE,
    );
  }

  return filePath;
}

export function normalizeProjectId(input: string): string {
  return input.startsWith("project:") ? input.slice("project:".length) : input;
}

export function createRulesBundle(records: RuleBackupRecord[]): CliRulesBundle {
  return {
    kind: "prompthub-cli-rules",
    version: 1,
    exportedAt: new Date().toISOString(),
    records,
  };
}

export function formatRuleVersionSnapshot(
  version: RuleVersionSnapshot,
): Record<string, unknown> {
  return {
    id: version.id,
    savedAt: version.savedAt,
    source: version.source,
    content: version.content,
  };
}

export function resolveRuleRewriteArgs(
  args: string[],
  currentContent: string,
  fileName: string,
  platformName: string,
): RuleRewriteRequest {
  const instruction = readTextOption(
    args,
    "--instruction",
    "--instruction-file",
  );
  const apiKey = takeOption(args, "--api-key");
  const apiUrl = takeOption(args, "--api-url");
  const model = takeOption(args, "--model");
  const provider = takeOption(args, "--provider") ?? "openai";
  const apiProtocol = takeOption(args, "--api-protocol");
  ensureNoUnknownOptions(args);

  if (!instruction?.trim()) {
    throw new CliError(
      "USAGE_ERROR",
      "rules rewrite 需要 --instruction 或 --instruction-file",
      EXIT_CODES.USAGE,
    );
  }
  if (!apiKey?.trim() || !apiUrl?.trim() || !model?.trim()) {
    throw new CliError(
      "USAGE_ERROR",
      "rules rewrite 需要 --api-key、--api-url 和 --model",
      EXIT_CODES.USAGE,
    );
  }
  if (
    apiProtocol !== undefined &&
    apiProtocol !== "openai" &&
    apiProtocol !== "gemini" &&
    apiProtocol !== "anthropic"
  ) {
    throw new CliError(
      "USAGE_ERROR",
      "--api-protocol 必须是 openai|gemini|anthropic",
      EXIT_CODES.USAGE,
    );
  }

  return {
    instruction: instruction.trim(),
    currentContent,
    fileName,
    platformName,
    aiConfig: {
      apiKey: apiKey.trim(),
      apiUrl: apiUrl.trim(),
      model: model.trim(),
      provider: provider.trim() || "openai",
      apiProtocol:
        apiProtocol === "gemini"
          ? "gemini"
          : apiProtocol === "anthropic"
            ? "anthropic"
            : "openai",
    },
  };
}

export function ruleTableRows(
  rules: RuleFileDescriptor[],
): Array<Record<string, unknown>> {
  return rules.map((rule) => ({
    id: rule.id,
    platform: rule.platformId,
    name: rule.name,
    group: rule.group,
    syncStatus: rule.syncStatus,
    exists: rule.exists,
    projectRootPath: rule.projectRootPath ?? "",
    path: rule.path,
  }));
}

export function ruleVersionTableRows(
  versions: RuleVersionSnapshot[],
): Array<Record<string, unknown>> {
  return versions.map((version) => ({
    id: version.id,
    source: version.source,
    savedAt: version.savedAt,
    preview: version.content.split("\n")[0] ?? "",
  }));
}
