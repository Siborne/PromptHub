import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  applyStorageRootChange,
  classifyStorageRoot,
  getStorageRootOperationJournalPath,
  readStorageRootOperationJournal,
  recoverPendingStorageRootChange,
  recoverPendingStorageRootChangeSync,
  type StorageRootOperationStage,
} from "../src/storage-root-operation";
import { writeRuntimeLayoutState } from "../src/runtime-storage-context";
import { createStorageInventory } from "../src/storage-inventory";
import {
  assertStorageMaintenanceAvailable,
  getStorageMaintenanceIntentPath,
} from "../src/storage-maintenance-intent";

describe("storage root operation", () => {
  const temporaryDirectories: string[] = [];

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  function createFixture(): {
    base: string;
    source: string;
    target: string;
    control: string;
    pointers: string[];
  } {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-root-op-"));
    temporaryDirectories.push(base);
    const source = path.join(base, "source");
    const target = path.join(base, "target");
    const control = path.join(base, "control");
    fs.mkdirSync(path.join(source, "data", "prompts", "prompt-1"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(source, "data", "prompts", "prompt-1", "manifest.json"),
      '{"kind":"prompthub-resource-bundle"}\n',
    );
    fs.writeFileSync(path.join(source, "data", "prompthub.db"), "sqlite-image");
    fs.mkdirSync(path.join(source, "config"), { recursive: true });
    fs.writeFileSync(
      path.join(source, "config", "app.json"),
      '{"theme":"dark"}\n',
    );
    writeRuntimeLayoutState(source, {
      now: new Date("2026-08-11T00:00:00.000Z"),
    });
    const pointers: string[] = [];
    return { base, source, target, control, pointers };
  }

  function writeJournal(
    control: string,
    values: Partial<Record<string, unknown>> = {},
  ): void {
    fs.mkdirSync(control, { recursive: true });
    const journal: Record<string, unknown> = {
      formatVersion: 1,
      kind: "prompthub-storage-root-operation",
      operationId: "pending-1",
      action: "migrate",
      state: "prepared",
      sourceRoot: path.join(control, "source"),
      targetRoot: path.join(control, "target"),
      sourceDigest: "digest",
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      ...values,
    };
    const targetRoot = String(journal.targetRoot);
    const operationId = String(journal.operationId);
    if (!("stagePath" in values)) {
      journal.stagePath = path.join(
        path.dirname(targetRoot),
        `.${path.basename(targetRoot)}.prompthub-stage-${operationId}`,
      );
    }
    if (!("priorPath" in values)) {
      journal.priorPath = path.join(
        path.dirname(targetRoot),
        `.${path.basename(targetRoot)}.prompthub-prior-${operationId}`,
      );
    }
    fs.writeFileSync(
      getStorageRootOperationJournalPath(control),
      `${JSON.stringify(journal)}\n`,
    );
  }

  it("rejects journal-owned paths that do not belong to the target operation", () => {
    const { base, source, target, control } = createFixture();
    writeJournal(control, {
      sourceRoot: source,
      targetRoot: target,
      stagePath: path.join(base, "unrelated"),
    });

    expect(() => readStorageRootOperationJournal(control)).toThrow(
      /Invalid storage root operation journal/,
    );
  });

  it("commits an overwrite journal when both prior and artifact are already absent", async () => {
    const { source, target, control } = createFixture();
    fs.cpSync(source, target, { recursive: true });
    writeRuntimeLayoutState(target);
    writeJournal(control, {
      operationId: "committed-without-prior",
      action: "overwrite",
      state: "committed",
      sourceRoot: source,
      targetRoot: target,
    });

    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toEqual({
      status: "committed",
      operationId: "committed-without-prior",
    });
    expect(fs.existsSync(getStorageRootOperationJournalPath(control))).toBe(
      false,
    );
  });

  it("validates operation identity and source ownership before acquiring maintenance", async () => {
    const { base, source, target, control } = createFixture();
    for (const operationId of ["../unsafe", ".", ".."]) {
      await expect(
        applyStorageRootChange({
          action: "migrate",
          sourceRoot: source,
          targetRoot: target,
          controlDirectory: control,
          publishBootPointer: () => undefined,
          operationId,
        }),
      ).rejects.toThrow(/Invalid storage root operation id/);
    }
    expect(fs.existsSync(getStorageMaintenanceIntentPath(source))).toBe(false);

    const unknown = path.join(base, "unknown");
    fs.mkdirSync(unknown);
    fs.writeFileSync(path.join(unknown, "notes.txt"), "not PromptHub");
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: unknown,
        targetRoot: target,
        controlDirectory: control,
        publishBootPointer: () => undefined,
        operationId: "unknown-source",
      }),
    ).rejects.toThrow(/Source must be a verified PromptHub root/);
    expect(fs.existsSync(getStorageMaintenanceIntentPath(unknown))).toBe(false);
  });

  it("classifies real roots without treating empty marker directories as owned", () => {
    const { base, source } = createFixture();
    const emptyMarkers = path.join(base, "empty-markers");
    fs.mkdirSync(path.join(emptyMarkers, "data"), { recursive: true });
    fs.mkdirSync(path.join(emptyMarkers, "config"), { recursive: true });
    const unrelated = path.join(base, "unrelated");
    fs.mkdirSync(unrelated);
    fs.writeFileSync(path.join(unrelated, "notes.txt"), "personal");

    expect(classifyStorageRoot(source).kind).toBe("canonical");
    expect(classifyStorageRoot(path.join(base, "missing")).kind).toBe(
      "missing",
    );
    expect(classifyStorageRoot(emptyMarkers).kind).toBe("empty");
    expect(classifyStorageRoot(unrelated)).toMatchObject({
      kind: "unknown",
      unknownEntries: ["notes.txt"],
    });
  });

  it("stages, verifies, and publishes a migration without mutating the source", async () => {
    const { source, target, control, pointers } = createFixture();
    const sourceManifest = fs.readFileSync(
      path.join(source, "data", "prompts", "prompt-1", "manifest.json"),
      "utf8",
    );

    const result = await applyStorageRootChange({
      action: "migrate",
      sourceRoot: source,
      targetRoot: target,
      controlDirectory: control,
      publishBootPointer: (root) => {
        expect(() => assertStorageMaintenanceAvailable(source)).toThrow(
          "storage maintenance",
        );
        pointers.push(root);
      },
      verifyDatabase: (databasePath) => {
        expect(fs.readFileSync(databasePath, "utf8")).toBe("sqlite-image");
      },
      getAvailableBytes: () => 1024 * 1024 * 1024,
      operationId: "migration-1",
    });

    expect(result.status).toBe("committed");
    expect(pointers).toEqual([target]);
    expect(classifyStorageRoot(target).kind).toBe("canonical");
    expect(
      fs.readFileSync(
        path.join(target, "data", "prompts", "prompt-1", "manifest.json"),
        "utf8",
      ),
    ).toBe(sourceManifest);
    expect(
      fs.readFileSync(
        path.join(source, "data", "prompts", "prompt-1", "manifest.json"),
        "utf8",
      ),
    ).toBe(sourceManifest);
    expect(fs.existsSync(getStorageRootOperationJournalPath(control))).toBe(
      false,
    );
  });

  it("fails before publication when capacity is insufficient", async () => {
    const { source, target, control, pointers } = createFixture();

    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: source,
        targetRoot: target,
        controlDirectory: control,
        publishBootPointer: (root) => {
          pointers.push(root);
        },
        getAvailableBytes: () => 1,
        operationId: "low-disk",
      }),
    ).rejects.toThrow("Insufficient space");

    expect(pointers).toEqual([]);
    expect(fs.existsSync(target)).toBe(false);
    expect(classifyStorageRoot(source).kind).toBe("canonical");
  });

  it.skipIf(process.platform === "win32")(
    "rejects symlinks in the durable inventory without writing the target",
    async () => {
      const { base, source, target, control } = createFixture();
      fs.symlinkSync(
        path.join(base, "outside"),
        path.join(source, "data", "prompts", "escape"),
      );

      await expect(
        applyStorageRootChange({
          action: "migrate",
          sourceRoot: source,
          targetRoot: target,
          controlDirectory: control,
          publishBootPointer: () => undefined,
          getAvailableBytes: () => 1024 * 1024 * 1024,
          operationId: "unsafe-link",
        }),
      ).rejects.toThrow("symbolic link");
      expect(fs.existsSync(target)).toBe(false);
    },
  );

  it("rolls back an interrupted target publication and keeps the source pointer", async () => {
    const { source, target, control, pointers } = createFixture();

    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: source,
        targetRoot: target,
        controlDirectory: control,
        publishBootPointer: (root) => {
          pointers.push(root);
        },
        getAvailableBytes: () => 1024 * 1024 * 1024,
        operationId: "interrupted",
        injectFailure: (stage: StorageRootOperationStage) => {
          if (stage === "target-published") throw new Error("simulated crash");
        },
      }),
    ).rejects.toThrow("simulated crash");

    expect(pointers.at(-1)).toBe(source);
    expect(() => assertStorageMaintenanceAvailable(source)).not.toThrow();
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(getStorageRootOperationJournalPath(control))).toBe(
      false,
    );
  });

  it("preserves an overwritten target as a managed recovery artifact", async () => {
    const { base, source, target, control } = createFixture();
    fs.mkdirSync(path.join(target, "data"), { recursive: true });
    fs.writeFileSync(path.join(target, "data", "prompthub.db"), "old-target");
    writeRuntimeLayoutState(target);

    const result = await applyStorageRootChange({
      action: "overwrite",
      sourceRoot: source,
      targetRoot: target,
      controlDirectory: control,
      publishBootPointer: () => undefined,
      getAvailableBytes: () => 1024 * 1024 * 1024,
      operationId: "overwrite-1",
    });

    expect(result.recoveryArtifactPath).toBeTruthy();
    expect(result.recoveryArtifactPath).toContain(
      path.join("backups", "recovery", "overwrite-1"),
    );
    expect(
      fs.readFileSync(
        path.join(result.recoveryArtifactPath!, "root", "data", "prompthub.db"),
        "utf8",
      ),
    ).toBe("old-target");
    expect(
      fs.readFileSync(path.join(target, "data", "prompthub.db"), "utf8"),
    ).toBe("sqlite-image");
    expect(
      fs.existsSync(path.join(base, ".target.prompthub-prior-overwrite-1")),
    ).toBe(false);
  });

  it("switches only to a recognized complete root", async () => {
    const { base, source, target, control, pointers } = createFixture();
    fs.mkdirSync(path.join(target, "data"), { recursive: true });
    fs.writeFileSync(path.join(target, "data", "prompthub.db"), "target-db");
    writeRuntimeLayoutState(target);

    const result = await applyStorageRootChange({
      action: "switch",
      sourceRoot: source,
      targetRoot: target,
      controlDirectory: control,
      publishBootPointer: (root) => {
        pointers.push(root);
      },
      verifyDatabase: () => undefined,
      operationId: "switch-1",
    });
    expect(result.status).toBe("committed");
    expect(pointers).toEqual([target]);

    const unknown = path.join(base, "unknown");
    fs.mkdirSync(unknown);
    fs.writeFileSync(path.join(unknown, "notes.txt"), "no");
    await expect(
      applyStorageRootChange({
        action: "switch",
        sourceRoot: source,
        targetRoot: unknown,
        controlDirectory: control,
        publishBootPointer: () => undefined,
        operationId: "switch-unknown",
      }),
    ).rejects.toThrow("verified PromptHub root");
  });

  it("resolves a durable prepared journal on startup before services open", async () => {
    const { source, target, control, pointers } = createFixture();
    let stopped = false;
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: source,
        targetRoot: target,
        controlDirectory: control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => 1024 * 1024 * 1024,
        operationId: "restart-1",
        injectFailure: (stage) => {
          if (stage === "prepared") {
            stopped = true;
            throw Object.assign(new Error("power loss"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("power loss");
    expect(stopped).toBe(true);
    expect(fs.existsSync(getStorageRootOperationJournalPath(control))).toBe(
      true,
    );

    const recovered = await recoverPendingStorageRootChange({
      controlDirectory: control,
      publishBootPointer: (root) => {
        pointers.push(root);
      },
    });
    expect(recovered).toMatchObject({
      status: "rolled-back",
      operationId: "restart-1",
    });
    expect(pointers.at(-1)).toBe(source);
    expect(fs.existsSync(target)).toBe(false);
    expect(fs.existsSync(getStorageRootOperationJournalPath(control))).toBe(
      false,
    );
  });

  it("does not delete a target created externally while a prepared stage is pending", async () => {
    const { source, target, control } = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: source,
        targetRoot: target,
        controlDirectory: control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "prepared-external-target",
        injectFailure: (stage) => {
          if (stage === "prepared") {
            throw Object.assign(new Error("power loss"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("power loss");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "external.txt"), "keep");

    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "rolled-back" });
    expect(fs.readFileSync(path.join(target, "external.txt"), "utf8")).toBe(
      "keep",
    );
  });

  it("rejects malformed, unsafe, and non-file journals", () => {
    const { base, source, target, control } = createFixture();
    expect(readStorageRootOperationJournal(control)).toBeNull();

    const journalPath = getStorageRootOperationJournalPath(control);
    fs.mkdirSync(journalPath, { recursive: true });
    expect(() => readStorageRootOperationJournal(control)).toThrow(/Invalid/);
    fs.rmSync(journalPath, { recursive: true });

    fs.mkdirSync(control, { recursive: true });
    fs.writeFileSync(journalPath, "{");
    expect(() => readStorageRootOperationJournal(control)).toThrow();

    const invalidValues: Array<Partial<Record<string, unknown>>> = [
      { formatVersion: 2 },
      { kind: "other" },
      { operationId: 1 },
      { operationId: "../unsafe" },
      { action: "delete" },
      { state: "unknown" },
      { sourceRoot: 1 },
      { targetRoot: 1 },
      { stagePath: 1 },
      { priorPath: 1 },
      { sourceDigest: 1 },
      { createdAt: 1 },
      { updatedAt: 1 },
      { sourceRoot: "relative" },
      { sourceRoot: source, targetRoot: source },
      {
        action: "switch",
        sourceRoot: source,
        targetRoot: target,
        stagePath: path.join(base, "stage"),
        priorPath: null,
      },
    ];
    for (const values of invalidValues) {
      writeJournal(control, values);
      expect(() => readStorageRootOperationJournal(control)).toThrow(/Invalid/);
    }

    writeJournal(control, {
      action: "switch",
      sourceRoot: source,
      targetRoot: target,
      stagePath: null,
      priorPath: null,
      sourceDigest: null,
    });
    expect(readStorageRootOperationJournal(control)).toMatchObject({
      action: "switch",
      stagePath: null,
      priorPath: null,
    });

    if (process.platform !== "win32") {
      fs.rmSync(journalPath);
      const outside = path.join(base, "journal.json");
      fs.writeFileSync(outside, "{}");
      fs.symlinkSync(outside, journalPath);
      expect(() => readStorageRootOperationJournal(control)).toThrow(/Invalid/);
    }
  });

  it("rejects overlapping roots, invalid targets, pending work, and path collisions", async () => {
    const first = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: first.source,
        targetRoot: first.source,
        controlDirectory: first.control,
        publishBootPointer: () => undefined,
        operationId: "same-root",
      }),
    ).rejects.toThrow(/must not overlap/);

    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: first.source,
        targetRoot: path.join(first.source, "nested"),
        controlDirectory: first.control,
        publishBootPointer: () => undefined,
        operationId: "nested-root",
      }),
    ).rejects.toThrow(/must not overlap/);

    const occupied = createFixture();
    fs.mkdirSync(path.join(occupied.target, "data"), { recursive: true });
    fs.writeFileSync(path.join(occupied.target, "data", "prompthub.db"), "db");
    writeRuntimeLayoutState(occupied.target);
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: occupied.source,
        targetRoot: occupied.target,
        controlDirectory: occupied.control,
        publishBootPointer: () => undefined,
        operationId: "occupied-target",
      }),
    ).rejects.toThrow(/absent or empty/);

    const missingOverwrite = createFixture();
    await expect(
      applyStorageRootChange({
        action: "overwrite",
        sourceRoot: missingOverwrite.source,
        targetRoot: missingOverwrite.target,
        controlDirectory: missingOverwrite.control,
        publishBootPointer: () => undefined,
        operationId: "missing-overwrite",
      }),
    ).rejects.toThrow(/Overwrite target must be a verified PromptHub root/);

    const pending = createFixture();
    writeJournal(pending.control, {
      sourceRoot: pending.source,
      targetRoot: pending.target,
    });
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: pending.source,
        targetRoot: pending.target,
        controlDirectory: pending.control,
        publishBootPointer: () => undefined,
        operationId: "new-operation",
      }),
    ).rejects.toThrow(/already pending recovery/);

    const collision = createFixture();
    fs.mkdirSync(
      path.join(collision.base, ".target.prompthub-stage-collision"),
    );
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: collision.source,
        targetRoot: collision.target,
        controlDirectory: collision.control,
        publishBootPointer: () => undefined,
        operationId: "collision",
      }),
    ).rejects.toThrow(/path already exists/);
  });

  it("migrates into an existing empty root and removes its temporary prior", async () => {
    const { base, source, target, control } = createFixture();
    fs.mkdirSync(target);
    const result = await applyStorageRootChange({
      action: "migrate",
      sourceRoot: source,
      targetRoot: target,
      controlDirectory: control,
      publishBootPointer: () => undefined,
      getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
    });

    expect(result.operationId).toMatch(/^[a-f0-9-]{36}$/);
    expect(result.recoveryArtifactPath).toBeUndefined();
    expect(
      fs.readdirSync(base).some((entry) => entry.includes("prompthub-prior")),
    ).toBe(false);
  });

  it("supports a legacy root and the default filesystem capacity probe", async () => {
    const { base, target, control } = createFixture();
    const source = path.join(base, "legacy");
    fs.mkdirSync(path.join(source, "workspace"), { recursive: true });
    fs.writeFileSync(path.join(source, "prompthub.db"), "legacy-db");
    fs.writeFileSync(path.join(source, "workspace", "prompt.json"), "{}");

    const verifiedDatabases: string[] = [];
    const result = await applyStorageRootChange({
      action: "migrate",
      sourceRoot: source,
      targetRoot: target,
      controlDirectory: control,
      publishBootPointer: () => undefined,
      verifyDatabase: (databasePath) => {
        verifiedDatabases.push(databasePath);
      },
      includeSecrets: false,
      inventoryLimits: { maxEntries: 10 },
      operationId: "legacy-default-capacity",
      now: new Date("2026-08-11T04:00:00.000Z"),
    });
    expect(result.copiedFiles).toBe(2);
    expect(classifyStorageRoot(target).layoutEpoch).toBe(0);
    expect(verifiedDatabases).toEqual([
      path.join(
        base,
        ".target.prompthub-stage-legacy-default-capacity",
        "prompthub.db",
      ),
      path.join(target, "prompthub.db"),
    ]);
  });

  it("cleans unpublished stages when inventory, staging, or journal publication fails", async () => {
    for (const stage of ["inventory-created", "staged"] as const) {
      const fixture = createFixture();
      await expect(
        applyStorageRootChange({
          action: "migrate",
          sourceRoot: fixture.source,
          targetRoot: fixture.target,
          controlDirectory: fixture.control,
          publishBootPointer: () => undefined,
          getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
          operationId: `fail-${stage}`,
          injectFailure: (current) => {
            if (current === stage) throw new Error(`failed ${stage}`);
          },
        }),
      ).rejects.toThrow(`failed ${stage}`);
      expect(
        fs.existsSync(
          path.join(fixture.base, `.target.prompthub-stage-fail-${stage}`),
        ),
      ).toBe(false);
    }

    const fixture = createFixture();
    const originalRename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (
        path.resolve(String(to)) ===
        getStorageRootOperationJournalPath(fixture.control)
      ) {
        throw new Error("journal rename failed");
      }
      return originalRename(from, to);
    });
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "journal-failure",
      }),
    ).rejects.toThrow("journal rename failed");
    expect(
      fs.existsSync(
        path.join(fixture.base, ".target.prompthub-stage-journal-failure"),
      ),
    ).toBe(false);
    expect(
      fs.readdirSync(fixture.control).some((entry) => entry.includes(".tmp-")),
    ).toBe(false);
  });

  it("rolls back every pre-commit publication stage and reports rollback failure", async () => {
    for (const stage of [
      "prepared",
      "pointer-published",
      "verified",
    ] as const) {
      const fixture = createFixture();
      await expect(
        applyStorageRootChange({
          action: "migrate",
          sourceRoot: fixture.source,
          targetRoot: fixture.target,
          controlDirectory: fixture.control,
          publishBootPointer: (rootPath) => {
            fixture.pointers.push(rootPath);
          },
          getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
          operationId: `rollback-${stage}`,
          injectFailure: (current) => {
            if (current === stage) throw new Error(`failed ${stage}`);
          },
        }),
      ).rejects.toThrow(`failed ${stage}`);
      expect(fixture.pointers.at(-1)).toBe(fixture.source);
      expect(fs.existsSync(fixture.target)).toBe(false);
    }

    const fixture = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => {
          throw new Error("pointer rollback failed");
        },
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "rollback-failure",
        injectFailure: (stage) => {
          if (stage === "prepared") throw new Error("operation failed");
        },
      }),
    ).rejects.toThrow(/requires startup recovery/);
    expect(
      fs.existsSync(getStorageRootOperationJournalPath(fixture.control)),
    ).toBe(true);
  });

  it("commits an interrupted publication during asynchronous startup recovery", async () => {
    const fixture = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "async-recover",
        injectFailure: (stage) => {
          if (stage === "target-published") {
            throw Object.assign(new Error("power loss"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("power loss");

    const pointers: string[] = [];
    const result = await recoverPendingStorageRootChange({
      controlDirectory: fixture.control,
      publishBootPointer: (rootPath) => {
        pointers.push(rootPath);
      },
      verifyDatabase: (databasePath) => {
        expect(databasePath).toBe(
          path.join(fixture.target, "data", "prompthub.db"),
        );
      },
    });
    expect(result).toEqual({
      status: "committed",
      operationId: "async-recover",
    });
    expect(pointers).toEqual([fixture.target]);
  });

  it("falls back from failed completion and reports asynchronous recovery failures", async () => {
    const fallback = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: fallback.source,
        targetRoot: fallback.target,
        controlDirectory: fallback.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "async-fallback",
        injectFailure: (stage) => {
          if (stage === "target-published") {
            throw Object.assign(new Error("stop"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("stop");
    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: fallback.control,
        publishBootPointer: () => undefined,
        verifyDatabase: () => {
          throw new Error("invalid target");
        },
      }),
    ).resolves.toEqual({
      status: "rolled-back",
      operationId: "async-fallback",
    });

    const failed = createFixture();
    writeJournal(failed.control, {
      sourceRoot: failed.source,
      targetRoot: failed.target,
    });
    const result = await recoverPendingStorageRootChange({
      controlDirectory: failed.control,
      publishBootPointer: () => {
        throw "cannot publish source";
      },
    });
    expect(result).toEqual({
      status: "recovery-required",
      operationId: "pending-1",
      reason: "cannot publish source",
    });
  });

  it("supports synchronous completion, rollback, failure, and empty recovery", async () => {
    const completed = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: completed.source,
        targetRoot: completed.target,
        controlDirectory: completed.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "sync-complete",
        injectFailure: (stage) => {
          if (stage === "target-published") {
            throw Object.assign(new Error("stop"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("stop");
    const completedPointers: string[] = [];
    expect(
      recoverPendingStorageRootChangeSync({
        controlDirectory: completed.control,
        publishBootPointer: (rootPath) => completedPointers.push(rootPath),
        verifyDatabase: () => undefined,
      }),
    ).toEqual({ status: "committed", operationId: "sync-complete" });
    expect(completedPointers).toEqual([completed.target]);

    const rolledBack = createFixture();
    writeJournal(rolledBack.control, {
      sourceRoot: rolledBack.source,
      targetRoot: rolledBack.target,
    });
    expect(
      recoverPendingStorageRootChangeSync({
        controlDirectory: rolledBack.control,
        publishBootPointer: () => undefined,
      }),
    ).toEqual({ status: "rolled-back", operationId: "pending-1" });

    const failed = createFixture();
    writeJournal(failed.control, {
      sourceRoot: failed.source,
      targetRoot: failed.target,
    });
    expect(
      recoverPendingStorageRootChangeSync({
        controlDirectory: failed.control,
        publishBootPointer: () => {
          throw new Error("sync pointer failed");
        },
      }),
    ).toEqual({
      status: "recovery-required",
      operationId: "pending-1",
      reason: "sync pointer failed",
    });

    const empty = createFixture();
    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: empty.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toEqual({ status: "none" });
    expect(
      recoverPendingStorageRootChangeSync({
        controlDirectory: empty.control,
        publishBootPointer: () => undefined,
      }),
    ).toEqual({ status: "none" });
  });

  it("covers the remaining root overlap and capacity boundaries", async () => {
    const nested = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: nested.source,
        targetRoot: nested.base,
        controlDirectory: nested.control,
        publishBootPointer: () => undefined,
        operationId: "source-inside-target",
      }),
    ).rejects.toThrow(/must not overlap/);

    const huge = createFixture();
    const hugeTarget = path.join(huge.base, "missing-parent", "target");
    vi.spyOn(fs, "statfsSync").mockReturnValue({
      bavail: BigInt(Number.MAX_SAFE_INTEGER),
      bsize: 2n,
    } as fs.BigIntStatsFs);
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: huge.source,
        targetRoot: hugeTarget,
        controlDirectory: huge.control,
        publishBootPointer: () => undefined,
        operationId: "huge-capacity",
      }),
    ).resolves.toMatchObject({ status: "committed" });
    vi.restoreAllMocks();

    const unavailable = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: unavailable.source,
        targetRoot: unavailable.target,
        controlDirectory: unavailable.control,
        publishBootPointer: () => undefined,
        operationId: "capacity-unavailable",
        injectFailure: (stage) => {
          if (stage === "inventory-created") {
            vi.spyOn(fs, "existsSync").mockReturnValue(false);
          }
        },
      }),
    ).rejects.toThrow(/Insufficient space/);
    vi.restoreAllMocks();
  });

  it("recovers a crash between target rename and swapping journal publication", async () => {
    const fixture = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "rename-window",
        injectFailure: (stage) => {
          if (stage === "prepared") {
            throw Object.assign(new Error("stop"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("stop");
    const journal = readStorageRootOperationJournal(fixture.control)!;
    expect(journal.sourceDigest).toBe(
      createStorageInventory(fixture.source).digest,
    );
    fs.renameSync(journal.stagePath!, fixture.target);

    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toEqual({
      status: "rolled-back",
      operationId: "rename-window",
    });
    expect(fs.existsSync(fixture.target)).toBe(false);

    const unknown = createFixture();
    fs.mkdirSync(unknown.target);
    fs.writeFileSync(path.join(unknown.target, "external.txt"), "keep");
    writeJournal(unknown.control, {
      sourceRoot: unknown.source,
      targetRoot: unknown.target,
      sourceDigest: "not-the-target-digest",
    });
    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: unknown.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "rolled-back" });
    expect(fs.existsSync(path.join(unknown.target, "external.txt"))).toBe(true);

    const missingDigest = createFixture();
    fs.mkdirSync(path.join(missingDigest.target, "data"), { recursive: true });
    fs.writeFileSync(
      path.join(missingDigest.target, "data", "prompthub.db"),
      "external-db",
    );
    writeRuntimeLayoutState(missingDigest.target);
    writeJournal(missingDigest.control, {
      sourceRoot: missingDigest.source,
      targetRoot: missingDigest.target,
      sourceDigest: null,
    });
    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: missingDigest.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "rolled-back" });
    expect(classifyStorageRoot(missingDigest.target).kind).toBe("canonical");
  });

  it("uses the journaled secret policy when recognizing a prepared rename window", async () => {
    const fixture = createFixture();
    fs.mkdirSync(path.join(fixture.source, "secrets"));
    fs.writeFileSync(
      path.join(fixture.source, "secrets", "vault.enc"),
      "secret",
    );
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "secret-rename-window",
        injectFailure: (stage) => {
          if (stage === "prepared") {
            throw Object.assign(new Error("stop"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("stop");
    const journal = readStorageRootOperationJournal(fixture.control)!;
    fs.renameSync(journal.stagePath!, fixture.target);

    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "rolled-back" });
    expect(fs.existsSync(fixture.target)).toBe(false);
  });

  it("restores an overwritten target when publication fails", async () => {
    const fixture = createFixture();
    fs.mkdirSync(path.join(fixture.target, "data"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture.target, "data", "prompthub.db"),
      "old-target",
    );
    writeRuntimeLayoutState(fixture.target);

    await expect(
      applyStorageRootChange({
        action: "overwrite",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "overwrite-rollback",
        injectFailure: (stage) => {
          if (stage === "target-published") throw new Error("publish failed");
        },
      }),
    ).rejects.toThrow("publish failed");
    expect(
      fs.readFileSync(
        path.join(fixture.target, "data", "prompthub.db"),
        "utf8",
      ),
    ).toBe("old-target");
  });

  it("keeps committed publication despite post-commit and retention failures", async () => {
    const committed = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: committed.source,
        targetRoot: committed.target,
        controlDirectory: committed.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "committed-failure",
        injectFailure: (stage) => {
          if (stage === "committed") throw new Error("after commit");
        },
      }),
    ).rejects.toThrow("after commit");
    expect(classifyStorageRoot(committed.target).kind).toBe("canonical");
    expect(
      fs.existsSync(getStorageRootOperationJournalPath(committed.control)),
    ).toBe(true);

    if (process.platform !== "win32") {
      const retained = createFixture();
      fs.mkdirSync(path.join(retained.target, "data"), { recursive: true });
      fs.writeFileSync(
        path.join(retained.target, "data", "prompthub.db"),
        "old",
      );
      writeRuntimeLayoutState(retained.target);
      await expect(
        applyStorageRootChange({
          action: "overwrite",
          sourceRoot: retained.source,
          targetRoot: retained.target,
          controlDirectory: retained.control,
          publishBootPointer: () => {
            const recoveryRoot = path.join(
              retained.target,
              "backups",
              "recovery",
            );
            const oldArtifact = path.join(recoveryRoot, "old-artifact");
            fs.mkdirSync(path.join(oldArtifact, "root"), { recursive: true });
            fs.writeFileSync(path.join(oldArtifact, "root", "payload"), "old");
            fs.writeFileSync(
              path.join(oldArtifact, "manifest.json"),
              `${JSON.stringify({
                formatVersion: 1,
                kind: "storage-root-recovery-artifact",
                state: "complete",
                id: "old-artifact",
                operationId: "old-artifact",
                artifactType: "overwritten-root",
                sourceRoot: retained.source,
                targetRoot: retained.target,
                createdAt: "2000-01-01T00:00:00.000Z",
                validatedAt: "2000-01-01T00:00:00.000Z",
              })}\n`,
            );
            const originalRemove = fs.rmSync.bind(fs);
            vi.spyOn(fs, "rmSync").mockImplementation((targetPath, options) => {
              if (path.resolve(String(targetPath)) === oldArtifact) {
                throw new Error("retention cleanup failed");
              }
              return originalRemove(targetPath, options);
            });
          },
          getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
          operationId: "retention-failure",
        }),
      ).resolves.toMatchObject({ status: "committed" });
      vi.restoreAllMocks();
      expect(classifyStorageRoot(retained.target).kind).toBe("canonical");
    }

    const artifactCollision = createFixture();
    fs.mkdirSync(path.join(artifactCollision.target, "data"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(artifactCollision.target, "data", "prompthub.db"),
      "old",
    );
    writeRuntimeLayoutState(artifactCollision.target);
    await expect(
      applyStorageRootChange({
        action: "overwrite",
        sourceRoot: artifactCollision.source,
        targetRoot: artifactCollision.target,
        controlDirectory: artifactCollision.control,
        publishBootPointer: () => {
          fs.mkdirSync(
            path.join(
              artifactCollision.target,
              "backups",
              "recovery",
              "artifact-collision",
            ),
            { recursive: true },
          );
        },
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "artifact-collision",
      }),
    ).rejects.toThrow(/Recovery artifact already exists/);
  });

  it("finishes overwrite recovery when artifact manifest publication fails after moving prior data", async () => {
    const fixture = createFixture();
    fs.mkdirSync(path.join(fixture.target, "data"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture.target, "data", "prompthub.db"),
      "old-target",
    );
    writeRuntimeLayoutState(fixture.target);
    const operationId = "root-artifact-manifest-crash";
    const artifactPath = path.join(
      fixture.target,
      "backups",
      "recovery",
      operationId,
    );
    const artifactManifestPath = path.join(artifactPath, "manifest.json");
    const originalRename = fs.renameSync.bind(fs);
    let failedCompleteManifest = false;
    vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (
        !failedCompleteManifest &&
        path.resolve(String(to)) === artifactManifestPath &&
        fs.readFileSync(String(from), "utf8").includes('"state": "complete"')
      ) {
        failedCompleteManifest = true;
        throw new Error("root artifact manifest interrupted");
      }
      return originalRename(from, to);
    });

    await expect(
      applyStorageRootChange({
        action: "overwrite",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId,
      }),
    ).rejects.toThrow("root artifact manifest interrupted");

    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toMatchObject({ status: "committed", operationId });
    expect(classifyStorageRoot(fixture.target).kind).toBe("canonical");
    expect(
      fs.readFileSync(
        path.join(artifactPath, "root", "data", "prompthub.db"),
        "utf8",
      ),
    ).toBe("old-target");
    expect(
      JSON.parse(
        fs.readFileSync(path.join(artifactPath, "manifest.json"), "utf8"),
      ),
    ).toMatchObject({ state: "complete", operationId });
  });

  it("falls back synchronously when target completion fails or is missing", async () => {
    const failed = createFixture();
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: failed.source,
        targetRoot: failed.target,
        controlDirectory: failed.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "sync-fallback",
        injectFailure: (stage) => {
          if (stage === "target-published") {
            throw Object.assign(new Error("stop"), {
              leaveOperationForRecovery: true,
            });
          }
        },
      }),
    ).rejects.toThrow("stop");
    expect(
      recoverPendingStorageRootChangeSync({
        controlDirectory: failed.control,
        publishBootPointer: () => undefined,
        verifyDatabase: () => {
          throw new Error("bad database");
        },
      }),
    ).toEqual({ status: "rolled-back", operationId: "sync-fallback" });

    const missing = createFixture();
    writeJournal(missing.control, {
      state: "swapping",
      sourceRoot: missing.source,
      targetRoot: missing.target,
    });
    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: missing.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toEqual({ status: "rolled-back", operationId: "pending-1" });

    const stringFailure = createFixture();
    writeJournal(stringFailure.control, {
      sourceRoot: stringFailure.source,
      targetRoot: stringFailure.target,
    });
    expect(
      recoverPendingStorageRootChangeSync({
        controlDirectory: stringFailure.control,
        publishBootPointer: () => {
          throw "sync string failure";
        },
      }),
    ).toEqual({
      status: "recovery-required",
      operationId: "pending-1",
      reason: "sync string failure",
    });

    const switchJournal = createFixture();
    fs.mkdirSync(path.join(switchJournal.target, "data"), { recursive: true });
    fs.writeFileSync(
      path.join(switchJournal.target, "data", "prompthub.db"),
      "target",
    );
    writeRuntimeLayoutState(switchJournal.target);
    writeJournal(switchJournal.control, {
      action: "switch",
      sourceRoot: switchJournal.source,
      targetRoot: switchJournal.target,
      stagePath: null,
      priorPath: null,
      sourceDigest: null,
    });
    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: switchJournal.control,
        publishBootPointer: () => undefined,
      }),
    ).resolves.toEqual({ status: "rolled-back", operationId: "pending-1" });
    expect(classifyStorageRoot(switchJournal.target).kind).toBe("canonical");

    const errorFailure = createFixture();
    writeJournal(errorFailure.control, {
      sourceRoot: errorFailure.source,
      targetRoot: errorFailure.target,
    });
    await expect(
      recoverPendingStorageRootChange({
        controlDirectory: errorFailure.control,
        publishBootPointer: () => {
          throw new Error("async error failure");
        },
      }),
    ).resolves.toEqual({
      status: "recovery-required",
      operationId: "pending-1",
      reason: "async error failure",
    });
  });

  it("tolerates directory fsync being unavailable", async () => {
    const fixture = createFixture();
    const originalOpen = fs.openSync.bind(fs);
    await expect(
      applyStorageRootChange({
        action: "migrate",
        sourceRoot: fixture.source,
        targetRoot: fixture.target,
        controlDirectory: fixture.control,
        publishBootPointer: () => undefined,
        getAvailableBytes: () => Number.MAX_SAFE_INTEGER,
        operationId: "no-directory-fsync",
        injectFailure: (stage) => {
          if (stage === "staged") {
            vi.spyOn(fs, "openSync").mockImplementation(
              (target, flags, mode) => {
                if (path.resolve(String(target)) === fixture.control) {
                  throw new Error("directory fsync unavailable");
                }
                return originalOpen(target, flags, mode);
              },
            );
          }
        },
      }),
    ).resolves.toMatchObject({ status: "committed" });
  });
});
