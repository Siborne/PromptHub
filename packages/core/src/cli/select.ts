import path from "path";
import type { Readable } from "stream";

import { PromptDB, SkillDB } from "../database";
import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import type {
  Prompt,
  RuleFileDescriptor,
  RuleFileId,
  Skill,
} from "@prompthub/shared/types";
import { isRuleFileId } from "@prompthub/shared/types";
import { coreRulesWorkspaceService } from "../rules-workspace-default";
import {
  CliError,
  EXIT_CODES,
  type CliContext,
  type SelectionChoice,
  type SkillIdentifierResolution,
} from "./types";
import type { CliSkillService } from "./skill";
import {
  ensureNoUnknownOptions,
  optionalPositional,
  requirePositional,
} from "./args";

export async function skillTableRows(
  skillService: CliSkillService,
  skills: Skill[],
): Promise<Array<Record<string, unknown>>> {
  return Promise.all(
    skills.map(async (skill) => ({
      id: skill.id,
      name: skill.name,
      protocol: skill.protocol_type,
      author: skill.author,
      version: skill.version,
      favorite: skill.is_favorite,
      managedRepo: skill.local_repo_path
        ? await skillService.isManagedRepoPath(skill.local_repo_path)
        : false,
      updatedAt: skill.updated_at,
    })),
  );
}

export function skillVersionTableRows(
  versions: import("@prompthub/shared/types").SkillVersion[],
): Array<Record<string, unknown>> {
  return versions.map((version) => ({
    id: version.id,
    version: version.version,
    note: version.note,
    createdAt: version.createdAt,
  }));
}

export function skillPlatformRows(
  platforms: SkillPlatform[],
  detected?: string[],
): Array<Record<string, unknown>> {
  const detectedSet = new Set(detected ?? []);
  return platforms.map((platform) => ({
    id: platform.id,
    name: platform.name,
    installed: detectedSet.has(platform.id),
  }));
}

export function sortSkillChoices(skills: Skill[]): Skill[] {
  return [...skills].sort((a, b) => {
    if (a.is_favorite !== b.is_favorite) {
      return a.is_favorite ? -1 : 1;
    }
    if (a.updated_at !== b.updated_at) {
      return b.updated_at - a.updated_at;
    }
    return a.name.localeCompare(b.name);
  });
}

export function rankSearchValues(
  values: Array<string | undefined>,
  query: string,
): number | null {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return null;
  }

  let best: number | null = null;
  for (const value of values) {
    const normalizedValue = value?.trim().toLowerCase();
    if (!normalizedValue) {
      continue;
    }
    const rank =
      normalizedValue === normalizedQuery
        ? 0
        : normalizedValue.startsWith(normalizedQuery)
          ? 1
          : normalizedValue.includes(normalizedQuery)
            ? 2
            : null;
    if (rank !== null && (best === null || rank < best)) {
      best = rank;
    }
  }

  return best;
}

export function findRankedMatches<T>(
  items: T[],
  query: string,
  values: (item: T) => Array<string | undefined>,
  label: (item: T) => string,
): T[] {
  return items
    .map((item) => ({ item, rank: rankSearchValues(values(item), query) }))
    .filter((entry): entry is { item: T; rank: number } => entry.rank !== null)
    .sort(
      (a, b) => a.rank - b.rank || label(a.item).localeCompare(label(b.item)),
    )
    .map((entry) => entry.item);
}

export function hasExactSearchMatch(
  values: Array<string | undefined>,
  query: string,
): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  return values.some(
    (value) => value?.trim().toLowerCase() === normalizedQuery,
  );
}

export function findSkillMatches(skills: Skill[], query: string): Skill[] {
  return findRankedMatches(
    skills,
    query,
    (skill) => [skill.id, skill.name, skill.description ?? undefined],
    (skill) => skill.name,
  );
}

export function readLineFromInput(input: Readable): Promise<string> {
  input.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let buffer = "";

    const cleanup = () => {
      input.off("data", onData);
      input.off("end", onEnd);
      input.off("error", onError);
    };
    const finish = (value: string) => {
      cleanup();
      resolve(value);
    };
    const onData = (chunk: string | Buffer) => {
      buffer += chunk.toString();
      const lineEnd = buffer.search(/\r?\n/);
      if (lineEnd !== -1) {
        finish(buffer.slice(0, lineEnd));
      }
    };
    const onEnd = () => finish(buffer);
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    input.on("data", onData);
    input.once("end", onEnd);
    input.once("error", onError);
    input.resume();
  });
}

