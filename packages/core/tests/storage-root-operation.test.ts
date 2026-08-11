import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  applyStorageRootChange,
  classifyStorageRoot,
  getStorageRootOperationJournalPath,
  recoverPendingStorageRootChange,
  type StorageRootOperationStage,
} from "../src/storage-root-operation";
import { writeRuntimeLayoutState } from "../src/runtime-storage-context";
import { assertStorageMaintenanceAvailable } from "../src/storage-maintenance-intent";

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
});
