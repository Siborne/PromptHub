import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RESOURCE_BUNDLE_KIND,
  RESOURCE_BUNDLE_MANIFEST_FILE,
  calculateResourceBundleContentHash,
  materializeResourceBundle,
  parseResourceBundleManifest,
  readResourceBundle,
  type ResourceBundleManifest,
} from "../src/resource-bundle";

const roots: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-bundle-"));
  roots.push(root);
  return root;
}

function writeSource(root: string, name: string, content: string): string {
  const sourcePath = path.join(root, "sources", name);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, content, "utf8");
  return sourcePath;
}

function createValidManifest(
  overrides: Partial<ResourceBundleManifest> = {},
): ResourceBundleManifest {
  const base: ResourceBundleManifest = {
    kind: RESOURCE_BUNDLE_KIND,
    manifestVersion: 1,
    resourceType: "prompt",
    resourceId: "prompt-1",
    schemaVersion: 1,
    revision: 1,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
    contentHash: "0".repeat(64),
    objectHashes: [],
    payloadFiles: [
      {
        path: "prompt.json",
        size: 3,
        sha256: "a".repeat(64),
      },
    ],
  };
  const manifest = { ...base, ...overrides };
  try {
    manifest.contentHash = calculateResourceBundleContentHash(manifest);
  } catch {
    // Invalid-shape tests must reach the production parser before hash checks.
  }
  return manifest;
}

function parseManifest(
  overrides: Partial<ResourceBundleManifest> = {},
  limits: Parameters<typeof parseResourceBundleManifest>[1] = {},
): ResourceBundleManifest {
  return parseResourceBundleManifest(
    `${JSON.stringify(createValidManifest(overrides))}\n`,
    limits,
  );
}

function cloneStatWithSize(stat: fs.Stats, size: number): fs.Stats {
  const clone = Object.assign(Object.create(Object.getPrototypeOf(stat)), stat);
  clone.size = size;
  return clone as fs.Stats;
}

