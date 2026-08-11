import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  getStorageRestoreJournalPath,
  recoverJournaledStorageRestore,
  runJournaledStorageRestore,
  type StorageRestorePublicationStage,
} from "../src/journaled-storage-restore";
import { assertStorageMaintenanceAvailable } from "../src/storage-maintenance-intent";
import { acquireStorageMaintenanceIntent } from "../src/storage-maintenance-intent";

describe("journaled storage restore", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-restore-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "data"), { recursive: true });
    fs.mkdirSync(path.join(root, "config"), { recursive: true });
    fs.writeFileSync(path.join(root, "data", "library.txt"), "before");
    fs.writeFileSync(path.join(root, "config", "app.json"), '{"before":true}');
    return root;
  }

  it("publishes all prepared domains and preserves the prior set as one artifact", async () => {
    const root = fixture();
    const result = await runJournaledStorageRestore({
      activeRoot: root,
      operationId: "restore-1",
      entryNames: ["data", "config"],
      prepareCandidate: (stageRoot) => {
        fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
        fs.mkdirSync(path.join(stageRoot, "config"), { recursive: true });
        fs.writeFileSync(path.join(stageRoot, "data", "library.txt"), "after");
        fs.writeFileSync(
          path.join(stageRoot, "config", "app.json"),
          '{"after":true}',
        );
      },
      verifyCandidate: (stageRoot) => {
        expect(
          fs.readFileSync(path.join(stageRoot, "data", "library.txt"), "utf8"),
        ).toBe("after");
      },
      verifyActive: (activeRoot) => {
        expect(
          fs.readFileSync(path.join(activeRoot, "data", "library.txt"), "utf8"),
        ).toBe("after");
      },
    });

    expect(result.status).toBe("committed");
    expect(
      fs.readFileSync(path.join(root, "data", "library.txt"), "utf8"),
    ).toBe("after");
    expect(
      fs.readFileSync(
        path.join(result.recoveryArtifactPath, "root", "data", "library.txt"),
        "utf8",
      ),
    ).toBe("before");
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(false);
  });

  it("rolls every entry back when verification fails after publication", async () => {
    const root = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "restore-fail",
        entryNames: ["data", "config"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.mkdirSync(path.join(stageRoot, "config"), { recursive: true });
          fs.writeFileSync(
            path.join(stageRoot, "data", "library.txt"),
            "broken",
          );
        },
        verifyCandidate: () => undefined,
        verifyActive: () => {
          throw new Error("domain invariant failed");
        },
      }),
    ).rejects.toThrow("domain invariant failed");

    expect(
      fs.readFileSync(path.join(root, "data", "library.txt"), "utf8"),
    ).toBe("before");
    expect(fs.readFileSync(path.join(root, "config", "app.json"), "utf8")).toBe(
      '{"before":true}',
    );
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(false);
  });

  it("resolves an interrupted swap before startup services open", async () => {
    const root = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "restore-restart",
        entryNames: ["data", "config"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.mkdirSync(path.join(stageRoot, "config"), { recursive: true });
          fs.writeFileSync(
            path.join(stageRoot, "data", "library.txt"),
            "after",
          );
          fs.writeFileSync(path.join(stageRoot, "config", "app.json"), "after");
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
        injectFailure: (stage: StorageRestorePublicationStage) => {
          if (stage === "entry-swapped:data") {
            throw Object.assign(new Error("power loss"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("power loss");
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(true);

    const recovered = await recoverJournaledStorageRestore({
      activeRoot: root,
      verifyActive: (activeRoot) => {
        expect(() => assertStorageMaintenanceAvailable(root)).toThrow(
          "storage maintenance",
        );
        expect(
          fs.readFileSync(path.join(activeRoot, "data", "library.txt"), "utf8"),
        ).toBe("after");
        expect(
          fs.readFileSync(path.join(activeRoot, "config", "app.json"), "utf8"),
        ).toBe("after");
      },
    });
    expect(recovered.status).toBe("committed");
    expect(() => assertStorageMaintenanceAvailable(root)).not.toThrow();
    expect(fs.existsSync(getStorageRestoreJournalPath(root))).toBe(false);
  });

  it("rejects unsafe entry names before creating staging state", async () => {
    const root = fixture();
    await expect(
      runJournaledStorageRestore({
        activeRoot: root,
        operationId: "unsafe",
        entryNames: ["../outside"],
        prepareCandidate: () => undefined,
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      }),
    ).rejects.toThrow("Invalid restore entry");
    expect(fs.existsSync(path.join(path.dirname(root), "outside"))).toBe(false);
  });

  it("reuses one verified maintenance barrier for staged authority work", async () => {
    const root = fixture();
    const maintenance = acquireStorageMaintenanceIntent(root, {
      operationId: "authority-restore",
      operationKind: "canonical-authority",
    });
    try {
      await expect(
        runJournaledStorageRestore({
          activeRoot: root,
          operationId: "different-operation",
          maintenanceOperationId: "authority-restore",
          entryNames: ["data"],
          prepareCandidate: () => undefined,
          verifyCandidate: () => undefined,
          verifyActive: () => undefined,
        }),
      ).rejects.toThrow("does not own maintenance intent");

      const result = await runJournaledStorageRestore({
        activeRoot: root,
        maintenanceOperationId: "authority-restore",
        entryNames: ["data"],
        prepareCandidate: (stageRoot) => {
          fs.mkdirSync(path.join(stageRoot, "data"), { recursive: true });
          fs.writeFileSync(
            path.join(stageRoot, "data", "library.txt"),
            "after",
          );
        },
        verifyCandidate: () => undefined,
        verifyActive: () => undefined,
      });
      expect(result.operationId).toBe("authority-restore");
    } finally {
      maintenance.release();
    }
  });
});
