import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";

import {
  listRecoveryArtifacts,
  pruneRecoveryArtifacts,
} from "../src/recovery-artifact-registry";

describe("recovery artifact registry", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-recovery-registry-"));
    roots.push(root);
    return root;
  }

  function artifact(root: string, id: string, createdAt: string, bytes: number): void {
    const directory = path.join(root, "backups", "recovery", id);
    fs.mkdirSync(path.join(directory, "root"), { recursive: true });
    fs.writeFileSync(path.join(directory, "root", "payload.bin"), Buffer.alloc(bytes, 1));
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

    expect(listRecoveryArtifacts(root)).toEqual([
      expect.objectContaining({
        id: "valid",
        artifactType: "pre-restore-state",
        payloadBytes: 17,
      }),
    ]);
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
      expect(fs.readFileSync(path.join(outside, "secret"), "utf8")).toBe("secret");
    },
  );
});
