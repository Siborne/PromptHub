import path from "path";

import { FolderDB, PromptDB, SkillDB } from "../database";
import {
  clearCliWorkspaceData,
  createCliWorkspaceBundle,
  createCliWorkspaceSummary,
  hasCliWorkspaceData,
  parseCliWorkspaceBundle,
  restoreCliWorkspaceSnapshot,
} from "./workspace-sync";
import {
  getRemoteSyncStatus,
  pullRemoteSyncSnapshot,
  pushRemoteSyncSnapshot,
} from "./sync-command";
import {
  CliError,
  EXIT_CODES,
  type CliContext,
  type CliDatabaseHooks,
} from "./types";
import { WORKSPACE_HELP, SYNC_HELP } from "./help";
import { emitSuccess, toJson } from "./io";
import {
  ensureNoUnknownOptions,
  readRequiredTextFile,
  requirePositional,
  takeFlag,
  writeRequiredTextFile,
} from "./args";
import {
  resolveRemoteSyncOptions,
  resolveWorkspaceFileOption,
} from "./workspace-utils";

export async function handleWorkspaceCommand(
  args: string[],
  context: CliContext,
  databaseHooks: CliDatabaseHooks,
): Promise<void> {
  if (args.length === 0 || takeFlag(args, "--help") || takeFlag(args, "-h")) {
    context.io.stdout(WORKSPACE_HELP);
    return;
  }

  const action = requirePositional(args, 0, "workspace 子命令");
  const db = databaseHooks.initDatabase();
  const promptDb = new PromptDB(db);
  const folderDb = new FolderDB(db);
  const skillDb = new SkillDB(db);

  if (action === "export") {
    const exportArgs = args.slice(1);
    const filePath = resolveWorkspaceFileOption(exportArgs, "export");
    ensureNoUnknownOptions(exportArgs);

    const bundle = await createCliWorkspaceBundle(
      promptDb,
      folderDb,
      skillDb,
      context.skills,
      db,
    );
    const summary = createCliWorkspaceSummary(bundle.payload);
    writeRequiredTextFile(filePath, toJson(bundle));
    emitSuccess(context, {
      exported: true,
      filePath: path.resolve(filePath),
      ...summary,
    });
    return;
  }

  if (action === "import") {
    const importArgs = args.slice(1);
    const filePath = resolveWorkspaceFileOption(importArgs, "import");
    const forceClear = takeFlag(importArgs, "--force-clear");
    ensureNoUnknownOptions(importArgs);

    let bundle: ReturnType<typeof parseCliWorkspaceBundle>;
    try {
      bundle = parseCliWorkspaceBundle(readRequiredTextFile(filePath));
    } catch (error) {
      throw new CliError(
        "USAGE_ERROR",
        "workspace import 文件格式不受支持",
        EXIT_CODES.USAGE,
        { cause: error instanceof Error ? error.message : String(error) },
      );
    }
    const hasData = await hasCliWorkspaceData(db);
    if (hasData && !forceClear) {
      throw new CliError(
        "CONFLICT",
        "目标数据库非空；如需覆盖请传入 --force-clear",
        EXIT_CODES.CONFLICT,
      );
    }

    if (forceClear) {
      clearCliWorkspaceData(db);
    }

    const summary = await restoreCliWorkspaceSnapshot(
      bundle.payload,
      {
        promptDb,
        folderDb,
        skillDb,
      },
      {
        db,
        skillService: context.skills,
      },
    );

    emitSuccess(context, {
      imported: true,
      filePath: path.resolve(filePath),
      ...summary,
      forceCleared: forceClear,
    });
    return;
  }

  throw new CliError(
    "USAGE_ERROR",
    `不支持的 workspace 子命令: ${action}`,
    EXIT_CODES.USAGE,
  );
}

export async function handleSyncCommand(
  args: string[],
  context: CliContext,
  databaseHooks: CliDatabaseHooks,
): Promise<void> {
  if (args.length === 0 || takeFlag(args, "--help") || takeFlag(args, "-h")) {
    context.io.stdout(SYNC_HELP);
    return;
  }

  const action = requirePositional(args, 0, "sync 子命令");
  const options = resolveRemoteSyncOptions(args.slice(1));

  if (action === "status") {
    emitSuccess(context, await getRemoteSyncStatus(options));
    return;
  }

  const db = databaseHooks.initDatabase();
  const promptDb = new PromptDB(db);
  const folderDb = new FolderDB(db);
  const skillDb = new SkillDB(db);

  if (action === "push") {
    emitSuccess(
      context,
      await pushRemoteSyncSnapshot(
        options,
        { promptDb, folderDb, skillDb },
        db,
      ),
    );
    return;
  }

  if (action === "pull") {
    emitSuccess(
      context,
      await pullRemoteSyncSnapshot(options, db, {
        promptDb,
        folderDb,
        skillDb,
      }),
    );
    return;
  }

  throw new CliError(
    "USAGE_ERROR",
    `不支持的 sync 子命令: ${action}`,
    EXIT_CODES.USAGE,
  );
}
