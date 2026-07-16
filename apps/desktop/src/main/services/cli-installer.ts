import { app } from "electron";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path, { win32 as pathWin32 } from "node:path";
import type {
  CliInstallMethod,
  CliInstallResult,
  CliStatus,
} from "@prompthub/shared/types";

const CLI_COMMAND = "prompthub";
const PACKAGE_MANAGER_NOT_FOUND_ERROR = "CLI_PACKAGE_MANAGER_NOT_FOUND";
const VERSION_PROBE_TIMEOUT_MS = 3_000;
const COMMAND_TIMEOUT_MS = 120_000;
const MAX_LEGACY_WRAPPER_BYTES = 4_096;
type CommandPathSource =
  | "app-env"
  | "login-shell"
  | "windows-where"
  | "npm-prefix";

function execFileAsync(
  command: string,
  args: string[],
  options: Parameters<typeof execFile>[2],
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({
        stdout: typeof stdout === "string" ? stdout : stdout.toString(),
        stderr: typeof stderr === "string" ? stderr : stderr.toString(),
      });
    });
  });
}

function getReleaseTag(): string {
  return `v${app.getVersion()}`;
}

function getCliTarballName(): string {
  return `prompthub-cli-${app.getVersion()}.tgz`;
}

function getCliInstallSource(): string {
  return `https://github.com/legeling/PromptHub/releases/download/${getReleaseTag()}/${getCliTarballName()}`;
}

function buildInstallCommand(method: CliInstallMethod): string {
  const installSource = getCliInstallSource();
  return method === "pnpm"
    ? `pnpm add -g ${installSource}`
    : `npm install -g ${installSource}`;
}

function getManualInstallCommands(): Record<CliInstallMethod, string> {
  return {
    pnpm: buildInstallCommand("pnpm"),
    npm: buildInstallCommand("npm"),
  };
}

async function runCommand(
  command: string,
  args: string[],
  timeout = COMMAND_TIMEOUT_MS,
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(command, args, {
    env: process.env,
    timeout,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    shell: process.platform === "win32",
  });
}

function getLegacyCliWrapperPath(): string {
  return path.join(
    app.getPath("userData"),
    "bin",
    process.platform === "win32" ? "prompthub.cmd" : CLI_COMMAND,
  );
}

