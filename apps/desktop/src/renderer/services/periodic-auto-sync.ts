import {
  hasValidS3Config,
  hasValidSelfHostedConfig,
  hasValidWebDAVConfig,
} from "./app-background";

type SyncProviderKind = "manual" | "webdav" | "self-hosted" | "s3";

export interface PeriodicAutoSyncSettings {
  syncProvider?: SyncProviderKind;
  webdavEnabled: boolean;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavSyncOnStartup: boolean;
  webdavAutoSyncInterval: number;
  selfHostedSyncEnabled: boolean;
  selfHostedSyncUrl: string;
  selfHostedSyncUsername: string;
  selfHostedSyncPassword: string;
  selfHostedSyncOnStartup: boolean;
  selfHostedAutoSyncInterval: number;
  s3StorageEnabled: boolean;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3SyncOnStartup: boolean;
  s3AutoSyncInterval: number;
}

type PeriodicProvider = Exclude<SyncProviderKind, "manual">;

interface PeriodicAutoSyncSelection {
  provider: PeriodicProvider;
  intervalMinutes: number;
}

interface PeriodicAutoSyncControllerOptions {
  getSettings: () => PeriodicAutoSyncSettings;
  subscribe: (
    listener: (
      state: PeriodicAutoSyncSettings,
      previous: PeriodicAutoSyncSettings,
    ) => void,
  ) => () => void;
  runWebDAV: () => void;
  runS3: () => void;
  runSelfHosted: () => void;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  log?: (message: string) => void;
}

export interface PeriodicAutoSyncController {
  refresh: () => void;
  dispose: () => void;
}

function selectPeriodicAutoSync(
  settings: PeriodicAutoSyncSettings,
): PeriodicAutoSyncSelection[] {
  const selections: PeriodicAutoSyncSelection[] = [];
  if (
    settings.syncProvider === "webdav" &&
    settings.webdavAutoSyncInterval > 0 &&
    hasValidWebDAVConfig(settings)
  ) {
    selections.push({
      provider: "webdav",
      intervalMinutes: settings.webdavAutoSyncInterval,
    });
  }

  if (
    settings.syncProvider === "s3" &&
    settings.s3AutoSyncInterval > 0 &&
    hasValidS3Config(settings)
  ) {
    selections.push({
      provider: "s3",
      intervalMinutes: settings.s3AutoSyncInterval,
    });
  }

  if (
    settings.selfHostedAutoSyncInterval > 0 &&
    hasValidSelfHostedConfig(settings)
  ) {
    selections.push({
      provider: "self-hosted",
      intervalMinutes: settings.selfHostedAutoSyncInterval,
    });
  }

  return selections;
}

function buildSelectionSignature(
  selections: PeriodicAutoSyncSelection[],
): string {
  return selections.length > 0
    ? selections
        .map(
          (selection) => `${selection.provider}:${selection.intervalMinutes}`,
        )
        .sort()
        .join("|")
    : "none";
}

function runSelectedProvider(
  selection: PeriodicAutoSyncSelection,
  options: PeriodicAutoSyncControllerOptions,
): void {
  if (selection.provider === "webdav") {
    options.runWebDAV();
    return;
  }

  if (selection.provider === "s3") {
    options.runS3();
    return;
  }

  options.runSelfHosted();
}

export function registerPeriodicAutoSyncController(
  options: PeriodicAutoSyncControllerOptions,
): PeriodicAutoSyncController {
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  const intervalHandles = new Map<
    PeriodicProvider,
    ReturnType<typeof setInterval>
  >();
  let activeSignature = "";

  const clearActiveIntervals = () => {
    for (const intervalHandle of intervalHandles.values()) {
      clearIntervalFn(intervalHandle);
    }
    intervalHandles.clear();
  };

  const refresh = () => {
    const selections = selectPeriodicAutoSync(options.getSettings());
    const signature = buildSelectionSignature(selections);

    if (signature === activeSignature) {
      return;
    }

    clearActiveIntervals();
    activeSignature = signature;

    for (const selection of selections) {
      const intervalMs = selection.intervalMinutes * 60 * 1000;
      options.log?.(
        `${selection.provider} automatic operation interval: ${selection.intervalMinutes} minutes`,
      );
      intervalHandles.set(
        selection.provider,
        setIntervalFn(() => {
          runSelectedProvider(selection, options);
        }, intervalMs),
      );
    }
  };

  const unsubscribe = options.subscribe(() => {
    refresh();
  });

  refresh();

  return {
    refresh,
    dispose: () => {
      unsubscribe();
      clearActiveIntervals();
      activeSignature = "";
    },
  };
}
