import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

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
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(schemaVersion = 1) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-resource-conversion-"),
    );
    roots.push(root);
    const sourcePath = path.join(root, "workflow.json");
    fs.writeFileSync(
      sourcePath,
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
      payloads: [{ path: "workflow.json", sourcePath, role: "current" }],
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
});
