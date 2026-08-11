import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  PluginLibraryEntry,
  PluginVersion,
} from "@prompthub/shared/types/plugin";
import { afterEach, describe, expect, it } from "vitest";

import {
  materializePluginResourceBundle,
  readPluginResourceBundle,
} from "../src/plugin-resource-schema";

const roots: string[] = [];

function root(): string {
  const value = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-plugin-bundle-"),
  );
  roots.push(value);
  return value;
}

function plugin(base: string): PluginLibraryEntry {
  return {
    id: "plugin-1",
    name: "writing-tools",
    displayName: "Writing Tools",
    description: "Writing utilities",
    version: "1.0.0",
    trustLevel: "custom",
    inventory: {
      skills: 1,
      mcpServers: 0,
      apps: 0,
      commands: 1,
      hooks: 0,
      agents: 0,
      assets: 0,
      docs: 1,
      lspServers: 0,
      scripts: 0,
    },
    classification: "bundle",
    source: {
      kind: "local",
      packagePath: "packages/writing-tools",
      localRepositoryPath: path.join(base, "source"),
      localPackagePath: path.join(base, "source", "packages", "writing-tools"),
    },
    isFavorite: true,
    tags: ["writing"],
    userTags: ["daily"],
    userNotes: "useful",
    distributedTargetIds: ["codex"],
    managedPath: path.join(base, "managed"),
    localRepositoryPath: path.join(base, "source"),
    localPackagePath: path.join(base, "source", "packages", "writing-tools"),
    installedManifestHash: "a".repeat(64),
    installedPackageHash: "b".repeat(64),
    installedAt: Date.parse("2026-08-11T00:00:00.000Z"),
    updatedAt: Date.parse("2026-08-11T01:00:00.000Z"),
  };
}

function version(base: string): PluginVersion {
  return {
    id: "plugin-version-1",
    pluginId: "plugin-1",
    version: 1,
    note: "initial",
    createdAt: "2026-08-11T00:00:00.000Z",
    plugin: plugin(base),
    packageSnapshot: {
      pluginId: "plugin-1",
      files: [
        {
          relativePath: ".codex-plugin/plugin.json",
          contentBase64: Buffer.from('{"name":"writing-tools"}\n').toString(
            "base64",
          ),
          size: Buffer.byteLength('{"name":"writing-tools"}\n'),
        },
      ],
    },
  };
}

afterEach(() => {
  for (const value of roots.splice(0))
    fs.rmSync(value, { recursive: true, force: true });
});

describe("Plugin canonical resource schema", () => {
  it("publishes user metadata edits independently of package versions", () => {
    const base = root();
    const bundlePath = path.join(base, "bundle");
    materializePluginResourceBundle({
      bundlePath,
      plugin: plugin(base),
      versions: [version(base)],
      packageFiles: [],
    });
    const updated = {
      ...plugin(base),
      userNotes: "use every day",
      updatedAt: Date.parse("2026-08-11T02:00:00.000Z"),
    };

    const manifest = materializePluginResourceBundle({
      bundlePath,
      plugin: updated,
      versions: [version(base)],
      packageFiles: [],
      writePolicy: { mode: "replace" },
    });

    expect(manifest.revision).toBe(2);
    expect(readPluginResourceBundle(bundlePath).plugin.userNotes).toBe(
      "use every day",
    );
  });

  it("round-trips portable metadata, package files, and package history", () => {
    const base = root();
    const currentFile = path.join(base, "plugin.json");
    fs.writeFileSync(currentFile, '{"name":"writing-tools"}\n');
    const bundlePath = path.join(base, "bundle");
    materializePluginResourceBundle({
      bundlePath,
      plugin: plugin(base),
      versions: [version(base)],
      packageFiles: [
        {
          path: ".codex-plugin/plugin.json",
          sourcePath: currentFile,
        },
      ],
    });

    const restored = readPluginResourceBundle(bundlePath);
    expect(restored.plugin).toMatchObject({
      id: "plugin-1",
      name: "writing-tools",
      managedPath: path.join(bundlePath, "files"),
    });
    expect(restored.plugin).not.toHaveProperty("distributedTargetIds");
    expect(restored.plugin).not.toHaveProperty("localRepositoryPath");
    expect(restored.plugin.source).not.toHaveProperty("localRepositoryPath");
    expect(restored.versionPackageFiles.get(1)?.[0]).toMatchObject({
      relativePath: ".codex-plugin/plugin.json",
      size: Buffer.byteLength('{"name":"writing-tools"}\n'),
    });
    expect(restored.versions[0].packageSnapshot?.files[0]).toMatchObject({
      relativePath: ".codex-plugin/plugin.json",
      contentBase64: version(base).packageSnapshot?.files[0].contentBase64,
    });
    expect(restored.packageFiles.map((file) => file.path)).toEqual([
      ".codex-plugin/plugin.json",
    ]);
  });

  it("rejects foreign versions and unsafe package paths", () => {
    const base = root();
    const foreign = version(base);
    foreign.pluginId = "other";
    expect(() =>
      materializePluginResourceBundle({
        bundlePath: path.join(base, "foreign"),
        plugin: plugin(base),
        versions: [foreign],
        packageFiles: [],
      }),
    ).toThrow(/does not belong/u);

    expect(() =>
      materializePluginResourceBundle({
        bundlePath: path.join(base, "unsafe"),
        plugin: plugin(base),
        versions: [version(base)],
        packageFiles: [{ path: "../escape", sourcePath: __filename }],
      }),
    ).toThrow(/package path/u);
  });

  it("fails closed on tampered package content", () => {
    const base = root();
    const currentFile = path.join(base, "plugin.json");
    fs.writeFileSync(currentFile, "{}\n");
    const bundlePath = path.join(base, "bundle");
    materializePluginResourceBundle({
      bundlePath,
      plugin: plugin(base),
      versions: [version(base)],
      packageFiles: [
        { path: ".codex-plugin/plugin.json", sourcePath: currentFile },
      ],
    });
    fs.appendFileSync(
      path.join(bundlePath, "files", ".codex-plugin", "plugin.json"),
      "tamper",
    );
    expect(() => readPluginResourceBundle(bundlePath)).toThrow(
      /size mismatch/u,
    );
  });
});
