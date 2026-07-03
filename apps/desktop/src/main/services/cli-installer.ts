import { app } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CliInstallMethod, CliInstallResult, CliStatus } from "@prompthub/shared/types";

const execFileAsync = promisify(execFile);

const CLI_COMMAND = "prompthub";
const PACKAGE_MANAGER_NOT_FOUND_ERROR = "CLI_PACKAGE_MANAGER_NOT_FOUND";

function getReleaseTag(): string {
  return `v${app.getVersion()}`;
}

function getCliTarballName(): string {
  return `prompthub-cli-${app.getVersion()}.tgz`;
}

function getCliInstallSource(): string {
  return `https://github.com/legeling/PromptHub/releases/download/${getReleaseTag()}/${getCliTarballName()}`;
}

async function runCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync(command, args, {
    env: process.env,
    timeout: 120000,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    shell: process.platform === "win32",
  });
}

async function detectPackageManager(
  command: CliInstallMethod,
): Promise<{ version: string | null }> {
  try {
    const { stdout } = await runCommand(command, ["--version"]);
    return { version: stdout.trim() || null };
  } catch {
    return { version: null };
  }
}

async function detectPrompthubVersion(): Promise<string | null> {
  try {
    const { stdout } = await runCommand(CLI_COMMAND, ["--version"]);
    const version = stdout.trim();
    return version || null;
  } catch {
    return null;
  }
}

export async function getCliStatus(): Promise<CliStatus> {
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
  const installSource = getCliInstallSource();
  const installCommand = packageManager
    ? packageManager === "pnpm"
      ? `pnpm add -g ${installSource}`
      : `npm install -g ${installSource}`
    : null;

  return {
    installed: Boolean(installedVersion),
    command: CLI_COMMAND,
    version: installedVersion,
    packageManager,
    packageManagerVersion,
    releaseTag: getReleaseTag(),
    installCommand,
    installSource,
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
    const { stdout, stderr } = await runCommand(installMethod, args);
    return {
      success: true,
      method: installMethod,
      command,
      stdout,
      stderr,
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
