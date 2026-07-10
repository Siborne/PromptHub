import fs from "fs";
import path from "path";

import { afterEach, describe, expect, it } from "vitest";

import { closeDatabase, resetRuntimePaths } from "@prompthub/core";

import { execCli, makeTempRoot, withDataDir } from "./helpers/cli-harness";

describe("prompt CLI commands", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    closeDatabase();
    resetRuntimePaths();
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("normalizes CSV tags by trimming whitespace and dropping empty items", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "CSV Prompt",
      "--user-prompt",
      "Hello CSV",
      "--tags",
      " tag1 , tag2 , , tag3 ",
    ]);

    expect(createRes.exitCode).toBe(0);
    expect(createRes.json.tags).toEqual(["tag1", "tag2", "tag3"]);
  });

  it("rejects using inline and file system prompt inputs together", async () => {
    const root = makeTempRoot(tempDirs);
    const systemPromptFile = path.join(root, "system.md");
    fs.writeFileSync(systemPromptFile, "System prompt from file", "utf8");

    const result = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Prompt With Conflict",
      "--user-prompt",
      "Hello conflict",
      "--system-prompt",
      "Inline system prompt",
      "--system-prompt-file",
      systemPromptFile,
    ]);

    expect(result.exitCode).toBe(2);
    expect(result.errorJson.error.code).toBe("USAGE_ERROR");
    expect(result.errorJson.error.message).toContain("不能同时使用");
  });

  it("supports the full prompt lifecycle", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Lifecycle Prompt",
      "--user-prompt",
      "Initial content",
      "--tags",
      "lifecycle,test",
    ]);
    expect(createRes.exitCode).toBe(0);
    const promptId = createRes.json.id as string;

    const updateRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "update",
      promptId,
      "--title",
      "Updated Lifecycle Prompt",
      "--favorite",
    ]);
    expect(updateRes.exitCode).toBe(0);
    expect(updateRes.json.title).toBe("Updated Lifecycle Prompt");
    expect(updateRes.json.isFavorite).toBe(true);

    const searchRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "search",
      "Lifecycle",
      "--favorite",
    ]);
    expect(searchRes.exitCode).toBe(0);
    expect(searchRes.json).toHaveLength(1);
    expect(searchRes.json[0].id).toBe(promptId);

    const deleteRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "delete",
      promptId,
    ]);
    expect(deleteRes.exitCode).toBe(0);
    expect(deleteRes.json.deleted).toBe(true);

    const missingRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "get",
      promptId,
    ]);
    expect(missingRes.exitCode).toBe(3);
    expect(missingRes.errorJson.error.code).toBe("NOT_FOUND");
  });

  it("filters prompts by visibility scope and renders copied prompt variables", async () => {
    const root = makeTempRoot(tempDirs);

    await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Private Prompt",
      "--user-prompt",
      "Private body",
      "--visibility",
      "private",
    ]);

    const createSharedRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Shared Prompt",
      "--user-prompt",
      "Hello {{name}} from {{team}}",
      "--visibility",
      "shared",
    ]);
    expect(createSharedRes.exitCode).toBe(0);
    expect(createSharedRes.json.visibility).toBe("shared");

    const sharedOnlyRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "search",
      "--scope",
      "shared",
    ]);
    expect(sharedOnlyRes.exitCode).toBe(0);
    expect(sharedOnlyRes.json).toHaveLength(1);
    expect(sharedOnlyRes.json[0].title).toBe("Shared Prompt");

    const copyRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "copy",
      createSharedRes.json.id as string,
      "--var",
      "name=PromptHub",
      "--var",
      "team=CLI",
    ]);
    expect(copyRes.exitCode).toBe(0);
    expect(copyRes.json).toEqual({
      promptId: createSharedRes.json.id,
      content: "Hello PromptHub from CLI",
      usageCount: 1,
      variables: {
        name: "PromptHub",
        team: "CLI",
      },
    });
  });

  it("creates prompts with extended fields and variables", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Advanced Prompt",
      "--user-prompt",
      "Primary prompt",
      "--user-prompt-en",
      "English prompt",
      "--system-prompt",
      "System prompt",
      "--system-prompt-en",
      "English system",
      "--variables",
      JSON.stringify([
        {
          name: "topic",
          type: "text",
          required: true,
          label: "Topic",
        },
      ]),
      "--images",
      "cover.png,hero.png",
      "--videos",
      "demo.mp4",
      "--notes",
      "Important notes",
      "--source",
      "https://example.com/source",
    ]);

    expect(createRes.exitCode).toBe(0);
    expect(createRes.json.userPromptEn).toBe("English prompt");
    expect(createRes.json.systemPromptEn).toBe("English system");
    expect(createRes.json.images).toEqual(["cover.png", "hero.png"]);
    expect(createRes.json.videos).toEqual(["demo.mp4"]);
    expect(createRes.json.variables).toEqual([
      {
        name: "topic",
        type: "text",
        required: true,
        label: "Topic",
      },
    ]);
  });

  it("duplicates a prompt with copied content", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Original Prompt",
      "--user-prompt",
      "Original body",
      "--tags",
      "copy,test",
    ]);
    expect(createRes.exitCode).toBe(0);

    const duplicateRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "duplicate",
      createRes.json.id as string,
    ]);

    expect(duplicateRes.exitCode).toBe(0);
    expect(duplicateRes.json.title).toBe("Original Prompt (Duplicate)");
    expect(duplicateRes.json.userPrompt).toBe("Original body");
    expect(duplicateRes.json.tags).toEqual(["copy", "test"]);
  });

  it("lists prompt versions after content updates", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Versioned Prompt",
      "--user-prompt",
      "Initial version",
    ]);
    expect(createRes.exitCode).toBe(0);
    const promptId = createRes.json.id as string;

    const updateRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "update",
      promptId,
      "--user-prompt",
      "Updated version",
    ]);
    expect(updateRes.exitCode).toBe(0);

    const versionsRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "versions",
      promptId,
    ]);

    expect(versionsRes.exitCode).toBe(0);
    expect(versionsRes.json).toHaveLength(2);
    expect(versionsRes.json[0].version).toBe(2);
    expect(versionsRes.json[1].version).toBe(1);
  });

  it("creates and deletes a manual prompt version", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Manual Version Prompt",
      "--user-prompt",
      "Initial body",
    ]);
    expect(createRes.exitCode).toBe(0);
    const promptId = createRes.json.id as string;

    const createVersionRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create-version",
      promptId,
      "--note",
      "Named snapshot",
    ]);
    expect(createVersionRes.exitCode).toBe(0);
    expect(createVersionRes.json.note).toBe("Named snapshot");

    const deleteVersionRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "delete-version",
      promptId,
      createVersionRes.json.id as string,
    ]);
    expect(deleteVersionRes.exitCode).toBe(0);
    expect(deleteVersionRes.json.deleted).toBe(true);
  });

  it("shows diffs between prompt versions", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Diff Prompt",
      "--user-prompt",
      "Version A",
    ]);
    expect(createRes.exitCode).toBe(0);
    const promptId = createRes.json.id as string;

    await execCli([
      ...withDataDir(root),
      "prompt",
      "update",
      promptId,
      "--user-prompt",
      "Version B",
      "--last-ai-response",
      "AI result B",
    ]);

    const diffRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "diff",
      promptId,
      "--from",
      "1",
      "--to",
      "2",
    ]);

    expect(diffRes.exitCode).toBe(0);
    expect(diffRes.json.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "userPrompt",
          from: "Version A",
          to: "Version B",
        }),
      ]),
    );
  });

  it("rolls back a prompt to a previous version", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Rollback Prompt",
      "--user-prompt",
      "Version one",
    ]);
    expect(createRes.exitCode).toBe(0);
    const promptId = createRes.json.id as string;

    const updateRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "update",
      promptId,
      "--user-prompt",
      "Version two",
    ]);
    expect(updateRes.exitCode).toBe(0);
    expect(updateRes.json.userPrompt).toBe("Version two");

    const rollbackRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "rollback",
      promptId,
      "--version",
      "1",
    ]);

    expect(rollbackRes.exitCode).toBe(0);
    expect(rollbackRes.json.userPrompt).toBe("Version one");
    expect(rollbackRes.json.currentVersion).toBeGreaterThanOrEqual(3);
  });

  it("increments usage count when prompt use is invoked", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Usage Prompt",
      "--user-prompt",
      "Track me",
    ]);
    expect(createRes.exitCode).toBe(0);
    const promptId = createRes.json.id as string;

    const useRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "use",
      promptId,
    ]);

    expect(useRes.exitCode).toBe(0);
    expect(useRes.json.usageCount).toBe(1);
  });

  it("lists, renames, and deletes prompt tags", async () => {
    const root = makeTempRoot(tempDirs);

    await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Tag Prompt",
      "--user-prompt",
      "Tag me",
      "--tags",
      "alpha,beta",
    ]);

    const listTagsRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "list-tags",
    ]);
    expect(listTagsRes.exitCode).toBe(0);
    expect(listTagsRes.json).toEqual(["alpha", "beta"]);

    const renameTagRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "rename-tag",
      "alpha",
      "gamma",
    ]);
    expect(renameTagRes.exitCode).toBe(0);
    expect(renameTagRes.json.renamed).toBe(true);

    const deleteTagRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "delete-tag",
      "beta",
    ]);
    expect(deleteTagRes.exitCode).toBe(0);
    expect(deleteTagRes.json.deleted).toBe(true);

    const promptListRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "list",
    ]);
    expect(promptListRes.exitCode).toBe(0);
    expect(promptListRes.json[0].tags).toEqual(["gamma"]);
  });

  it("updates advanced prompt fields", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Updatable Prompt",
      "--user-prompt",
      "Original",
    ]);
    expect(createRes.exitCode).toBe(0);

    const updateRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "update",
      createRes.json.id as string,
      "--user-prompt-en",
      "English update",
      "--variables",
      JSON.stringify([
        {
          name: "audience",
          type: "select",
          required: false,
          options: ["dev", "ops"],
        },
      ]),
      "--images",
      "updated.png",
      "--videos",
      "updated.mp4",
      "--usage-count",
      "7",
      "--last-ai-response",
      "Latest answer",
    ]);

    expect(updateRes.exitCode).toBe(0);
    expect(updateRes.json.userPromptEn).toBe("English update");
    expect(updateRes.json.usageCount).toBe(7);
    expect(updateRes.json.lastAiResponse).toBe("Latest answer");
    expect(updateRes.json.images).toEqual(["updated.png"]);
    expect(updateRes.json.videos).toEqual(["updated.mp4"]);
    expect(updateRes.json.variables).toEqual([
      {
        name: "audience",
        type: "select",
        required: false,
        options: ["dev", "ops"],
      },
    ]);
  });

  it("returns usage error when rollback omits --version", async () => {
    const root = makeTempRoot(tempDirs);

    const createRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "create",
      "--title",
      "Missing Version Prompt",
      "--user-prompt",
      "Hello",
    ]);
    expect(createRes.exitCode).toBe(0);

    const rollbackRes = await execCli([
      ...withDataDir(root),
      "prompt",
      "rollback",
      createRes.json.id as string,
    ]);

    expect(rollbackRes.exitCode).toBe(2);
    expect(rollbackRes.errorJson.error.code).toBe("USAGE_ERROR");
  });

  it("renders empty table output for prompt list", async () => {
    const root = makeTempRoot(tempDirs);

    const result = await execCli([
      ...withDataDir(root),
      "-o",
      "table",
      "prompt",
      "list",
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.joinedStdout).toContain("(empty)");
  });
});
