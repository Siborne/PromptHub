import { describe, expect, it, vi } from "vitest";
import {
  validateSkillName,
  getSkillNameError,
  parseSkillMd,
  validateSkillMd,
  validateSkillPackage,
} from "../../../src/main/services/skill-validator";

// ─────────────────────────────────────────────
// validateSkillName
// ─────────────────────────────────────────────
describe("validateSkillName", () => {
  it("accepts simple lowercase names", () => {
    expect(validateSkillName("hello")).toBe(true);
    expect(validateSkillName("a")).toBe(true);
    expect(validateSkillName("abc123")).toBe(true);
  });

  it("accepts hyphen-separated names", () => {
    expect(validateSkillName("my-skill")).toBe(true);
    expect(validateSkillName("a-b-c")).toBe(true);
    expect(validateSkillName("skill-2-go")).toBe(true);
  });

  it("rejects empty / falsy input", () => {
    expect(validateSkillName("")).toBe(false);
    expect(validateSkillName(null as unknown as string)).toBe(false);
    expect(validateSkillName(undefined as unknown as string)).toBe(false);
  });

  it("rejects names exceeding 64 characters", () => {
    const long = "a".repeat(65);
    expect(validateSkillName(long)).toBe(false);
    expect(validateSkillName("a".repeat(64))).toBe(true);
  });

  it("rejects uppercase characters", () => {
    expect(validateSkillName("Hello")).toBe(false);
    expect(validateSkillName("mySkill")).toBe(false);
  });

  it("rejects leading/trailing hyphens", () => {
    expect(validateSkillName("-skill")).toBe(false);
    expect(validateSkillName("skill-")).toBe(false);
    expect(validateSkillName("-")).toBe(false);
  });

  it("rejects consecutive hyphens", () => {
    expect(validateSkillName("my--skill")).toBe(false);
  });

  it("rejects special characters", () => {
    expect(validateSkillName("my_skill")).toBe(false);
    expect(validateSkillName("my skill")).toBe(false);
    expect(validateSkillName("my.skill")).toBe(false);
    expect(validateSkillName("my@skill")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(validateSkillName(123 as unknown as string)).toBe(false);
    expect(validateSkillName({} as unknown as string)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// getSkillNameError
// ─────────────────────────────────────────────
describe("getSkillNameError", () => {
  it("returns null for valid names", () => {
    expect(getSkillNameError("my-skill")).toBeNull();
    expect(getSkillNameError("abc123")).toBeNull();
  });

  it('returns "required" for empty/null input', () => {
    expect(getSkillNameError("")).toBe("Skill name is required");
    expect(getSkillNameError(null as unknown as string)).toBe(
      "Skill name is required",
    );
  });

  it('returns "exceed 64" for long names', () => {
    const msg = getSkillNameError("a".repeat(65));
    expect(msg).toContain("64");
  });

  it("returns specific message for uppercase", () => {
    expect(getSkillNameError("MySkill")).toBe("Skill name must be lowercase");
  });

  it("returns specific message for leading/trailing hyphen", () => {
    expect(getSkillNameError("-abc")).toBe(
      "Skill name cannot start or end with a hyphen",
    );
    expect(getSkillNameError("abc-")).toBe(
      "Skill name cannot start or end with a hyphen",
    );
  });

  it("returns specific message for consecutive hyphens", () => {
    expect(getSkillNameError("a--b")).toBe(
      "Skill name cannot contain consecutive hyphens",
    );
  });

  it("returns specific message for special characters", () => {
    expect(getSkillNameError("a_b")).toContain("only contain lowercase");
  });

  // Edge: name that starts with hyphen AND has uppercase — uppercase check runs first
  it("prioritises uppercase error over hyphen error", () => {
    const msg = getSkillNameError("-Abc");
    // The regex fails, then checks go in order: uppercase first
    expect(msg).toBe("Skill name must be lowercase");
  });
});

// ─────────────────────────────────────────────
// parseSkillMd
// ─────────────────────────────────────────────
describe("parseSkillMd", () => {
  it("returns null for empty/null/non-string input", () => {
    expect(parseSkillMd("")).toBeNull();
    expect(parseSkillMd(null as unknown as string)).toBeNull();
    expect(parseSkillMd(undefined as unknown as string)).toBeNull();
  });

  it("parses content without frontmatter as body-only", () => {
    const result = parseSkillMd("# Hello\nSome instructions");
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe("");
    expect(result!.body).toBe("# Hello\nSome instructions");
    expect(result!.raw).toBe("# Hello\nSome instructions");
  });

  it("parses standard frontmatter fields", () => {
    const md = `---
name: my-skill
description: A test skill
version: 1.0.0
author: John
license: MIT
---
# Instructions
Do something`;

    const result = parseSkillMd(md);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe("my-skill");
    expect(result!.frontmatter.description).toBe("A test skill");
    expect(result!.frontmatter.version).toBe("1.0.0");
    expect(result!.frontmatter.author).toBe("John");
    expect(result!.frontmatter.license).toBe("MIT");
    expect(result!.body).toBe("# Instructions\nDo something");
  });

  it("strips surrounding quotes from values", () => {
    const md = `---
name: "quoted-name"
description: 'single-quoted'
---
Body`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.name).toBe("quoted-name");
    expect(result!.frontmatter.description).toBe("single-quoted");
  });

  it("parses array tags in bracket notation", () => {
    const md = `---
name: t
tags: [ai, nlp, "coding"]
---
Body`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.tags).toEqual(["ai", "nlp", "coding"]);
  });

  it("parses comma-separated tags without brackets", () => {
    const md = `---
name: t
tags: ai, nlp, coding
---
Body`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.tags).toEqual(["ai", "nlp", "coding"]);
  });

  it("parses compatibility as comma-joined string from array", () => {
    const md = `---
name: t
compatibility: [claude, gpt4]
---
Body`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.compatibility).toBe("claude, gpt4");
  });

  it("parses metadata block", () => {
    const md = `---
name: my-skill
metadata:
  key1: val1
  key2: val2
---
Body`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.metadata).toEqual({
      key1: "val1",
      key2: "val2",
    });
  });

  it("parses YAML block scalars and standard allowed-tools metadata", () => {
    const md = `---
name: pdf-processing
description: |-
  Extracts text and tables from PDF files.
  Use when working with PDF documents.
allowed-tools: Read, Bash(git add *)
metadata:
  author: your-org
  version: "1.2"
---
# PDF Processing`;

    const result = parseSkillMd(md);

    expect(result?.frontmatter.description).toBe(
      "Extracts text and tables from PDF files.\nUse when working with PDF documents.",
    );
    expect(result?.frontmatter).toMatchObject({
      allowedTools: "Read, Bash(git add *)",
      metadata: { author: "your-org", version: "1.2" },
    });
  });

  it("applies YAML folded block scalar semantics", () => {
    const md = `---
name: folded-description
description: >-
  First trigger sentence.
  Second trigger sentence.
---
Body`;

    expect(parseSkillMd(md)?.frontmatter.description).toBe(
      "First trigger sentence. Second trigger sentence.",
    );
  });

  it("keeps allowed-tools string syntax intact", () => {
    const md = `---
name: tool-pattern
description: Tests tool patterns
allowed-tools: 'Read, Bash(python -c "a,b")'
---
Body`;

    expect(parseSkillMd(md)?.frontmatter.allowedTools).toBe(
      'Read, Bash(python -c "a,b")',
    );
  });

  it("rejects malformed YAML and non-object frontmatter roots", () => {
    expect(
      parseSkillMd(`---\nname: broken\ndescription: [unterminated\n---\nBody`),
    ).toBeNull();
    expect(parseSkillMd(`---\n- name: array-root\n---\nBody`)).toBeNull();
  });

  it("rejects custom tags, excessive aliases, and missing closing markers", () => {
    expect(
      parseSkillMd(`---\nname: tagged\ndescription: !env SECRET\n---\nBody`),
    ).toBeNull();

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
    expect(() => parseSkillMd(aliasHeavy)).not.toThrow();
    expect(parseSkillMd(aliasHeavy)).toBeNull();
    expect(parseSkillMd(`---\nname: missing-close\nBody`)).toBeNull();
  });

  it("parses CRLF frontmatter without changing body semantics", () => {
    const result = parseSkillMd(
      "---\r\nname: crlf-skill\r\ndescription: Works on Windows\r\n---\r\n# Body\r\nText",
    );
    expect(result?.frontmatter).toMatchObject({
      name: "crlf-skill",
      description: "Works on Windows",
    });
    expect(result?.body).toBe("# Body\r\nText");
  });

  it("exits metadata block when a top-level key appears", () => {
    const md = `---
name: my-skill
metadata:
  key1: val1
author: Jane
---
Body`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.metadata).toEqual({ key1: "val1" });
    expect(result!.frontmatter.author).toBe("Jane");
  });

  it("skips comment lines inside frontmatter", () => {
    const md = `---
name: my-skill
# this is a comment
description: test
---
Body`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.name).toBe("my-skill");
    expect(result!.frontmatter.description).toBe("test");
  });

  it("rejects invalid YAML lines without key-value syntax", () => {
    const md = `---
name: my-skill
this line has no colon
description: ok
---
Body`;

    expect(parseSkillMd(md)).toBeNull();
  });

  it("handles empty frontmatter as an empty YAML object", () => {
    const md = `---
---
Body here`;

    const result = parseSkillMd(md);
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe("");
    expect(result!.body).toBe("Body here");
  });

  it("handles frontmatter with empty body", () => {
    const md = `---
name: empty-body
---
`;

    const result = parseSkillMd(md);
    expect(result!.frontmatter.name).toBe("empty-body");
    expect(result!.body).toBe("");
  });
});

