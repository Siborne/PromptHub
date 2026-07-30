import { mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtemp, rm } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

import {
  listQwenDefinitions,
  resolveQwenDefinitionPath,
} from "../../../src/main/services/agent-qwen-definition-service";

const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(
    path.join(tmpdir(), "prompthub-qwen-definitions-"),
  );
  roots.push(root);
  return root;
}

async function put(
  root: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe("Qwen definition discovery", () => {
  it("discovers user SubAgents and nested Commands through renderer-safe metadata", async () => {
    const root = await makeRoot();
    await put(
      root,
      "agents/reviewer.md",
      [
        "---",
        "name: reviewer",
        "description: Reviews changes",
        "model: qwen3-coder",
        "approvalMode: plan",
        "tools: [read_file, search_file_content]",
        "disallowedTools: shell",
        "---",
        "Review the selected change.",
      ].join("\n"),
    );
    await put(
      root,
      "commands/review/frontend.md",
      [
        "---",
        "description: Review the frontend",
        "---",
        "Inspect {{args}}.",
      ].join("\n"),
    );

    const result = await listQwenDefinitions({
      rootPath: root,
      scope: "user",
    });

    expect(result).toMatchObject({
      scope: "user",
      truncated: false,
      skippedSymlinks: 0,
      skippedUnsafe: 0,
      entries: [
        {
          kind: "command",
          relativePath: "review/frontend.md",
          name: "review:frontend",
          description: "Review the frontend",
          status: "valid",
        },
        {
          kind: "subagent",
          relativePath: "reviewer.md",
          name: "reviewer",
          description: "Reviews changes",
          model: "qwen3-coder",
          approvalMode: "plan",
          tools: ["read_file", "search_file_content"],
          disallowedTools: ["shell"],
          status: "valid",
        },
      ],
    });
    expect(JSON.stringify(result)).not.toContain("Review the selected change");
    expect(JSON.stringify(result)).not.toContain("Inspect {{args}}");
    expect(JSON.stringify(result)).not.toContain(root);
  });

  it("uses the project .qwen root and keeps malformed or oversized files visible", async () => {
    const projectRoot = await makeRoot();
    await put(
      projectRoot,
      ".qwen/agents/broken.md",
      "---\nname: broken\nname: duplicate\n---\nbody",
    );
    await put(
      projectRoot,
      ".qwen/commands/empty.md",
      "---\ndescription: no body\n---\n",
    );
    await put(
      projectRoot,
      ".qwen/commands/large.md",
      `---\ndescription: large\n---\n${"x".repeat(128)}`,
    );

    const result = await listQwenDefinitions(
      { rootPath: projectRoot, scope: "project" },
      { maxFileBytes: 64 },
    );

    expect(result.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          relativePath: "broken.md",
          status: "invalid",
          warnings: expect.arrayContaining(["invalid-frontmatter"]),
        }),
        expect.objectContaining({
          relativePath: "empty.md",
          status: "invalid",
          warnings: expect.arrayContaining(["missing-body"]),
        }),
        expect.objectContaining({
          relativePath: "large.md",
          status: "oversized",
          warnings: ["file-too-large"],
        }),
      ]),
    );
  });

  it("redacts credential-like metadata and never reads extension children", async () => {
    const root = await makeRoot();
    await put(
      root,
      "agents/secret.md",
      [
        "---",
        "name: sk-live-secret-value",
        "description: Authorization Bearer top-secret",
        "---",
        "Safe body.",
      ].join("\n"),
    );
    await put(
      root,
      "extensions/bundle/agents/owned.md",
      "---\nname: extension-owned\ndescription: hidden\n---\nbody",
    );

    const result = await listQwenDefinitions({
      rootPath: root,
      scope: "user",
    });

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]).toMatchObject({
      name: "[REDACTED]",
      description: "[REDACTED]",
      warnings: expect.arrayContaining(["sensitive-metadata-redacted"]),
    });
    expect(JSON.stringify(result)).not.toContain("top-secret");
    expect(JSON.stringify(result)).not.toContain("extension-owned");
  });

  it("enforces entry, byte and depth ceilings without unbounded traversal", async () => {
    const root = await makeRoot();
    await put(root, "commands/a.md", "A");
    await put(root, "commands/b.md", "B");
    await put(root, "commands/c.md", "C");
    await put(root, "commands/one/two/three/deep.md", "Deep");

    const result = await listQwenDefinitions(
      { rootPath: root, scope: "user" },
      {
        maxEntries: 2,
        maxVisitedEntries: 4,
        maxDepth: 2,
        maxTotalBytes: 2,
      },
    );

    expect(result.entries.length).toBeLessThanOrEqual(2);
    expect(result.truncated).toBe(true);
    expect(result.visitedEntries).toBeLessThanOrEqual(4);
    expect(result.readBytes).toBeLessThanOrEqual(2);
    expect(
      result.entries.some((entry) => entry.name === "one:two:three:deep"),
    ).toBe(false);
  });

  it("validates roots and limits before touching the filesystem", async () => {
    await expect(
      listQwenDefinitions({ rootPath: "relative", scope: "user" }),
    ).rejects.toThrow("QWEN_DEFINITION_ROOT_INVALID");
    await expect(
      listQwenDefinitions({ rootPath: "/tmp/invalid\0root", scope: "user" }),
    ).rejects.toThrow("QWEN_DEFINITION_ROOT_INVALID");
    await expect(
      listQwenDefinitions({
        rootPath: "/tmp",
        scope: "unknown" as never,
      }),
    ).rejects.toThrow("QWEN_DEFINITION_ROOT_INVALID");
    await expect(
      listQwenDefinitions(
        { rootPath: "/tmp", scope: "user" },
        { maxEntries: 0 },
      ),
    ).rejects.toThrow("QWEN_DEFINITION_LIMIT_INVALID");
    await expect(
      listQwenDefinitions(
        { rootPath: "/tmp", scope: "user" },
        { maxDepth: 1.5 },
      ),
    ).rejects.toThrow("QWEN_DEFINITION_LIMIT_INVALID");

    await expect(
      listQwenDefinitions({
        rootPath: path.join(tmpdir(), "missing-qwen-definition-root"),
        scope: "user",
      }),
    ).resolves.toMatchObject({ entries: [], truncated: false });
  });

  it("marks missing and invalid SubAgent metadata without exposing long values", async () => {
    const root = await makeRoot();
    const longDescription = "x".repeat(1_100);
    await put(
      root,
      "agents/metadata.md",
      [
        "---",
        `description: ${longDescription}`,
        "model: '   '",
        "tools:",
        "  - 42",
        "disallowedTools:",
        "  - ''",
        "---",
        "正文支持 Unicode。",
      ].join("\n"),
    );
    await put(
      root,
      "commands/no-description.md",
      ["---", "unknown: true", "---", "Run the command."].join("\n"),
    );
    await put(
      root,
      "agents/too-many-tools.md",
      [
        "---",
        "name: too-many-tools",
        "description: Too many tools",
        `tools: [${Array.from({ length: 65 }, (_, index) => `tool-${index}`).join(", ")}]`,
        "---",
        "Body.",
      ].join("\n"),
    );
    await put(
      root,
      "agents/no-description.md",
      ["---", "name: no-description", "---", "Body."].join("\n"),
    );
    await put(root, "commands/ignored.txt", "not a Markdown definition");

    const result = await listQwenDefinitions({
      rootPath: root,
      scope: "user",
    });
    const metadata = result.entries.find(
      (entry) => entry.relativePath === "metadata.md",
    );
    expect(metadata).toMatchObject({
      name: "metadata",
      status: "invalid",
      tools: [],
      disallowedTools: [],
      warnings: expect.arrayContaining([
        "missing-name",
        "metadata-truncated",
        "invalid-metadata",
      ]),
    });
    expect(metadata?.description).toHaveLength(1_000);
    expect(
      result.entries.find(
        (entry) =>
          entry.kind === "command" &&
          entry.relativePath === "no-description.md",
      ),
    ).toMatchObject({ status: "valid", description: null });
    expect(
      result.entries.find(
        (entry) => entry.relativePath === "too-many-tools.md",
      ),
    ).toMatchObject({
      status: "invalid",
      warnings: expect.arrayContaining(["invalid-metadata"]),
    });
    expect(
      result.entries.find(
        (entry) =>
          entry.kind === "subagent" &&
          entry.relativePath === "no-description.md",
      ),
    ).toMatchObject({
      status: "invalid",
      warnings: expect.arrayContaining(["missing-description"]),
    });
  });

  it("stops independently at entry, total-byte and depth limits", async () => {
    const entryRoot = await makeRoot();
    await put(entryRoot, "commands/a.md", "a");
    await put(entryRoot, "commands/b.md", "b");
    const entryResult = await listQwenDefinitions(
      { rootPath: entryRoot, scope: "user" },
      { maxEntries: 1 },
    );
    expect(entryResult).toMatchObject({ truncated: true });
    expect(entryResult.entries).toHaveLength(1);

    const byteRoot = await makeRoot();
    await put(byteRoot, "commands/a.md", "1234");
    await put(byteRoot, "commands/b.md", "5678");
    const byteResult = await listQwenDefinitions(
      { rootPath: byteRoot, scope: "user" },
      { maxTotalBytes: 5 },
    );
    expect(byteResult).toMatchObject({ truncated: true, readBytes: 4 });

    const depthRoot = await makeRoot();
    await put(depthRoot, "commands/one/two/deep.md", "deep");
    const depthResult = await listQwenDefinitions(
      { rootPath: depthRoot, scope: "user" },
      { maxDepth: 1 },
    );
    expect(depthResult).toMatchObject({ truncated: true, entries: [] });
  });

  it("classifies symlinked and non-directory definition roots safely", async () => {
    const symlinkRoot = await makeRoot();
    const outside = await makeRoot();
    await mkdir(path.join(outside, "agents"), { recursive: true });
    await symlink(
      path.join(outside, "agents"),
      path.join(symlinkRoot, "agents"),
    );
    await writeFile(path.join(symlinkRoot, "commands"), "not a directory");

    await expect(
      listQwenDefinitions({ rootPath: symlinkRoot, scope: "user" }),
    ).resolves.toMatchObject({
      entries: [],
      skippedSymlinks: 1,
      skippedUnsafe: 1,
    });
  });

  it("skips symlinks and rejects traversal, null bytes and containment changes on open", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    await put(root, "commands/safe.md", "Safe");
    await put(outside, "outside.md", "Outside");
    await symlink(
      path.join(outside, "outside.md"),
      path.join(root, "commands", "linked.md"),
    );
    await symlink(outside, path.join(root, "commands", "linked-dir"));

    const result = await listQwenDefinitions({
      rootPath: root,
      scope: "user",
    });
    expect(result.entries.map((entry) => entry.relativePath)).toEqual([
      "safe.md",
    ]);
    expect(result.skippedSymlinks).toBe(2);

    const safePath = await realpath(path.join(root, "commands", "safe.md"));
    await expect(
      resolveQwenDefinitionPath({
        rootPath: root,
        scope: "user",
        kind: "command",
        relativePath: "safe.md",
      }),
    ).resolves.toBe(safePath);
    await expect(
      resolveQwenDefinitionPath({
        rootPath: root,
        scope: "user",
        kind: "command",
        relativePath: "../outside.md",
      }),
    ).rejects.toThrow("QWEN_DEFINITION_PATH_INVALID");
    await expect(
      resolveQwenDefinitionPath({
        rootPath: root,
        scope: "user",
        kind: "command",
        relativePath: "/absolute.md",
      }),
    ).rejects.toThrow("QWEN_DEFINITION_PATH_INVALID");
    await expect(
      resolveQwenDefinitionPath({
        rootPath: root,
        scope: "user",
        kind: "command",
        relativePath: "safe.txt",
      }),
    ).rejects.toThrow("QWEN_DEFINITION_PATH_INVALID");
    await expect(
      resolveQwenDefinitionPath({
        rootPath: root,
        scope: "user",
        kind: "command",
        relativePath: "missing.md",
      }),
    ).rejects.toThrow("QWEN_DEFINITION_PATH_INVALID");
    await expect(
      resolveQwenDefinitionPath({
        rootPath: root,
        scope: "user",
        kind: "command",
        relativePath: "safe.md\0outside",
      }),
    ).rejects.toThrow("QWEN_DEFINITION_PATH_INVALID");
    await expect(
      resolveQwenDefinitionPath({
        rootPath: root,
        scope: "user",
        kind: "command",
        relativePath: "linked.md",
      }),
    ).rejects.toThrow("QWEN_DEFINITION_PATH_INVALID");
  });
});