export async function selectSkillFromTerminal(
  context: CliContext,
  skills: Skill[],
  query?: string,
): Promise<Skill> {
  const choices = sortSkillChoices(skills);
  const title = query?.trim()
    ? `选择要安装到项目的 Skill（匹配 "${query.trim()}"）：`
    : "选择要安装到项目的 Skill：";
  return selectFromTerminal(context, title, choices.map(skillChoice), {
    emptyMessage: "没有可安装的 My Skills",
    missingMessage:
      "缺少 skill id/name；在交互式终端中可省略并选择，非交互调用请传入 skill 名称或查询词",
    invalidLabel: "Skill 编号",
  });
}

export function skillChoice(skill: Skill): SelectionChoice<Skill> {
  return {
    value: skill,
    id: skill.id,
    label: skill.name,
    description: skill.description ?? undefined,
  };
}

export async function selectFromTerminal<T>(
  context: CliContext,
  title: string,
  choices: SelectionChoice<T>[],
  options: {
    emptyMessage: string;
    missingMessage: string;
    invalidLabel: string;
  },
): Promise<T> {
  if (choices.length === 0) {
    throw new CliError("NOT_FOUND", options.emptyMessage, EXIT_CODES.NOT_FOUND);
  }

  if (!context.io.isInteractive || !context.io.stdin) {
    throw new CliError("USAGE_ERROR", options.missingMessage, EXIT_CODES.USAGE);
  }

  context.io.stderr(title);
  choices.forEach((choice, index) => {
    const description = choice.description ? ` - ${choice.description}` : "";
    context.io.stderr(`  ${index + 1}. ${choice.label}${description}`);
  });
  context.io.stderr("输入编号：");

  const answer = (await readLineFromInput(context.io.stdin)).trim();
  const selectedIndex = Number.parseInt(answer, 10);
  if (
    !Number.isInteger(selectedIndex) ||
    selectedIndex < 1 ||
    selectedIndex > choices.length
  ) {
    throw new CliError(
      "USAGE_ERROR",
      `无效的 ${options.invalidLabel}: ${answer || "(empty)"}`,
      EXIT_CODES.USAGE,
    );
  }

  return choices[selectedIndex - 1].value;
}

export async function resolveProjectInstallSkill(
  context: CliContext,
  skillDb: SkillDB,
  identifier?: string,
): Promise<Skill> {
  const skills = skillDb.getAll();
  if (!identifier?.trim()) {
    return selectSkillFromTerminal(context, skills);
  }

  const matches = findSkillMatches(skills, identifier);
  if (matches.length === 0) {
    throw new CliError(
      "NOT_FOUND",
      `Skill 不存在或没有匹配项: ${identifier}`,
      EXIT_CODES.NOT_FOUND,
    );
  }
  if (matches.length === 1) {
    return matches[0];
  }

  const exactMatches = matches.filter(
    (skill) =>
      skill.id.toLowerCase() === identifier.toLowerCase() ||
      skill.name.toLowerCase() === identifier.toLowerCase(),
  );
  if (exactMatches.length === 1) {
    return exactMatches[0];
  }

  if (context.io.isInteractive) {
    return selectSkillFromTerminal(context, matches, identifier);
  }

  throw new CliError(
    "CONFLICT",
    `Skill 查询匹配多个结果: ${identifier}`,
    EXIT_CODES.CONFLICT,
    {
      candidates: matches.map((skill) => ({ id: skill.id, name: skill.name })),
    },
  );
}

export function resolveSkillIdentifier(
  skillDb: SkillDB,
  identifier: string,
): SkillIdentifierResolution {
  const skill = skillDb.getById(identifier) ?? skillDb.getByName(identifier);
  if (!skill) {
    throw new CliError(
      "NOT_FOUND",
      `Skill 不存在: ${identifier}`,
      EXIT_CODES.NOT_FOUND,
    );
  }

  return { identifier, skill };
}

export function promptChoice(prompt: Prompt): SelectionChoice<Prompt> {
  const description = prompt.description || prompt.tags.join(", ") || undefined;
  return {
    value: prompt,
    id: prompt.id,
    label: prompt.title,
    description,
  };
}

export function promptSearchValues(prompt: Prompt): Array<string | undefined> {
  return [
    prompt.id,
    prompt.title,
    prompt.description ?? undefined,
    ...prompt.tags,
  ];
}

export function sortPromptChoices(prompts: Prompt[]): Prompt[] {
  return [...prompts].sort((a, b) => {
    if (a.isPinned !== b.isPinned) {
      return a.isPinned ? -1 : 1;
    }
    if (a.isFavorite !== b.isFavorite) {
      return a.isFavorite ? -1 : 1;
    }
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt.localeCompare(a.updatedAt);
    }
    return a.title.localeCompare(b.title);
  });
}