// ─────────────────────────────────────────────
// parseSkillMd — adversarial / fuzz-style edge cases
// ─────────────────────────────────────────────
describe("parseSkillMd adversarial inputs", () => {
  it("handles value containing a colon (e.g. URL)", () => {
    const md = `---
name: my-skill
description: See https://example.com:8080/path for details
---
Body`;
    const result = parseSkillMd(md);
    // The simple parser splits on first colon, so everything after "description:" is the value
    expect(result!.frontmatter.description).toBe(
      "See https://example.com:8080/path for details",
    );
  });

  it("handles value containing --- (should not break frontmatter parsing)", () => {
    const md = `---
name: my-skill
description: Use --- to separate sections
---
Body`;
    const result = parseSkillMd(md);
    // The description value contains --- but the regex captures minimally
    expect(result!.frontmatter.description).toBe(
      "Use --- to separate sections",
    );
  });

  it("handles frontmatter with trailing whitespace on --- markers", () => {
    const md = "---   \nname: trailing-ws\n---   \nBody";
    const result = parseSkillMd(md);
    expect(result!.frontmatter.name).toBe("trailing-ws");
    expect(result!.body).toBe("Body");
  });

  it("handles very long description value (4000 chars)", () => {
    const longDesc = "x".repeat(4000);
    const md = `---
name: my-skill
description: ${longDesc}
---
Body`;
    const result = parseSkillMd(md);
    expect(result!.frontmatter.description).toBe(longDesc);
  });

  it("handles Unicode CJK characters in all fields", () => {
    const md = `---
name: my-skill
description: 这是一个中文描述
author: 田中太郎
---
# 指南
使用说明`;
    const result = parseSkillMd(md);
    expect(result!.frontmatter.description).toBe("这是一个中文描述");
    expect(result!.frontmatter.author).toBe("田中太郎");
    expect(result!.body).toContain("使用说明");
  });

  it("handles emoji in values", () => {
    const md = `---
name: my-skill
description: A skill for 🎉 coding 🔥
---
Body`;
    const result = parseSkillMd(md);
    expect(result!.frontmatter.description).toBe("A skill for 🎉 coding 🔥");
  });

  it("ignores unknown keys gracefully", () => {
    const md = `---
name: my-skill
unknown_key: some-value
another: thing
description: real desc
---
Body`;
    const result = parseSkillMd(md);
    expect(result!.frontmatter.name).toBe("my-skill");
    expect(result!.frontmatter.description).toBe("real desc");
    // Unknown keys should not break parsing
  });

  it("rejects mismatched YAML quotes", () => {
    const md = `---
name: my-skill
description: "unclosed single
---
Body`;
    expect(parseSkillMd(md)).toBeNull();
  });

  it("handles empty tags array []", () => {
    const md = `---
name: my-skill
tags: []
---
Body`;
    const result = parseSkillMd(md);
    expect(result!.frontmatter.tags).toEqual([]);
  });

  it("handles tags with extra whitespace", () => {
    const md = `---
name: my-skill
tags: [  ai ,  nlp  ,  coding  ]
---
Body`;
    const result = parseSkillMd(md);
    expect(result!.frontmatter.tags).toEqual(["ai", "nlp", "coding"]);
  });

  it("handles multiple metadata entries then returns to top-level", () => {
    const md = `---
name: my-skill
metadata:
  k1: v1
  k2: v2
  k3: v3
version: 2.0.0
---
Body`;
    const result = parseSkillMd(md);
    expect(result!.frontmatter.metadata).toEqual({
      k1: "v1",
      k2: "v2",
      k3: "v3",
    });
    expect(result!.frontmatter.version).toBe("2.0.0");
  });

  it("handles Windows line endings (CRLF)", () => {
    const md = "---\r\nname: my-skill\r\ndescription: test\r\n---\r\nBody";
    const result = parseSkillMd(md);
    // The regex uses \n so \r\n might cause issues
    // This test documents actual behavior
    expect(result).not.toBeNull();
    if (result!.frontmatter.name === "my-skill") {
      expect(result!.frontmatter.name).toBe("my-skill");
    }
  });

  it("handles content that only has frontmatter delimiters, no body at all", () => {
    const md = `---
name: only-frontmatter
description: no body follows
---`;
    const result = parseSkillMd(md);
    // Depending on regex, there may or may not be a trailing newline
    expect(result).not.toBeNull();
    expect(result!.frontmatter.name).toBe("only-frontmatter");
  });
});

