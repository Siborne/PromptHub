import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  acquireStorageMaintenanceIntent,
  assertStorageMaintenanceAvailable,
  assertStorageMaintenanceIntentHeld,
  getStorageMaintenanceIntentPath,
  StorageMaintenanceBusyError,
} from "../src/storage-maintenance-intent";

describe("storage maintenance intent", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function createRoot(): string {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-storage-maintenance-"),
    );
    roots.push(root);
    return root;
  }

  it("blocks concurrent structural work and database reopening until release", () => {
    const root = createRoot();
    const maintenance = acquireStorageMaintenanceIntent(
      root,
      { operationId: "restore-1", operationKind: "restore" },
      { pid: 101, token: "a".repeat(32), isProcessAlive: () => true },
    );

    expect(() =>
      assertStorageMaintenanceAvailable(root, { isProcessAlive: () => true }),
    ).toThrow(StorageMaintenanceBusyError);
    expect(() =>
      acquireStorageMaintenanceIntent(
        root,
        { operationId: "migrate-2", operationKind: "root-migrate" },
        { pid: 202, token: "b".repeat(32), isProcessAlive: () => true },
      ),
    ).toThrow("storage maintenance is already in progress");

    maintenance.release();
    expect(() => assertStorageMaintenanceAvailable(root)).not.toThrow();
  });

  it("recovers a dead owner without allowing the old owner to remove the new intent", () => {
    const root = createRoot();
    const stale = acquireStorageMaintenanceIntent(
      root,
      { operationId: "restore-1", operationKind: "restore" },
      { pid: 101, token: "a".repeat(32), isProcessAlive: () => true },
    );
    const recovered = acquireStorageMaintenanceIntent(
      root,
      { operationId: "restore-2", operationKind: "restore" },
      {
        pid: 202,
        token: "b".repeat(32),
        isProcessAlive: (pid) => pid === 202,
      },
    );

    stale.release();
    expect(fs.existsSync(recovered.intentPath)).toBe(true);
    recovered.release();
    expect(fs.existsSync(recovered.intentPath)).toBe(false);
  });

  it("verifies an explicitly inherited maintenance intent belongs to this operation", () => {
    const root = createRoot();
    const maintenance = acquireStorageMaintenanceIntent(root, {
      operationId: "portable-1",
      operationKind: "portable-export",
    });

    expect(() =>
      assertStorageMaintenanceIntentHeld(root, "portable-1"),
    ).not.toThrow();
    expect(() =>
      assertStorageMaintenanceIntentHeld(root, "portable-2"),
    ).toThrow("ownership could not be verified");
    maintenance.release();
    expect(() =>
      assertStorageMaintenanceIntentHeld(root, "portable-1"),
    ).toThrow("ownership could not be verified");
  });

  it("fails closed for malformed and unsafe intent paths", () => {
    const root = createRoot();
    const intentPath = getStorageMaintenanceIntentPath(root);
    fs.mkdirSync(path.dirname(intentPath), { recursive: true });
    fs.writeFileSync(intentPath, "{}", "utf8");
    expect(() => assertStorageMaintenanceAvailable(root)).toThrow(
      "malformed or unsafe",
    );
    fs.rmSync(intentPath);
    fs.mkdirSync(intentPath);
    expect(() => assertStorageMaintenanceAvailable(root)).toThrow(
      "malformed or unsafe",
    );
  });
});
