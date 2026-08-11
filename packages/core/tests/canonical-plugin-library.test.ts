import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type {
  PluginLibraryEntry,
  PluginLibraryFile,
} from "@prompthub/shared/types/plugin";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  readCanonicalPluginLibrary,
  readCanonicalPluginVersions,
  writeCanonicalPluginState,
} from "../src/canonical-plugin-library";
import { CorePluginLibraryService } from "../src/plugin-library";
import { readPluginResourceBundle } from "../src/plugin-resource-schema";
import { configureRuntimePaths, resetRuntimePaths } from "../src/runtime-paths";
import {
  writeCanonicalStorageAuthority,
  writeRuntimeLayoutState,
} from "../src";

function plugin(packagePath: string): PluginLibraryEntry {
  return {
    id: "plugin-1",
    name: "writing-tools",
    displayName: "Writing Tools",
    trustLevel: "custom",
    inventory: {
      skills: 1,
      mcpServers: 0,
      apps: 0,
      commands: 0,
      hooks: 0,
      agents: 0,
      assets: 0,
      docs: 0,
      lspServers: 0,
      scripts: 0,
    },
    classification: "bundle",
    source: { kind: "local", localPackagePath: packagePath },
    localPackagePath: packagePath,
    managedPath: path.dirname(packagePath),
    distributedTargetIds: ["codex"],
    installedAt: Date.parse("2026-08-12T00:00:00.000Z"),
    updatedAt: Date.parse("2026-08-12T00:00:00.000Z"),
  };
}

function library(plugins: PluginLibraryEntry[]): PluginLibraryFile {
  return {
    kind: "prompthub-plugin-library",
    version: 1,
    updatedAt: "2026-08-12T00:00:00.000Z",
    plugins,
  };
}

describe("canonical Plugin library", () => {
  let root: string;
  let packagePath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-canonical-plugin-"),
    );
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "c".repeat(64),
      operationId: "canonical-plugin-test",
    });
    const rendererPath = path.join(root, "config", "devices", "renderer.json");
    fs.mkdirSync(path.dirname(rendererPath), { recursive: true });
    fs.writeFileSync(
      rendererPath,
      JSON.stringify({ selfHostedDeviceId: "device-1" }),
    );
    packagePath = path.join(root, "incoming", "package");
    fs.mkdirSync(path.join(packagePath, ".codex-plugin"), { recursive: true });
    fs.writeFileSync(
      path.join(packagePath, ".codex-plugin", "plugin.json"),
      '{"name":"writing-tools"}\n',
    );
  });

  afterEach(() => {
    resetRuntimePaths();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("routes production reads, metadata writes, versions, and deletion through bundles", () => {
    const service = new CorePluginLibraryService();
    service.write(library([plugin(packagePath)]));
    const bundlePath = path.join(root, "data", "plugins", "plugin-1");

    expect(service.read().plugins[0]).toMatchObject({
      id: "plugin-1",
      distributedTargetIds: ["codex"],
      localPackagePath: path.join(bundlePath, "files"),
    });
    expect(
      fs.readFileSync(
        path.join(bundlePath, "files", ".codex-plugin", "plugin.json"),
        "utf8",
      ),
    ).toContain("writing-tools");
    const createdVersion = service.createPluginVersion("plugin-1", "baseline");
    expect(createdVersion.version).toBe(1);
    expect(readCanonicalPluginVersions().versions).toHaveLength(1);

    const metadata = service.updatePluginMetadata("plugin-1", {
      userNotes: "daily",
    });
    expect(metadata.plugins[0].userNotes).toBe("daily");
    expect(readPluginResourceBundle(bundlePath).bundleManifest.revision).toBe(
      3,
    );
    expect(
      fs.existsSync(path.join(root, "data", "plugins", "library.json")),
    ).toBe(false);

    service.deletePlugin("plugin-1");
    expect(readCanonicalPluginLibrary().plugins).toEqual([]);
    expect(fs.existsSync(bundlePath)).toBe(false);
  });

  it("rolls back bundle and device projection publication together", () => {
    writeCanonicalPluginState({
      library: library([plugin(packagePath)]),
      versions: {
        kind: "prompthub-plugin-versions",
        version: 1,
        updatedAt: "2026-08-12T00:00:00.000Z",
        versions: [],
      },
    });
    const current = readCanonicalPluginLibrary().plugins[0];
    const projectionPath = path.join(
      root,
      "config",
      "devices",
      "plugin-projections.json",
    );
    const beforeProjection = fs.readFileSync(projectionPath, "utf8");

    expect(() =>
      writeCanonicalPluginState({
        library: library([
          {
            ...current,
            userNotes: "should roll back",
            distributedTargetIds: ["claude-code"],
            updatedAt: Date.parse("2026-08-12T01:00:00.000Z"),
          },
        ]),
        versions: readCanonicalPluginVersions(),
        injectPublicationFailure(targetPath) {
          if (targetPath === projectionPath) throw new Error("disk full");
        },
      }),
    ).toThrow("disk full");

    const restored = readCanonicalPluginLibrary().plugins[0];
    expect(restored).toMatchObject({
      distributedTargetIds: ["codex"],
    });
    expect(restored.userNotes).toBeUndefined();
    expect(fs.readFileSync(projectionPath, "utf8")).toBe(beforeProjection);
  });
});
