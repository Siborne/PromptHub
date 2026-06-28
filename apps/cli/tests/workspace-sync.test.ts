import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import {
  closeDatabase,
  configureRuntimePaths,
  CoreMcpLibraryService,
  CorePluginLibraryService,
  getPluginLibraryFilePath,
  resetRuntimePaths,
  runCli,
} from "@prompthub/core";
import type { PluginLibraryFile } from "@prompthub/shared/types/plugin";

function makeTempRoot(tempDirs: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-cli-sync-"));
  tempDirs.push(dir);
  return dir;
}

function dataArgs(rootDir: string): string[] {
  return ["--data-dir", path.join(rootDir, "user-data")];
}

async function execCli(args: string[]) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const exitCode = await runCli(args, {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  });

  const joinedStdout = stdout.join("\n");
  return {
    exitCode,
    stdout: joinedStdout.trim() ? JSON.parse(joinedStdout) : undefined,
    stderr: stderr.join("\n"),
  };
}

function withRuntimePaths<T>(rootDir: string, run: () => T): T {
  configureRuntimePaths({
    userDataPath: path.join(rootDir, "user-data"),
    exePath: process.execPath,
    isPackaged: false,
    platform: process.platform,
  });
  try {
    return run();
  } finally {
    resetRuntimePaths();
  }
}

function seedMcpAndPluginLibraries(rootDir: string): void {
  withRuntimePaths(rootDir, () => {
    new CoreMcpLibraryService().write({
      kind: "prompthub-mcp-library",
      version: 1,
      updatedAt: "2026-06-28T00:00:00.000Z",
      bindings: [],
      servers: [
        {
          id: "mcp-1",
          name: "Docs MCP",
          displayName: "Docs MCP",
          description: "Docs helper",
          transport: "stdio",
          command: "node",
          args: ["server.js"],
          env: {},
          enabled: true,
          tags: ["docs"],
          source: { type: "manual" },
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const now = Date.now();
    const pluginLibrary: PluginLibraryFile = {
      kind: "prompthub-plugin-library",
      version: 1,
      updatedAt: "2026-06-28T00:00:00.000Z",
      plugins: [
        {
          id: "plugin-1",
          name: "demo-plugin",
          displayName: "Demo Plugin",
          description: "Plugin for workspace sync",
          trustLevel: "custom",
          inventory: {
            skills: 0,
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
          source: {
            kind: "local",
            label: "Local",
          },
          installedAt: now,
          updatedAt: now,
        },
      ],
    };
    new CorePluginLibraryService().write(pluginLibrary);
    fs.writeFileSync(
      path.join(path.dirname(getPluginLibraryFilePath()), "plugin-note.txt"),
      "plugin asset",
      "utf8",
    );
  });
}

describe("CLI workspace sync snapshots", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    closeDatabase();
    resetRuntimePaths();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exports a sync-compatible workspace bundle with skills, MCP, and plugins", async () => {
    const root = makeTempRoot(tempDirs);
    const exportFile = path.join(root, "workspace.json");

    expect(
      (
        await execCli([
          ...dataArgs(root),
          "prompt",
          "create",
          "--title",
          "CLI Full Snapshot",
          "--user-prompt",
          "Use the full workspace",
        ])
      ).exitCode,
    ).toBe(0);
    const skillFile = path.join(root, "sync-skill.SKILL.md");
    fs.writeFileSync(
      skillFile,
      "---\nname: sync-skill\ndescription: Sync Skill\n---\nUse sync.\n",
      "utf8",
    );
    expect(
      (
        await execCli([
          ...dataArgs(root),
          "skill",
          "install",
          skillFile,
        ])
      ).exitCode,
    ).toBe(0);
    seedMcpAndPluginLibraries(root);

    const exportResult = await execCli([
      ...dataArgs(root),
      "workspace",
      "export",
      "--file",
      exportFile,
    ]);

    expect(exportResult.exitCode).toBe(0);
    expect(exportResult.stdout).toMatchObject({
      exported: true,
      prompts: 1,
      skills: 1,
      mcpServers: 1,
      plugins: 1,
    });

    const bundle = JSON.parse(fs.readFileSync(exportFile, "utf8"));
    expect(bundle).toMatchObject({
      kind: "prompthub-cli-workspace",
      version: 2,
      payload: {
        prompts: [expect.objectContaining({ title: "CLI Full Snapshot" })],
        skills: [expect.objectContaining({ name: "sync-skill" })],
        mcpLibrary: {
          servers: [expect.objectContaining({ name: "docs-mcp" })],
        },
        pluginLibrary: {
          plugins: [expect.objectContaining({ id: "plugin-1" })],
        },
        agentAssetFiles: {
          plugins: expect.arrayContaining([
            expect.objectContaining({ relativePath: "plugin-note.txt" }),
          ]),
        },
      },
    });
  });

  it("imports a v2 workspace bundle into the shared local workspace", async () => {
    const sourceRoot = makeTempRoot(tempDirs);
    const targetRoot = makeTempRoot(tempDirs);
    const exportFile = path.join(sourceRoot, "workspace.json");

    expect(
      (
        await execCli([
          ...dataArgs(sourceRoot),
          "prompt",
          "create",
          "--title",
          "Portable Prompt",
          "--user-prompt",
          "Portable body",
        ])
      ).exitCode,
    ).toBe(0);
    seedMcpAndPluginLibraries(sourceRoot);

    expect(
      (
        await execCli([
          ...dataArgs(sourceRoot),
          "workspace",
          "export",
          "--file",
          exportFile,
        ])
      ).exitCode,
    ).toBe(0);

    const importResult = await execCli([
      ...dataArgs(targetRoot),
      "workspace",
      "import",
      "--file",
      exportFile,
      "--force-clear",
    ]);

    expect(importResult.exitCode).toBe(0);
    expect(importResult.stdout).toMatchObject({
      imported: true,
      prompts: 1,
      mcpServers: 1,
      plugins: 1,
      forceCleared: true,
    });

    const promptList = await execCli([...dataArgs(targetRoot), "prompt", "list"]);
    expect(promptList.stdout).toEqual([
      expect.objectContaining({ title: "Portable Prompt" }),
    ]);

    const libraries = withRuntimePaths(targetRoot, () => ({
      mcp: new CoreMcpLibraryService().read(),
      plugin: new CorePluginLibraryService().read(),
      pluginNote: fs.readFileSync(
        path.join(path.dirname(getPluginLibraryFilePath()), "plugin-note.txt"),
        "utf8",
      ),
    }));

    expect(libraries.mcp.servers).toEqual([
      expect.objectContaining({ name: "docs-mcp" }),
    ]);
    expect(libraries.plugin.plugins).toEqual([
      expect.objectContaining({ id: "plugin-1" }),
    ]);
    expect(libraries.pluginNote).toBe("plugin asset");
  });
});
