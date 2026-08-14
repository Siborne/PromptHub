import path from "node:path";

export const PACKAGED_STARTUP_SMOKE_APP_DATA_ENV =
  "PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA";

interface PackagedStartupSmokeProfileOptions {
  env: NodeJS.ProcessEnv;
  isPackaged: boolean;
  platform: NodeJS.Platform;
}

export function resolvePackagedStartupSmokeAppDataPath({
  env,
  isPackaged,
  platform,
}: PackagedStartupSmokeProfileOptions): string | null {
  const configuredPath = env[PACKAGED_STARTUP_SMOKE_APP_DATA_ENV];
  if (!configuredPath) return null;

  if (!isPackaged || platform !== "win32" || env.CI !== "true") {
    throw new Error(
      "The packaged startup smoke AppData override requires packaged Windows CI",
    );
  }

  const runnerTemp = env.RUNNER_TEMP;
  if (!runnerTemp) {
    throw new Error(
      "The packaged startup smoke AppData override requires RUNNER_TEMP",
    );
  }

  const resolvedRunnerTemp = path.resolve(runnerTemp);
  const resolvedAppDataPath = path.resolve(configuredPath);
  const relativePath = path.relative(resolvedRunnerTemp, resolvedAppDataPath);
  if (
    relativePath === "" ||
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error(
      "The packaged startup smoke AppData path must be below RUNNER_TEMP",
    );
  }

  return resolvedAppDataPath;
}
