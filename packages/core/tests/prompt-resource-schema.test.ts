import type { Prompt, PromptVersion } from "@prompthub/shared/types";
import { describe, expect, it } from "vitest";

import {
  PROMPT_RESOURCE_KIND,
  PROMPT_VERSION_RESOURCE_KIND,
  createPromptResourceDocuments,
  deriveCanonicalTagId,
  parsePromptResourceDocuments,
} from "../src/prompt-resource-schema";

function createPrompt(overrides: Partial<Prompt> = {}): Prompt {
  return {
    id: "prompt-1",
    ownerUserId: "user-1",
    visibility: "private",
    title: "Release checklist",
    description: "Ship safely",
    promptType: "text",
    systemPrompt: "Be precise",
    systemPromptEn: "Be precise",
    userPrompt: "Review {{target}}",
    userPromptEn: "Review {{target}}",
    variables: [
      {
        name: "target",
        type: "select",
        label: "Target",
        defaultValue: "desktop",
        options: ["desktop", "web"],
        required: true,
      },
    ],
    tags: ["Release", "质量", "Release"],
    folderId: "folder-1",
    parentId: null,
    order: 2,
    images: ["covers/release.png"],
    videos: ["demo.mp4"],
    isFavorite: true,
    isPinned: false,
    version: 2,
    currentVersion: 2,
    usageCount: 7,
    source: "local",
    notes: "Keep all checks",
    lastAiResponse: "Ready",
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T01:00:00.000Z",
    ...overrides,
  };
}

function createVersion(version: number): PromptVersion {
  return {
    id: `version-${version}`,
    promptId: "prompt-1",
    version,
    systemPrompt: `System ${version}`,
    systemPromptEn: `System ${version}`,
    userPrompt: `Prompt ${version}`,
    userPromptEn: `Prompt ${version}`,
    variables: [],
    note: `Version ${version}`,
    aiResponse: `Response ${version}`,
    createdAt: `2026-08-11T00:0${version}:00.000Z`,
  };
}

