import { describe, expect, it } from "vitest";
import {
  hasValidS3Config,
  hasValidSelfHostedConfig,
  hasValidWebDAVConfig,
  shouldRunPeriodicS3Sync,
  shouldRunPeriodicSelfHostedSync,
  shouldRunBackgroundUpdateCheck,
  shouldRunStartupS3Sync,
  shouldRunStartupSelfHostedSync,
  shouldRunPeriodicWebDAVSync,
  shouldRunStartupWebDAVSync,
} from "../../../src/renderer/services/app-background";

const baseSettings = {
  syncProvider: "webdav" as const,
  webdavEnabled: true,
  webdavUrl: "https://example.com/dav",
  webdavUsername: "user",
  webdavPassword: "pass",
  webdavSyncOnStartup: true,
  webdavAutoSyncInterval: 15,
};

const baseSelfHostedSettings = {
  syncProvider: "self-hosted" as const,
  selfHostedSyncEnabled: true,
  selfHostedSyncUrl: "https://backup.example.com",
  selfHostedSyncUsername: "owner",
  selfHostedSyncPassword: "secret",
  selfHostedSyncOnStartup: true,
  selfHostedAutoSyncInterval: 15,
};

const baseS3Settings = {
  syncProvider: "s3" as const,
  s3StorageEnabled: true,
  s3Endpoint: "https://s3.example.com",
  s3Region: "us-east-1",
  s3Bucket: "prompthub-backups",
  s3AccessKeyId: "access",
  s3SecretAccessKey: "secret",
  s3SyncOnStartup: true,
  s3AutoSyncInterval: 15,
};

describe("app-background", () => {
  it("validates required WebDAV configuration", () => {
    expect(hasValidWebDAVConfig(baseSettings)).toBe(true);
    expect(
      hasValidWebDAVConfig({
        ...baseSettings,
        webdavPassword: "",
      }),
    ).toBe(false);
  });

  it("runs update checks only when visible, online, and idle", () => {
    expect(
      shouldRunBackgroundUpdateCheck(true, {
        isVisible: true,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(true);

    expect(
      shouldRunBackgroundUpdateCheck(true, {
        isVisible: false,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(false);

    expect(
      shouldRunBackgroundUpdateCheck(true, {
        isVisible: true,
        isOnline: false,
        isRunning: false,
      }),
    ).toBe(false);
  });

  it("blocks WebDAV sync while hidden or already running", () => {
    expect(
      shouldRunStartupWebDAVSync(baseSettings, {
        isVisible: true,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(true);

    expect(
      shouldRunStartupWebDAVSync(baseSettings, {
        isVisible: false,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(false);

    expect(
      shouldRunPeriodicWebDAVSync(baseSettings, {
        isVisible: true,
        isOnline: true,
        isRunning: true,
      }),
    ).toBe(false);
  });

  it("requires a positive interval for periodic WebDAV sync", () => {
    expect(
      shouldRunPeriodicWebDAVSync(
        {
          ...baseSettings,
          webdavAutoSyncInterval: 0,
        },
        {
          isVisible: true,
          isOnline: true,
          isRunning: false,
        },
      ),
    ).toBe(false);
  });

  it("prevents WebDAV auto sync when another sync provider is selected", () => {
    expect(
      shouldRunStartupWebDAVSync(
        {
          ...baseSettings,
          syncProvider: "s3",
        },
        {
          isVisible: true,
          isOnline: true,
          isRunning: false,
        },
      ),
    ).toBe(false);
  });

  it("validates required self-hosted configuration", () => {
    expect(hasValidSelfHostedConfig(baseSelfHostedSettings)).toBe(true);
    expect(
      hasValidSelfHostedConfig({
        ...baseSelfHostedSettings,
        selfHostedSyncPassword: "",
      }),
    ).toBe(false);
  });

  it("validates required s3 configuration", () => {
    expect(hasValidS3Config(baseS3Settings)).toBe(true);
    expect(
      hasValidS3Config({
        ...baseS3Settings,
        s3Bucket: "",
      }),
    ).toBe(false);
  });

  it("blocks self-hosted startup sync while hidden or already running", () => {
    expect(
      shouldRunStartupSelfHostedSync(baseSelfHostedSettings, {
        isVisible: true,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(true);

    expect(
      shouldRunStartupSelfHostedSync(baseSelfHostedSettings, {
        isVisible: false,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(false);

    expect(
      shouldRunPeriodicSelfHostedSync(baseSelfHostedSettings, {
        isVisible: true,
        isOnline: true,
        isRunning: true,
      }),
    ).toBe(false);
  });

  it("requires a positive interval for periodic self-hosted sync", () => {
    expect(
      shouldRunPeriodicSelfHostedSync(
        {
          ...baseSelfHostedSettings,
          selfHostedAutoSyncInterval: 0,
        },
        {
          isVisible: true,
          isOnline: true,
          isRunning: false,
        },
      ),
    ).toBe(false);
  });

  it("keeps self-hosted backup automation independent from the sync provider", () => {
    expect(
      shouldRunStartupSelfHostedSync(
        {
          ...baseSelfHostedSettings,
          syncProvider: "webdav",
        },
        {
          isVisible: true,
          isOnline: true,
          isRunning: false,
        },
      ),
    ).toBe(true);
  });

  it("blocks s3 startup sync while hidden or already running", () => {
    expect(
      shouldRunStartupS3Sync(baseS3Settings, {
        isVisible: true,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(true);

    expect(
      shouldRunStartupS3Sync(baseS3Settings, {
        isVisible: false,
        isOnline: true,
        isRunning: false,
      }),
    ).toBe(false);

    expect(
      shouldRunPeriodicS3Sync(baseS3Settings, {
        isVisible: true,
        isOnline: true,
        isRunning: true,
      }),
    ).toBe(false);
  });

  it("requires a positive interval for periodic s3 sync", () => {
    expect(
      shouldRunPeriodicS3Sync(
        {
          ...baseS3Settings,
          s3AutoSyncInterval: 0,
        },
        {
          isVisible: true,
          isOnline: true,
          isRunning: false,
        },
      ),
    ).toBe(false);
  });

  it("prevents s3 auto sync when another sync provider is selected", () => {
    expect(
      shouldRunStartupS3Sync(
        {
          ...baseS3Settings,
          syncProvider: "self-hosted",
        },
        {
          isVisible: true,
          isOnline: true,
          isRunning: false,
        },
      ),
    ).toBe(false);
  });
});
