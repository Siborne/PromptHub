import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DatabaseAdapter,
  FolderDB,
  PromptDB,
  PromptOutputFormatDB,
  PromptRelationDB,
  closeDatabase,
  initDatabase,
} from "@prompthub/db";
import type { Folder, Prompt, PromptVersion } from "@prompthub/shared/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectPromptCanonicalGraph,
  materializePromptCanonicalGraph,
  type PromptCanonicalGraphSnapshot,
} from "../src/prompt-canonical-export";
import {
  calculatePromptCanonicalGraphHash,
  stagePromptCanonicalDatabase,
} from "../src/prompt-canonical-catalog";
import { readPromptCanonicalGraph } from "../src/prompt-canonical-import";
import { readResourceBundle } from "../src/resource-bundle";

const roots: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-graph-"));
  roots.push(root);
  return root;
}

function prompt(id: string, folderId: string | null = null): Prompt {
  return {
    id,
    title: `Prompt ${id}`,
    promptType: "text",
    systemPrompt: null,
    userPrompt: `Body ${id}`,
    variables: [],
    tags: ["Shared", id],
    folderId,
    parentId: null,
    order: 0,
    images: [`${id}.png`],
    videos: [],
    isFavorite: false,
    isPinned: false,
    version: 1,
    currentVersion: 1,
    usageCount: 0,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
  };
}

function version(promptId: string): PromptVersion {
  return {
    id: `version-${promptId}`,
    promptId,
    version: 1,
    systemPrompt: null,
    userPrompt: `Body ${promptId}`,
    variables: [],
    createdAt: "2026-08-11T00:00:00.000Z",
  };
}