describe("prompt resource schema", () => {
  it("round-trips every Prompt field, ordered versions, tag identities, and media references", () => {
    const prompt = createPrompt();
    const documents = createPromptResourceDocuments(prompt, [
      createVersion(2),
      createVersion(1),
    ]);

    expect(documents.promptDocument).toMatchObject({
      kind: PROMPT_RESOURCE_KIND,
      schemaVersion: 1,
      prompt,
      tagReferences: [
        { id: deriveCanonicalTagId("Release"), label: "Release" },
        { id: deriveCanonicalTagId("质量"), label: "质量" },
      ].sort((left, right) => left.id.localeCompare(right.id)),
      mediaReferences: {
        images: ["covers/release.png"],
        videos: ["demo.mp4"],
      },
    });
    expect(documents.versionDocuments.map((entry) => entry.path)).toEqual([
      "versions/000001.json",
      "versions/000002.json",
    ]);

    const parsed = parsePromptResourceDocuments(
      `${JSON.stringify({ ...documents.promptDocument, future: { keep: true } })}\n`,
      documents.versionDocuments.map((entry) => ({
        path: entry.path,
        text: `${JSON.stringify({ ...entry.document, future: entry.path })}\n`,
      })),
    );
    expect(parsed.prompt).toEqual(prompt);
    expect(parsed.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(parsed.promptDocument.future).toEqual({ keep: true });
    expect(parsed.versionDocuments[0].document.future).toBe(
      "versions/000001.json",
    );
  });

  it("derives stable, normalization-aware tag ids without merging distinct case", () => {
    expect(deriveCanonicalTagId("  Cafe\u0301  ")).toBe(
      deriveCanonicalTagId("Café"),
    );
    expect(deriveCanonicalTagId("Release")).not.toBe(
      deriveCanonicalTagId("release"),
    );
    expect(() => deriveCanonicalTagId("   ")).toThrow(/tag label/u);
  });

  it.each([
    ["id", { id: "" }],
    ["title", { title: 1 }],
    ["promptType", { promptType: "audio" }],
    ["visibility", { visibility: "public" }],
    ["variables", { variables: "bad" }],
    ["tags", { tags: [""] }],
    ["folderId", { folderId: 1 }],
    ["parentId", { parentId: "bad/id" }],
    ["order", { order: Number.NaN }],
    ["images", { images: ["../escape.png"] }],
    ["videos", { videos: ["C:\\escape.mp4"] }],
    ["isFavorite", { isFavorite: 1 }],
    ["currentVersion", { currentVersion: 0 }],
    ["usageCount", { usageCount: -1 }],
    ["createdAt", { createdAt: "invalid" }],
  ])("rejects malformed Prompt %s", (_field, override) => {
    expect(() =>
      createPromptResourceDocuments(createPrompt(override as Partial<Prompt>), [
        createVersion(1),
        createVersion(2),
      ]),
    ).toThrow();
  });

  it("validates variable fields and optional Prompt strings", () => {
    const prompt = createPrompt();
    expect(() =>
      createPromptResourceDocuments(
        { ...prompt, variables: [{ name: "", type: "text", required: true }] },
        [createVersion(1), createVersion(2)],
      ),
    ).toThrow(/variable name/u);
    expect(() =>
      createPromptResourceDocuments(
        {
          ...prompt,
          variables: [{ name: "x", type: "unknown" as "text", required: true }],
        },
        [createVersion(1), createVersion(2)],
      ),
    ).toThrow(/variable type/u);
    expect(() =>
      createPromptResourceDocuments(
        { ...prompt, notes: 1 as unknown as string },
        [createVersion(1), createVersion(2)],
      ),
    ).toThrow(/notes/u);
    expect(() =>
      createPromptResourceDocuments(
        { ...prompt, tags: [1 as unknown as string] },
        [createVersion(1), createVersion(2)],
      ),
    ).toThrow(/string array/u);
    expect(() =>
      createPromptResourceDocuments(
        {
          ...prompt,
          variables: [null as unknown as Prompt["variables"][number]],
        },
        [createVersion(1), createVersion(2)],
      ),
    ).toThrow(/must be an object/u);
    expect(() =>
      createPromptResourceDocuments(
        {
          ...prompt,
          variables: [
            {
              name: "x",
              type: "text",
              required: "yes" as unknown as boolean,
            },
          ],
        },
        [createVersion(1), createVersion(2)],
      ),
    ).toThrow(/variable required/u);
    expect(() =>
      createPromptResourceDocuments({ ...prompt, version: 1 }, [
        createVersion(1),
        createVersion(2),
      ]),
    ).toThrow(/equal currentVersion/u);
  });

  it("normalizes absent optional media arrays without losing other fields", () => {
    const documents = createPromptResourceDocuments(
      createPrompt({ images: undefined, videos: undefined }),
      [createVersion(1), createVersion(2)],
    );
    expect(documents.promptDocument.prompt.images).toEqual([]);
    expect(documents.promptDocument.prompt.videos).toEqual([]);
    expect(documents.promptDocument.mediaReferences).toEqual({
      images: [],
      videos: [],
    });
  });

  it("rejects missing, duplicate, mismatched, or path-inconsistent versions", () => {
    const prompt = createPrompt();
    expect(() => createPromptResourceDocuments(prompt, [])).toThrow(
      /current version/u,
    );
    expect(() =>
      createPromptResourceDocuments(prompt, [
        createVersion(1),
        createVersion(1),
      ]),
    ).toThrow(/duplicate version/u);
    expect(() =>
      createPromptResourceDocuments(prompt, [
        createVersion(1),
        { ...createVersion(2), promptId: "other" },
      ]),
    ).toThrow(/owning Prompt/u);
    expect(() =>
      createPromptResourceDocuments(prompt, [
        createVersion(1),
        { ...createVersion(2), id: "" },
      ]),
    ).toThrow(/version id/u);
    expect(() =>
      createPromptResourceDocuments(prompt, [
        createVersion(1),
        createVersion(2),
        createVersion(3),
      ]),
    ).toThrow(/newer than currentVersion/u);

    const documents = createPromptResourceDocuments(prompt, [
      createVersion(1),
      createVersion(2),
    ]);
    expect(() =>
      parsePromptResourceDocuments(JSON.stringify(documents.promptDocument), [
        {
          path: "versions/000003.json",
          text: JSON.stringify(documents.versionDocuments[0].document),
        },
        {
          path: documents.versionDocuments[1].path,
          text: JSON.stringify(documents.versionDocuments[1].document),
        },
      ]),
    ).toThrow(/version path/u);
  });

  it("fails closed for malformed JSON and unknown schema versions or kinds", () => {
    const documents = createPromptResourceDocuments(createPrompt(), [
      createVersion(1),
      createVersion(2),
    ]);
    expect(() => parsePromptResourceDocuments("{", [])).toThrow(
      /invalid JSON/u,
    );
    expect(() => parsePromptResourceDocuments("[]", [])).toThrow(
      /must be an object/u,
    );
    expect(() =>
      parsePromptResourceDocuments(
        JSON.stringify({ ...documents.promptDocument, prompt: null }),
        [],
      ),
    ).toThrow(/prompt must be an object/u);
    expect(() =>
      parsePromptResourceDocuments(
        JSON.stringify({ ...documents.promptDocument, schemaVersion: 2 }),
        [],
      ),
    ).toThrow(/schema version/u);
    expect(() =>
      parsePromptResourceDocuments(
        JSON.stringify({ ...documents.promptDocument, kind: "other" }),
        [],
      ),
    ).toThrow(/kind/u);
    expect(() =>
      parsePromptResourceDocuments(JSON.stringify(documents.promptDocument), [
        {
          path: documents.versionDocuments[0].path,
          text: JSON.stringify({
            ...documents.versionDocuments[0].document,
            schemaVersion: 2,
          }),
        },
      ]),
    ).toThrow(/schema version/u);
    expect(() =>
      parsePromptResourceDocuments(JSON.stringify(documents.promptDocument), [
        {
          path: documents.versionDocuments[0].path,
          text: JSON.stringify({
            ...documents.versionDocuments[0].document,
            version: null,
          }),
        },
      ]),
    ).toThrow(/version resource must be an object/u);
  });

  it("rejects tag and media metadata that diverge from the Prompt payload", () => {
    const documents = createPromptResourceDocuments(createPrompt(), [
      createVersion(1),
      createVersion(2),
    ]);
    expect(() =>
      parsePromptResourceDocuments(
        JSON.stringify({ ...documents.promptDocument, tagReferences: [] }),
        documents.versionDocuments.map((entry) => ({
          path: entry.path,
          text: JSON.stringify(entry.document),
        })),
      ),
    ).toThrow(/tag references/u);
    expect(() =>
      parsePromptResourceDocuments(
        JSON.stringify({
          ...documents.promptDocument,
          mediaReferences: { images: [], videos: [] },
        }),
        documents.versionDocuments.map((entry) => ({
          path: entry.path,
          text: JSON.stringify(entry.document),
        })),
      ),
    ).toThrow(/media references/u);
  });
});
