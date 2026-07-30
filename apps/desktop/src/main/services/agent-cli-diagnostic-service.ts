import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import type {
  AgentCliDiagnostic,
  AgentCliDiagnosticErrorCode,
  AgentCliInstallSource,
} from "@prompthub/shared/types";
import type { NativeCommandRunner } from "./native-command";

const VERSION_TIMEOUT_MS = 5_000;
const VERSION_OUTPUT_LIMIT = 64 * 1024;
const VERSION_TEXT_LIMIT = 160;
const SECRET_OUTPUT_PATTERN =
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|bearer|secret|password)\b/i;

export interface AgentCliDiagnosticDependencies {
  now(): number;
  resolve: NativeCommandRunner["resolve"];
  run: NativeCommandRunner["run"];
}

function installSourceForPath(resolvedPath: string): AgentCliInstallSource {
  const normalized = resolvedPath.replace(/\\/g, "/").toLowerCase();
  if (
    normalized.includes("/homebrew/") ||
    normalized.includes("/cellar/") ||
    normalized.includes("/caskroom/")
  ) {
    return "homebrew";
  }
  if (
    normalized.includes("/.nvm/") ||
    normalized.includes("/.fnm/") ||
    normalized.includes("/node-versions/") ||
    normalized.includes("/.volta/")
  ) {
    return "node-version-manager";
  }
  if (normalized.includes("/pnpm/")) return "pnpm";
  if (normalized.includes("/npm/") || normalized.includes("/node_modules/")) {
    return "npm";
  }
  if (normalized.includes("/.local/")) return "user-local";
  if (
    normalized.startsWith("/usr/") ||
    normalized.startsWith("/opt/") ||
    /^[a-z]:\/program files\//.test(normalized)
  ) {
    return "system";
  }
  return "unknown";
}

export function supportsAgentCliUpdateSource(
  platform: SkillPlatform,
  installSource: AgentCliInstallSource,
): boolean {
  const update = platform.cli?.update;
  if (!update) return false;
  return (
    !update.command ||
    update.command.supportedInstallSources.includes(installSource)
  );
}

function normalizeVersion(stdout: string, stderr: string): string | null {
  const firstLine = `${stdout}\n${stderr}`
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, " "))
    .find(Boolean);
  if (!firstLine || SECRET_OUTPUT_PATTERN.test(firstLine)) return null;
  return firstLine.slice(0, VERSION_TEXT_LIMIT);
}

function classifyCommandError(error: unknown): AgentCliDiagnosticErrorCode {
  if (!error || typeof error !== "object") return "command-failed";
  const record = error as {
    code?: unknown;
    killed?: unknown;
    signal?: unknown;
  };
  if (
    record.killed === true ||
    record.code === "ETIMEDOUT" ||
    record.signal === "SIGTERM"
  ) {
    return "timeout";
  }
  if (
    record.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" ||
    record.code === "ENOBUFS"
  ) {
    return "output-limit";
  }
  return "command-failed";
}

function baseResult(
  platform: SkillPlatform,
  checkedAt: number,
): Pick<AgentCliDiagnostic, "agentId" | "checkedAt"> {
  return { agentId: platform.id, checkedAt };
}

function unavailableResult(
  platform: SkillPlatform,
  checkedAt: number,
  status: "unsupported" | "not-installed",
): AgentCliDiagnostic {
  return {
    ...baseResult(platform, checkedAt),
    status,
    executablePath: null,
    version: null,
    installSource: null,
    errorCode: status === "unsupported" ? "unsupported" : "not-found",
    canUpdate: false,
  };
}

async function diagnoseResolvedExecutable(
  platform: SkillPlatform,
  checkedAt: number,
  executablePath: string,
  versionArgs: string[],
  dependencies: AgentCliDiagnosticDependencies,
): Promise<AgentCliDiagnostic> {
  const installSource = installSourceForPath(executablePath);
  try {
    const output = await dependencies.run(executablePath, versionArgs, {
      timeout: VERSION_TIMEOUT_MS,
      maxBuffer: VERSION_OUTPUT_LIMIT,
    });
    const version = normalizeVersion(output.stdout, output.stderr);
    return {
      ...baseResult(platform, checkedAt),
      status: version ? "installed" : "unhealthy",
      executablePath,
      version,
      installSource,
      errorCode: version ? null : "invalid-output",
      canUpdate: supportsAgentCliUpdateSource(platform, installSource),
    };
  } catch (error) {
    return {
      ...baseResult(platform, checkedAt),
      status: "unhealthy",
      executablePath,
      version: null,
      installSource,
      errorCode: classifyCommandError(error),
      canUpdate: Boolean(platform.cli?.update),
    };
  }
}

export async function diagnoseAgentCli(
  platform: SkillPlatform,
  dependencies: AgentCliDiagnosticDependencies,
): Promise<AgentCliDiagnostic> {
  const checkedAt = dependencies.now();
  const descriptor = platform.cli;
  if (!descriptor) {
    return unavailableResult(platform, checkedAt, "unsupported");
  }

  for (const candidate of descriptor.executableCandidates) {
    const executablePath = await dependencies.resolve(candidate);
    if (!executablePath) continue;
    return diagnoseResolvedExecutable(
      platform,
      checkedAt,
      executablePath,
      descriptor.versionArgs,
      dependencies,
    );
  }

  return unavailableResult(platform, checkedAt, "not-installed");
}