function folder(): Folder {
  return {
    id: "folder-1",
    name: "Release",
    order: 0,
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:00:00.000Z",
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  closeDatabase();
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("prompt canonical export", () => {
  it("collects the real SQLite graph and publishes a complete deterministic shadow tree", () => {
    const root = createRoot();
    const db = initDatabase(path.join(root, "prompthub.db"));
    const promptDb = new PromptDB(db);
    const folderDb = new FolderDB(db);
    folderDb.insertFolderDirect(folder());
    promptDb.insertPromptDirect(prompt("prompt-1", "folder-1"));
    promptDb.insertPromptDirect(prompt("prompt-2"));
    promptDb.insertVersionDirect(version("prompt-1"));
    promptDb.insertVersionDirect(version("prompt-2"));
    new PromptRelationDB(db).insertRelationDirect({
      id: "relation-1",
      sourcePromptId: "prompt-1",
      targetPromptId: "prompt-2",
      kind: "depends_on",
      note: "ordered",
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    });
    new PromptOutputFormatDB(db).insertItemDirect({
      id: "format-1",
      sourcePromptId: "prompt-1",
      targetPromptId: "prompt-2",
      sortOrder: 0,
      createdAt: "2026-08-11T00:00:00.000Z",
      updatedAt: "2026-08-11T00:00:00.000Z",
    });

    const snapshot = collectPromptCanonicalGraph(promptDb, folderDb, db);
    const target = path.join(root, "canonical-data");
    const manifest = materializePromptCanonicalGraph(target, snapshot, {
      createdAt: "2026-08-11T02:00:00.000Z",
    });

    expect(manifest.counts).toEqual({
      prompts: 2,
      promptVersions: 2,
      folders: 1,
      tags: 3,
      relations: 1,
      outputFormatItems: 1,
    });
    expect(manifest.files.map((file) => file.path)).toEqual(
      [...manifest.files.map((file) => file.path)].sort(),
    );
    expect(
      readResourceBundle(path.join(target, "prompts", "prompt-1"), {
        expectedResourceType: "prompt",
        expectedResourceId: "prompt-1",
      }).payloadFileCount,
    ).toBe(2);
    expect(
      JSON.parse(
        fs.readFileSync(path.join(target, "folders", "folder-1.json"), "utf8"),
      ),
    ).toMatchObject({ kind: "prompthub-folder-resource", folder: folder() });
    expect(fs.readdirSync(path.join(target, "tags"))).toHaveLength(3);
    expect(fs.existsSync(path.join(target, ".sources"))).toBe(false);

    const restored = readPromptCanonicalGraph(target);
    expect(restored.snapshot.prompts.map((item) => item.id).sort()).toEqual([
      "prompt-1",
      "prompt-2",
    ]);
    expect(restored.snapshot.promptVersions).toHaveLength(2);
    expect(restored.snapshot.promptRelations).toHaveLength(1);
    expect(restored.snapshot.outputFormatItems).toHaveLength(1);

    const rebuiltPath = path.join(root, "rebuilt.db");
    const rebuilt = stagePromptCanonicalDatabase(target, rebuiltPath);
    expect(rebuilt.counts).toEqual(manifest.counts);
    expect(rebuilt.graphHash).toBe(
      calculatePromptCanonicalGraphHash(restored.snapshot),
    );
    const rebuiltDb = new DatabaseAdapter(rebuiltPath, { readOnly: true });
    try {
      const rebuiltSnapshot = collectPromptCanonicalGraph(
        new PromptDB(rebuiltDb),
        new FolderDB(rebuiltDb),
        rebuiltDb,
      );
      expect(calculatePromptCanonicalGraphHash(rebuiltSnapshot)).toBe(
        rebuilt.graphHash,
      );
    } finally {
      rebuiltDb.close();
    }
  });

  it("rejects broken graph references before writing and cleans failed stages", () => {
    const root = createRoot();
    const snapshot: PromptCanonicalGraphSnapshot = {
      prompts: [prompt("prompt-1", "missing-folder")],
      promptVersions: [version("prompt-1")],
      folders: [],
      promptRelations: [],
      outputFormatItems: [],
    };
    const target = path.join(root, "canonical-data");
    expect(() => materializePromptCanonicalGraph(target, snapshot)).toThrow(
      /missing folder/u,
    );
    expect(fs.existsSync(target)).toBe(false);
    expect(
      fs.readdirSync(root).filter((entry) => entry.includes(".stage-")),
    ).toEqual([]);
  });

  it("round-trips resource ids that require cross-platform directory encoding", () => {
    const root = createRoot();
    const id = "custom:提示*one";
    const target = path.join(root, "canonical-data");
    materializePromptCanonicalGraph(target, {
      prompts: [prompt(id)],
      promptVersions: [version(id)],
      folders: [],
      promptRelations: [],
      outputFormatItems: [],
    });

    expect(fs.readdirSync(path.join(target, "prompts"))).toEqual([
      "custom%3A%E6%8F%90%E7%A4%BA%2Aone",
    ]);
    expect(readPromptCanonicalGraph(target).snapshot.prompts[0].id).toBe(id);
  });

  it("stores Prompt media as verified content-addressed objects", () => {
    const root = createRoot();
    const target = path.join(root, "canonical-data");
    const imagePath = path.join(root, "cover.png");
    fs.writeFileSync(imagePath, "image bytes", "utf8");
    materializePromptCanonicalGraph(
      target,
      {
        prompts: [prompt("prompt-media")],
        promptVersions: [version("prompt-media")],
        folders: [],
        promptRelations: [],
        outputFormatItems: [],
      },
      { resolveMediaSource: () => imagePath },
    );

    const bundlePath = path.join(target, "prompts", "prompt-media");
    const document = JSON.parse(
      fs.readFileSync(path.join(bundlePath, "prompt.json"), "utf8"),
    );
    expect(document.mediaObjects).toEqual([
      expect.objectContaining({
        kind: "image",
        reference: "prompt-media.png",
        byteSize: 11,
      }),
    ]);
    expect(readPromptCanonicalGraph(target).snapshot.prompts[0].id).toBe(
      "prompt-media",
    );
    const hash = document.mediaObjects[0].sha256;
    const objectPath = path.join(
      target,
      "assets",
      "objects",
      "sha256",
      hash.slice(0, 2),
      hash,
    );
    fs.writeFileSync(objectPath, "tampered", "utf8");
    expect(() => readPromptCanonicalGraph(target)).toThrow(
      /canonical graph file size mismatch|content-addressed object/u,
    );
  });

  it("never overwrites an existing target and rejects dangling graph edges", () => {
    const root = createRoot();
    const target = path.join(root, "canonical-data");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "keep.txt"), "keep", "utf8");
    const snapshot: PromptCanonicalGraphSnapshot = {
      prompts: [prompt("prompt-1")],
      promptVersions: [version("prompt-1")],
      folders: [],
      promptRelations: [
        {
          id: "relation-1",
          sourcePromptId: "prompt-1",
          targetPromptId: "missing",
          kind: "next_step",
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
      ],
      outputFormatItems: [],
    };
    expect(() => materializePromptCanonicalGraph(target, snapshot)).toThrow(
      /already exists/u,
    );
    expect(fs.readFileSync(path.join(target, "keep.txt"), "utf8")).toBe("keep");

    fs.rmSync(target, { recursive: true });
    expect(() => materializePromptCanonicalGraph(target, snapshot)).toThrow(
      /missing target Prompt/u,
    );
  });

  it("fails closed when a declared record is tampered with", () => {
    const root = createRoot();
    const target = path.join(root, "canonical-data");
    materializePromptCanonicalGraph(target, {
      prompts: [prompt("prompt-1")],
      promptVersions: [version("prompt-1")],
      folders: [],
      promptRelations: [],
      outputFormatItems: [],
    });
    fs.appendFileSync(
      path.join(target, "prompts", "prompt-1", "prompt.json"),
      " ",
    );

    expect(() => readPromptCanonicalGraph(target)).toThrow(/size mismatch/u);
  });

  it("fails closed on undeclared files, catalog count tampering, and unsafe roots", () => {
    const root = createRoot();
    const target = path.join(root, "canonical-data");
    materializePromptCanonicalGraph(target, {
      prompts: [prompt("prompt-1")],
      promptVersions: [version("prompt-1")],
      folders: [],
      promptRelations: [],
      outputFormatItems: [],
    });
    fs.writeFileSync(path.join(target, "undeclared.txt"), "surprise", "utf8");
    expect(() => readPromptCanonicalGraph(target)).toThrow(/inventory count/u);
    fs.rmSync(path.join(target, "undeclared.txt"));

    const catalogPath = path.join(target, "catalog.json");
    const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
    catalog.counts.prompts = 2;
    fs.writeFileSync(catalogPath, `${JSON.stringify(catalog)}\n`, "utf8");
    expect(() => readPromptCanonicalGraph(target)).toThrow(/domain counts/u);

    expect(() =>
      readPromptCanonicalGraph(path.join(root, "missing")),
    ).toThrow();
  });

  it("does not publish a catalog when local ownership or the destination is invalid", () => {
    const root = createRoot();
    const target = path.join(root, "canonical-data");
    const owned = prompt("prompt-1");
    owned.ownerUserId = "server-user";
    materializePromptCanonicalGraph(target, {
      prompts: [owned],
      promptVersions: [version("prompt-1")],
      folders: [],
      promptRelations: [],
      outputFormatItems: [],
    });
    const databasePath = path.join(root, "rebuilt.db");
    expect(() => stagePromptCanonicalDatabase(target, databasePath)).toThrow(
      /server-owned user reference/u,
    );
    expect(fs.existsSync(databasePath)).toBe(false);

    fs.writeFileSync(databasePath, "keep", "utf8");
    expect(() => stagePromptCanonicalDatabase(target, databasePath)).toThrow(
      /already exists/u,
    );
    expect(fs.readFileSync(databasePath, "utf8")).toBe("keep");
  });

  it("normalizes optional catalog values and deterministic graph ordering", () => {
    const root = createRoot();
    const firstPrompt = {
      ...prompt("prompt-1", "folder-1"),
      promptType: undefined,
      order: undefined,
      images: undefined,
      videos: undefined,
      version: 2,
      currentVersion: 2,
    };
    const secondVersion: PromptVersion = {
      ...version("prompt-1"),
      id: "version-prompt-1-2",
      version: 2,
      userPrompt: "Body prompt-1 v2",
      systemPrompt: "System",
      systemPromptEn: "System EN",
      userPromptEn: "Body EN",
      note: "note",
      aiResponse: "response",
    };
    const secondFolder: Folder = {
      ...folder(),
      id: "folder-2",
      name: "Second",
      visibility: "private",
      icon: "folder",
      parentId: "folder-1",
      isPrivate: true,
    };
    const sparseFolder = {
      ...folder(),
      visibility: undefined,
      icon: undefined,
      parentId: undefined,
      order: 0,
      isPrivate: undefined,
    } as unknown as Folder;
    const target = path.join(root, "canonical-data");
    materializePromptCanonicalGraph(target, {
      prompts: [prompt("prompt-2"), firstPrompt],
      promptVersions: [version("prompt-2"), secondVersion, version("prompt-1")],
      folders: [secondFolder, sparseFolder],
      promptRelations: [
        {
          id: "relation-2",
          sourcePromptId: "prompt-2",
          targetPromptId: "prompt-1",
          kind: "related_to",
          note: "linked",
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
        {
          id: "relation-1",
          sourcePromptId: "prompt-1",
          targetPromptId: "prompt-2",
          kind: "depends_on",
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
      ],
      outputFormatItems: [
        {
          id: "format-2",
          sourcePromptId: "prompt-2",
          targetPromptId: "prompt-1",
          sortOrder: 1,
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
        {
          id: "format-1",
          sourcePromptId: "prompt-1",
          targetPromptId: "prompt-2",
          sortOrder: 0,
          createdAt: "2026-08-11T00:00:00.000Z",
          updatedAt: "2026-08-11T00:00:00.000Z",
        },
      ],
    });

    expect(
      stagePromptCanonicalDatabase(target, path.join(root, "normalized.db"))
        .counts,
    ).toEqual({
      prompts: 2,
      promptVersions: 3,
      folders: 2,
      tags: 3,
      relations: 2,
      outputFormatItems: 2,
    });
  });

  it("cleans catalog stages after quick-check, hash, and destination race failures", () => {
    const root = createRoot();
    const target = path.join(root, "canonical-data");
    materializePromptCanonicalGraph(target, {
      prompts: [prompt("prompt-1")],
      promptVersions: [version("prompt-1")],
      folders: [],
      promptRelations: [],
      outputFormatItems: [],
    });
    const originalPragma = DatabaseAdapter.prototype.pragma;
    for (const [index, result] of [
      [],
      [undefined],
      [{ quick_check: "not ok" }],
    ].entries()) {
      vi.spyOn(DatabaseAdapter.prototype, "pragma").mockImplementation(
        function (this: InstanceType<typeof DatabaseAdapter>, pragma: string) {
          if (pragma === "quick_check") return result as never;
          return originalPragma.call(this, pragma);
        },
      );
      const databasePath = path.join(root, `quick-check-${index}.db`);
      expect(() => stagePromptCanonicalDatabase(target, databasePath)).toThrow(
        /quick_check/,
      );
      expect(fs.existsSync(databasePath)).toBe(false);
      vi.restoreAllMocks();
    }

    vi.spyOn(PromptDB.prototype, "getAll").mockReturnValue([]);
    const hashPath = path.join(root, "hash.db");
    expect(() => stagePromptCanonicalDatabase(target, hashPath)).toThrow(
      /does not match source graph/,
    );
    expect(fs.existsSync(hashPath)).toBe(false);
    vi.restoreAllMocks();

    const racePath = path.join(root, "race.db");
    const originalExists = fs.existsSync.bind(fs);
    let raceChecks = 0;
    vi.spyOn(fs, "existsSync").mockImplementation((candidate) => {
      if (path.resolve(String(candidate)) === racePath) {
        raceChecks += 1;
        return raceChecks > 1;
      }
      return originalExists(candidate);
    });
    expect(() => stagePromptCanonicalDatabase(target, racePath)).toThrow(
      /destination already exists/,
    );
    expect(originalExists(racePath)).toBe(false);
  });
});
