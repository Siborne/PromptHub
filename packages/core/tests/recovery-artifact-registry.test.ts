import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listRecoveryArtifacts,
  pruneRecoveryArtifacts,
} from "../src/recovery-artifact-registry";

describe("recovery artifact registry", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(): string {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-recovery-registry-"),
    );
    roots.push(root);
    return root;
  }

  function artifact(
    root: string,
    id: string,
    createdAt: string,
    bytes: number,
    options: { pinnedReason?: string; targetRoot?: string } = {},
  ): void {
    const directory = path.join(root, "backups", "recovery", id);
    fs.mkdirSync(path.join(directory, "root"), { recursive: true });
    fs.writeFileSync(
      path.join(directory, "root", "payload.bin"),
      Buffer.alloc(bytes, 1),
    );
    fs.writeFileSync(
      path.join(directory, "manifest.json"),
      JSON.stringify({
        formatVersion: 1,
        kind: "storage-restore-recovery-artifact",
        state: "complete",
        id,
        operationId: id,
        artifactType: "pre-restore-state",
        sourceRoot: root,
        ...options,
        entries: ["data"],
        createdAt,
        validatedAt: createdAt,
      }),
    );
  }

  it("lists only complete bounded artifacts with measured sizes", () => {
    const root = fixture();
    artifact(root, "valid", "2026-08-10T00:00:00.000Z", 17);
    fs.mkdirSync(path.join(root, "backups", "recovery", "broken"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "backups", "recovery", "broken", "manifest.json"),
      "{}",
    );

    expect(listRecoveryArtifacts(root)).toEqual([
      expect.objectContaining({
        id: "valid",
        artifactType: "pre-restore-state",
        payloadBytes: 17,
      }),
    ]);
  });

  it("uses default retention for an empty registry", () => {
    const root = fixture();
    expect(listRecoveryArtifacts(root)).toEqual([]);
    expect(pruneRecoveryArtifacts(root)).toEqual([]);
  });

  it("enforces age, count, and byte retention while protecting in-use ids", () => {
    const root = fixture();
    artifact(root, "old", "2026-01-01T00:00:00.000Z", 8);
    artifact(root, "middle", "2026-08-09T00:00:00.000Z", 8);
    artifact(root, "new", "2026-08-10T00:00:00.000Z", 8);

    const removed = pruneRecoveryArtifacts(
      root,
      { maxCount: 1, maxAgeMs: 7 * 24 * 60 * 60 * 1000, maxBytes: 8 },
      new Set(["middle"]),
      new Date("2026-08-11T00:00:00.000Z").getTime(),
    );

    expect(removed.sort()).toEqual(["new", "old"]);
    expect(listRecoveryArtifacts(root).map((entry) => entry.id)).toEqual([
      "middle",
    ]);
  });

  it.skipIf(process.platform === "win32")(
    "ignores symlinked artifact directories without traversing them",
    () => {
      const root = fixture();
      const outside = path.join(root, "outside");
      fs.mkdirSync(outside);
      fs.writeFileSync(path.join(outside, "secret"), "secret");
      const registry = path.join(root, "backups", "recovery");
      fs.mkdirSync(registry, { recursive: true });
      fs.symlinkSync(outside, path.join(registry, "linked"));

      expect(listRecoveryArtifacts(root)).toEqual([]);
      expect(fs.readFileSync(path.join(outside, "secret"), "utf8")).toBe(
        "secret",
      );
    },
  );

  it.skipIf(process.platform === "win32")(
    "ignores a symlinked artifact manifest",
    () => {
      const root = fixture();
      const directory = path.join(
        root,
        "backups",
        "recovery",
        "linked-manifest",
      );
      fs.mkdirSync(directory, { recursive: true });
      const outside = path.join(root, "outside-manifest.json");
      fs.writeFileSync(outside, "{}\n");
      fs.symlinkSync(outside, path.join(directory, "manifest.json"));

      expect(listRecoveryArtifacts(root)).toEqual([]);
    },
  );

  it("returns optional target and pin metadata and never prunes a pinned artifact", () => {
    const root = fixture();
    artifact(root, "pinned", "2026-01-01T00:00:00.000Z", 8, {
      pinnedReason: "manual recovery",
      targetRoot: path.join(root, "target"),
    });

    expect(listRecoveryArtifacts(root)).toEqual([
      expect.objectContaining({
        id: "pinned",
        pinnedReason: "manual recovery",
        targetRoot: path.join(root, "target"),
      }),
    ]);
    expect(
      pruneRecoveryArtifacts(
        root,
        { maxCount: 1, maxAgeMs: 1, maxBytes: 1 },
        new Set(),
        new Date("2026-08-12T00:00:00.000Z").getTime(),
      ),
    ).toEqual([]);
  });

  it("keeps eligible artifacts and prunes by bytes independently", () => {
    const root = fixture();
    artifact(root, "small", "2026-08-11T00:00:00.000Z", 4);
    expect(
      pruneRecoveryArtifacts(
        root,
        { maxCount: 2, maxAgeMs: 100_000_000, maxBytes: 1024 },
        new Set(),
        new Date("2026-08-12T00:00:00.000Z").getTime(),
      ),
    ).toEqual([]);

    artifact(root, "large", "2026-08-12T00:00:00.000Z", 64);
    expect(
      pruneRecoveryArtifacts(
        root,
        { maxCount: 10, maxAgeMs: 100_000_000, maxBytes: 32 },
        new Set(),
        new Date("2026-08-12T00:00:01.000Z").getTime(),
      ),
    ).toContain("large");
  });

  it("enforces configurable scan depth and entry limits", () => {
    const root = fixture();
    artifact(root, "bounded", "2026-08-11T00:00:00.000Z", 4);

    expect(listRecoveryArtifacts(root, { maxDepth: 1 })).toEqual([]);
    expect(listRecoveryArtifacts(root, { maxEntries: 2 })).toEqual([]);
    expect(() => listRecoveryArtifacts(root, { maxEntries: 0 })).toThrow(
      /maxEntries must be a positive safe integer/,
    );
  });

  it.skipIf(process.platform === "win32")(
    "rejects symbolic links inside an otherwise valid artifact",
    () => {
      const root = fixture();
      artifact(root, "linked-payload", "2026-08-11T00:00:00.000Z", 4);
      const payloadPath = path.join(
        root,
        "backups",
        "recovery",
        "linked-payload",
        "root",
        "payload.bin",
      );
      const outside = path.join(root, "outside.bin");
      fs.writeFileSync(outside, "outside");
      fs.rmSync(payloadPath);
      fs.symlinkSync(outside, payloadPath);

      expect(listRecoveryArtifacts(root)).toEqual([]);
    },
  );

  it("rejects special files reported inside an artifact", () => {
    const root = fixture();
    artifact(root, "special", "2026-08-11T00:00:00.000Z", 4);
    const payloadPath = path.join(
      root,
      "backups",
      "recovery",
      "special",
      "root",
      "payload.bin",
    );
    const originalLstat = fs.lstatSync.bind(fs);
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      const stats = originalLstat(target, options as never);
      if (path.resolve(String(target)) !== payloadPath) return stats;
      return Object.assign(Object.create(stats), {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => false,
      });
    });

    expect(listRecoveryArtifacts(root)).toEqual([]);
  });

  it("returns an empty inventory for unsafe roots and scan errors", () => {
    const fileRoot = fixture();
    const registryPath = path.join(fileRoot, "backups", "recovery");
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, "unsafe");
    expect(listRecoveryArtifacts(fileRoot)).toEqual([]);

    const deniedRoot = fixture();
    const deniedPath = path.join(deniedRoot, "backups", "recovery");
    const originalLstat = fs.lstatSync.bind(fs);
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      if (path.resolve(String(target)) === deniedPath) {
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      }
      return originalLstat(target, options as never);
    });
    expect(listRecoveryArtifacts(deniedRoot)).toEqual([]);
  });

  it("rejects invalid retention numbers", () => {
    const root = fixture();
    expect(() => pruneRecoveryArtifacts(root, { maxCount: 0 })).toThrow(
      /maxCount must be a positive safe integer/,
    );
    expect(() =>
      pruneRecoveryArtifacts(root, { maxAgeMs: Number.NaN }),
    ).toThrow(/maxAgeMs must be a positive finite number/);
  });
});
