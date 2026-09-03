import { describe, expect, it } from "vitest";
import type { Skill } from "@prompthub/shared/types";
import {
  collectSkillTagOptions,
  filterSkillTagOptions,
} from "../../../src/renderer/services/skill-tag-options";

function skill(tags: string[] | undefined): Pick<Skill, "tags"> {
  return { tags };
}

describe("collectSkillTagOptions", () => {
  it("returns a unique, trimmed, non-empty, sorted list across skills", () => {
    const options = collectSkillTagOptions([
      skill(["writer", "editorial"]),
      skill(["writer", ""]),
      skill(["  editor  "]),
      skill([undefined as unknown as string]),
      skill(undefined),
      skill([]),
      skill([null as unknown as string]),
    ]);
    expect(options).toEqual(["editor", "editorial", "writer"]);
  });

  it("returns an empty list when no skills carry tags", () => {
    expect(collectSkillTagOptions([])).toEqual([]);
    expect(
      collectSkillTagOptions([
        skill([]),
        skill(undefined),
        skill([""]),
        skill(["   "]),
      ]),
    ).toEqual([]);
  });

  it("sorts consistently and independently of input order", () => {
    const input = [skill(["writer"]), skill(["editorial"]), skill(["writer"])];
    expect(collectSkillTagOptions(input)).toEqual(["editorial", "writer"]);
    // Reverse input order must yield the same sorted result.
    expect(collectSkillTagOptions([...input].reverse())).toEqual([
      "editorial",
      "writer",
    ]);
  });
});

describe("filterSkillTagOptions", () => {
  const options = ["alpha", "editor", "Editorial", "writer"];

  it("returns all options for a blank or whitespace query", () => {
    expect(filterSkillTagOptions(options, "")).toEqual(options);
    expect(filterSkillTagOptions(options, "   ")).toEqual(options);
  });

  it("matches case-insensitive substrings", () => {
    expect(filterSkillTagOptions(options, "EDIT")).toEqual([
      "editor",
      "Editorial",
    ]);
    expect(filterSkillTagOptions(options, "ed")).toEqual([
      "editor",
      "Editorial",
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(filterSkillTagOptions(options, "nope")).toEqual([]);
  });

  it("handles an empty option set", () => {
    expect(filterSkillTagOptions([], "anything")).toEqual([]);
    expect(filterSkillTagOptions([], "")).toEqual([]);
  });
});
