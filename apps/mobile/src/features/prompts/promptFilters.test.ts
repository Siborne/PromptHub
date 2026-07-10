import { describe, expect, it } from "vitest";

import type { MobilePromptSummary } from "./data/promptRepository";
import { filterPrompts } from "./promptFilters";

const prompts: MobilePromptSummary[] = [
  {
    id: "1",
    title: "Release Review",
    description: "Check the stable build",
    tags: ["release"],
    isFavorite: true,
    updatedAt: "2026-07-10T00:00:00.000Z",
    userPrompt: "Review",
    systemPrompt: "",
  },
  {
    id: "2",
    title: "Translate",
    description: "Localize copy",
    tags: [],
    isFavorite: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    userPrompt: "Translate this",
    systemPrompt: "",
  },
];

describe("mobile Prompt filters", () => {
  it("searches title, description, body, and tags case-insensitively", () => {
    expect(filterPrompts(prompts, "STABLE", "all")).toHaveLength(1);
    expect(filterPrompts(prompts, "release", "all")).toHaveLength(1);
    expect(filterPrompts(prompts, "translate this", "all")).toHaveLength(1);
  });

  it("applies favorite, tagged, and recent filters", () => {
    expect(
      filterPrompts(prompts, "", "favorite").map((item) => item.id),
    ).toEqual(["1"]);
    expect(filterPrompts(prompts, "", "tags").map((item) => item.id)).toEqual([
      "1",
    ]);
    expect(
      filterPrompts(
        prompts,
        "",
        "recent",
        new Date("2026-07-10T12:00:00.000Z"),
      ).map((item) => item.id),
    ).toEqual(["1"]);
  });

  it("returns all records for blank search and the all filter", () => {
    expect(filterPrompts(prompts, "  ", "all")).toEqual(prompts);
  });
});
