import { ensureNoUnknownOptions, takeFlag, takeOption } from "./args";
import { CliError, EXIT_CODES, type CliRemoteSyncOptions } from "./types";

export function resolveWorkspaceFileOption(
  args: string[],
  commandName: "export" | "import",
): string {
  const filePath = takeOption(args, "--file");
  if (!filePath?.trim()) {
    throw new CliError(
      "USAGE_ERROR",
      `workspace ${commandName} 需要 --file`,
      EXIT_CODES.USAGE,
    );
  }
  return filePath;
}

export function resolveRemoteSyncOptions(args: string[]): CliRemoteSyncOptions {
  const endpoint =
    takeOption(args, "--endpoint") ?? process.env.PROMPTHUB_SYNC_ENDPOINT;
  const token =
    takeOption(args, "--token") ??
    process.env.PROMPTHUB_SYNC_TOKEN ??
    process.env.PROMPTHUB_TOKEN;
  const forceClear = takeFlag(args, "--force-clear");
  ensureNoUnknownOptions(args);

  if (!endpoint?.trim()) {
    throw new CliError(
      "USAGE_ERROR",
      "sync 需要 --endpoint 或 PROMPTHUB_SYNC_ENDPOINT",
      EXIT_CODES.USAGE,
    );
  }
  if (!token?.trim()) {
    throw new CliError(
      "USAGE_ERROR",
      "sync 需要 --token、PROMPTHUB_SYNC_TOKEN 或 PROMPTHUB_TOKEN",
      EXIT_CODES.USAGE,
    );
  }

  return { endpoint, token, forceClear };
}
