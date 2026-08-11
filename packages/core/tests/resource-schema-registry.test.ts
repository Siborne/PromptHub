import { describe, expect, it } from "vitest";

import {
  ResourceSchemaRegistry,
  createCanonicalResourceSchemaRegistry,
} from "../src/resource-schema-registry";

describe("resource schema registry", () => {
  it("registers current built-in schemas independently", () => {
    expect(
      createCanonicalResourceSchemaRegistry()
        .list()
        .map((entry) => [entry.resourceType, entry.currentVersion]),
    ).toEqual([
      ["agent-provider", 1],
      ["generation", 1],
      ["mcp-server", 1],
      ["plugin", 1],
      ["prompt", 1],
      ["rule", 1],
      ["skill", 1],
    ]);
  });

  it("applies an immutable ordered converter chain", () => {
    const registry = new ResourceSchemaRegistry([
      {
        resourceType: "workflow",
        currentVersion: 3,
        converters: [
          {
            fromVersion: 1,
            toVersion: 2,
            convert: (document) => ({ ...document, title: document.name }),
          },
          {
            fromVersion: 2,
            toVersion: 3,
            convert: (document) => ({ ...document, enabled: true }),
          },
        ],
      },
    ]);
    const input = { name: "Daily", extension: { color: "green" } };
    const result = registry.resolve("workflow", 1, input);

    expect(result).toMatchObject({
      sourceVersion: 1,
      currentVersion: 3,
      mode: "converted",
      document: {
        name: "Daily",
        title: "Daily",
        enabled: true,
        extension: { color: "green" },
      },
    });
    expect(input).toEqual({ name: "Daily", extension: { color: "green" } });
  });

  it("opens unknown newer versions read-only without rewriting", () => {
    const registry = new ResourceSchemaRegistry([
      { resourceType: "workflow", currentVersion: 1 },
    ]);
    const document = { future: { mode: "parallel" } };
    const result = registry.resolve("workflow", 2, document);
    expect(result.mode).toBe("read-only-newer");
    expect(result.document).toEqual(document);
    expect(result.document).not.toBe(document);
  });

  it("returns an independent current document without invoking converters", () => {
    const registry = new ResourceSchemaRegistry([
      { resourceType: "workflow", currentVersion: 1 },
    ]);
    const document = { name: "Daily" };

    const result = registry.resolve("workflow", 1, document);

    expect(result).toMatchObject({
      resourceType: "workflow",
      sourceVersion: 1,
      currentVersion: 1,
      mode: "current",
      document,
    });
    expect(result.document).not.toBe(document);
  });

  it("rejects gaps, duplicate registrations, and unknown schemas", () => {
    expect(
      () =>
        new ResourceSchemaRegistry([
          {
            resourceType: "workflow",
            currentVersion: 3,
            converters: [
              { fromVersion: 1, toVersion: 3, convert: (value) => value },
            ],
          },
        ]),
    ).toThrow(/converter chain is invalid/);
    const registry = new ResourceSchemaRegistry([
      { resourceType: "workflow", currentVersion: 1 },
    ]);
    expect(() =>
      registry.register({ resourceType: "workflow", currentVersion: 1 }),
    ).toThrow(/already registered/);
    expect(() => registry.resolve("missing", 1, {})).toThrow(
      /Unknown resource schema/,
    );
  });

  it("rejects invalid names, versions, and incomplete converter chains", () => {
    expect(
      () =>
        new ResourceSchemaRegistry([
          { resourceType: "Workflow", currentVersion: 1 },
        ]),
    ).toThrow(/Invalid resource schema type/);
    expect(
      () =>
        new ResourceSchemaRegistry([
          { resourceType: "workflow", currentVersion: 0 },
        ]),
    ).toThrow(/positive safe integer/);
    expect(
      () =>
        new ResourceSchemaRegistry([
          {
            resourceType: "workflow",
            currentVersion: 3,
            converters: [
              { fromVersion: 1, toVersion: 2, convert: (value) => value },
            ],
          },
        ]),
    ).toThrow(/converter chain is invalid/);
    const registry = new ResourceSchemaRegistry([
      { resourceType: "workflow", currentVersion: 1 },
    ]);
    expect(() => registry.resolve("workflow", 0, {})).toThrow(
      /positive safe integer/,
    );
  });
});
