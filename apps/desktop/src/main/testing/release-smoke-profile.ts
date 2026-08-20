import path from "node:path";

export const PACKAGED_STARTUP_SMOKE_APP_DATA_ENV =
  "PROMPTHUB_PACKAGED_STARTUP_SMOKE_APP_DATA";
export const PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV =
  "PROMPTHUB_PACKAGED_STARTUP_SMOKE_AUTO_EXIT";

interface PackagedStartupSmokeProfileOptions {
  env: NodeJS.ProcessEnv;
  isPackaged: boolean;
  platform: NodeJS.Platform;
}

interface PackagedStartupSmokeAutoExitOptions extends PackagedStartupSmokeProfileOptions {
  appDataPath: string | null;
}

interface PackagedStartupSmokeSetupOptions extends PackagedStartupSmokeProfileOptions {
  onExit: () => void;
  logMigration: (
    status: PackagedStartupSmokeRendererPersistenceMigrationStatus,
  ) => void;
}

export type PackagedStartupSmokeRendererPersistenceMigrationStatus =
  | "migrated"
  | "already-complete";

export interface PackagedStartupSmokeExitBarrier {
  signalWindowReady(): void;
  signalRendererPersistenceMigration(
    status: PackagedStartupSmokeRendererPersistenceMigrationStatus,
  ): void;
}

export interface PackagedStartupSmokeController {
  enabled: boolean;
  onWindowReady(): void;
  onRendererPersistenceMigration(result: {
    status: PackagedStartupSmokeRendererPersistenceMigrationStatus;
  }): void;
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

export function shouldAutoExitPackagedStartupSmoke({
  env,
  isPackaged,
  platform,
  appDataPath,
}: PackagedStartupSmokeAutoExitOptions): boolean {
  const configured = env[PACKAGED_STARTUP_SMOKE_AUTO_EXIT_ENV];
  if (configured === undefined) return false;
  if (configured !== "true") {
    throw new Error(
      `The packaged startup smoke auto-exit flag must be true, got: ${configured}`,
    );
  }
  if (!appDataPath) {
    throw new Error(
      "The packaged startup smoke auto-exit requires a validated AppData override",
    );
  }
  const validatedAppDataPath = resolvePackagedStartupSmokeAppDataPath({
    env,
    isPackaged,
    platform,
  });
  if (
    !validatedAppDataPath ||
    path.resolve(validatedAppDataPath) !== path.resolve(appDataPath)
  ) {
    throw new Error(
      "The packaged startup smoke auto-exit requires a validated AppData override",
    );
  }
  return true;
}

export function resolvePackagedStartupSmokeSetup({
  env,
  isPackaged,
  platform,
  onExit,
  logMigration,
}: PackagedStartupSmokeSetupOptions): {
  appDataPath: string | null;
  controller: PackagedStartupSmokeController;
} {
  const appDataPath = resolvePackagedStartupSmokeAppDataPath({
    env,
    isPackaged,
    platform,
  });
  const enabled = shouldAutoExitPackagedStartupSmoke({
    env,
    isPackaged,
    platform,
    appDataPath,
  });
  return {
    appDataPath,
    controller: createPackagedStartupSmokeController({
      enabled,
      onExit,
      logMigration,
    }),
  };
}

export function createPackagedStartupSmokeExitBarrier(options: {
  enabled: boolean;
  onExit: () => void;
}): PackagedStartupSmokeExitBarrier {
  let windowReady = false;
  let migrationStatus: PackagedStartupSmokeRendererPersistenceMigrationStatus | null =
    null;
  let exitCalled = false;

  const tryExit = (): void => {
    if (!options.enabled || exitCalled || !windowReady || !migrationStatus) {
      return;
    }
    exitCalled = true;
    options.onExit();
  };

  return {
    signalWindowReady() {
      windowReady = true;
      tryExit();
    },
    signalRendererPersistenceMigration(status) {
      migrationStatus = status;
      tryExit();
    },
  };
}

export function createPackagedStartupSmokeController(options: {
  enabled: boolean;
  onExit: () => void;
  logMigration: (
    status: PackagedStartupSmokeRendererPersistenceMigrationStatus,
  ) => void;
}): PackagedStartupSmokeController {
  const barrier = createPackagedStartupSmokeExitBarrier(options);
  return {
    enabled: options.enabled,
    onWindowReady: barrier.signalWindowReady,
    onRendererPersistenceMigration(result) {
      if (!options.enabled) return;
      options.logMigration(result.status);
      barrier.signalRendererPersistenceMigration(result.status);
    },
  };
}
