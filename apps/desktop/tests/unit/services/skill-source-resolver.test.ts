import { describe, expect, it } from "vitest";

import type { RegistrySkill } from "@prompthub/shared/types";
import {
  getRegistrySkillDirectory,
  getRegistrySkillSourceReference,
  getRegistrySkillSourceResolverKind,
  normalizeLocalRegistryDirectory,
  normalizeRemoteDirectoryFingerprint,
  shouldCloneRegistrySkillPackage,
} from "../../../src/renderer/services/skill-source-resolver";
import { createSkillFixture } from "../../fixtures/skills";

function createRegistrySkillFixture(
  overrides: Partial<RegistrySkill> = {},
): RegistrySkill {
  return {
    slug: "writer",
    name: "Writer",
    install_name: "writer",
    description: "Write better",
    category: "writing",
    author: "PromptHub",
    source_url: "https://example.com/skills/writer",
    version: "1.0.0",
    content: "# Writer\n",
    tags: ["writing"],
    ...overrides,
  };
}

describe("skill source resolver", () => {
  it("classifies remote zip, git package, raw content URL, linked local, and managed copy sources", () => {
    expect(
      getRegistrySkillSourceResolverKind(
        createRegistrySkillFixture({
          package_url: "https://example.com/release/skill.zip",
        }),
      ),
    ).toBe("remote-zip");

    expect(
      getRegistrySkillSourceResolverKind(
        createRegistrySkillFixture({
          source_url: "https://github.com/example/skills/tree/main/writer",
          source_directory: "writer",
          content_url:
            "https://raw.githubusercontent.com/example/skills/main/writer/SKILL.md",
        }),
      ),
    ).toBe("remote-git");

    expect(
      getRegistrySkillSourceResolverKind(
        createRegistrySkillFixture({
          source_url: "",
          content_url: "https://example.com/skills/writer/SKILL.md",
        }),
      ),
    ).toBe("content-url");

    expect(
      getRegistrySkillSourceResolverKind(
        createRegistrySkillFixture({
          source_url: "/Users/me/skills/writer",
          content_url: "/Users/me/skills/writer",
        }),
        createSkillFixture({
          local_repo_path: "/Users/me/skills/writer",
          source_url: "/Users/me/skills/writer",
        }),
      ),
    ).toBe("local-linked");

    expect(
      getRegistrySkillSourceResolverKind(
        createRegistrySkillFixture({
          source_url: "",
          content_url: "",
        }),
        createSkillFixture({
          local_repo_path:
            "/Users/me/Library/Application Support/PromptHub/data/skills/writer/repo",
        }),
      ),
    ).toBe("managed-copy");
  });

  it("derives package directories from explicit source directory before canonical skill path", () => {
    expect(
      getRegistrySkillDirectory(
        createRegistrySkillFixture({
          source_directory: "skills/writer",
          canonical_skill_path: "fallback/SKILL.md",
        }),
      ),
    ).toBe("skills/writer");

    expect(
      getRegistrySkillDirectory(
        createRegistrySkillFixture({
          source_directory: "",
          canonical_skill_path: "skills/writer/SKILL.md",
        }),
      ),
    ).toBe("skills/writer");

    expect(
      getRegistrySkillDirectory(
        createRegistrySkillFixture({
          source_directory: "",
          canonical_skill_path: "SKILL.md",
        }),
      ),
    ).toBeUndefined();
  });

  it("returns a diagnostic reference for each supported source kind", () => {
    expect(
      getRegistrySkillSourceReference(
        createRegistrySkillFixture({
          package_url: "https://example.com/release/skill.zip",
        }),
      ),
    ).toEqual({
      kind: "remote-zip",
      reference: "https://example.com/release/skill.zip",
    });

    expect(
      getRegistrySkillSourceReference(
        createRegistrySkillFixture({
          source_url: "https://github.com/example/skills/tree/main/writer",
          source_directory: "writer",
          content_url:
            "https://raw.githubusercontent.com/example/skills/main/writer/SKILL.md",
        }),
      ),
    ).toEqual({
      kind: "remote-git",
      reference: "https://github.com/example/skills/tree/main/writer",
    });

    expect(
      getRegistrySkillSourceReference(
        createRegistrySkillFixture({
          source_url: "",
          content_url: "https://example.com/skills/writer/SKILL.md",
        }),
      ),
    ).toEqual({
      kind: "content-url",
      reference: "https://example.com/skills/writer/SKILL.md",
    });

    expect(
      getRegistrySkillSourceReference(
        createRegistrySkillFixture({
          source_url: "https://example.com/store",
          content_url: "",
        }),
      ),
    ).toEqual({
      kind: "remote-store",
      reference: "https://example.com/store",
    });

    expect(
      getRegistrySkillSourceReference(
        createRegistrySkillFixture({
          source_url: "/Users/me/skills/writer",
          content_url: "https://example.com/skills/writer/SKILL.md",
        }),
      ),
    ).toEqual({
      kind: "local-linked",
      reference: "/Users/me/skills/writer",
    });
    expect(
      normalizeLocalRegistryDirectory({
        source_url: "/Users/me/skills/writer",
        content_url: "https://example.com/skills/writer/SKILL.md",
      }),
    ).toBe("/Users/me/skills/writer");

    expect(
      getRegistrySkillSourceReference(
        createRegistrySkillFixture({ source_url: "", content_url: "" }),
        createSkillFixture({
          local_repo_path: "/Users/me/managed/writer",
        }),
      ),
    ).toEqual({
      kind: "managed-copy",
      reference: "/Users/me/managed/writer",
    });

    expect(
      getRegistrySkillSourceReference(
        createRegistrySkillFixture({
          source_url: "file:///bad%ZZ",
          content_url: "",
          source_label: "Personal files",
        }),
      ),
    ).toEqual({
      kind: "local-linked",
      reference: "file:///bad%ZZ",
    });
  });

  it("does not treat a raw content URL as a package even when the registry carries a stale directory fingerprint", () => {
    const rawContentUrlSkill = createRegistrySkillFixture({
      source_url: "",
      content_url: "https://example.com/skills/writer/SKILL.md",
      directory_fingerprint: "stale-registry-package",
    });

    expect(shouldCloneRegistrySkillPackage(rawContentUrlSkill)).toBe(false);
    expect(
      normalizeRemoteDirectoryFingerprint(rawContentUrlSkill, {
        remoteContentHash: "content-sha",
        resolvedDirectoryFingerprint: "stale-registry-package",
      }),
    ).toBe("content-sha");
  });
});
