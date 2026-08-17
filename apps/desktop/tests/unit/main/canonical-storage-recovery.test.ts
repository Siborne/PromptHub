/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtractedMcpSecret } from "@prompthub/core";

import type { McpResourceSecretEncryption } from "../../../src/main/services/mcp-resource-secret-store";

const mocks = vi.hoisted(() => ({
  closeDatabase: vi.fn(),
  deriveLocalResourceDeviceId: vi.fn(() => "device-test"),
  recoverCanonicalStorageAuthorityFromDatabase: vi.fn(),
  writeMany: vi.fn(),
  createMcpResourceSecretStore: vi.fn(),
  logStartupEvent: vi.fn(),
  scrubPath: vi.fn((value: unknown) => value),
}));

vi.mock("../../../src/main/database", () => ({
  closeDatabase: mocks.closeDatabase,
}));
vi.mock("@prompthub/core", () => ({
  deriveLocalResourceDeviceId: mocks.deriveLocalResourceDeviceId,
}));
vi.mock("../../../src/main/services/canonical-storage-authority", () => ({
  recoverCanonicalStorageAuthorityFromDatabase:
    mocks.recoverCanonicalStorageAuthorityFromDatabase,
}));
vi.mock("../../../src/main/services/mcp-resource-secret-store", () => ({
  createMcpResourceSecretStore: mocks.createMcpResourceSecretStore,
}));
vi.mock("../../../src/main/startup-log", () => ({
  logStartupEvent: mocks.logStartupEvent,
  scrubPath: mocks.scrubPath,
}));

import { performCanonicalDatabaseRecovery } from "../../../src/main/services/canonical-storage-recovery";

describe("canonical storage recovery orchestration", () => {
  const encryption: McpResourceSecretEncryption = {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString("utf8"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createMcpResourceSecretStore.mockReturnValue({
      writeMany: mocks.writeMany,
    });
  });

  it("closes SQLite and rebuilds canonical storage with device-bound secrets", async () => {
    const onSuccess = vi.fn();
    const onFailure = vi.fn();
    const scheduleRelaunch = vi.fn();
    mocks.recoverCanonicalStorageAuthorityFromDatabase.mockImplementation(
      async (options: {
        persistExtractedMcpSecrets?: (
          secrets: readonly ExtractedMcpSecret[],
        ) => Promise<void>;
      }) => {
        await options.persistExtractedMcpSecrets?.([
          {
            ref: "secret-1",
            field: "headers",
            key: "Authorization",
            value: "token",
            version: 1,
          },
        ]);
        return {
          status: "committed",
          operationId: "operation-1",
          consistencyId: "consistency-1",
          recoveryArtifactPath: "/root/recovery/operation-1",
        };
      },
    );

    const result = await performCanonicalDatabaseRecovery({
      activeRoot: "/root",
      sourceDatabasePath: "/root/data/prompthub.db",
      sourcePath: "/root/data/prompthub.db",
      encryption,
      scheduleRelaunch,
      onSuccess,
      onFailure,
    });

    expect(mocks.closeDatabase).toHaveBeenCalledOnce();
    expect(mocks.deriveLocalResourceDeviceId).toHaveBeenCalledWith("/root");
    expect(
      mocks.recoverCanonicalStorageAuthorityFromDatabase,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        activeRoot: "/root",
        sourceDatabasePath: "/root/data/prompthub.db",
        deviceId: "device-test",
        checkpointPath: expect.stringContaining(
          "/root/cache/.canonical-recovery-checkpoint-",
        ),
      }),
    );
    expect(mocks.createMcpResourceSecretStore).toHaveBeenCalledWith({
      filePath: "/root/secrets/mcp-resource-secrets.json",
      encryption,
    });
    expect(mocks.writeMany).toHaveBeenCalledWith([
      {
        ref: "secret-1",
        field: "headers",
        key: "Authorization",
        value: "token",
        version: 1,
      },
    ]);
    expect(result).toEqual({
      success: true,
      needsRestart: true,
      recoveryArtifactPath: "/root/recovery/operation-1",
    });
    expect(onSuccess).toHaveBeenCalledOnce();
    expect(onFailure).not.toHaveBeenCalled();
    expect(scheduleRelaunch).toHaveBeenCalledWith(1500);
    expect(mocks.logStartupEvent).toHaveBeenCalledWith({
      event: "recovery:canonical_authority_rebuilt",
      sourcePath: "/root/data/prompthub.db",
      recoveryArtifactPath: "/root/recovery/operation-1",
    });
  });

  it.each([
    [new Error("recovery failed"), "recovery failed"],
    ["recovery failed", "recovery failed"],
  ])(
    "returns a retryable failure without relaunching for %p",
    async (failure, message) => {
      const onSuccess = vi.fn();
      const onFailure = vi.fn();
      const scheduleRelaunch = vi.fn();
      mocks.recoverCanonicalStorageAuthorityFromDatabase.mockRejectedValue(
        failure,
      );

      await expect(
        performCanonicalDatabaseRecovery({
          activeRoot: "/root",
          sourceDatabasePath: "/root/data/prompthub.db",
          sourcePath: "/root/data/prompthub.db",
          encryption,
          scheduleRelaunch,
          onSuccess,
          onFailure,
        }),
      ).resolves.toEqual({ success: false, error: message });
      expect(onSuccess).not.toHaveBeenCalled();
      expect(onFailure).toHaveBeenCalledOnce();
      expect(scheduleRelaunch).not.toHaveBeenCalled();
      expect(mocks.logStartupEvent).toHaveBeenCalledWith({
        event: "recovery:canonical_authority_rebuild_failed",
        sourcePath: "/root/data/prompthub.db",
        error: message,
      });
    },
  );
});
