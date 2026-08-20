/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import type { ExtractedMcpSecret } from "@prompthub/core";

import type { McpResourceSecretEncryption } from "../../../src/main/services/mcp-resource-secret-store";

const mocks = vi.hoisted(() => ({
  closeDatabase: vi.fn(),
  deriveLocalResourceDeviceId: vi.fn(() => "device-test"),
  readMcpLibraryRecoverySource: vi.fn(),
  listRecoveryArtifacts: vi.fn((): Array<{ directoryPath: string }> => []),
  listUpgradeBackups: vi.fn(
    async (): Promise<Array<{ backupPath: string }>> => [],
  ),
  stageFileAuthoritativePromptCatalog: vi.fn(),
  createVerifiedPromptMediaResolver: vi.fn(() => vi.fn()),
  repairCanonicalStorageFromPromptWorkspace: vi.fn(),
  recoverCanonicalStorageAuthorityFromDatabase: vi.fn(),
  writeMany: vi.fn(),
  createMcpResourceSecretStore: vi.fn(),
  createCanonicalMcpResourceSecretStore: vi.fn(),
  logStartupEvent: vi.fn(),
  scrubPath: vi.fn((value: unknown) => value),
}));

vi.mock("../../../src/main/database", () => ({
  closeDatabase: mocks.closeDatabase,
}));
vi.mock("@prompthub/core", () => ({
  deriveLocalResourceDeviceId: mocks.deriveLocalResourceDeviceId,
  listRecoveryArtifacts: mocks.listRecoveryArtifacts,
  readMcpLibraryRecoverySource: mocks.readMcpLibraryRecoverySource,
}));
vi.mock("../../../src/main/services/upgrade-backup", () => ({
  listUpgradeBackups: mocks.listUpgradeBackups,
}));
vi.mock(
  "../../../src/main/services/file-authoritative-prompt-recovery",
  () => ({
    stageFileAuthoritativePromptCatalog:
      mocks.stageFileAuthoritativePromptCatalog,
    createVerifiedPromptMediaResolver: mocks.createVerifiedPromptMediaResolver,
  }),
);
vi.mock("../../../src/main/services/canonical-storage-authority", () => ({
  recoverCanonicalStorageAuthorityFromDatabase:
    mocks.recoverCanonicalStorageAuthorityFromDatabase,
}));
vi.mock("../../../src/main/services/canonical-storage-self-heal", () => ({
  repairCanonicalStorageFromPromptWorkspace:
    mocks.repairCanonicalStorageFromPromptWorkspace,
}));
vi.mock("../../../src/main/services/mcp-resource-secret-store", () => ({
  createMcpResourceSecretStore: mocks.createMcpResourceSecretStore,
  createCanonicalMcpResourceSecretStore:
    mocks.createCanonicalMcpResourceSecretStore,
}));
vi.mock("../../../src/main/startup-log", () => ({
  logStartupEvent: mocks.logStartupEvent,
  scrubPath: mocks.scrubPath,
}));

