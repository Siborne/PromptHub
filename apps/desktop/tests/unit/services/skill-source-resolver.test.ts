import { describe, expect, it } from "vitest";

import type { RegistrySkill } from "@prompthub/shared/types";
import {
  getRegistrySkillDirectory,
  getRegistrySkillSourceResolverKind,
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
