interface WebDAVSyncSettings {
  syncProvider?: "manual" | "webdav" | "self-hosted" | "s3";
  webdavEnabled: boolean;
  webdavUrl: string;
  webdavUsername: string;
  webdavPassword: string;
  webdavSyncOnStartup: boolean;
  webdavAutoSyncInterval: number;
}

interface SelfHostedSyncSettings {
  syncProvider?: "manual" | "webdav" | "self-hosted" | "s3";
  selfHostedSyncEnabled: boolean;
  selfHostedSyncUrl: string;
  selfHostedSyncUsername: string;
  selfHostedSyncPassword: string;
  selfHostedSyncOnStartup: boolean;
  selfHostedAutoSyncInterval: number;
}

interface S3SyncSettings {
  syncProvider?: "manual" | "webdav" | "self-hosted" | "s3";
  s3StorageEnabled: boolean;
  s3Endpoint: string;
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3SyncOnStartup: boolean;
  s3AutoSyncInterval: number;
}

interface BackgroundTaskState {
  isVisible: boolean;
  isOnline: boolean;
  isRunning: boolean;
}

export function hasValidWebDAVConfig(settings: WebDAVSyncSettings): boolean {
  return Boolean(
    settings.webdavEnabled &&
    settings.webdavUrl?.trim() &&
    settings.webdavUsername?.trim() &&
    settings.webdavPassword?.trim(),
  );
}

export function shouldRunBackgroundUpdateCheck(
  autoCheckUpdate: boolean,
  state: BackgroundTaskState,
): boolean {
  return Boolean(
    autoCheckUpdate && state.isVisible && state.isOnline && !state.isRunning,
  );
}

export function shouldRunStartupWebDAVSync(
  settings: WebDAVSyncSettings,
  state: BackgroundTaskState,
): boolean {
  return Boolean(
    settings.syncProvider === "webdav" &&
    settings.webdavSyncOnStartup &&
    hasValidWebDAVConfig(settings) &&
    state.isVisible &&
    state.isOnline &&
    !state.isRunning,
  );
}

export function shouldRunPeriodicWebDAVSync(
  settings: WebDAVSyncSettings,
  state: BackgroundTaskState,
): boolean {
  return Boolean(
    settings.syncProvider === "webdav" &&
    settings.webdavAutoSyncInterval > 0 &&
    hasValidWebDAVConfig(settings) &&
    state.isVisible &&
    state.isOnline &&
    !state.isRunning,
  );
}

export function hasValidSelfHostedConfig(
  settings: SelfHostedSyncSettings,
): boolean {
  return Boolean(
    settings.selfHostedSyncEnabled &&
    settings.selfHostedSyncUrl?.trim() &&
    settings.selfHostedSyncUsername?.trim() &&
    settings.selfHostedSyncPassword?.trim(),
  );
}

export function shouldRunStartupSelfHostedSync(
  settings: SelfHostedSyncSettings,
  state: BackgroundTaskState,
): boolean {
  return Boolean(
    settings.selfHostedSyncOnStartup &&
    hasValidSelfHostedConfig(settings) &&
    state.isVisible &&
    state.isOnline &&
    !state.isRunning,
  );
}

export function shouldRunPeriodicSelfHostedSync(
  settings: SelfHostedSyncSettings,
  state: BackgroundTaskState,
): boolean {
  return Boolean(
    settings.selfHostedAutoSyncInterval > 0 &&
    hasValidSelfHostedConfig(settings) &&
    state.isVisible &&
    state.isOnline &&
    !state.isRunning,
  );
}

export function hasValidS3Config(settings: S3SyncSettings): boolean {
  return Boolean(
    settings.s3StorageEnabled &&
    settings.s3Endpoint?.trim() &&
    settings.s3Region?.trim() &&
    settings.s3Bucket?.trim() &&
    settings.s3AccessKeyId?.trim() &&
    settings.s3SecretAccessKey?.trim(),
  );
}

export function shouldRunStartupS3Sync(
  settings: S3SyncSettings,
  state: BackgroundTaskState,
): boolean {
  return Boolean(
    settings.syncProvider === "s3" &&
    settings.s3SyncOnStartup &&
    hasValidS3Config(settings) &&
    state.isVisible &&
    state.isOnline &&
    !state.isRunning,
  );
}

export function shouldRunPeriodicS3Sync(
  settings: S3SyncSettings,
  state: BackgroundTaskState,
): boolean {
  return Boolean(
    settings.syncProvider === "s3" &&
    settings.s3AutoSyncInterval > 0 &&
    hasValidS3Config(settings) &&
    state.isVisible &&
    state.isOnline &&
    !state.isRunning,
  );
}
