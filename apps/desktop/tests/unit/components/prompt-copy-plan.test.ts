import { describe, expect, it } from "vitest";
import type { OutputFormatItem, Prompt } from "@prompthub/shared/types";

import { getPromptCopyPlan } from "../../../src/renderer/components/layout/usePromptWorkspaceCopyFlow";

function createPrompt(id: string): Prompt {
  return {
    id,
    title: id,
    description: "",
    systemPrompt: "",
    userPrompt: `${id} body`,
    variables: [],
    tags: [],
    folderId: null,
    parentId: null,
    order: 0,
    isFavorite: false,
    isPinned: false,
    version: 1,
    currentVersion: 1,
    usageCount: 0,
    createdAt: "2026-07-30T00:00:00.000Z",
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
}

function createItem(
  id: string,
  targetPromptId: string | null,
  sortOrder: number,
): OutputFormatItem {
  return {
    id,
    sourcePromptId: "source",
    targetPromptId,
    sortOrder,
    createdAt: `2026-07-30T00:00:0${sortOrder}.000Z`,
    updatedAt: "2026-07-30T00:00:00.000Z",
  };
}

describe("getPromptCopyPlan", () => {
  it("keeps source attribution while ordering target prompts", () => {
    const source = createPrompt("source");
    const first = createPrompt("first");
    const second = createPrompt("second");
    const promptById = new Map([
      [source.id, source],
      [first.id, first],
      [second.id, second],
    ]);

    const plan = getPromptCopyPlan(
      source,
      [
        createItem("second-item", "second", 2),
        createItem("first-item", "first", 1),
      ],
      promptById,
    );

    expect(plan.sourcePromptId).toBe("source");
    expect(plan.prompts.map((item) => item.id)).toEqual(["first", "second"]);
  });

  it("falls back to the source when every configured target is missing", () => {
    const source = createPrompt("source");

    expect(
      getPromptCopyPlan(
        source,
        [createItem("missing", "missing", 0)],
        new Map([[source.id, source]]),
      ).prompts,
    ).toEqual([source]);
  });

  it("looks up only selected output targets in a large unrelated workspace", () => {
    const source = createPrompt("source");
    const target = createPrompt("target");
    let promptLookups = 0;
    const promptById = new (class extends Map<string, Prompt> {
      override get(key: string) {
        promptLookups += 1;
        return super.get(key);
      }
    })([
      [source.id, source],
      [target.id, target],
    ]);
    const unrelated = Array.from({ length: 10_000 }, (_, index) => ({
      ...createItem(`unrelated-${index}`, null, index),
      sourcePromptId: `other-${index}`,
      createdAt: "2026-07-30T00:00:00.000Z",
    }));

    const plan = getPromptCopyPlan(
      source,
      [...unrelated, createItem("selected", "target", 0)],
      promptById,
    );

    expect(plan.prompts).toEqual([target]);
    expect(promptLookups).toBe(1);
  });
});
