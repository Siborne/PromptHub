import fs from "fs";
import path from "path";

import type {
  CreateFolderDTO,
  CreatePromptDTO,
  PromptVersion,
  RuleBackupRecord,
  SearchQuery,
  UpdateFolderDTO,
  UpdatePromptDTO,
  Variable,
} from "@prompthub/shared/types";
import { CliError, EXIT_CODES, type CliRemoteSyncOptions } from "./types";
import { toJson } from "./io";

export type PromptDiffField =
  | "systemPrompt"
  | "systemPromptEn"
  | "userPrompt"
  | "userPromptEn"
  | "variables"
  | "aiResponse";

export interface PromptDiffResult {
  from: PromptVersion;
  to: PromptVersion;
  fields: Array<{
    field: PromptDiffField;
    from: string;
    to: string;
  }>;
}

export interface CliRulesBundle {
  kind: "prompthub-cli-rules";
  version: 1;
  exportedAt: string;
  records: RuleBackupRecord[];
}

export function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const nextValue = args[index + 1];
  const looksLikeOption =
    nextValue?.startsWith("--") &&
    !nextValue.includes("\n") &&
    !nextValue.includes("\r");
  if (index === args.length - 1 || looksLikeOption) {
    throw new CliError("USAGE_ERROR", `${name} 需要一个值`, EXIT_CODES.USAGE);
  }
  const [value] = args.splice(index, 2).slice(1);
  return value;
}

export function takeFlag(args: string[], name: string): boolean {
  const index = args.indexOf(name);
  if (index === -1) {
    return false;
  }
  args.splice(index, 1);
  return true;
}

export function ensureNoUnknownOptions(args: string[]): void {
  const unknownOptions = args.filter((arg) => arg.startsWith("--"));
  if (unknownOptions.length > 0) {
    throw new CliError(
      "USAGE_ERROR",
      `未知参数: ${unknownOptions.join(", ")}`,
      EXIT_CODES.USAGE,
    );
  }
}

export function requirePositional(
  args: string[],
  index: number,
  label: string,
): string {
  const value = args[index];
  if (!value) {
    throw new CliError("USAGE_ERROR", `缺少参数: ${label}`, EXIT_CODES.USAGE);
  }
  return value;
}

export function optionalPositional(
  args: string[],
  index: number,
): string | undefined {
  const value = args[index]?.trim();
  return value && !value.startsWith("-") ? value : undefined;
}

export function parseCsv(value?: string): string[] | undefined {
  if (!value) {
    return undefined;
  }
  const items = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

export function parseRepeatedOption(args: string[], name: string): string[] {
  const values: string[] = [];
  while (true) {
    const value = takeOption(args, name);
    if (value === undefined) {
      break;
    }
    values.push(value);
  }
  return values;
}

export function parseNumberOption(
  value: string | undefined,
  label: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CliError(
      "USAGE_ERROR",
      `${label} 必须是非负整数`,
      EXIT_CODES.USAGE,
    );
  }
  return parsed;
}

export function parsePositiveNumberOption(
  value: string | undefined,
  label: string,
): number | undefined {
  const parsed = parseNumberOption(value, label);
  if (parsed !== undefined && parsed < 1) {
    throw new CliError(
      "USAGE_ERROR",
      `${label} 必须是正整数`,
      EXIT_CODES.USAGE,
    );
  }
  return parsed;
}

export function parsePromptVisibilityOption(
  value: string | undefined,
  label: string,
): "private" | "shared" | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== "private" && value !== "shared") {
    throw new CliError(
      "USAGE_ERROR",
      `${label} 必须是 private|shared`,
      EXIT_CODES.USAGE,
    );
  }
  return value;
}

export function parsePromptScopeOption(
  value: string | undefined,
): SearchQuery["scope"] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value !== "private" && value !== "shared" && value !== "all") {
    throw new CliError(
      "USAGE_ERROR",
      "--scope 必须是 private|shared|all",
      EXIT_CODES.USAGE,
    );
  }
  return value;
}

export function parsePromptVariablesMap(
  args: string[],
): Record<string, string> {
  const entries = parseRepeatedOption(args, "--var");
  const result: Record<string, string> = {};

  for (const entry of entries) {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex <= 0) {
      throw new CliError(
        "USAGE_ERROR",
        "--var 需要 name=value 格式",
        EXIT_CODES.USAGE,
      );
    }

    const name = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1);
    if (!name) {
      throw new CliError(
        "USAGE_ERROR",
        "--var 需要非空变量名",
        EXIT_CODES.USAGE,
      );
    }

    result[name] = value;
  }

  return result;
}

