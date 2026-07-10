import { PromptDB, PromptOutputFormatDB, PromptRelationDB } from "../database";
import type { PromptGraphRelationKind } from "@prompthub/shared/types";
import {
  CliError,
  EXIT_CODES,
  type CliContext,
  type CliDatabaseHooks,
} from "./types";
import { PROMPT_HELP } from "./help";
import { emitSuccess } from "./io";
import {
  ensureNoUnknownOptions,
  optionalPositional,
  parseNumberOption,
  parsePromptVariablesMap,
  requirePositional,
  takeFlag,
  takeOption,
} from "./args";
import {
  diffPromptVersions,
  duplicatePrompt,
  promptDiffTableRows,
  promptTableRows,
  promptTagTableRows,
  promptVersionTableRows,
  renderPromptCopy,
  requirePrompt,
  resolvePromptCreateArgs,
  resolvePromptSearchArgs,
  resolvePromptUpdateArgs,
  resolvePromptVersionDiffArgs,
} from "./prompt-utils";
import { resolvePromptIdentifier } from "./select";

export async function handlePromptCommand(
  args: string[],
  context: CliContext,
  databaseHooks: CliDatabaseHooks,
): Promise<void> {
  if (args.length === 0 || takeFlag(args, "--help") || takeFlag(args, "-h")) {
    context.io.stdout(PROMPT_HELP);
    return;
  }

  const action = requirePositional(args, 0, "prompt 子命令");
  const db = databaseHooks.initDatabase();
  const promptDb = new PromptDB(db);

  if (action === "list") {
    const prompts = promptDb.getAll();
    emitSuccess(context, prompts, promptTableRows(prompts));
    return;
  }

  if (action === "get") {
    const prompt = await resolvePromptIdentifier(
      context,
      promptDb,
      optionalPositional(args, 1),
    );
    ensureNoUnknownOptions(args.slice(optionalPositional(args, 1) ? 2 : 1));
    emitSuccess(context, prompt);
    return;
  }

  if (action === "duplicate") {
    const prompt = await resolvePromptIdentifier(
      context,
      promptDb,
      requirePositional(args, 1, "prompt id 或 title"),
    );
    ensureNoUnknownOptions(args.slice(2));
    emitSuccess(context, duplicatePrompt(promptDb, prompt.id));
    return;
  }

  if (action === "versions") {
    const prompt = await resolvePromptIdentifier(
      context,
      promptDb,
      requirePositional(args, 1, "prompt id 或 title"),
    );
    ensureNoUnknownOptions(args.slice(2));
    const versions = promptDb.getVersions(prompt.id);
    emitSuccess(context, versions, promptVersionTableRows(versions));
    return;
  }

  if (action === "create-version") {
    const prompt = await resolvePromptIdentifier(
      context,
      promptDb,
      requirePositional(args, 1, "prompt id 或 title"),
    );
    const versionArgs = args.slice(2);
    const note = takeOption(versionArgs, "--note");
    ensureNoUnknownOptions(versionArgs);
    const createdVersion = promptDb.createVersion(prompt.id, note);
    if (!createdVersion) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt 不存在: ${prompt.id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, createdVersion);
    return;
  }

  if (action === "delete-version") {
    const prompt = await resolvePromptIdentifier(
      context,
      promptDb,
      requirePositional(args, 1, "prompt id 或 title"),
    );
    const versionId = requirePositional(args, 2, "version id");
    ensureNoUnknownOptions(args.slice(3));
    if (!promptDb.deleteVersion(versionId)) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt 版本不存在: ${versionId}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, { deleted: true, promptId: prompt.id, versionId });
    return;
  }

  if (action === "diff") {
    const prompt = await resolvePromptIdentifier(
      context,
      promptDb,
      requirePositional(args, 1, "prompt id 或 title"),
    );
    const diffArgs = resolvePromptVersionDiffArgs(args.slice(2));
    const versions = promptDb.getVersions(prompt.id);
    const fromVersion = versions.find((item) => item.version === diffArgs.from);
    const toVersion = versions.find((item) => item.version === diffArgs.to);
    if (!fromVersion || !toVersion) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt 版本不存在: ${prompt.id}@v${!fromVersion ? diffArgs.from : diffArgs.to}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    const diff = diffPromptVersions(fromVersion, toVersion);
    emitSuccess(context, diff, promptDiffTableRows(diff));
    return;
  }

  if (action === "rollback") {
    const prompt = await resolvePromptIdentifier(
      context,
      promptDb,
      requirePositional(args, 1, "prompt id 或 title"),
    );
    const rollbackArgs = args.slice(2);
    const version = parseNumberOption(
      takeOption(rollbackArgs, "--version"),
      "--version",
    );
    ensureNoUnknownOptions(rollbackArgs);

    if (version === undefined || version === 0) {
      throw new CliError(
        "USAGE_ERROR",
        "prompt rollback 需要有效的 --version",
        EXIT_CODES.USAGE,
      );
    }

    const rolledBack = promptDb.rollback(prompt.id, version);
    if (!rolledBack) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt 版本不存在: ${prompt.id}@v${version}`,
        EXIT_CODES.NOT_FOUND,
      );
    }

    emitSuccess(context, rolledBack);
    return;
  }

  if (action === "use") {
    const identifier = optionalPositional(args, 1);
    const prompt = await resolvePromptIdentifier(context, promptDb, identifier);
    ensureNoUnknownOptions(args.slice(identifier ? 2 : 1));
    promptDb.incrementUsage(prompt.id);
    emitSuccess(context, requirePrompt(promptDb, prompt.id));
    return;
  }

  if (action === "copy") {
    const identifier = optionalPositional(args, 1);
    const copyArgs = args.slice(identifier ? 2 : 1);
    const variables = parsePromptVariablesMap(copyArgs);
    ensureNoUnknownOptions(copyArgs);

    const prompt = await resolvePromptIdentifier(context, promptDb, identifier);
    const content = renderPromptCopy(prompt, variables);
    promptDb.incrementUsage(prompt.id);
    emitSuccess(context, {
      promptId: prompt.id,
      content,
      usageCount: requirePrompt(promptDb, prompt.id).usageCount,
      variables,
    });
    return;
  }

  if (action === "list-tags") {
    ensureNoUnknownOptions(args.slice(1));
    const tags = promptDb.getAllTags();
    emitSuccess(context, tags, promptTagTableRows(tags));
    return;
  }

  if (action === "rename-tag") {
    const oldTag = requirePositional(args, 1, "old tag");
    const newTag = requirePositional(args, 2, "new tag");
    ensureNoUnknownOptions(args.slice(3));
    promptDb.renameTag(oldTag, newTag);
    emitSuccess(context, { renamed: true, oldTag, newTag });
    return;
  }

  if (action === "delete-tag") {
    const tag = requirePositional(args, 1, "tag");
    ensureNoUnknownOptions(args.slice(2));
    promptDb.deleteTag(tag);
    emitSuccess(context, { deleted: true, tag });
    return;
  }

  if (action === "create") {
    const created = promptDb.create(resolvePromptCreateArgs(args.slice(1)));
    emitSuccess(context, created);
    return;
  }

  if (action === "update") {
    const identifier = optionalPositional(args, 1);
    const prompt = await resolvePromptIdentifier(context, promptDb, identifier);
    const updated = promptDb.update(
      prompt.id,
      resolvePromptUpdateArgs(args.slice(identifier ? 2 : 1)),
    );
    if (!updated) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt 不存在: ${prompt.id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, updated);
    return;
  }

  if (action === "delete") {
    const identifier = optionalPositional(args, 1);
    const prompt = await resolvePromptIdentifier(context, promptDb, identifier);
    ensureNoUnknownOptions(args.slice(identifier ? 2 : 1));
    if (!promptDb.delete(prompt.id)) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt 不存在: ${prompt.id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, { deleted: true, id: prompt.id });
    return;
  }

  if (action === "search") {
    const prompts = promptDb.search(resolvePromptSearchArgs(args.slice(1)));
    emitSuccess(context, prompts, promptTableRows(prompts));
    return;
  }

  if (action === "relation") {
    await handlePromptRelationCommand(args.slice(1), context, db);
    return;
  }

  if (action === "output-format") {
    await handlePromptOutputFormatCommand(args.slice(1), context, db);
    return;
  }

  throw new CliError(
    "USAGE_ERROR",
    `不支持的 prompt 子命令: ${action}`,
    EXIT_CODES.USAGE,
  );
}

export function parseRelationKind(
  value: string | undefined,
): PromptGraphRelationKind {
  if (
    value === "related_to" ||
    value === "variant_of" ||
    value === "depends_on" ||
    value === "next_step"
  ) {
    return value;
  }
  throw new CliError(
    "USAGE_ERROR",
    "relation kind 必须是 related_to|variant_of|depends_on|next_step",
    EXIT_CODES.USAGE,
  );
}

export async function handlePromptRelationCommand(
  args: string[],
  context: CliContext,
  db: ReturnType<CliDatabaseHooks["initDatabase"]>,
): Promise<void> {
  const relationDb = new PromptRelationDB(db);
  const action = requirePositional(args, 0, "prompt relation 子命令");

  if (action === "list") {
    const listArgs = args.slice(1);
    const promptId = takeOption(listArgs, "--prompt-id");
    const kindRaw = takeOption(listArgs, "--kind");
    ensureNoUnknownOptions(listArgs);
    const relations = relationDb.list({
      ...(promptId && { promptId }),
      ...(kindRaw && { kind: parseRelationKind(kindRaw) }),
    });
    emitSuccess(
      context,
      relations,
      relations.map((item) => ({
        id: item.id,
        source: item.sourcePromptId,
        target: item.targetPromptId,
        kind: item.kind,
        note: item.note ?? "",
      })),
    );
    return;
  }

  if (action === "create") {
    const createArgs = args.slice(1);
    const sourcePromptId = takeOption(createArgs, "--source");
    const targetPromptId = takeOption(createArgs, "--target");
    const kind = parseRelationKind(takeOption(createArgs, "--kind"));
    const note = takeOption(createArgs, "--note");
    ensureNoUnknownOptions(createArgs);
    if (!sourcePromptId?.trim() || !targetPromptId?.trim()) {
      throw new CliError(
        "USAGE_ERROR",
        "prompt relation create 需要 --source 和 --target",
        EXIT_CODES.USAGE,
      );
    }
    emitSuccess(
      context,
      relationDb.create({
        sourcePromptId: sourcePromptId.trim(),
        targetPromptId: targetPromptId.trim(),
        kind,
        note,
      }),
    );
    return;
  }

  if (action === "update") {
    const id = requirePositional(args, 1, "relation id");
    const updateArgs = args.slice(2);
    const kindRaw = takeOption(updateArgs, "--kind");
    const note = takeOption(updateArgs, "--note");
    ensureNoUnknownOptions(updateArgs);
    const updated = relationDb.update(id, {
      ...(kindRaw && { kind: parseRelationKind(kindRaw) }),
      ...(note !== undefined && { note }),
    });
    if (!updated) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt relation 不存在: ${id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, updated);
    return;
  }

  if (action === "delete") {
    const id = requirePositional(args, 1, "relation id");
    ensureNoUnknownOptions(args.slice(2));
    if (!relationDb.delete(id)) {
      throw new CliError(
        "NOT_FOUND",
        `Prompt relation 不存在: ${id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, { deleted: true, id });
    return;
  }

  throw new CliError(
    "USAGE_ERROR",
    `不支持的 prompt relation 子命令: ${action}`,
    EXIT_CODES.USAGE,
  );
}

