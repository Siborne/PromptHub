import { describe, expect, it } from "vitest";

import { createCliSkillService } from "@prompthub/core";
import { parseSkillMd } from "@prompthub/core/cli/skill/parse";
import type { Skill } from "@prompthub/shared/types";

const SKILL_MD = `---
name: pdf-processing
description: |-
  Extracts text and tables from PDF files.
  Use when working with PDF documents.
license: Apache-2.0
version: "2.0"
allowed-tools: Read, Bash(git add *)
metadata:
  author: your-org
  version: "1.2"
x-extension: keep-me
---

# PDF Processing

Body content here.`;

describe("CLI SKILL.md frontmatter", () => {
  it("uses the shared YAML parser for block scalars and standard fields", () => {
    const parsed = parseSkillMd(SKILL_MD);

    expect(parsed?.frontmatter.description).toBe(
      "Extracts text and tables from PDF files.\nUse when working with PDF documents.",
    );
    expect(parsed?.frontmatter).toMatchObject({
      license: "Apache-2.0",
      allowedTools: "Read, Bash(git add *)",
      metadata: { author: "your-org", version: "1.2" },
    });
  });

  it("preserves file-owned fields when CLI export receives a full SKILL.md", () => {
    const service = createCliSkillService();
    const skill: Skill = {
      id: "skill-1",
      name: "pdf-processing",
      description:
        "Extracts text and tables from PDF files.\nUse when working with PDF documents.",
      instructions: SKILL_MD,
      protocol_type: "skill",
      tags: ["pdf"],
      is_favorite: false,
      created_at: 1,
      updated_at: 1,
    };

    const exported = service.exportAsSkillMd(skill);
    const reparsed = parseSkillMd(exported);

    expect(exported.match(/^---$/gm)).toHaveLength(2);
    expect(reparsed?.frontmatter).toMatchObject({
      version: "2.0",
      allowedTools: "Read, Bash(git add *)",
      metadata: { author: "your-org", version: "1.2" },
    });
    expect(reparsed?.rawFrontmatter).toMatchObject({
      "x-extension": "keep-me",
    });
    expect(reparsed?.body).toContain("# PDF Processing");
  });
});
