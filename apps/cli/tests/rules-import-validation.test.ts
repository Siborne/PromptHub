import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { closeDatabase, resetRuntimePaths } from "@prompthub/core";

import { execCli, makeTempRoot, withDataDir } from "./helpers/cli-harness";

describe("CLI rules import and validation", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    closeDatabase();
    resetRuntimePaths();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exports and imports rules bundles", async () => {
    const sourceRoot = makeTempRoot(tempDirs);
    const targetRoot = makeTempRoot(tempDirs);
    const projectRoot = path.join(sourceRoot, "project-a");
    const exportFile = path.join(sourceRoot, "rules-export.json");
    fs.mkdirSync(projectRoot, { recursive: true });

    await execCli([
      ...withDataDir(sourceRoot),
      "rules",
      "add-project",
      "--id",
      "project-a",
      "--name",
      "Project A",
      "--root-path",
      projectRoot,
    ]);

    await execCli([
      ...withDataDir(sourceRoot),
      "rules",
      "save",
      "project:project-a",
      "--content",
      "# Project A Rule",
    ]);

    const exportRes = await execCli([
      ...withDataDir(sourceRoot),
      "rules",
      "export",
      "--file",
      exportFile,
    ]);
    expect(exportRes.exitCode).toBe(0);
    expect(fs.existsSync(exportFile)).toBe(true);

    fs.writeFileSync(
      path.join(projectRoot, "AGENTS.md"),
      "# External rule that must survive import",
      "utf8",
    );

    const importRes = await execCli([
      ...withDataDir(targetRoot),
      "rules",
      "import",
      "--file",
      exportFile,
      "--replace",
    ]);
    expect(importRes.exitCode).toBe(0);
    expect(importRes.json.imported).toBe(true);

    const readImportedRes = await execCli([
      ...withDataDir(targetRoot),
      "rules",
      "read",
      "project:project-a",
    ]);
    expect(readImportedRes.exitCode).toBe(0);
    expect(readImportedRes.json.content).toBe("# Project A Rule");
    expect(fs.readFileSync(path.join(projectRoot, "AGENTS.md"), "utf8")).toBe(
      "# External rule that must survive import",
    );
  }, 30_000);

  it("requires content for rules save", async () => {
    const root = makeTempRoot(tempDirs);
    const result = await execCli([
      ...withDataDir(root),
      "rules",
      "save",
      "claude-global",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.errorJson.error.code).toBe("USAGE_ERROR");
    expect(result.errorJson.error.message).toContain("--content");
  });

  it("requires explicit AI config for rules rewrite", async () => {
    const root = makeTempRoot(tempDirs);
    const result = await execCli([
      ...withDataDir(root),
      "rules",
      "rewrite",
      "claude-global",
      "--instruction",
      "Tighten the structure",
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.errorJson.error.code).toBe("USAGE_ERROR");
    expect(result.errorJson.error.message).toContain("--api-key");
  });
});
