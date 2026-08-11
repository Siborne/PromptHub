import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPortableSnapshot,
  readPortableSnapshot,
} from "../src/portable-snapshot";

describe("portable snapshot", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(): { root: string; destination: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-portable-"));
    roots.push(root);
    fs.mkdirSync(path.join(root, "data", "prompts", "p1"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "data", "skills", "s1"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "data", "prompts", "p1", "prompt.json"),
      "prompt",
    );
    fs.writeFileSync(
      path.join(root, "data", "skills", "s1", "SKILL.md"),
      "skill",
    );
    fs.mkdirSync(path.join(root, "secrets"));
    fs.writeFileSync(path.join(root, "secrets", "vault.enc"), "secret");
    return {
      root,
      destination: path.join(path.dirname(root), `${path.basename(root)}-out`),
    };
  }

  function promptScope(root: string) {
    return {
      id: "prompts",
      sourcePath: path.join(root, "data", "prompts"),
      archivePath: "data/prompts",
    };
  }

  function readManifest(destination: string): Record<string, any> {
    return JSON.parse(
      fs.readFileSync(path.join(destination, "portable-manifest.json"), "utf8"),
    );
  }

  function writeManifest(
    destination: string,
    manifest: Record<string, any>,
  ): void {
    fs.writeFileSync(
      path.join(destination, "portable-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
  }

  function createPromptSnapshot(operationId = "read-fixture") {
    const value = fixture();
    roots.push(value.destination);
    createPortableSnapshot({
      sourceRoot: value.root,
      destinationPath: value.destination,
      scopes: [promptScope(value.root)],
      operationId,
    });
    return value;
  }

  it("reads only selected scopes and publishes a versioned verified envelope", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    const result = createPortableSnapshot({
      sourceRoot: root,
      destinationPath: destination,
      scopes: [
        {
          id: "prompts",
          sourcePath: path.join(root, "data", "prompts"),
          archivePath: "data/prompts",
        },
      ],
      generatedFiles: [
        {
          archivePath: "config/app.json",
          content: Buffer.from('{"theme":"dark"}\n'),
          scope: "configuration",
        },
      ],
      omissions: ["secrets", "skills"],
      operationId: "snapshot-1",
      now: new Date("2026-08-11T00:00:00.000Z"),
    });

    expect(result.manifest).toMatchObject({
      kind: "prompthub-portable-snapshot",
      formatVersion: 1,
      consistencyId: expect.stringMatching(/^[a-f0-9]{64}$/),
      scopes: ["configuration", "prompts"],
      omissions: ["secrets", "skills"],
    });
    expect(
      fs.existsSync(
        path.join(destination, "data", "prompts", "p1", "prompt.json"),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(destination, "data", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(destination, "secrets"))).toBe(false);
    expect(readPortableSnapshot(destination).manifest.consistencyId).toBe(
      result.manifest.consistencyId,
    );
  });

  it("fails without publishing when a selected source mutates during copy", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [
          {
            id: "prompts",
            sourcePath: path.join(root, "data", "prompts"),
            archivePath: "data/prompts",
          },
        ],
        operationId: "snapshot-race",
        afterFileCopied: ({ sourcePath }) => {
          fs.appendFileSync(sourcePath, "changed");
        },
      }),
    ).toThrow("changed during snapshot");
    expect(fs.existsSync(destination)).toBe(false);
  });

  it.skipIf(process.platform === "win32")(
    "rejects traversal and symlinked selected content",
    () => {
      const { root, destination } = fixture();
      roots.push(destination);
      fs.symlinkSync(
        path.join(root, "secrets", "vault.enc"),
        path.join(root, "data", "prompts", "linked"),
      );
      expect(() =>
        createPortableSnapshot({
          sourceRoot: root,
          destinationPath: destination,
          scopes: [
            {
              id: "prompts",
              sourcePath: path.join(root, "data", "prompts"),
              archivePath: "../escape",
            },
          ],
        }),
      ).toThrow(/archive path|symbolic link/i);
      expect(fs.existsSync(destination)).toBe(false);
    },
  );

  it("creates a generated-only snapshot with defaults and declared empty scopes", () => {
    const { root, destination } = fixture();
    roots.push(destination);

    const result = createPortableSnapshot({
      sourceRoot: root,
      destinationPath: destination,
      scopes: [],
      declaredScopes: ["settings"],
      generatedFiles: [
        { archivePath: "config/settings.json", content: Buffer.from("{}\n") },
      ],
    });

    expect(result.manifest.operationId).toMatch(/^[a-f0-9-]{36}$/);
    expect(result.manifest.scopes).toEqual(["configuration", "settings"]);
    expect(result.manifest.omissions).toEqual([]);
    expect(readPortableSnapshot(destination).manifest).toEqual(result.manifest);
  });

  it("allows the active root itself as an explicitly selected source", () => {
    const { root, destination } = fixture();
    roots.push(destination);

    expect(
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [{ id: "all", sourcePath: root, archivePath: "root" }],
        operationId: "whole-root",
      }).manifest.entryCount,
    ).toBe(3);
  });

  it("rejects invalid limits, operation ids, scope ids, and archive paths", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [],
        limits: { maxEntries: 0 },
      }),
    ).toThrow(/positive safe integer/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [],
        operationId: "invalid/id",
      }),
    ).toThrow(/Invalid portable snapshot operation id/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [{ ...promptScope(root), id: "invalid/id" }],
      }),
    ).toThrow(/Invalid portable snapshot scope id/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [{ ...promptScope(root), archivePath: "data\\prompts" }],
      }),
    ).toThrow(/Invalid portable snapshot archive path/);
  });

  it("rejects sources outside the active root and symbolic-link path segments", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    const outside = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-outside-"),
    );
    roots.push(outside);
    fs.writeFileSync(path.join(outside, "payload"), "outside");
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [
          { id: "outside", sourcePath: outside, archivePath: "data/outside" },
        ],
      }),
    ).toThrow(/escapes active root/);

    if (process.platform !== "win32") {
      const linkedDirectory = path.join(root, "data", "linked-directory");
      fs.symlinkSync(outside, linkedDirectory);
      expect(() =>
        createPortableSnapshot({
          sourceRoot: root,
          destinationPath: destination,
          scopes: [
            {
              id: "linked",
              sourcePath: linkedDirectory,
              archivePath: "data/linked",
            },
          ],
        }),
      ).toThrow(/contains symbolic link/);
    }
  });

  it("enforces source depth, file, byte, entry, scope, and archive uniqueness", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    const prompts = path.join(root, "data", "prompts");
    fs.writeFileSync(path.join(prompts, "second.json"), "second");
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
        limits: { maxDepth: 1 },
      }),
    ).toThrow(/maxDepth/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
        limits: { maxFileBytes: 2 },
      }),
    ).toThrow(/maxFileBytes/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
        limits: { maxBytes: 2 },
      }),
    ).toThrow(/maxBytes/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
        limits: { maxEntries: 1 },
      }),
    ).toThrow(/maxEntries/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root), promptScope(root)],
      }),
    ).toThrow(/Duplicate portable snapshot scope/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [
          promptScope(root),
          { ...promptScope(root), id: "duplicate-path" },
        ],
      }),
    ).toThrow(/Duplicate portable snapshot archive path/);
  });

  it("rejects a special source file and a source changed before copy", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    const sourcePath = path.join(root, "data", "prompts", "p1", "prompt.json");
    const originalLstat = fs.lstatSync.bind(fs);
    let sourceReads = 0;
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      const stats = originalLstat(target, options as never);
      if (path.resolve(String(target)) !== sourcePath) return stats;
      sourceReads += 1;
      if (sourceReads < 2) return stats;
      return Object.assign(Object.create(stats), {
        isFile: () => false,
        isDirectory: () => false,
      });
    });
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
      }),
    ).toThrow(/not a regular file/);

    vi.restoreAllMocks();
    sourceReads = 0;
    vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
      const stats = originalLstat(target, options as never);
      if (path.resolve(String(target)) !== sourcePath) return stats;
      sourceReads += 1;
      if (sourceReads < 3) return stats;
      return Object.assign(Object.create(stats), { size: stats.size + 1 });
    });
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
      }),
    ).toThrow(/changed before copy/);
  });

  it("rejects duplicate, oversized, and over-budget generated files", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    const duplicate = {
      archivePath: "config/generated.json",
      content: Buffer.from("{}"),
    };
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [],
        generatedFiles: [duplicate, duplicate],
      }),
    ).toThrow(/Invalid generated portable snapshot file/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
        generatedFiles: [
          {
            archivePath: "data/prompts/p1/prompt.json",
            content: Buffer.from("duplicate"),
          },
        ],
      }),
    ).toThrow(/Invalid generated portable snapshot file/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [],
        generatedFiles: [
          {
            archivePath: "config/large.bin",
            content: Buffer.alloc(16 * 1024 * 1024 + 1),
          },
        ],
      }),
    ).toThrow(/Invalid generated portable snapshot file/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
        generatedFiles: [duplicate],
        limits: { maxEntries: 1 },
      }),
    ).toThrow(/maxEntries/);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [],
        generatedFiles: [duplicate],
        limits: { maxBytes: 1 },
      }),
    ).toThrow(/maxBytes/);
  });

  it("rejects existing destinations and operation stages", () => {
    const { root, destination } = fixture();
    fs.mkdirSync(destination);
    roots.push(destination);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [],
      }),
    ).toThrow(/destination already exists/);

    fs.rmSync(destination, { recursive: true });
    const stagePath = `${destination}.stage-stage-exists`;
    fs.mkdirSync(stagePath);
    roots.push(stagePath);
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [],
        operationId: "stage-exists",
      }),
    ).toThrow(/stage already exists/);
  });

  it("detects selected inventory additions after copying and cleans its stage", () => {
    const { root, destination } = fixture();
    roots.push(destination);
    let added = false;
    expect(() =>
      createPortableSnapshot({
        sourceRoot: root,
        destinationPath: destination,
        scopes: [promptScope(root)],
        operationId: "inventory-race",
        afterFileCopied: () => {
          if (added) return;
          added = true;
          fs.writeFileSync(
            path.join(root, "data", "prompts", "added.json"),
            "added",
          );
        },
      }),
    ).toThrow(/selected inventory changed/);
    expect(fs.existsSync(`${destination}.stage-inventory-race`)).toBe(false);
  });

  it("rejects invalid read limits, roots, and manifest paths", () => {
    const { root, destination } = createPromptSnapshot("read-root-validation");
    expect(() => readPortableSnapshot(destination, { maxDepth: 0 })).toThrow(
      /positive safe integer/,
    );
    const fileRoot = path.join(root, "snapshot-file");
    fs.writeFileSync(fileRoot, "not-a-directory");
    expect(() => readPortableSnapshot(fileRoot)).toThrow(
      /Invalid portable snapshot root/,
    );

    const manifestPath = path.join(destination, "portable-manifest.json");
    fs.rmSync(manifestPath);
    fs.mkdirSync(manifestPath);
    expect(() => readPortableSnapshot(destination)).toThrow(
      /Invalid portable snapshot manifest/,
    );
  });

  it.skipIf(process.platform === "win32")(
    "rejects symlinked snapshot roots and manifests",
    () => {
      const { root, destination } = createPromptSnapshot(
        "read-symlink-validation",
      );
      const rootLink = path.join(root, "snapshot-link");
      fs.symlinkSync(destination, rootLink);
      expect(() => readPortableSnapshot(rootLink)).toThrow(
        /Invalid portable snapshot root/,
      );

      const manifestPath = path.join(destination, "portable-manifest.json");
      const outside = path.join(root, "outside-manifest.json");
      fs.copyFileSync(manifestPath, outside);
      fs.rmSync(manifestPath);
      fs.symlinkSync(outside, manifestPath);
      expect(() => readPortableSnapshot(destination)).toThrow(
        /Invalid portable snapshot manifest/,
      );
    },
  );

  it("rejects oversized and malformed manifests", () => {
    const oversized = createPromptSnapshot("read-oversized-manifest");
    fs.writeFileSync(
      path.join(oversized.destination, "portable-manifest.json"),
      Buffer.alloc(16 * 1024 * 1024 + 1),
    );
    expect(() => readPortableSnapshot(oversized.destination)).toThrow(
      /manifest exceeds size limit/,
    );

    const malformed = createPromptSnapshot("read-malformed-manifest");
    writeManifest(malformed.destination, {});
    expect(() => readPortableSnapshot(malformed.destination)).toThrow(
      /Invalid portable snapshot manifest/,
    );
  });

  it("rejects unsafe and invalid manifest entries", () => {
    const unsafe = createPromptSnapshot("read-unsafe-entry");
    const unsafeManifest = readManifest(unsafe.destination);
    unsafeManifest.entries[0].path = "../escape";
    writeManifest(unsafe.destination, unsafeManifest);
    expect(() => readPortableSnapshot(unsafe.destination)).toThrow(
      /Invalid portable snapshot archive path/,
    );

    const invalid = createPromptSnapshot("read-invalid-entry");
    const invalidManifest = readManifest(invalid.destination);
    invalidManifest.entries[0].scope = 42;
    writeManifest(invalid.destination, invalidManifest);
    expect(() => readPortableSnapshot(invalid.destination)).toThrow(
      /Invalid portable snapshot entry/,
    );

    const duplicate = createPromptSnapshot("read-duplicate-entry");
    const duplicateManifest = readManifest(duplicate.destination);
    duplicateManifest.entries.push({ ...duplicateManifest.entries[0] });
    duplicateManifest.entryCount += 1;
    duplicateManifest.totalBytes += duplicateManifest.entries[0].sizeBytes;
    writeManifest(duplicate.destination, duplicateManifest);
    expect(() => readPortableSnapshot(duplicate.destination)).toThrow(
      /Invalid portable snapshot entry/,
    );
  });

  it("rejects a missing, modified, or symlinked declared payload", () => {
    const missing = createPromptSnapshot("read-missing-payload");
    const missingManifest = readManifest(missing.destination);
    fs.rmSync(
      path.join(
        missing.destination,
        ...missingManifest.entries[0].path.split("/"),
      ),
    );
    expect(() => readPortableSnapshot(missing.destination)).toThrow();

    const modified = createPromptSnapshot("read-modified-payload");
    const modifiedManifest = readManifest(modified.destination);
    fs.appendFileSync(
      path.join(
        modified.destination,
        ...modifiedManifest.entries[0].path.split("/"),
      ),
      "tampered",
    );
    expect(() => readPortableSnapshot(modified.destination)).toThrow(
      /entry verification failed/,
    );

    if (process.platform !== "win32") {
      const linked = createPromptSnapshot("read-linked-payload");
      const linkedManifest = readManifest(linked.destination);
      const payloadPath = path.join(
        linked.destination,
        ...linkedManifest.entries[0].path.split("/"),
      );
      const outside = path.join(linked.root, "outside-payload");
      fs.writeFileSync(outside, "prompt");
      fs.rmSync(payloadPath);
      fs.symlinkSync(outside, payloadPath);
      expect(() => readPortableSnapshot(linked.destination)).toThrow(
        /entry verification failed/,
      );
    }
  });

  it.each(["entryCount", "totalBytes", "consistencyId"])(
    "rejects a mismatched %s consistency field",
    (field) => {
      const value = createPromptSnapshot(`read-consistency-${field}`);
      const manifest = readManifest(value.destination);
      if (field === "consistencyId") manifest.consistencyId = "0".repeat(64);
      else manifest[field] += 1;
      writeManifest(value.destination, manifest);

      expect(() => readPortableSnapshot(value.destination)).toThrow(
        /consistency verification failed/,
      );
    },
  );

  it("rejects undeclared, symbolic-link, deep, and over-count archive entries", () => {
    const undeclared = createPromptSnapshot("read-undeclared");
    fs.writeFileSync(
      path.join(undeclared.destination, "undeclared.txt"),
      "extra",
    );
    expect(() => readPortableSnapshot(undeclared.destination)).toThrow(
      /contains undeclared entry/,
    );

    if (process.platform !== "win32") {
      const linked = createPromptSnapshot("read-undeclared-link");
      fs.symlinkSync(linked.root, path.join(linked.destination, "linked"));
      expect(() => readPortableSnapshot(linked.destination)).toThrow(
        /contains symbolic link/,
      );
    }

    const deep = createPromptSnapshot("read-depth");
    expect(() =>
      readPortableSnapshot(deep.destination, { maxDepth: 1 }),
    ).toThrow(/exceeds depth limit/);

    const counted = createPromptSnapshot("read-count");
    expect(() =>
      readPortableSnapshot(counted.destination, { maxEntries: 1 }),
    ).toThrow(/exceeds entry limit/);
  });
});