export async function resolvePromptIdentifier(
  context: CliContext,
  promptDb: PromptDB,
  identifier: string | undefined,
): Promise<Prompt> {
  const prompts = promptDb.getAll();
  if (!identifier?.trim()) {
    return selectFromTerminal(
      context,
      "选择 Prompt：",
      sortPromptChoices(prompts).map(promptChoice),
      {
        emptyMessage: "没有可选择的 Prompt",
        missingMessage:
          "缺少 prompt id/title；在交互式终端中可省略并选择，非交互调用请传入 prompt id、标题或查询词",
        invalidLabel: "Prompt 编号",
      },
    );
  }

  const matches = findRankedMatches(
    prompts,
    identifier,
    promptSearchValues,
    (prompt) => prompt.title,
  );
  if (matches.length === 0) {
    throw new CliError(
      "NOT_FOUND",
      `Prompt 不存在或没有匹配项: ${identifier}`,
      EXIT_CODES.NOT_FOUND,
    );
  }

  const exactMatches = matches.filter((prompt) =>
    hasExactSearchMatch([prompt.id, prompt.title], identifier),
  );
  if (matches.length === 1 || exactMatches.length === 1) {
    return exactMatches[0] ?? matches[0];
  }

  if (context.io.isInteractive) {
    return selectFromTerminal(
      context,
      `选择 Prompt（匹配 "${identifier.trim()}"）：`,
      matches.map(promptChoice),
      {
        emptyMessage: "没有可选择的 Prompt",
        missingMessage: "缺少 prompt id/title",
        invalidLabel: "Prompt 编号",
      },
    );
  }

  throw new CliError(
    "CONFLICT",
    `Prompt 查询匹配多个结果: ${identifier}`,
    EXIT_CODES.CONFLICT,
    {
      candidates: matches.map((prompt) => ({
        id: prompt.id,
        title: prompt.title,
      })),
    },
  );
}

export function ruleChoice(
  rule: RuleFileDescriptor,
): SelectionChoice<RuleFileDescriptor> {
  return {
    value: rule,
    id: rule.id,
    label: `${rule.platformName} / ${rule.name}`,
    description: rule.projectRootPath ?? rule.path,
  };
}

export function ruleSearchValues(
  rule: RuleFileDescriptor,
): Array<string | undefined> {
  return [
    rule.id,
    rule.name,
    rule.platformName,
    rule.description,
    rule.projectRootPath ?? undefined,
    rule.projectRootPath ? path.basename(rule.projectRootPath) : undefined,
  ];
}

export async function resolveRuleIdentifier(
  context: CliContext,
  identifier: string | undefined,
): Promise<RuleFileId> {
  const rules = await coreRulesWorkspaceService.listCachedRuleDescriptors();
  if (!identifier?.trim()) {
    return (
      await selectFromTerminal(context, "选择 Rule：", rules.map(ruleChoice), {
        emptyMessage: "没有可选择的 Rule",
        missingMessage:
          "缺少 rule id/name；在交互式终端中可省略并选择，非交互调用请传入 rule id 或查询词",
        invalidLabel: "Rule 编号",
      })
    ).id;
  }

  if (isRuleFileId(identifier)) {
    return identifier;
  }

  const matches = findRankedMatches(
    rules,
    identifier,
    ruleSearchValues,
    (rule) => rule.name,
  );
  if (matches.length === 0) {
    throw new CliError(
      "NOT_FOUND",
      `Rule 不存在或没有匹配项: ${identifier}`,
      EXIT_CODES.NOT_FOUND,
    );
  }

  const exactMatches = matches.filter((rule) =>
    hasExactSearchMatch([rule.id, rule.name, rule.platformName], identifier),
  );
  if (matches.length === 1 || exactMatches.length === 1) {
    return (exactMatches[0] ?? matches[0]).id;
  }

  if (context.io.isInteractive) {
    return (
      await selectFromTerminal(
        context,
        `选择 Rule（匹配 "${identifier.trim()}"）：`,
        matches.map(ruleChoice),
        {
          emptyMessage: "没有可选择的 Rule",
          missingMessage: "缺少 rule id/name",
          invalidLabel: "Rule 编号",
        },
      )
    ).id;
  }

  throw new CliError(
    "CONFLICT",
    `Rule 查询匹配多个结果: ${identifier}`,
    EXIT_CODES.CONFLICT,
    {
      candidates: matches.map((rule) => ({
        id: rule.id,
        name: rule.name,
        platformName: rule.platformName,
      })),
    },
  );
}
