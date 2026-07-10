import { FolderDB } from "../database";
import {
  CliError,
  EXIT_CODES,
  type CliContext,
  type CliDatabaseHooks,
} from "./types";
import { FOLDER_HELP } from "./help";
import { emitSuccess } from "./io";
import {
  folderTableRows,
  parseFolderIdsOption,
  resolveFolderCreateArgs,
  resolveFolderUpdateArgs,
} from "./folder-utils";
import { requirePositional, takeFlag } from "./args";

export async function handleFolderCommand(
  args: string[],
  context: CliContext,
  databaseHooks: CliDatabaseHooks,
): Promise<void> {
  if (args.length === 0 || takeFlag(args, "--help") || takeFlag(args, "-h")) {
    context.io.stdout(FOLDER_HELP);
    return;
  }

  const action = requirePositional(args, 0, "folder 子命令");
  const db = databaseHooks.initDatabase();
  const folderDb = new FolderDB(db);

  if (action === "list") {
    const folders = folderDb.getAll();
    emitSuccess(context, folders, folderTableRows(folders));
    return;
  }

  if (action === "get") {
    const id = requirePositional(args, 1, "folder id");
    const folder = folderDb.getById(id);
    if (!folder) {
      throw new CliError(
        "NOT_FOUND",
        `Folder 不存在: ${id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, folder);
    return;
  }

  if (action === "create") {
    emitSuccess(
      context,
      folderDb.create(resolveFolderCreateArgs(args.slice(1))),
    );
    return;
  }

  if (action === "update") {
    const id = requirePositional(args, 1, "folder id");
    const updated = folderDb.update(id, resolveFolderUpdateArgs(args.slice(2)));
    if (!updated) {
      throw new CliError(
        "NOT_FOUND",
        `Folder 不存在: ${id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, updated);
    return;
  }

  if (action === "delete") {
    const id = requirePositional(args, 1, "folder id");
    if (!folderDb.delete(id)) {
      throw new CliError(
        "NOT_FOUND",
        `Folder 不存在: ${id}`,
        EXIT_CODES.NOT_FOUND,
      );
    }
    emitSuccess(context, { deleted: true, id });
    return;
  }

  if (action === "reorder") {
    const ids = parseFolderIdsOption(args.slice(1));
    folderDb.reorder(ids);
    emitSuccess(context, { reordered: true, ids });
    return;
  }

  throw new CliError(
    "USAGE_ERROR",
    `不支持的 folder 子命令: ${action}`,
    EXIT_CODES.USAGE,
  );
}