function rewriteBundleManifest(
  bundlePath: string,
  update: (manifest: ResourceBundleManifest) => void,
): void {
  const manifestPath = path.join(bundlePath, RESOURCE_BUNDLE_MANIFEST_FILE);
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, "utf8"),
  ) as ResourceBundleManifest;
  update(manifest);
  manifest.contentHash = calculateResourceBundleContentHash(manifest);
  fs.writeFileSync(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

function mockPayloadLstat(
  payloadPath: string,
  change: (call: number, stat: fs.Stats) => fs.Stats,
) {
  const original = fs.lstatSync.bind(fs) as (target: fs.PathLike) => fs.Stats;
  let calls = 0;
  return vi.spyOn(fs, "lstatSync").mockImplementation(((
    target: fs.PathLike,
  ) => {
    const stat = original(target);
    if (String(target) !== payloadPath) return stat;
    calls += 1;
    return change(calls, stat);
  }) as typeof fs.lstatSync);
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("resource bundle", () => {
  it("materializes and verifies a deterministic self-describing bundle", () => {
    const root = createRoot();
    const bundlePath = path.join(root, "data", "prompts", "prompt-1");
    const promptSource = writeSource(root, "prompt.json", '{"title":"你好"}\n');
    const versionSource = writeSource(root, "version.json", '{"version":1}\n');

    const manifest = materializeResourceBundle({
      bundlePath,
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 4,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T01:00:00.000Z",
      provenance: { source: "sqlite-shadow-export" },
      objectHashes: ["b".repeat(64), "a".repeat(64), "b".repeat(64)],
      payloads: [
        {
          path: "versions/0001.json",
          sourcePath: versionSource,
          role: "version",
        },
        { path: "prompt.json", sourcePath: promptSource, role: "current" },
      ],
      extraFields: { futureMetadata: { retained: true } },
    });

    expect(manifest).toMatchObject({
      kind: RESOURCE_BUNDLE_KIND,
      manifestVersion: 1,
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 4,
      objectHashes: ["a".repeat(64), "b".repeat(64)],
      futureMetadata: { retained: true },
    });
    expect(manifest.payloadFiles.map((file) => file.path)).toEqual([
      "prompt.json",
      "versions/0001.json",
    ]);
    expect(manifest.contentHash).toBe(
      calculateResourceBundleContentHash(manifest),
    );

    const verified = readResourceBundle(bundlePath, {
      expectedResourceType: "prompt",
      expectedResourceId: "prompt-1",
    });
    expect(verified.manifest).toEqual(manifest);
    expect(verified.payloadFileCount).toBe(2);
    expect(verified.totalPayloadBytes).toBe(
      Buffer.byteLength('{"title":"你好"}\n') +
        Buffer.byteLength('{"version":1}\n'),
    );
    expect(fs.readFileSync(path.join(bundlePath, "prompt.json"), "utf8")).toBe(
      '{"title":"你好"}\n',
    );
  });

  it("preserves an existing destination and removes staging after a bounded write fails", () => {
    const root = createRoot();
    const existingPath = path.join(root, "data", "prompts", "prompt-1");
    fs.mkdirSync(existingPath, { recursive: true });
    fs.writeFileSync(path.join(existingPath, "keep.txt"), "keep", "utf8");
    const sourcePath = writeSource(root, "large.txt", "12345");

    expect(() =>
      materializeResourceBundle({
        bundlePath: existingPath,
        resourceType: "prompt",
        resourceId: "prompt-1",
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: "prompt.json", sourcePath }],
      }),
    ).toThrow(/already exists/u);

    const newPath = path.join(root, "data", "prompts", "prompt-2");
    expect(() =>
      materializeResourceBundle({
        bundlePath: newPath,
        resourceType: "prompt",
        resourceId: "prompt-2",
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: "prompt.json", sourcePath }],
        limits: { maxPayloadFileBytes: 4 },
      }),
    ).toThrow(/payload file byte limit/u);

    expect(fs.readFileSync(path.join(existingPath, "keep.txt"), "utf8")).toBe(
      "keep",
    );
    expect(fs.existsSync(newPath)).toBe(false);
    expect(
      fs
        .readdirSync(path.dirname(newPath))
        .filter((entry) => entry.includes(".prompt-2.stage-")),
    ).toEqual([]);
  });

  it.each([
    "../escape.json",
    "/absolute.json",
    "nested\\windows.json",
    "./prefixed.json",
    "nested//double.json",
    "control\u0000.json",
    "manifest.json",
  ])("rejects unsafe or non-normalized payload path %j", (payloadPath) => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "{}\n");

    expect(() =>
      materializeResourceBundle({
        bundlePath: path.join(root, "bundle"),
        resourceType: "prompt",
        resourceId: "prompt-1",
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: payloadPath, sourcePath }],
      }),
    ).toThrow(/payload path/u);
  });

  it("rejects duplicate payload paths and symlinked payload sources", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "{}\n");
    const symlinkPath = path.join(root, "sources", "linked.json");
    fs.symlinkSync(sourcePath, symlinkPath);

    const base = {
      bundlePath: path.join(root, "bundle"),
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    } as const;

    expect(() =>
      materializeResourceBundle({
        ...base,
        payloads: [
          { path: "prompt.json", sourcePath },
          { path: "prompt.json", sourcePath },
        ],
      }),
    ).toThrow(/duplicate payload path/u);
    expect(() =>
      materializeResourceBundle({
        ...base,
        payloads: [{ path: "prompt.json", sourcePath: symlinkPath }],
      }),
    ).toThrow(/regular file/u);
  });

  it("fails closed on undeclared, missing, modified, and symlinked bundle files", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "{}\n");
    const createBundle = (id: string): string => {
      const bundlePath = path.join(root, id);
      materializeResourceBundle({
        bundlePath,
        resourceType: "prompt",
        resourceId: id,
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: "prompt.json", sourcePath }],
      });
      return bundlePath;
    };

    const undeclared = createBundle("undeclared");
    fs.writeFileSync(path.join(undeclared, "extra.json"), "{}", "utf8");
    expect(() => readResourceBundle(undeclared)).toThrow(/undeclared/u);

    const missing = createBundle("missing");
    fs.unlinkSync(path.join(missing, "prompt.json"));
    expect(() => readResourceBundle(missing)).toThrow(/missing payload/u);

    const modified = createBundle("modified");
    fs.writeFileSync(path.join(modified, "prompt.json"), '{"changed":true}\n');
    expect(() => readResourceBundle(modified)).toThrow(
      /size mismatch|hash mismatch/u,
    );

    const linked = createBundle("linked");
    fs.unlinkSync(path.join(linked, "prompt.json"));
    fs.symlinkSync(sourcePath, path.join(linked, "prompt.json"));
    expect(() => readResourceBundle(linked)).toThrow(/regular file/u);
  });

  it("rejects tampered aggregate hashes, newer manifest versions, and identity mismatch", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "{}\n");
    const bundlePath = path.join(root, "bundle");
    materializeResourceBundle({
      bundlePath,
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      payloads: [{ path: "prompt.json", sourcePath }],
    });

    expect(() =>
      readResourceBundle(bundlePath, { expectedResourceId: "prompt-2" }),
    ).toThrow(/resource identity/u);

    const manifestPath = path.join(bundlePath, RESOURCE_BUNDLE_MANIFEST_FILE);
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8"),
    ) as ResourceBundleManifest;
    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify({ ...manifest, contentHash: "0".repeat(64) }, null, 2)}\n`,
      "utf8",
    );
    expect(() => readResourceBundle(bundlePath)).toThrow(
      /content hash mismatch/u,
    );

    fs.writeFileSync(
      manifestPath,
      `${JSON.stringify({ ...manifest, manifestVersion: 2 }, null, 2)}\n`,
      "utf8",
    );
    expect(() => readResourceBundle(bundlePath)).toThrow(/manifest version/u);
  });

  it("enforces manifest, entry, path, and total-byte limits", () => {
    const root = createRoot();
    const first = writeSource(root, "first.json", "1234");
    const second = writeSource(root, "second.json", "5678");
    const input = {
      bundlePath: path.join(root, "bundle"),
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      payloads: [
        { path: "first.json", sourcePath: first },
        { path: "second.json", sourcePath: second },
      ],
    } as const;

    expect(() =>
      materializeResourceBundle({
        ...input,
        limits: { maxPayloadFiles: 1 },
      }),
    ).toThrow(/payload file count/u);
    expect(() =>
      materializeResourceBundle({
        ...input,
        limits: { maxTotalPayloadBytes: 7 },
      }),
    ).toThrow(/total payload byte limit/u);
    expect(() =>
      materializeResourceBundle({
        ...input,
        limits: { maxRelativePathBytes: 5 },
      }),
    ).toThrow(/payload path byte limit/u);
    expect(() =>
      materializeResourceBundle({
        ...input,
        limits: { maxManifestBytes: 10 },
      }),
    ).toThrow(/manifest byte limit/u);
  });

  it("validates manifest identity, versions, timestamps, and hash fields", () => {
    const cases: Array<[Partial<ResourceBundleManifest>, RegExp]> = [
      [{ kind: "other" as typeof RESOURCE_BUNDLE_KIND }, /kind/u],
      [{ resourceType: "Prompt" }, /resourceType/u],
      [{ resourceId: "" }, /resourceId/u],
      [{ resourceId: "." }, /resourceId/u],
      [{ resourceId: ".." }, /resourceId/u],
      [{ resourceId: "bad/id" }, /resourceId/u],
      [{ resourceId: "x".repeat(257) }, /resourceId/u],
      [{ schemaVersion: 0 }, /schemaVersion/u],
      [{ revision: Number.NaN }, /revision/u],
      [{ createdAt: "not-a-date" }, /createdAt/u],
      [{ updatedAt: "2026-08-11T08:00:00+08:00" }, /updatedAt/u],
      [{ objectHashes: ["A".repeat(64)] }, /SHA-256/u],
      [
        { objectHashes: ["b".repeat(64), "a".repeat(64)] },
        /unique and sorted/u,
      ],
      [
        { objectHashes: ["a".repeat(64), "a".repeat(64)] },
        /unique and sorted/u,
      ],
    ];
    for (const [overrides, message] of cases) {
      expect(() => parseManifest(overrides)).toThrow(message);
    }
    expect(() => parseResourceBundleManifest("[]")).toThrow(/object/u);
    expect(() => parseResourceBundleManifest("{")).toThrow(/invalid JSON/u);
    expect(() => parseManifest({}, { maxManifestBytes: 10 })).toThrow(
      /manifest byte limit/u,
    );
    expect(() => parseManifest({}, { maxPayloadFiles: 0 })).toThrow(
      /positive safe integer/u,
    );
  });

  it("validates declared payload metadata and aggregate limits", () => {
    const baseFile = createValidManifest().payloadFiles[0];
    const invalidFiles: Array<[unknown, RegExp]> = [
      [null, /must be an object/u],
      [{ ...baseFile, path: "" }, /payload path/u],
      [{ ...baseFile, size: -1 }, /payload size/u],
      [{ ...baseFile, sha256: "invalid" }, /payload sha256/u],
      [{ ...baseFile, role: "" }, /payload role/u],
      [{ ...baseFile, role: "x".repeat(65) }, /payload role/u],
      [{ ...baseFile, role: "bad\u0000role" }, /payload role/u],
    ];
    for (const [file, message] of invalidFiles) {
      expect(() =>
        parseManifest({
          payloadFiles: [file] as ResourceBundleManifest["payloadFiles"],
        }),
      ).toThrow(message);
    }
    expect(() => parseManifest({ payloadFiles: [] })).toThrow(/at least one/u);
    expect(() =>
      parseManifest({ payloadFiles: "bad" as unknown as [] }),
    ).toThrow(/must be an array/u);
    expect(() =>
      parseManifest(
        { payloadFiles: [baseFile, { ...baseFile }] },
        { maxPayloadFiles: 1 },
      ),
    ).toThrow(/file count/u);
    expect(() =>
      parseManifest(
        { payloadFiles: [{ ...baseFile, size: 4 }] },
        { maxPayloadFileBytes: 3 },
      ),
    ).toThrow(/file byte limit/u);
    expect(() =>
      parseManifest({ payloadFiles: [baseFile, { ...baseFile }] }),
    ).toThrow(/duplicate payload path/u);
    expect(() =>
      parseManifest(
        {
          payloadFiles: [
            baseFile,
            { ...baseFile, path: "second.json", size: 3 },
          ],
        },
        { maxTotalPayloadBytes: 5 },
      ),
    ).toThrow(/total payload byte limit/u);
    expect(() =>
      parseManifest({
        provenance: "bad" as unknown as Record<string, unknown>,
      }),
    ).toThrow(/provenance/u);
    expect(() =>
      parseResourceBundleManifest(
        JSON.stringify({ ...createValidManifest(), objectHashes: null }),
      ),
    ).toThrow(/objectHashes/u);
  });

  it("rejects invalid materialization metadata without publishing a bundle", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "{}\n");
    const base = {
      bundlePath: path.join(root, "bundle"),
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      payloads: [{ path: "prompt.json", sourcePath }],
    } as const;
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(() => materializeResourceBundle({ ...base, payloads: [] })).toThrow(
      /at least one/u,
    );
    expect(() =>
      materializeResourceBundle({ ...base, resourceType: "Prompt" }),
    ).toThrow(/resourceType/u);
    expect(() =>
      materializeResourceBundle({ ...base, extraFields: { revision: 2 } }),
    ).toThrow(/reserved/u);
    expect(() =>
      materializeResourceBundle({ ...base, extraFields: circular }),
    ).toThrow(/JSON serializable/u);
    expect(() =>
      materializeResourceBundle({
        ...base,
        provenance: "bad" as unknown as Record<string, unknown>,
      }),
    ).toThrow(/provenance/u);
    expect(() =>
      materializeResourceBundle({ ...base, objectHashes: ["bad"] }),
    ).toThrow(/SHA-256/u);
    expect(fs.existsSync(base.bundlePath)).toBe(false);
  });

  it("rejects missing source and invalid bundle root or manifest states", () => {
    const root = createRoot();
    const missingSource = path.join(root, "missing.json");
    const input = {
      bundlePath: path.join(root, "bundle"),
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      payloads: [{ path: "prompt.json", sourcePath: missingSource }],
    } as const;
    expect(() => materializeResourceBundle(input)).toThrow(/not readable/u);
    fs.mkdirSync(missingSource);
    expect(() => materializeResourceBundle(input)).toThrow(/regular file/u);

    expect(() => readResourceBundle(path.join(root, "missing-bundle"))).toThrow(
      /directory is missing/u,
    );
    const fileRoot = path.join(root, "file-root");
    fs.writeFileSync(fileRoot, "x", "utf8");
    expect(() => readResourceBundle(fileRoot)).toThrow(/regular directory/u);
    const linkedRoot = path.join(root, "linked-root");
    fs.symlinkSync(root, linkedRoot);
    expect(() => readResourceBundle(linkedRoot)).toThrow(/regular directory/u);

    const noManifest = path.join(root, "no-manifest");
    fs.mkdirSync(noManifest);
    expect(() => readResourceBundle(noManifest)).toThrow(
      /manifest is missing/u,
    );
    const directoryManifest = path.join(root, "directory-manifest");
    fs.mkdirSync(path.join(directoryManifest, RESOURCE_BUNDLE_MANIFEST_FILE), {
      recursive: true,
    });
    expect(() => readResourceBundle(directoryManifest)).toThrow(
      /regular file/u,
    );
  });

  it("rejects manifest symlinks, oversized manifests, undeclared directories, and same-size tampering", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "abc");
    const createBundle = (id: string): string => {
      const bundlePath = path.join(root, id);
      materializeResourceBundle({
        bundlePath,
        resourceType: "prompt",
        resourceId: id,
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: "prompt.json", sourcePath }],
      });
      return bundlePath;
    };

    const linkedManifest = createBundle("linked-manifest");
    const manifestPath = path.join(
      linkedManifest,
      RESOURCE_BUNDLE_MANIFEST_FILE,
    );
    const manifestCopy = path.join(root, "manifest-copy.json");
    fs.copyFileSync(manifestPath, manifestCopy);
    fs.unlinkSync(manifestPath);
    fs.symlinkSync(manifestCopy, manifestPath);
    expect(() => readResourceBundle(linkedManifest)).toThrow(/regular file/u);

    const oversized = createBundle("oversized");
    expect(() =>
      readResourceBundle(oversized, { limits: { maxManifestBytes: 10 } }),
    ).toThrow(/manifest byte limit/u);

    const undeclaredDirectory = createBundle("undeclared-directory");
    fs.mkdirSync(path.join(undeclaredDirectory, "extra"));
    expect(() => readResourceBundle(undeclaredDirectory)).toThrow(
      /undeclared directory/u,
    );

    const sameSize = createBundle("same-size");
    fs.writeFileSync(path.join(sameSize, "prompt.json"), "xyz", "utf8");
    expect(() => readResourceBundle(sameSize)).toThrow(/hash mismatch/u);
    expect(() =>
      readResourceBundle(createBundle("wrong-type"), {
        expectedResourceType: "skill",
      }),
    ).toThrow(/resource identity/u);
  });

  it("fails closed when a payload changes size between inventory and copy", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "1234");
    const base = {
      bundlePath: path.join(root, "bundle"),
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      payloads: [{ path: "prompt.json", sourcePath }],
    } as const;
    const actualStat = fs.lstatSync(sourcePath);

    vi.spyOn(fs, "lstatSync").mockReturnValueOnce(
      cloneStatWithSize(actualStat, 3),
    );
    expect(() =>
      materializeResourceBundle({
        ...base,
        limits: { maxPayloadFileBytes: 3 },
      }),
    ).toThrow(/file byte limit/u);
    vi.restoreAllMocks();

    vi.spyOn(fs, "lstatSync").mockReturnValueOnce(
      cloneStatWithSize(actualStat, 3),
    );
    expect(() => materializeResourceBundle(base)).toThrow(
      /changed while copying/u,
    );
    expect(fs.existsSync(base.bundlePath)).toBe(false);
  });

  it("closes the source and refuses publication when the opened source is not regular", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "{}\n");
    const directoryStat = fs.statSync(root);
    vi.spyOn(fs, "fstatSync").mockReturnValueOnce(directoryStat);

    expect(() =>
      materializeResourceBundle({
        bundlePath: path.join(root, "bundle"),
        resourceType: "prompt",
        resourceId: "prompt-1",
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: "prompt.json", sourcePath }],
      }),
    ).toThrow(/regular file/u);
  });

  it("preserves a concurrently-created destination and tolerates unsupported directory fsync", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "{}\n");
    const input = {
      bundlePath: path.join(root, "bundle"),
      resourceType: "prompt",
      resourceId: "prompt-1",
      schemaVersion: 1,
      revision: 1,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
      payloads: [{ path: "prompt.json", sourcePath }],
    } as const;
    vi.spyOn(fs, "existsSync")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    expect(() => materializeResourceBundle(input)).toThrow(/already exists/u);
    vi.restoreAllMocks();

    const originalFsync = fs.fsyncSync.bind(fs);
    vi.spyOn(fs, "fsyncSync").mockImplementation((descriptor) => {
      if (fs.fstatSync(descriptor).isDirectory()) {
        throw new Error("directory fsync unsupported");
      }
      originalFsync(descriptor);
    });
    const manifest = materializeResourceBundle(input);
    expect(readResourceBundle(input.bundlePath).manifest).toEqual(manifest);
  });

  it("fails closed for special entries and post-inventory payload races", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "abc");
    const createBundle = (id: string): string => {
      const bundlePath = path.join(root, id);
      materializeResourceBundle({
        bundlePath,
        resourceType: "prompt",
        resourceId: id,
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: "prompt.json", sourcePath }],
      });
      return bundlePath;
    };

    const special = createBundle("special");
    const specialPayload = path.join(special, "prompt.json");
    mockPayloadLstat(
      specialPayload,
      () =>
        ({
          isSymbolicLink: () => false,
          isDirectory: () => false,
          isFile: () => false,
        }) as fs.Stats,
    );
    expect(() => readResourceBundle(special)).toThrow(
      /regular file or directory/u,
    );
    vi.restoreAllMocks();

    const missing = createBundle("race-missing");
    const missingPayload = path.join(missing, "prompt.json");
    const originalLstat = fs.lstatSync.bind(fs);
    let missingCalls = 0;
    vi.spyOn(fs, "lstatSync").mockImplementation(((target: fs.PathLike) => {
      if (String(target) === missingPayload && ++missingCalls === 2) {
        throw new Error("removed after inventory");
      }
      return originalLstat(target) as fs.Stats;
    }) as typeof fs.lstatSync);
    expect(() => readResourceBundle(missing)).toThrow(/missing payload/u);
    vi.restoreAllMocks();

    const linked = createBundle("race-linked");
    const linkedPayload = path.join(linked, "prompt.json");
    const linkTarget = writeSource(root, "link-target.json", "abc");
    const linkPath = path.join(root, "link.json");
    fs.symlinkSync(linkTarget, linkPath);
    const symlinkStat = fs.lstatSync(linkPath);
    mockPayloadLstat(linkedPayload, (call, stat) =>
      call === 2 ? symlinkStat : stat,
    );
    expect(() => readResourceBundle(linked)).toThrow(/regular file/u);
  });

  it("detects post-inventory size growth, truncation, and non-file descriptor races", () => {
    const root = createRoot();
    const sourcePath = writeSource(root, "prompt.json", "abc");
    const createBundle = (id: string): string => {
      const bundlePath = path.join(root, id);
      materializeResourceBundle({
        bundlePath,
        resourceType: "prompt",
        resourceId: id,
        schemaVersion: 1,
        revision: 1,
        createdAt: "2026-08-11T00:00:00.000Z",
        updatedAt: "2026-08-11T00:00:00.000Z",
        payloads: [{ path: "prompt.json", sourcePath }],
      });
      return bundlePath;
    };

    const grown = createBundle("grown");
    fs.writeFileSync(path.join(grown, "prompt.json"), "abcd", "utf8");
    rewriteBundleManifest(grown, (manifest) => {
      manifest.payloadFiles[0].size = 3;
    });
    mockPayloadLstat(path.join(grown, "prompt.json"), (_call, stat) =>
      cloneStatWithSize(stat, 3),
    );
    expect(() => readResourceBundle(grown)).toThrow(/file byte limit/u);
    vi.restoreAllMocks();

    const truncated = createBundle("truncated");
    rewriteBundleManifest(truncated, (manifest) => {
      manifest.payloadFiles[0].size = 4;
    });
    mockPayloadLstat(path.join(truncated, "prompt.json"), (_call, stat) =>
      cloneStatWithSize(stat, 4),
    );
    expect(() => readResourceBundle(truncated)).toThrow(/size mismatch/u);
    vi.restoreAllMocks();

    const nonFile = createBundle("non-file-fd");
    vi.spyOn(fs, "fstatSync").mockReturnValueOnce(fs.statSync(root));
    expect(() => readResourceBundle(nonFile)).toThrow(/regular file/u);
  });
});