// ─────────────────────────────────────────────
// validateSkillMd
// ─────────────────────────────────────────────
describe("validateSkillMd", () => {
  it("returns invalid for unparseable content", () => {
    const result = validateSkillMd("");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Failed to parse SKILL.md content");
  });

  it("reports missing name as error", () => {
    const md = `---
description: test
---
Body`;

    const result = validateSkillMd(md);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Missing required field: name");
  });

  it("reports invalid name format as error", () => {
    const md = `---
name: My-Skill
---
Body`;

    const result = validateSkillMd(md);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid name"))).toBe(true);
  });

  it("warns when description is missing", () => {
    const md = `---
name: my-skill
---
Body`;

    const result = validateSkillMd(md);
    expect(result.valid).toBe(true);
    expect(result.warnings).toContain("Missing recommended field: description");
  });

  it("errors when description exceeds 1024 chars", () => {
    const md = `---
name: my-skill
description: ${"x".repeat(1025)}
---
Body`;

    const result = validateSkillMd(md);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("1024"))).toBe(true);
  });

  it("warns when body is empty", () => {
    const md = `---
name: my-skill
description: test
---
`;

    const result = validateSkillMd(md);
    expect(result.warnings).toContain(
      "SKILL.md has no content after frontmatter",
    );
  });

  it("warns when name does not match directoryName", () => {
    const md = `---
name: skill-a
description: test
---
Body`;

    const result = validateSkillMd(md, "skill-b");
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("does not match"))).toBe(
      true,
    );
  });

  it("passes for fully valid SKILL.md", () => {
    const md = `---
name: my-skill
description: A good skill
version: 1.0.0
---
# Instructions
Do things`;

    const result = validateSkillMd(md);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data).toBeDefined();
    expect(result.data!.frontmatter.name).toBe("my-skill");
  });

  it("no directory mismatch warning when directoryName matches", () => {
    const md = `---
name: my-skill
description: test
---
Body`;

    const result = validateSkillMd(md, "my-skill");
    expect(result.warnings.some((w) => w.includes("does not match"))).toBe(
      false,
    );
  });
});