function isRecognizedLegacyWrapper(filePath: string): boolean {
  try {
    const stat = fs.lstatSync(filePath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size > MAX_LEGACY_WRAPPER_BYTES
    ) {
      return false;
    }
    const content = fs.readFileSync(filePath, "utf8");
    const invokesDesktop =
      /PromptHub(?:\.app[^\r\n"]*)?[\s\S]*--cli(?:\s|%\*|"\$@")/i.test(content);
    return invokesDesktop && /^(?:#!\/bin\/sh|@echo off)/i.test(content.trim());
  } catch {
    return false;
  }
}

function findLegacyCliWrapper(): string | null {
  const candidate = getLegacyCliWrapperPath();
  return isRecognizedLegacyWrapper(candidate) ? candidate : null;
}

function removeLegacyCliWrapper(filePath: string | null): boolean {
  if (!filePath || !isRecognizedLegacyWrapper(filePath)) {
    return false;
  }
  fs.rmSync(filePath);
  return true;
}

async function resolveFromLoginShell(command: string): Promise<string | null> {
  if (process.platform === "win32") {
    return null;
  }

  const shell = process.env.SHELL || "/bin/zsh";
  try {
    const { stdout } = await execFileAsync(
      shell,
      ["-lc", `command -v ${command}`],
      {
        env: process.env,
        timeout: 10000,
        windowsHide: true,
        maxBuffer: 64 * 1024,
      },
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function cleanCommandPath(value: string): string {
  return value.trim().replace(/^"|"$/g, "");
}

async function resolveFromWindowsWhere(command: string): Promise<string[]> {
  if (process.platform !== "win32") {
    return [];
  }

  try {
    const { stdout } = await runCommand("where.exe", [command]);
    return uniqueNonEmpty(stdout.split(/\r?\n/).map(cleanCommandPath));
  } catch {
    return [];
  }
}

async function detectVersionAtPath(
  commandPath: string,
  pathSource: CommandPathSource,
): Promise<{
  version: string | null;
  path: string | null;
  pathSource: CommandPathSource | null;
}> {
  try {
    if (isRecognizedLegacyWrapper(commandPath)) {
      return { version: null, path: null, pathSource: null };
    }
    const { stdout } = await runCommand(
      commandPath,
      ["--version"],
      VERSION_PROBE_TIMEOUT_MS,
    );
    return {
      version: stdout.trim() || null,
      path: commandPath,
      pathSource,
    };
  } catch {
    return { version: null, path: null, pathSource: null };
  }
}

async function detectVersionFromCandidates(
  candidates: string[],
  pathSource: CommandPathSource,
): Promise<{
  version: string | null;
  path: string | null;
  pathSource: CommandPathSource | null;
}> {
  for (const candidate of uniqueNonEmpty(candidates)) {
    const result = await detectVersionAtPath(candidate, pathSource);
    if (result.version) {
      return result;
    }
  }

  return { version: null, path: null, pathSource: null };
}

async function queryNpmValue(args: string[]): Promise<string | null> {
  if (process.platform !== "win32") {
    return null;
  }

  const npmExecutables = uniqueNonEmpty([
    "npm",
    ...(await resolveFromWindowsWhere("npm")),
  ]);

  for (const npmExecutable of npmExecutables) {
    try {
      const { stdout } = await runCommand(npmExecutable, args);
      const value = stdout.trim();
      if (value) {
        return value;
      }
    } catch {
      // Try the next npm resolver. Electron may have a narrower PATH than the user's terminal.
    }
  }

  return null;
}

async function getWindowsNpmGlobalPrefixes(): Promise<string[]> {
  const prefix = await queryNpmValue(["config", "get", "prefix"]);
  const root = await queryNpmValue(["root", "-g"]);
  const rootPrefix =
    root && pathWin32.basename(root).toLowerCase() === "node_modules"
      ? pathWin32.dirname(root)
      : null;

  return uniqueNonEmpty([prefix, rootPrefix]);
}

async function detectPrompthubFromWindowsNpmPrefix(): Promise<{
  version: string | null;
  path: string | null;
  pathSource: CommandPathSource | null;
}> {
  if (process.platform !== "win32") {
    return { version: null, path: null, pathSource: null };
  }

  const prefixes = await getWindowsNpmGlobalPrefixes();
  const candidates = prefixes.flatMap((prefix) => [
    pathWin32.join(prefix, "prompthub.cmd"),
    pathWin32.join(prefix, "prompthub.exe"),
    pathWin32.join(prefix, "prompthub"),
  ]);

  return detectVersionFromCandidates(candidates, "npm-prefix");
}

async function detectCommandVersion(
  command: string,
  options?: { skipDirect?: boolean },
): Promise<{
  version: string | null;
  path: string | null;
  pathSource: CommandPathSource | null;
}> {
  if (!options?.skipDirect) {
    const directResult = await detectVersionAtPath(command, "app-env");
    if (directResult.version) {
      return directResult;
    }
  }

  const windowsWhereResult = await detectVersionFromCandidates(
    await resolveFromWindowsWhere(command),
    "windows-where",
  );
  if (windowsWhereResult.version) {
    return windowsWhereResult;
  }

  if (command === CLI_COMMAND) {
    const windowsNpmPrefixResult = await detectPrompthubFromWindowsNpmPrefix();
    if (windowsNpmPrefixResult.version) {
      return windowsNpmPrefixResult;
    }
  }

  const shellPath = await resolveFromLoginShell(command);
  if (!shellPath) {
    return { version: null, path: null, pathSource: null };
  }
  return detectVersionAtPath(shellPath, "login-shell");
}

async function detectPackageManager(command: CliInstallMethod): Promise<{
  version: string | null;
  path: string | null;
  pathSource: CommandPathSource | null;
}> {
  return detectCommandVersion(command);
}

async function detectPrompthubVersion(): Promise<string | null> {
  const result = await detectCommandVersion(CLI_COMMAND, {
    skipDirect: Boolean(findLegacyCliWrapper()),
  });
  return result.version;
}

export async function getCliStatus(): Promise<CliStatus> {
  const legacyCommandPath = findLegacyCliWrapper();
  const [pnpmInfo, npmInfo, installedVersion] = await Promise.all([
    detectPackageManager("pnpm"),
    detectPackageManager("npm"),
    detectPrompthubVersion(),
  ]);

  const packageManager: CliInstallMethod | null = pnpmInfo.version
    ? "pnpm"
    : npmInfo.version
      ? "npm"
      : null;
  const packageManagerVersion =
    packageManager === "pnpm"
      ? pnpmInfo.version
      : packageManager === "npm"
        ? npmInfo.version
        : null;
  const packageManagerPath =
    packageManager === "pnpm"
      ? pnpmInfo.path
      : packageManager === "npm"
        ? npmInfo.path
        : null;
  const packageManagerPathSource =
    packageManager === "pnpm"
      ? pnpmInfo.pathSource
      : packageManager === "npm"
        ? npmInfo.pathSource
        : null;
  const installSource = getCliInstallSource();
  const installCommand = packageManager
    ? buildInstallCommand(packageManager)
    : null;

  return {
    installed: Boolean(installedVersion),
    command: CLI_COMMAND,
    version: installedVersion,
    packageManager,
    packageManagerVersion,
    packageManagerPath,
    packageManagerPathSource,
    releaseTag: getReleaseTag(),
    installCommand,
    manualInstallCommands: getManualInstallCommands(),
    installSource,
    legacyCommandPath,
  };
}

export async function installCli(
  method?: CliInstallMethod,
): Promise<CliInstallResult> {
  const status = await getCliStatus();
  const installMethod = method ?? status.packageManager;

  if (!installMethod) {
    return {
      success: false,
      method: "npm",
      command: "",
      error: "Neither pnpm nor npm is available on PATH.",
    };
  }

  const installSource = getCliInstallSource();
  const args =
    installMethod === "pnpm"
      ? ["add", "-g", installSource]
      : ["install", "-g", installSource];
  const command = `${installMethod} ${args.join(" ")}`;
  const packageManagerInfo = await detectPackageManager(installMethod);

  if (!packageManagerInfo.version) {
    return {
      success: false,
      method: installMethod,
      command,
      error: PACKAGE_MANAGER_NOT_FOUND_ERROR,
    };
  }

  try {
    const executable = packageManagerInfo.path || installMethod;
    const { stdout, stderr } = await runCommand(executable, args);
    const removedLegacyCommand = removeLegacyCliWrapper(
      status.legacyCommandPath ?? null,
    );
    return {
      success: true,
      method: installMethod,
      command,
      stdout,
      stderr,
      removedLegacyCommand,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      method: installMethod,
      command,
      error: message,
    };
  }
}
