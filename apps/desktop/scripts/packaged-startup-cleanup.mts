import fs from "node:fs";

export const PACKAGED_STARTUP_CLEANUP_MAX_ATTEMPTS = 20;
const PACKAGED_STARTUP_CLEANUP_RETRY_DELAY_MS = 250;
const RETRYABLE_WINDOWS_CLEANUP_CODES = new Set([
  "EBUSY",
  "EMFILE",
  "ENFILE",
  "ENOTEMPTY",
  "EPERM",
]);

type RemoveDirectory = (
  rootPath: string,
  options: { recursive: true; force: true },
) => void;

interface CleanupDependencies {
  remove: RemoveDirectory;
  wait: (milliseconds: number) => Promise<void>;
}

interface PackagedProcessCloseSignal {
  exitCode: number | null;
  once: (event: "close", listener: () => void) => unknown;
  removeListener: (event: "close", listener: () => void) => unknown;
}

const defaultDependencies: CleanupDependencies = {
  remove: fs.rmSync,
  wait: waitForPackagedStartupRetry,
};

export function waitForPackagedStartupRetry(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableWindowsCleanupError(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return typeof code === "string" && RETRYABLE_WINDOWS_CLEANUP_CODES.has(code);
}

export async function removePackagedStartupRoot(
  rootPath: string,
  dependencies: CleanupDependencies = defaultDependencies,
): Promise<void> {
  for (
    let attempt = 1;
    attempt < PACKAGED_STARTUP_CLEANUP_MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      dependencies.remove(rootPath, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!isRetryableWindowsCleanupError(error)) throw error;
      await dependencies.wait(PACKAGED_STARTUP_CLEANUP_RETRY_DELAY_MS);
    }
  }
  dependencies.remove(rootPath, { recursive: true, force: true });
}

export async function waitForPackagedProcessExit(
  child: PackagedProcessCloseSignal,
  graceMilliseconds: number,
): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    let timeout: NodeJS.Timeout | undefined;
    const finish = () => {
      if (timeout) clearTimeout(timeout);
      child.removeListener("close", finish);
      resolve();
    };
    child.once("close", finish);
    timeout = setTimeout(finish, graceMilliseconds);
  });
}
