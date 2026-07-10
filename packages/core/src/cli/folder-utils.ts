import type {
  CreateFolderDTO,
  Folder,
  UpdateFolderDTO,
} from "@prompthub/shared/types";

import {
  ensureNoUnknownOptions,
  parseCsv,
  parseNumberOption,
  takeFlag,
  takeOption,
} from "./args";
import { CliError, EXIT_CODES } from "./types";

export function parseFolderIdsOption(args: string[]): string[] {
  const ids = parseCsv(takeOption(args, "--ids"));
  ensureNoUnknownOptions(args);

  if (!ids || ids.length === 0) {
    throw new CliError(
      "USAGE_ERROR",
      "folder reorder 需要 --ids",
      EXIT_CODES.USAGE,
    );
  }

  return ids;
}

export function resolveFolderCreateArgs(args: string[]): CreateFolderDTO {
  const name = takeOption(args, "--name");
  const icon = takeOption(args, "--icon");
  const parentId = takeOption(args, "--parent-id");
  const isPrivate = takeFlag(args, "--private")
    ? true
    : takeFlag(args, "--public")
      ? false
      : undefined;
  ensureNoUnknownOptions(args);

  if (!name?.trim()) {
    throw new CliError(
      "USAGE_ERROR",
      "folder create 需要 --name",
      EXIT_CODES.USAGE,
    );
  }

  return { name: name.trim(), icon, parentId, isPrivate };
}

export function resolveFolderUpdateArgs(args: string[]): UpdateFolderDTO {
  const name = takeOption(args, "--name");
  const icon = takeOption(args, "--icon");
  const parentId = takeOption(args, "--parent-id");
  const order = parseNumberOption(takeOption(args, "--order"), "--order");
  const isPrivate = takeFlag(args, "--private")
    ? true
    : takeFlag(args, "--public")
      ? false
      : undefined;
  ensureNoUnknownOptions(args);

  const data: UpdateFolderDTO = {
    ...(name !== undefined && { name }),
    ...(icon !== undefined && { icon }),
    ...(parentId !== undefined && { parentId }),
    ...(order !== undefined && { order }),
    ...(isPrivate !== undefined && { isPrivate }),
  };
  if (Object.keys(data).length === 0) {
    throw new CliError(
      "USAGE_ERROR",
      "folder update 至少需要一个更新字段",
      EXIT_CODES.USAGE,
    );
  }

  return data;
}

export function folderTableRows(
  folders: Folder[],
): Array<Record<string, unknown>> {
  return folders.map((folder) => ({
    id: folder.id,
    name: folder.name,
    icon: folder.icon,
    parentId: folder.parentId,
    order: folder.order,
    private: folder.isPrivate ?? false,
    updatedAt: folder.updatedAt,
  }));
}
