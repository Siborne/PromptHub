import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  convertResourceBundleSchema,
  recoverResourceBundlePublication,
} from "../src/resource-schema-conversion";
import {
  materializeResourceBundle,
  readResourceBundle,
} from "../src/resource-bundle";
import { ResourceSchemaRegistry } from "../src/resource-schema-registry";

describe("resource schema conversion", () => {
  const roots: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(
    schemaVersion = 1,
    options: { content?: string; role?: string | null } = {},
  ) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-resource-conversion-"),
    );
    roots.push(root);
    const sourcePath = path.join(root, "workflow.json");
    fs.writeFileSync(
      sourcePath,
      options.content ??
        `${JSON.stringify({
          kind: "workflow",
          schemaVersion,
          name: "Daily",
          extension: { color: "green" },
        })}\n`,
    );
    const bundlePath = path.join(root, "data", "workflows", "workflow-1");
    materializeResourceBundle({
      bundlePath,
      resourceType: "workflow",
      resourceId: "workflow-1",
      schemaVersion,
      revision: 7,
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
      extraFields: { extensionManifest: { owner: "test" } },
      payloads: [
        {
          path: "workflow.json",
          sourcePath,
          role: options.role === null ? undefined : (options.role ?? "current"),
        },
      ],
    });
    return { root, bundlePath };
  }

  function registry() {
    return new ResourceSchemaRegistry([
      {
        resourceType: "workflow",
        currentVersion: 2,
        converters: [
          {
            fromVersion: 1,
            toVersion: 2,
            convert: (document) => ({
              ...document,
              title: document.name,
              enabled: true,
            }),
          },
        ],
      },
    ]);
  }

  it("upgrades only the affected bundle without changing its user revision", () => {
    const input = fixture();

    const result = convertResourceBundleSchema({
      bundlePath: input.bundlePath,
      registry: registry(),
    });

    expect(result).toMatchObject({
      status: "converted",
      sourceVersion: 1,
      targetVersion: 2,
      revision: 7,
      convertedDocuments: 1,
    });
    const manifest = readResourceBundle(input.bundlePath).manifest;
    expect(manifest).toMatchObject({
      schemaVersion: 2,
      revision: 7,
      extensionManifest: { owner: "test" },
    });
    expect(
      JSON.parse(
        fs.readFileSync(path.join(input.bundlePath, "workflow.json"), "utf8"),
      ),
    ).toEqual({
      kind: "workflow",
      schemaVersion: 2,
      name: "Daily",
      title: "Daily",
      enabled: true,
      extension: { color: "green" },
    });
  });

  it("opens a newer bundle read-only and never rewrites it as a downgrade", () => {
    const input = fixture(3);
    const before = fs.readFileSync(
      path.join(input.bundlePath, "manifest.json"),
    );

    expect(
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: registry(),
      }),
    ).toMatchObject({
      status: "read-only-newer",
      sourceVersion: 3,
      targetVersion: 2,
      revision: 7,
    });
    expect(
      fs.readFileSync(path.join(input.bundlePath, "manifest.json")),
    ).toEqual(before);
  });

  it("leaves an already-current bundle byte-for-byte unchanged", () => {
    const input = fixture(2);
    const before = fs.readFileSync(
      path.join(input.bundlePath, "manifest.json"),
    );

    expect(
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: registry(),
      }),
    ).toMatchObject({
      status: "current",
      sourceVersion: 2,
      targetVersion: 2,
      convertedDocuments: 0,
    });
    expect(
      fs.readFileSync(path.join(input.bundlePath, "manifest.json")),
    ).toEqual(before);
  });

  it("recovers an interrupted schema publication from its durable journal", () => {
    const input = fixture();
    const interruption = Object.assign(new Error("process interrupted"), {
      leaveOperationForRecovery: true,
    });

    expect(() =>
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: registry(),
        injectFailure: (stage) => {
          if (stage === "destination-published") throw interruption;
        },
      }),
    ).toThrow("process interrupted");

    expect(recoverResourceBundlePublication(input.bundlePath)).toBe(
      "committed",
    );
    expect(readResourceBundle(input.bundlePath).manifest).toMatchObject({
      schemaVersion: 2,
      revision: 7,
    });
  });

  it("leaves the original bundle untouched when conversion fails", () => {
    const input = fixture();
    const before = fs.readFileSync(
      path.join(input.bundlePath, "manifest.json"),
    );
    const failing = new ResourceSchemaRegistry([
      {
        resourceType: "workflow",
        currentVersion: 2,
        converters: [
          {
            fromVersion: 1,
            toVersion: 2,
            convert: () => {
              throw new Error("converter failed");
            },
          },
        ],
      },
    ]);

    expect(() =>
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: failing,
      }),
    ).toThrow("converter failed");
    expect(
      fs.readFileSync(path.join(input.bundlePath, "manifest.json")),
    ).toEqual(before);
    expect(
      fs.readdirSync(input.root).some((entry) => entry.includes("convert-")),
    ).toBe(false);
  });

  it("rejects unknown schemas and invalid byte limits before publication", () => {
    const unknown = fixture();
    expect(() =>
      convertResourceBundleSchema({
        bundlePath: unknown.bundlePath,
        registry: new ResourceSchemaRegistry(),
      }),
    ).toThrow(/Unknown resource schema/);

    const invalidLimit = fixture();
    expect(() =>
      convertResourceBundleSchema({
        bundlePath: invalidLimit.bundlePath,
        registry: registry(),
        maxDocumentBytes: 0,
      }),
    ).toThrow(/byte limit is invalid/);
  });

  it.each([
    ["invalid JSON", "{", /invalid JSON/],
    ["array document", "[]\n", /must be an object/],
    ["null document", "null\n", /must be an object/],
  ])("rejects a %s schema document", (_label, content, expected) => {
    const input = fixture(1, { content });
    expect(() =>
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: registry(),
      }),
    ).toThrow(expected);
  });

  it("rejects oversized input and converted documents", () => {
    const input = fixture();
    expect(() =>
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: registry(),
        maxDocumentBytes: 8,
      }),
    ).toThrow(/exceeds conversion limits/);

    const expanded = fixture();
    const expandingRegistry = new ResourceSchemaRegistry([
      {
        resourceType: "workflow",
        currentVersion: 2,
        converters: [
          {
            fromVersion: 1,
            toVersion: 2,
            convert: (document) => ({ ...document, padding: "x".repeat(400) }),
          },
        ],
      },
    ]);
    expect(() =>
      convertResourceBundleSchema({
        bundlePath: expanded.bundlePath,
        registry: expandingRegistry,
        maxDocumentBytes: 256,
      }),
    ).toThrow(/Converted resource schema document exceeds limits/);
  });

  it("rejects a document whose version disagrees with its bundle", () => {
    const input = fixture(1, {
      content: `${JSON.stringify({ schemaVersion: 2, name: "Daily" })}\n`,
    });
    expect(() =>
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: registry(),
      }),
    ).toThrow(/version does not match its bundle/);
  });

  it.each([null, "metadata"])(
    "rejects a bundle without schema-owned documents for role %s",
    (role) => {
      const input = fixture(1, { role });
      expect(() =>
        convertResourceBundleSchema({
          bundlePath: input.bundlePath,
          registry: registry(),
          documentRoles: ["current"],
        }),
      ).toThrow(/no schema-owned documents/);
    },
  );

  it("converts an explicitly selected non-default document role", () => {
    const input = fixture(1, { role: "metadata" });
    expect(
      convertResourceBundleSchema({
        bundlePath: input.bundlePath,
        registry: registry(),
        documentRoles: ["metadata"],
      }),
    ).toMatchObject({ status: "converted", convertedDocuments: 1 });
  });

  it.each(["non-file", "symlink"])(
    "rejects a %s document observed after bundle verification",
    (kind) => {
      const input = fixture();
      const documentPath = path.join(input.bundlePath, "workflow.json");
      const originalLstat = fs.lstatSync.bind(fs);
      let documentReads = 0;
      vi.spyOn(fs, "lstatSync").mockImplementation((target, options) => {
        const stats = originalLstat(target, options as never);
        if (path.resolve(String(target)) !== documentPath) return stats;
        documentReads += 1;
        if (documentReads < 3) return stats;
        return Object.assign(Object.create(stats), {
          isFile: () => kind !== "non-file",
          isSymbolicLink: () => kind === "symlink",
        });
      });

      expect(() =>
        convertResourceBundleSchema({
          bundlePath: input.bundlePath,
          registry: registry(),
        }),
      ).toThrow(/exceeds conversion limits/);
    },
  );
});