import {
  performCanonicalDatabaseRecovery,
  performCanonicalFileWorkspaceRecovery,
} from "../../../src/main/services/canonical-storage-recovery";

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
    mocks.createCanonicalMcpResourceSecretStore.mockReturnValue({
      filePath: "/root/secrets/mcp-resource-secrets.json",
      read: vi.fn(),
      prepareUpdate: vi.fn(),
    });
    mocks.readMcpLibraryRecoverySource.mockReturnValue({
      kind: "prompthub-mcp-library",
      version: 1,
      updatedAt: "2026-08-18T00:00:00.000Z",
      servers: [],
      bindings: [],
    });
  });

  it("closes SQLite and rebuilds through a bounded checkpoint with device-bound secrets", async () => {
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
    expect(mocks.createCanonicalMcpResourceSecretStore).toHaveBeenCalledWith({
      filePath: "/root/secrets/mcp-resource-secrets.json",
      encryption,
    });
    expect(mocks.readMcpLibraryRecoverySource).toHaveBeenCalledWith({
      canonicalOptions: {
        secretStore: expect.objectContaining({
          filePath: "/root/secrets/mcp-resource-secrets.json",
        }),
      },
      supersededPath: "/root/data/mcp/library.json",
    });
    expect(
      mocks.recoverCanonicalStorageAuthorityFromDatabase,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        activeRoot: "/root",
        sourceDatabasePath: "/root/data/prompthub.db",
        deviceId: "device-test",
        checkpointPath: expect.any(String),
        mcpLibrary: expect.objectContaining({
          kind: "prompthub-mcp-library",
          servers: [],
        }),
      }),
    );
    const recoveryOptions = mocks.recoverCanonicalStorageAuthorityFromDatabase
      .mock.calls[0]?.[0] as { checkpointPath?: unknown } | undefined;
    const checkpointPath = String(recoveryOptions?.checkpointPath);
    expect(path.dirname(checkpointPath)).toBe(path.join("/root", "cache"));
    expect(path.basename(checkpointPath)).toMatch(
      /^\.canonical-checkpoint-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u,
    );
    expect(path.basename(checkpointPath).length).toBeLessThanOrEqual(64);
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

  it("repairs from files without reading unrelated device-bound secrets", async () => {
    mocks.listRecoveryArtifacts.mockReturnValue([
      { directoryPath: "/root/backups/recovery/one" },
    ]);
    mocks.listUpgradeBackups.mockResolvedValue([
      { backupPath: "/root/backups/safety-points/upgrades/two" },
    ]);
    mocks.repairCanonicalStorageFromPromptWorkspace.mockResolvedValue({
      recoveryArtifactPath: "/root/recovery/file",
    });

    const result = await performCanonicalFileWorkspaceRecovery({
      activeRoot: "/root",
      sourceDatabasePath: "/root/data/prompthub.db",
      sourcePath: "/root/data/prompts",
      encryption,
      scheduleRelaunch: vi.fn(),
      onSuccess: vi.fn(),
      onFailure: vi.fn(),
    });

    expect(
      mocks.repairCanonicalStorageFromPromptWorkspace,
    ).toHaveBeenCalledWith({
      activeRoot: "/root",
      sourceDatabasePath: "/root/data/prompthub.db",
      trustedRoots: [
        "/root/backups/recovery/one",
        "/root/backups/safety-points/upgrades/two",
      ],
    });
    expect(mocks.readMcpLibraryRecoverySource).not.toHaveBeenCalled();
    expect(mocks.createCanonicalMcpResourceSecretStore).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      needsRestart: true,
      recoveryArtifactPath: "/root/recovery/file",
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

  it("waits for database reopen and IPC rebinding before returning a failure", async () => {
    let finishRebind: (() => void) | undefined;
    const onFailure = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRebind = resolve;
        }),
    );
    mocks.recoverCanonicalStorageAuthorityFromDatabase.mockRejectedValue(
      new Error("recovery failed"),
    );

    let settled = false;
    const recovery = performCanonicalDatabaseRecovery({
      activeRoot: "/root",
      sourceDatabasePath: "/root/data/prompthub.db",
      sourcePath: "/root/data/prompthub.db",
      encryption,
      scheduleRelaunch: vi.fn(),
      onSuccess: vi.fn(),
      onFailure,
    }).then((result) => {
      settled = true;
      return result;
    });

    await vi.waitFor(() => expect(onFailure).toHaveBeenCalledOnce());
    expect(settled).toBe(false);
    finishRebind?.();
    await expect(recovery).resolves.toEqual({
      success: false,
      error: "recovery failed",
    });
  });

  it("reports both recovery and database reopen failures", async () => {
    mocks.recoverCanonicalStorageAuthorityFromDatabase.mockRejectedValue(
      new Error("recovery failed"),
    );

    await expect(
      performCanonicalDatabaseRecovery({
        activeRoot: "/root",
        sourceDatabasePath: "/root/data/prompthub.db",
        sourcePath: "/root/data/prompthub.db",
        encryption,
        scheduleRelaunch: vi.fn(),
        onSuccess: vi.fn(),
        onFailure: vi.fn().mockRejectedValue(new Error("rebind failed")),
      }),
    ).resolves.toEqual({
      success: false,
      error: "recovery failed; failed to reopen database: rebind failed",
    });
  });
});
