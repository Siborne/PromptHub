import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  publishRecoveryArtifact,
  type RecoveryArtifactManifestBase,
} from "../src/recovery-artifact-publication";

describe("recovery artifact publication", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(id = "artifact") {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-artifact-publication-"),
    );
    roots.push(root);
    const registryRoot = path.join(root, "recovery");
    const priorRoot = path.join(root, "prior");
    const artifactPath = path.join(registryRoot, id);
    const stagePath = path.join(registryRoot, `.${id}.preparing`);
    const manifest: RecoveryArtifactManifestBase = {
      kind: "storage-restore-recovery-artifact",
      id,
      operationId: id,
      artifactType: "pre-restore-state",
      sourceRoot: root,
      targetRoot: path.join(root, "target"),
      entries: ["data"],
      createdAt: "2026-08-12T00:00:00.000Z",
    };
    return {
      root,
      ownerRoot: root,
      registryRoot,
      priorRoot,
      artifactPath,
      stagePath,
      manifest,
    };
  }

  function writeManifest(
    directoryPath: string,
    manifest: RecoveryArtifactManifestBase,
    state: "preparing" | "complete",
    overrides: Record<string, unknown> = {},
  ): void {
    fs.mkdirSync(directoryPath, { recursive: true });
    fs.writeFileSync(
      path.join(directoryPath, "manifest.json"),
      JSON.stringify({
        formatVersion: 1,
        ...manifest,
        state,
        ...(state === "complete"
          ? { validatedAt: "2026-08-12T01:00:00.000Z" }
          : {}),
        ...overrides,
      }),
    );
  }

  it("publishes prior data atomically and treats the complete artifact as idempotent", () => {
    const value = fixture();
    fs.mkdirSync(value.priorRoot);
    fs.writeFileSync(path.join(value.priorRoot, "payload"), "before");

    expect(
      publishRecoveryArtifact({
        ...value,
        now: () => new Date("2026-08-12T01:00:00.000Z"),
      }),
    ).toBe(value.artifactPath);
    expect(
      fs.readFileSync(path.join(value.artifactPath, "root", "payload"), "utf8"),
    ).toBe("before");
    expect(
      JSON.parse(
        fs.readFileSync(path.join(value.artifactPath, "manifest.json"), "utf8"),
      ),
    ).toMatchObject({
      state: "complete",
      validatedAt: "2026-08-12T01:00:00.000Z",
    });

    expect(publishRecoveryArtifact(value)).toBe(value.artifactPath);
  });

  it("rejects artifact identities that can escape the managed registry", () => {
    const value = fixture("safe-id");

    for (const id of ["../outside", ".", ".."]) {
      expect(() =>
        publishRecoveryArtifact({
          ...value,
          manifest: { ...value.manifest, id },
        }),
      ).toThrow(/Invalid recovery artifact id/);
    }
  });

  it("creates an empty payload when no prior tree exists", () => {
    const value = fixture();

    publishRecoveryArtifact(value);

    expect(fs.readdirSync(path.join(value.artifactPath, "root"))).toEqual([]);
  });

  it("resumes preparing and legacy root-only artifacts", () => {
    const preparing = fixture("preparing");
    writeManifest(preparing.artifactPath, preparing.manifest, "preparing");
    fs.mkdirSync(preparing.priorRoot);
    fs.writeFileSync(path.join(preparing.priorRoot, "payload"), "prior");

    publishRecoveryArtifact(preparing);
    expect(
      fs.readFileSync(
        path.join(preparing.artifactPath, "root", "payload"),
        "utf8",
      ),
    ).toBe("prior");

    const legacy = fixture("legacy");
    fs.mkdirSync(path.join(legacy.artifactPath, "root"), { recursive: true });
    fs.writeFileSync(path.join(legacy.artifactPath, "root", "payload"), "old");

    publishRecoveryArtifact(legacy);
    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(legacy.artifactPath, "manifest.json"),
          "utf8",
        ),
      ),
    ).toMatchObject({ state: "complete", id: "legacy" });
  });

  it("resumes empty and owned preparation directories", () => {
    const empty = fixture("empty-stage");
    fs.mkdirSync(empty.stagePath, { recursive: true });
    publishRecoveryArtifact(empty);
    expect(fs.existsSync(empty.stagePath)).toBe(false);

    const prepared = fixture("prepared-stage");
    writeManifest(prepared.stagePath, prepared.manifest, "preparing");
    publishRecoveryArtifact(prepared);
    expect(fs.existsSync(prepared.stagePath)).toBe(false);
    expect(fs.existsSync(prepared.artifactPath)).toBe(true);
  });

  it("rejects ambiguous, unexpected, and unsafe payload trees", () => {
    const complete = fixture("complete-prior");
    writeManifest(complete.artifactPath, complete.manifest, "complete");
    fs.mkdirSync(path.join(complete.artifactPath, "root"));
    fs.mkdirSync(complete.priorRoot);
    expect(() => publishRecoveryArtifact(complete)).toThrow(
      /unexpected prior tree/,
    );

    const ambiguous = fixture("ambiguous");
    writeManifest(ambiguous.artifactPath, ambiguous.manifest, "preparing");
    fs.mkdirSync(path.join(ambiguous.artifactPath, "root"));
    fs.mkdirSync(ambiguous.priorRoot);
    expect(() => publishRecoveryArtifact(ambiguous)).toThrow(/ambiguous/);

    const unsafe = fixture("unsafe-root");
    writeManifest(unsafe.artifactPath, unsafe.manifest, "preparing");
    fs.writeFileSync(path.join(unsafe.artifactPath, "root"), "not-directory");
    expect(() => publishRecoveryArtifact(unsafe)).toThrow(/root is unsafe/);

    const completeUnsafe = fixture("complete-unsafe-root");
    writeManifest(
      completeUnsafe.artifactPath,
      completeUnsafe.manifest,
      "complete",
    );
    fs.writeFileSync(
      path.join(completeUnsafe.artifactPath, "root"),
      "not-directory",
    );
    expect(() => publishRecoveryArtifact(completeUnsafe)).toThrow(
      /root is unsafe/,
    );
  });

  it("rejects incomplete and unsafe artifact directory layouts", () => {
    const missingManifest = fixture("missing-manifest");
    fs.mkdirSync(missingManifest.artifactPath, { recursive: true });
    fs.writeFileSync(path.join(missingManifest.artifactPath, "unknown"), "x");
    expect(() => publishRecoveryArtifact(missingManifest)).toThrow(
      /already exists/,
    );

    const legacyUnsafe = fixture("legacy-unsafe");
    fs.mkdirSync(legacyUnsafe.artifactPath, { recursive: true });
    fs.writeFileSync(path.join(legacyUnsafe.artifactPath, "root"), "x");
    expect(() => publishRecoveryArtifact(legacyUnsafe)).toThrow(
      /root is unsafe/,
    );

    const manifestDirectory = fixture("manifest-directory");
    fs.mkdirSync(path.join(manifestDirectory.artifactPath, "manifest.json"), {
      recursive: true,
    });
    expect(() => publishRecoveryArtifact(manifestDirectory)).toThrow(
      /manifest is unsafe/,
    );

    const invalidJson = fixture("invalid-json");
    fs.mkdirSync(invalidJson.artifactPath, { recursive: true });
    fs.writeFileSync(path.join(invalidJson.artifactPath, "manifest.json"), "{");
    expect(() => publishRecoveryArtifact(invalidJson)).toThrow(
      /manifest is invalid/,
    );
  });

  it.skipIf(process.platform === "win32")(
    "rejects symlinked artifact and manifest paths",
    () => {
      const artifactLink = fixture("artifact-link");
      const outside = path.join(artifactLink.root, "outside");
      fs.mkdirSync(outside);
      fs.mkdirSync(artifactLink.registryRoot, { recursive: true });
      fs.symlinkSync(outside, artifactLink.artifactPath);
      expect(() => publishRecoveryArtifact(artifactLink)).toThrow(
        /directory is unsafe/,
      );

      const manifestLink = fixture("manifest-link");
      fs.mkdirSync(manifestLink.artifactPath, { recursive: true });
      const outsideManifest = path.join(manifestLink.root, "outside.json");
      fs.writeFileSync(outsideManifest, "{}");
      fs.symlinkSync(
        outsideManifest,
        path.join(manifestLink.artifactPath, "manifest.json"),
      );
      expect(() => publishRecoveryArtifact(manifestLink)).toThrow(
        /manifest is unsafe/,
      );
    },
  );

  it.skipIf(process.platform === "win32")(
    "rejects a symlinked registry ancestor without writing outside the owner",
    () => {
      const value = fixture("linked-registry-parent");
      const outside = fs.mkdtempSync(
        path.join(os.tmpdir(), "prompthub-artifact-outside-"),
      );
      roots.push(outside);
      fs.symlinkSync(outside, path.join(value.root, "backups"));

      expect(() =>
        publishRecoveryArtifact({
          ...value,
          registryRoot: path.join(value.root, "backups", "recovery"),
        }),
      ).toThrow(/Refusing symbolic link/);
      expect(fs.readdirSync(outside)).toEqual([]);
    },
  );

  it("rejects a registry outside its declared owner root", () => {
    const value = fixture("outside-owner");

    expect(() =>
      publishRecoveryArtifact({
        ...value,
        registryRoot: path.join(path.dirname(value.root), "outside-owner"),
      }),
    ).toThrow(/escapes its active root/);
  });

  it("rejects every conflicting manifest identity field and state", () => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ["primitive", { __raw: "null" }],
      ["array", { __raw: "[]" }],
      ["format", { formatVersion: 2 }],
      ["kind", { kind: "storage-root-recovery-artifact" }],
      ["id", { id: "different" }],
      ["operation", { operationId: "different" }],
      ["type", { artifactType: "different" }],
      ["source", { sourceRoot: "/different" }],
      ["target", { targetRoot: "/different" }],
      ["entries", { entries: ["config"] }],
      ["created", { createdAt: "2026-08-11T00:00:00.000Z" }],
      ["state", { state: "unknown" }],
      ["preparing-validated", { validatedAt: "2026-08-12T01:00:00.000Z" }],
    ];

    for (const [id, overrides] of cases) {
      const value = fixture(`conflict-${id}`);
      fs.mkdirSync(value.artifactPath, { recursive: true });
      const raw = overrides.__raw;
      fs.writeFileSync(
        path.join(value.artifactPath, "manifest.json"),
        typeof raw === "string"
          ? raw
          : JSON.stringify({
              formatVersion: 1,
              ...value.manifest,
              state: "preparing",
              ...overrides,
            }),
      );
      expect(() => publishRecoveryArtifact(value), id).toThrow(
        /already exists/,
      );
    }
  });

  it("rejects completed manifests without valid completion metadata", () => {
    for (const [id, validatedAt] of [
      ["missing", undefined],
      ["invalid", "not-a-date"],
    ] as const) {
      const value = fixture(`complete-${id}`);
      writeManifest(value.artifactPath, value.manifest, "complete", {
        validatedAt,
      });
      fs.mkdirSync(path.join(value.artifactPath, "root"));

      expect(() => publishRecoveryArtifact(value)).toThrow(/already exists/);
    }
  });

  it("rejects a completed preparation manifest", () => {
    const value = fixture("complete-stage");
    writeManifest(value.stagePath, value.manifest, "complete");

    expect(() => publishRecoveryArtifact(value)).toThrow(
      /preparation is invalid/,
    );
  });

  it("cleans preparation state when the first manifest write fails", () => {
    const value = fixture("write-failure");
    const originalWrite = fs.writeFileSync.bind(fs);
    vi.spyOn(fs, "writeFileSync").mockImplementation(
      (target, data, options) => {
        if (typeof target === "number") {
          throw new Error("manifest write failed");
        }
        return originalWrite(target, data, options as never);
      },
    );

    expect(() => publishRecoveryArtifact(value)).toThrow(
      "manifest write failed",
    );
    expect(fs.existsSync(value.stagePath)).toBe(false);
    expect(fs.existsSync(value.artifactPath)).toBe(false);
  });

  it("preserves a write failure when descriptor cleanup also reports failure", () => {
    const value = fixture("write-and-close-failure");
    const originalClose = fs.closeSync.bind(fs);
    vi.spyOn(fs, "writeFileSync").mockImplementation((target) => {
      if (typeof target === "number") throw new Error("manifest write failed");
    });
    vi.spyOn(fs, "closeSync").mockImplementation((descriptor) => {
      originalClose(descriptor);
      throw new Error("descriptor close failed");
    });

    expect(() => publishRecoveryArtifact(value)).toThrow(
      "manifest write failed",
    );
    expect(fs.existsSync(value.stagePath)).toBe(false);
  });

  it("tolerates unavailable directory fsync without hiding data failures", () => {
    const value = fixture("directory-fsync");
    const originalOpen = fs.openSync.bind(fs);
    vi.spyOn(fs, "openSync").mockImplementation((target, flags, mode) => {
      if (flags === "r") throw new Error("directory fsync unavailable");
      return originalOpen(target, flags, mode);
    });

    expect(publishRecoveryArtifact(value)).toBe(value.artifactPath);
  });
});