export async function handlePromptOutputFormatCommand(
  args: string[],
  context: CliContext,
  db: ReturnType<CliDatabaseHooks["initDatabase"]>,
): Promise<void> {
  const formatDb = new PromptOutputFormatDB(db);
  const action = requirePositional(args, 0, "prompt output-format 子命令");

  if (action === "list") {
    const listArgs = args.slice(1);
    const sourcePromptId = takeOption(listArgs, "--source");
    ensureNoUnknownOptions(listArgs);
    const items = formatDb.list({
      ...(sourcePromptId && { sourcePromptId }),
    });
    emitSuccess(
      context,
      items,
      items.map((item) => ({
        id: item.id,
        source: item.sourcePromptId,
        target: item.targetPromptId ?? "",
        sortOrder: item.sortOrder,
      })),
    );
    return;
  }

  if (action === "create") {
    const createArgs = args.slice(1);
    const sourcePromptId = takeOption(createArgs, "--source");
    const targetPromptId = takeOption(createArgs, "--target");
    const sortOrder = parseNumberOption(
      takeOption(createArgs, "--sort-order"),
      "--sort-order",
    );
    ensureNoUnknownOptions(createArgs);
    if (!sourcePromptId?.trim()) {
      throw new CliError(
        "USAGE_ERROR",
        "prompt output-format create 需要 --source",
        EXIT_CODES.USAGE,
      );
    }
    emitSuccess(
      context,
      formatDb.create({
        sourcePromptId: sourcePromptId.trim(),
        targetPromptId: targetPromptId?.trim() || null,
        ...(sortOrder !== undefined && { sortOrder }),
      }),
    );
    return;
  }

  if (action === "delete") {
    const id = requirePositional(args, 1, "output-format item id");
    ensureNoUnknownOptions(args.slice(2));
    if (!formatDb.delete(id)) {
      throw new CliError(
        "NOT_FOUND",
        `Output format item 不存在: ${id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, { deleted: true, id });
    return;
  }

  if (action === "reorder") {
    const reorderArgs = args.slice(1);
    const sourcePromptId = takeOption(reorderArgs, "--source");
    const itemId = takeOption(reorderArgs, "--id");
    const sortOrder = parseNumberOption(
      takeOption(reorderArgs, "--sort-order"),
      "--sort-order",
    );
    ensureNoUnknownOptions(reorderArgs);
    if (!sourcePromptId?.trim() || !itemId?.trim() || sortOrder === undefined) {
      throw new CliError(
        "USAGE_ERROR",
        "prompt output-format reorder 需要 --source、--id 和 --sort-order",
        EXIT_CODES.USAGE,
      );
    }
    formatDb.reorder(sourcePromptId.trim(), itemId.trim(), sortOrder);
    emitSuccess(context, {
      reordered: true,
      sourcePromptId: sourcePromptId.trim(),
      id: itemId.trim(),
      sortOrder,
    });
    return;
  }

  throw new CliError(
    "USAGE_ERROR",
    `不支持的 prompt output-format 子命令: ${action}`,
    EXIT_CODES.USAGE,
  );
}