// ─────────────────────────────────────────────
// validateSkillPackage
// ─────────────────────────────────────────────
describe("validateSkillPackage", () => {
  function makeMockFs(files: Record<string, string>, isDir = true) {
    return {
      readFile: vi.fn(async (p: string) => {
        if (p in files) return files[p];
        throw new Error(`ENOENT: ${p}`);
      }),
      access: vi.fn(async () => {}),
      stat: vi.fn(async () => ({ isDirectory: () => isDir })),
    };
  }

  const mockPath = {
    join: (...args: string[]) => args.join("/"),
    basename: (p: string) => p.split("/").pop()!,
  };

  it("returns error if path is not a directory", async () => {
    const fs = makeMockFs({}, false);
    const result = await validateSkillPackage("/fake", fs, mockPath);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Path is not a directory");
  });

  it("returns error if SKILL.md is missing", async () => {
    const fs = makeMockFs({});
    const result = await validateSkillPackage("/skills/my-skill", fs, mockPath);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("SKILL.md file not found");
  });

  it("validates SKILL.md content and returns errors/warnings", async () => {
    const skillMd = `---
name: My-Skill
---
Body`;

    const fs = makeMockFs({ "/skills/my-skill/SKILL.md": skillMd });
    const result = await validateSkillPackage("/skills/my-skill", fs, mockPath);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Invalid name"))).toBe(true);
  });

  it("warns if name does not match directory name", async () => {
    const skillMd = `---
name: other-name
description: test
---
Body`;

    const fs = makeMockFs({ "/skills/my-skill/SKILL.md": skillMd });
    const result = await validateSkillPackage("/skills/my-skill", fs, mockPath);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("does not match"))).toBe(
      true,
    );
  });

  it("warns if manifest.json has invalid JSON", async () => {
    const skillMd = `---
name: my-skill
description: test
---
Body`;

    const fs = makeMockFs({
      "/skills/my-skill/SKILL.md": skillMd,
      "/skills/my-skill/manifest.json": "not-json{",
    });
    const result = await validateSkillPackage("/skills/my-skill", fs, mockPath);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("invalid JSON"))).toBe(true);
  });

  it("passes valid package with manifest.json", async () => {
    const skillMd = `---
name: my-skill
description: test
---
Body`;

    const fs = makeMockFs({
      "/skills/my-skill/SKILL.md": skillMd,
      "/skills/my-skill/manifest.json": '{"version":"1.0.0"}',
    });
    const result = await validateSkillPackage("/skills/my-skill", fs, mockPath);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("catches unexpected exceptions gracefully", async () => {
    const fs = {
      readFile: vi.fn(async () => {
        throw new Error("boom");
      }),
      access: vi.fn(async () => {}),
      stat: vi.fn(async () => {
        throw new Error("stat failed");
      }),
    };
    const result = await validateSkillPackage("/bad-path", fs, mockPath);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Failed to validate");
  });
});
