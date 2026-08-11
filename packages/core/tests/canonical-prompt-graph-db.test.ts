import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DatabaseAdapter, SCHEMA } from "@prompthub/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CanonicalFolderDB,
  CanonicalPromptDB,
  CanonicalPromptOutputFormatDB,
  CanonicalPromptRelationDB,
  publishCanonicalPromptGraph,
} from "../src/canonical-prompt-graph-db";
import { readPromptCanonicalGraph } from "../src/prompt-canonical-import";
import { readResourceBundle } from "../src/resource-bundle";
import { writeCanonicalStorageAuthority } from "../src/canonical-storage-authority";
import {
  configureRuntimePaths,
  getImagesDir,
  getPromptsWorkspaceDir,
  resetRuntimePaths,
  writeRuntimeLayoutState,
} from "../src/runtime-paths";

describe("canonical Prompt graph database adapters", () => {
  let root: string;
  let database: DatabaseAdapter.Database;
  let prompts: CanonicalPromptDB;
  let folders: CanonicalFolderDB;
  let relations: CanonicalPromptRelationDB;
  let outputFormats: CanonicalPromptOutputFormatDB;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-prompt-graph-"));
    configureRuntimePaths({ userDataPath: root });
    writeRuntimeLayoutState(root);
    writeCanonicalStorageAuthority(root, {
      consistencyId: "c".repeat(64),
      operationId: "canonical-prompt-graph-test",
    });
    database = new DatabaseAdapter(":memory:");
    database.exec(SCHEMA);
    prompts = new CanonicalPromptDB(database);
    folders = new CanonicalFolderDB(database);
    relations = new CanonicalPromptRelationDB(database);
    outputFormats = new CanonicalPromptOutputFormatDB(database);
    expect(publishCanonicalPromptGraph(database)).toBe("published");
  });

  afterEach(() => {
    database.close();
    resetRuntimePaths();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("publishes the complete Prompt graph without mixing in its cache workspace", () => {
    const folder = folders.create({ name: "Writing" });
    fs.mkdirSync(getImagesDir(), { recursive: true });
    fs.writeFileSync(path.join(getImagesDir(), "cover.png"), "image-content");
    const first = prompts.create({
      title: "First",
      userPrompt: "Draft",
      folderId: folder.id,
      images: ["cover.png"],
      tags: ["writing"],
    });
    const second = prompts.create({ title: "Second", userPrompt: "Review" });
    const firstBundle = path.join(root, "data", "prompts", first.id);
    expect(readResourceBundle(firstBundle).manifest.revision).toBe(1);

    folders.update(folder.id, { name: "Writing Updated" });
    expect(readResourceBundle(firstBundle).manifest.revision).toBe(1);
    prompts.update(first.id, { userPrompt: "Revised" });
    expect(readResourceBundle(firstBundle).manifest.revision).toBe(2);

    relations.create({
      sourcePromptId: first.id,
      targetPromptId: second.id,
      kind: "depends_on",
    });
    outputFormats.create({
      sourcePromptId: first.id,
      targetPromptId: second.id,
    });
    const restored = readPromptCanonicalGraph(path.join(root, "data")).snapshot;
    expect(restored.prompts).toHaveLength(2);
    expect(restored.folders[0].name).toBe("Writing Updated");
    expect(restored.promptRelations).toHaveLength(1);
    expect(restored.outputFormatItems).toHaveLength(1);
    expect(readResourceBundle(firstBundle).manifest.objectHashes).toHaveLength(
      1,
    );
    expect(fs.existsSync(path.join(firstBundle, "prompt.md"))).toBe(false);
    expect(getPromptsWorkspaceDir()).toBe(
      path.join(root, "cache", "prompt-workspace"),
    );
  });

  it("publishes direct restore rows only when the batch explicitly converges", () => {
    const folder = {
      id: "folder-direct",
      name: "Direct",
      order: 0,
      isPrivate: false,
      visibility: "private" as const,
      createdAt: "2026-08-12T00:00:00.000Z",
      updatedAt: "2026-08-12T00:00:00.000Z",
    };
    folders.insertFolderDirect(folder);
    expect(
      readPromptCanonicalGraph(path.join(root, "data")).snapshot.folders,
    ).toEqual([]);
    expect(prompts.publishCanonicalGraph()).toBe("published");
    expect(
      readPromptCanonicalGraph(path.join(root, "data")).snapshot.folders,
    ).toEqual([folder]);
  });
});