export function readTextOption(
  args: string[],
  optionName: string,
  fileOptionName: string,
): string | undefined {
  const directValue = takeOption(args, optionName);
  const fileValue = takeOption(args, fileOptionName);

  if (directValue !== undefined && fileValue !== undefined) {
    throw new CliError(
      "USAGE_ERROR",
      `${optionName} 和 ${fileOptionName} 不能同时使用`,
      EXIT_CODES.USAGE,
    );
  }

  if (fileValue !== undefined) {
    try {
      return fs.readFileSync(path.resolve(fileValue), "utf8");
    } catch (error) {
      throw new CliError(
        "IO_ERROR",
        `读取文件失败: ${fileValue}`,
        EXIT_CODES.IO,
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
  }

  return directValue;
}

export function readJsonOption(
  args: string[],
  optionName: string,
  fileOptionName: string,
): unknown {
  const raw = readTextOption(args, optionName, fileOptionName);
  if (raw === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new CliError(
      "USAGE_ERROR",
      `${optionName} / ${fileOptionName} 需要合法 JSON`,
      EXIT_CODES.USAGE,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

export function readRequiredTextFile(filePath: string): string {
  try {
    return fs.readFileSync(path.resolve(filePath), "utf8");
  } catch (error) {
    throw new CliError("IO_ERROR", `读取文件失败: ${filePath}`, EXIT_CODES.IO, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function writeRequiredTextFile(filePath: string, content: string): void {
  try {
    const resolved = path.resolve(filePath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, content, "utf8");
  } catch (error) {
    throw new CliError("IO_ERROR", `写入文件失败: ${filePath}`, EXIT_CODES.IO, {
      cause: error instanceof Error ? error.message : String(error),
    });
  }
}

export function parseRulesBundle(text: string): CliRulesBundle {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new CliError(
      "USAGE_ERROR",
      "rules import 需要合法 JSON 文件",
      EXIT_CODES.USAGE,
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new CliError(
      "USAGE_ERROR",
      "rules import 文件格式不正确",
      EXIT_CODES.USAGE,
    );
  }

  const record = parsed as Record<string, unknown>;
  if (
    record.kind !== "prompthub-cli-rules" ||
    record.version !== 1 ||
    !Array.isArray(record.records)
  ) {
    throw new CliError(
      "USAGE_ERROR",
      "rules import 文件格式不受支持",
      EXIT_CODES.USAGE,
    );
  }

  return record as unknown as CliRulesBundle;
}

export function parseVariableType(
  value: unknown,
  label: string,
): Variable["type"] {
  if (
    value === "text" ||
    value === "textarea" ||
    value === "number" ||
    value === "select"
  ) {
    return value;
  }

  throw new CliError(
    "USAGE_ERROR",
    `${label}.type 必须是 text|textarea|number|select`,
    EXIT_CODES.USAGE,
  );
}

export function parseOptionalStringValue(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new CliError(
      "USAGE_ERROR",
      `${label} 必须是字符串`,
      EXIT_CODES.USAGE,
    );
  }
  return value;
}

export function parseOptionalStringArrayValue(
  value: unknown,
  label: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new CliError(
      "USAGE_ERROR",
      `${label} 必须是字符串数组`,
      EXIT_CODES.USAGE,
    );
  }
  return value;
}

export function parseVariablesOption(args: string[]): Variable[] | undefined {
  const value = readJsonOption(args, "--variables", "--variables-file");
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new CliError(
      "USAGE_ERROR",
      "--variables / --variables-file 必须是 JSON 数组",
      EXIT_CODES.USAGE,
    );
  }

  return value.map((item, index) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new CliError(
        "USAGE_ERROR",
        `variables[${index}] 必须是对象`,
        EXIT_CODES.USAGE,
      );
    }

    const record = item as Record<string, unknown>;
    const name = parseOptionalStringValue(
      record.name,
      `variables[${index}].name`,
    );
    if (!name?.trim()) {
      throw new CliError(
        "USAGE_ERROR",
        `variables[${index}].name 不能为空`,
        EXIT_CODES.USAGE,
      );
    }
    if (typeof record.required !== "boolean") {
      throw new CliError(
        "USAGE_ERROR",
        `variables[${index}].required 必须是布尔值`,
        EXIT_CODES.USAGE,
      );
    }

    return {
      name,
      type: parseVariableType(record.type, `variables[${index}]`),
      label: parseOptionalStringValue(
        record.label,
        `variables[${index}].label`,
      ),
      defaultValue: parseOptionalStringValue(
        record.defaultValue,
        `variables[${index}].defaultValue`,
      ),
      options: parseOptionalStringArrayValue(
        record.options,
        `variables[${index}].options`,
      ),
      required: record.required,
    };
  });
}
