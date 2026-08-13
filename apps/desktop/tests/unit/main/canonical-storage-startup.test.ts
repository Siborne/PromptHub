/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  RENDERER_PERSISTENCE_MARKER,
  configureRuntimePaths,
  getRuntimeStorageContext,
  resetRuntimePaths,
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
} from "@prompthub/core";
import { closeDatabase, initDatabase } from "@prompthub/db";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ensureCanonicalStorageAuthorityOnStartup } from "../../../src/main/services/canonical-storage-startup";

describe("canonical storage startup", () => {
  const roots: string[] = [];

  afterEach(() => {
    closeDatabase();
    resetRuntimePaths();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture() {
    const activeRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-canonical-startup-"),
    );
    roots.push(activeRoot);
    writeRuntimeLayoutState(activeRoot);
    const sourceDatabasePath = path.join(activeRoot, "data", "prompthub.db");
    fs.mkdirSync(path.dirname(sourceDatabasePath), { recursive: true });
    fs.writeFileSync(sourceDatabasePath, "database");
    return {
      activeRoot,
      sourceDatabasePath,
      prepareSourceDatabase: vi.fn(),
    };
  }

  function completeRendererMigration(activeRoot: string): void {
    const markerPath = path.join(activeRoot, RENDERER_PERSISTENCE_MARKER);
    fs.mkdirSync(path.dirname(markerPath), { recursive: true });
    fs.writeFileSync(
      markerPath,
      `${JSON.stringify({
        kind: "prompthub-renderer-persistence-migration",
        version: 1,
        state: "complete",
        completedAt: "2026-08-12T00:00:00.000Z",
        indexedDbMigrationDone: true,
      })}\n`,
    );
  }

  it("waits until renderer persistence has been durably migrated", async () => {
    const input = fixture();
    const publish = vi.fn();

    await expect(
      ensureCanonicalStorageAuthorityOnStartup({ ...input, publish }),
    ).resolves.toEqual({ status: "waiting-renderer-migration" });
    expect(publish).not.toHaveBeenCalled();
    expect(input.prepareSourceDatabase).not.toHaveBeenCalled();
  });

  it("does not republish an existing canonical authority", async () => {
    const input = fixture();
    writeCanonicalStorageAuthority(input.activeRoot, {
      consistencyId: "a".repeat(64),
      operationId: "existing-authority",
    });
    const publish = vi.fn();

    await expect(
      ensureCanonicalStorageAuthorityOnStartup({ ...input, publish }),
    ).resolves.toEqual({ status: "already-canonical" });
    expect(publish).not.toHaveBeenCalled();
    expect(input.prepareSourceDatabase).not.toHaveBeenCalled();
  });

  it("publishes once and refreshes runtime paths only after commit", async () => {
    const input = fixture();
    completeRendererMigration(input.activeRoot);
    const publish = vi.fn().mockResolvedValue({
      status: "committed",
      operationId: "authority-startup",
      consistencyId: "b".repeat(64),
      recoveryArtifactPath: path.join(input.activeRoot, "backups", "recovery"),
    });
    const refreshRuntimeContext = vi.fn();

    const result = await ensureCanonicalStorageAuthorityOnStartup({
      ...input,
      publish,
      refreshRuntimeContext,
      now: new Date("2026-08-12T01:00:00.000Z"),
    });

    expect(result).toMatchObject({
      status: "published",
      operationId: "authority-startup",
      consistencyId: "b".repeat(64),
    });
    expect(publish).toHaveBeenCalledOnce();
    expect(input.prepareSourceDatabase).toHaveBeenCalledOnce();
    expect(
      input.prepareSourceDatabase.mock.invocationCallOrder[0],
    ).toBeLessThan(publish.mock.invocationCallOrder[0] ?? 0);
    expect(publish.mock.calls[0]?.[0]).toMatchObject({
      activeRoot: input.activeRoot,
      sourceDatabasePath: input.sourceDatabasePath,
      now: new Date("2026-08-12T01:00:00.000Z"),
    });
    expect(publish.mock.calls[0]?.[0].checkpointPath).toMatch(
      /cache[/\\]\.canonical-authority-checkpoint-/u,
    );
    expect(refreshRuntimeContext).toHaveBeenCalledOnce();
  });

  it("preserves the old runtime context when publication fails", async () => {
    const input = fixture();
    completeRendererMigration(input.activeRoot);
    const refreshRuntimeContext = vi.fn();

    await expect(
      ensureCanonicalStorageAuthorityOnStartup({
        ...input,
        publish: vi.fn().mockRejectedValue(new Error("publication failed")),
        refreshRuntimeContext,
      }),
    ).rejects.toThrow("publication failed");
    expect(refreshRuntimeContext).not.toHaveBeenCalled();
  });

  it("does not publish when source database preparation fails", async () => {
    const input = fixture();
    completeRendererMigration(input.activeRoot);
    input.prepareSourceDatabase.mockImplementation(() => {
      throw new Error("migration failed");
    });
    const publish = vi.fn();

    await expect(
      ensureCanonicalStorageAuthorityOnStartup({ ...input, publish }),
    ).rejects.toThrow("migration failed");
    expect(publish).not.toHaveBeenCalled();
  });

  it("defers a missing source database instead of creating a partial root", async () => {
    const input = fixture();
    completeRendererMigration(input.activeRoot);
    fs.rmSync(input.sourceDatabasePath);
    const publish = vi.fn();

    await expect(
      ensureCanonicalStorageAuthorityOnStartup({ ...input, publish }),
    ).resolves.toEqual({ status: "source-database-missing" });
    expect(publish).not.toHaveBeenCalled();
    expect(input.prepareSourceDatabase).not.toHaveBeenCalled();
  });

  it("switches the live runtime context to canonical file authority", async () => {
    const input = fixture();
    fs.rmSync(input.sourceDatabasePath);
    initDatabase(input.sourceDatabasePath);
    closeDatabase();
    completeRendererMigration(input.activeRoot);
    configureRuntimePaths({ userDataPath: input.activeRoot });
    expect(getRuntimeStorageContext().localAuthority).toBe("database-catalog");

    const result = await ensureCanonicalStorageAuthorityOnStartup({
      ...input,
      readRules: async () => [],
      mcpLibrary: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-08-12T00:00:00.000Z",
        servers: [],
        bindings: [],
      },
      plugins: [],
      pluginVersions: new Map(),
      generations: [],
      getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
    });

    expect(result.status).toBe("published");
    expect(getRuntimeStorageContext().localAuthority).toBe("canonical-files");
    expect(
      await ensureCanonicalStorageAuthorityOnStartup({ ...input }),
    ).toEqual({ status: "already-canonical" });
  });
});
