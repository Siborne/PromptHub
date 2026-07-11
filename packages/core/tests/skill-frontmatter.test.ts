import { describe, expect, it } from "vitest";

import {
  parseSkillMd,
  serializeSkillMd,
} from "../src/skills/skill-frontmatter";

describe("shared SKILL.md frontmatter", () => {
  it("parses YAML scalar, collection, metadata, and CRLF forms", () => {
    const parsed = parseSkillMd(
      [
        "---",
        "name: yaml-skill",
        "description: |-",
        "  First line.",
        "  Second line.",
        "version: 1.2",
        "author: false",
        "license: MIT",
        "compatibility: [claude, codex]",
        "tags: ai, yaml",
        "allowed-tools: 'Read, Bash(python -c \"a,b\")'",
        "metadata:",
        '  owner: "team-a"',
        "  revision: 3",
        "  enabled: true",
        "  nested:",
        "    ignored: normalized-view",
        "x-extension: keep-me",
        "---",
        "# Body",
      ].join("\r\n"),
    );

    expect(parsed?.frontmatter).toEqual({
      name: "yaml-skill",
      description: "First line.\nSecond line.",
      version: "1.2",
      author: "false",
      license: "MIT",
      compatibility: "claude, codex",
      tags: ["ai", "yaml"],
      metadata: { owner: "team-a", revision: "3", enabled: "true" },
      allowedTools: 'Read, Bash(python -c "a,b")',
    });
    expect(parsed?.rawFrontmatter).toMatchObject({
      metadata: { nested: { ignored: "normalized-view" } },
      "x-extension": "keep-me",
    });
    expect(parsed?.body).toBe("# Body");
  });

  it("supports folded blocks, empty collections, and array allowed-tools", () => {
    const parsed = parseSkillMd(`---
name: folded
description: >-
  First sentence.
  Second sentence.
tags: []
allowed-tools: [Read, Write]
metadata: {}
---
Body`);

    expect(parsed?.frontmatter).toMatchObject({
      description: "First sentence. Second sentence.",
      tags: [],
      allowedTools: "Read, Write",
    });
    expect(parsed?.frontmatter.metadata).toBeUndefined();
  });

  it("keeps body-only and empty-frontmatter files compatible", () => {
    expect(parseSkillMd("  # Body only  ")).toEqual({
      frontmatter: { name: "" },
      rawFrontmatter: {},
      body: "# Body only",
      raw: "  # Body only  ",
    });
    expect(parseSkillMd("---\n---\nBody")).toMatchObject({
      frontmatter: { name: "" },
      rawFrontmatter: {},
      body: "Body",
    });
  });

  it("rejects invalid inputs and unsafe YAML features", () => {
    const aliasHeavy = `---
name: alias-heavy
a: &a [x, x]
b: &b [*a, *a]
c: &c [*b, *b]
d: &d [*c, *c]
e: &e [*d, *d]
f: &f [*e, *e]
metadata: *f
---
Body`;
    const rejected = [
      "",
      "---\nname: missing-close",
      "---\nname: duplicate\nname: duplicate\n---\nBody",
      "---\nname: tagged\ndescription: !env SECRET\n---\nBody",
      "---\n- name: array-root\n---\nBody",
      "---\nname: broken\ndescription: [unterminated\n---\nBody",
      aliasHeavy,
    ];

    for (const input of rejected) expect(parseSkillMd(input)).toBeNull();
    expect(parseSkillMd(null as unknown as string)).toBeNull();
  });

  it("serializes new documents with standard fields", () => {
    const serialized = serializeSkillMd({
      name: "new-skill",
      description: "Line one.\nLine two.",
      version: "1.0",
      author: "Team",
      license: "Apache-2.0",
      compatibility: "claude",
      tags: ["one", "two"],
      metadata: { owner: "team-a" },
      allowedTools: "Read, Write",
      instructions: "# Instructions",
    });

    expect(parseSkillMd(serialized)).toMatchObject({
      frontmatter: {
        name: "new-skill",
        description: "Line one.\nLine two.",
        version: "1.0",
        author: "Team",
        license: "Apache-2.0",
        compatibility: "claude",
        tags: ["one", "two"],
        metadata: { owner: "team-a" },
        allowedTools: "Read, Write",
      },
      body: "# Instructions",
    });
  });

  it("serializes minimal documents and treats invalid embedded frontmatter as body", () => {
    expect(parseSkillMd(serializeSkillMd({ name: "minimal" }))).toMatchObject({
      frontmatter: { name: "minimal", compatibility: "prompthub" },
      body: "",
    });

    const invalidEmbedded = "---\nname: missing-close";
    expect(
      parseSkillMd(
        serializeSkillMd({
          name: "invalid-embedded",
          instructions: invalidEmbedded,
        }),
      )?.body,
    ).toBe(invalidEmbedded);
  });

  it("preserves extension fields and removes explicitly cleared fields", () => {
    const serialized = serializeSkillMd({
      name: "updated-skill",
      description: undefined,
      version: undefined,
      author: undefined,
      license: undefined,
      tags: [],
      compatibility: ["claude", "codex"],
      instructions: "Body",
      preservedFrontmatter: {
        name: "old-skill",
        description: "Old",
        version: "1",
        author: "Old author",
        license: "MIT",
        tags: ["old"],
        metadata: { nested: { preserved: true } },
        "allowed-tools": "Read",
        "x-extension": "keep-me",
      },
    });
    const parsed = parseSkillMd(serialized);

    expect(parsed?.frontmatter).toMatchObject({
      name: "updated-skill",
      compatibility: "claude, codex",
      allowedTools: "Read",
    });
    expect(parsed?.frontmatter.description).toBeUndefined();
    expect(parsed?.frontmatter.version).toBeUndefined();
    expect(parsed?.frontmatter.author).toBeUndefined();
    expect(parsed?.frontmatter.license).toBeUndefined();
    expect(parsed?.frontmatter.tags).toBeUndefined();
    expect(parsed?.rawFrontmatter).toMatchObject({
      metadata: { nested: { preserved: true } },
      "allowed-tools": "Read",
      "x-extension": "keep-me",
    });
  });

  it("preserves parsed frontmatter and defaults compatibility for plain bodies", () => {
    const existing = `---
name: existing
description: Existing description
x-extension: keep-me
---
# Existing body`;
    const reparsed = parseSkillMd(
      serializeSkillMd({ name: "existing", instructions: existing }),
    );
    expect(reparsed?.rawFrontmatter).toMatchObject({
      description: "Existing description",
      compatibility: ["prompthub"],
      "x-extension": "keep-me",
    });

    const plain = parseSkillMd(
      serializeSkillMd({ name: "plain", instructions: "  Plain body  " }),
    );
    expect(plain).toMatchObject({
      frontmatter: { name: "plain", compatibility: "prompthub" },
      body: "Plain body",
    });
  });
});
