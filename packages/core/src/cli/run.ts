import path from "path";

import { closeDatabase, initDatabase } from "../database";
import { configureRuntimePaths, resetRuntimePaths } from "../runtime-paths";
import { CoreMcpError } from "../mcp-library";
import { coreCliSkillService, type CliSkillService } from "./skill";
import { handleAIConfigCommand } from "./ai-config-command";
import { handlePluginCommand } from "./plugin-command";
import { handlePromptCommand } from "./prompt-command";
import { handleFolderCommand } from "./folder-command";
import { handleWorkspaceCommand, handleSyncCommand } from "./workspace-command";
import { handleRulesCommand } from "./rules-command";
import { handleSkillCommand } from "./skill-command";
import { handleMcpCommand } from "./mcp-command";
import { CliRemoteSyncError } from "./sync-command";
import { ROOT_HELP } from "./help";
import {
  CLI_VERSION,
  CliError,
  EXIT_CODES,
  defaultIO,
  type CliContext,
  type CliDatabaseHooks,
  type CliIO,
  type CliRuntimeHooks,
  type OutputFormat,
} from "./types";
import {
  cloneArgs,
  emitError,
  mapCoreMcpError,
  suppressConsoleNoise,
} from "./io";
import { requirePositional, takeOption } from "./args";

// Re-export public types used by tests and consumers
export type {
  CliIO,
  CliRuntimeHooks,
  CliDatabaseHooks,
  OutputFormat,
} from "./types";
export { CliError, EXIT_CODES, CLI_VERSION } from "./types";

function configureCliRuntime(
  args: string[],
  runtimeHooks: CliRuntimeHooks,
): {
  args: string[];
  output: OutputFormat;
} {
  const nextArgs = cloneArgs(args);
  const dataDir = takeOption(nextArgs, "--data-dir");
  const appDataDir = takeOption(nextArgs, "--app-data-dir");
  const outputOption =
    takeOption(nextArgs, "--output") ?? takeOption(nextArgs, "-o") ?? "json";

  if (outputOption !== "json" && outputOption !== "table") {
    throw new CliError(
      "USAGE_ERROR",
      `不支持的输出格式: ${outputOption}`,
      EXIT_CODES.USAGE,
    );
  }

  runtimeHooks.configureRuntimePaths({
    ...(dataDir && { userDataPath: path.resolve(dataDir) }),
    ...(appDataDir && { appDataPath: path.resolve(appDataDir) }),
    exePath: process.execPath,
    isPackaged: false,
    platform: process.platform,
  });

  return { args: nextArgs, output: outputOption };
}

export async function runCli(
  argv: string[],
  io: CliIO = defaultIO(),
  runtimeHooks: CliRuntimeHooks = {
    configureRuntimePaths,
    resetRuntimePaths,
  },
  databaseHooks: CliDatabaseHooks = {
    closeDatabase,
    initDatabase,
  },
  skillService: CliSkillService = coreCliSkillService,
): Promise<number> {
  const restoreConsole = suppressConsoleNoise();

  try {
    const configured = configureCliRuntime(argv, runtimeHooks);
    const context: CliContext = {
      io,
      output: configured.output,
      skills: skillService,
    };
    const args = configured.args;

    if (args[0] === "--version" || args[0] === "-v") {
      io.stdout(CLI_VERSION);
      return EXIT_CODES.OK;
    }

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
      io.stdout(ROOT_HELP);
      return EXIT_CODES.OK;
    }

    const resource = requirePositional(args, 0, "资源类型");
    const commandArgs = args.slice(1);

    if (resource === "prompt") {
      await handlePromptCommand(commandArgs, context, databaseHooks);
      return EXIT_CODES.OK;
    }
    if (resource === "folder") {
      await handleFolderCommand(commandArgs, context, databaseHooks);
      return EXIT_CODES.OK;
    }
    if (resource === "rules") {
      await handleRulesCommand(commandArgs, context);
      return EXIT_CODES.OK;
    }
    if (resource === "workspace") {
      await handleWorkspaceCommand(commandArgs, context, databaseHooks);
      return EXIT_CODES.OK;
    }
    if (resource === "sync") {
      await handleSyncCommand(commandArgs, context, databaseHooks);
      return EXIT_CODES.OK;
    }
    if (resource === "skill") {
      await handleSkillCommand(commandArgs, context, databaseHooks);
      return EXIT_CODES.OK;
    }
    if (resource === "mcp") {
      await handleMcpCommand(commandArgs, context);
      return EXIT_CODES.OK;
    }
    if (resource === "plugin") {
      return await handlePluginCommand(commandArgs, io, configured.output);
    }
    if (resource === "ai") {
      return await handleAIConfigCommand(commandArgs, io, configured.output);
    }

    throw new CliError(
      "USAGE_ERROR",
      `不支持的资源类型: ${resource}`,
      EXIT_CODES.USAGE,
    );
  } catch (error) {
    const cliError =
      error instanceof CliError
        ? error
        : error instanceof CoreMcpError
          ? mapCoreMcpError(error)
          : error instanceof CliRemoteSyncError
            ? new CliError(
                error.status === 409 ? "CONFLICT" : "SYNC_ERROR",
                error.message,
                error.status === 409 ? EXIT_CODES.CONFLICT : EXIT_CODES.IO,
              )
            : new CliError(
                "INTERNAL_ERROR",
                error instanceof Error ? error.message : String(error),
                EXIT_CODES.INTERNAL,
              );
    emitError({ io, output: "json", skills: skillService }, cliError);
    return cliError.exitCode;
  } finally {
    restoreConsole();
    databaseHooks.closeDatabase();
    runtimeHooks.resetRuntimePaths();
  }
}
