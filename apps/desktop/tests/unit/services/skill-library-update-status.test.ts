import { describe, expect, it } from "vitest";
import type { RegistrySkill, Skill } from "@prompthub/shared/types";
import { SKILL_PACKAGE_FINGERPRINT_ALGORITHM } from "@prompthub/shared/utils/skill-source-update";
import { getSkillsWithStoreUpdates } from "../../../src/renderer/services/skill-library-update-status";
import { createSkillFixture } from "../../fixtures/skills";

function registrySkill(overrides: Partial<RegistrySkill> = {}): RegistrySkill {
  return {
    slug: "writer",
    name: "Writer",
    description: "Write better",
    category: "general",
    author: "PromptHub",
    source_id: "source-writer",
    source_url: "https://gitea.example.com/team/skills/tree/main/writer",
    content_url:
      "https://gitea.example.com/team/skills/raw/branch/main/writer/SKILL.md",
    tags: ["writing"],
    version: "1.0.0",
    content: "# Writer",
    ...overrides,
  };
}

function installedSkill(overrides: Partial<Skill> = {}): Skill {
  return createSkillFixture({
    id: "skill-writer",
    name: "writer",
    registry_slug: "writer",
    source_id: "source-writer",
    source_url: "https://gitea.example.com/team/skills/tree/main/writer",
    content_url:
      "https://gitea.example.com/team/skills/raw/branch/main/writer/SKILL.md",
    installed_version: "1.0.0",
    ...overrides,
  });
}

describe("Skill library update badges", () => {
  it("does not mark a just-installed Skill updated when another store reuses its slug", () => {
    const installed = installedSkill();
    const collision = registrySkill({
      source_id: "source-unrelated-writer",
      source_url: "https://github.com/unrelated/skills/tree/main/writer",
      content_url:
        "https://raw.githubusercontent.com/unrelated/skills/main/writer/SKILL.md",
      version: "9.0.0",
    });

    expect(
      getSkillsWithStoreUpdates([installed], [registrySkill(), collision]),
    ).toEqual(new Set());
  });

  it("uses content URL and then matching source URL when a source id is absent", () => {
    const byContentUrl = installedSkill({ source_id: "old-source-id" });
    const bySourceUrl = installedSkill({
      id: "skill-source-url",
      source_id: undefined,
      content_url: undefined,
    });

    expect(
      getSkillsWithStoreUpdates(
        [byContentUrl, bySourceUrl],
        [
          registrySkill({ source_id: "new-source-id", version: "2.0.0" }),
          registrySkill({
            source_id: undefined,
            content_url: undefined,
            version: "2.0.0",
          }),
        ],
      ),
    ).toEqual(new Set([byContentUrl.id, bySourceUrl.id]));
  });

  it("does not match an explicit source by slug or a shared repo with another name", () => {
    const explicitSource = installedSkill({
      source_id: "missing-source",
      content_url: undefined,
    });

    expect(
      getSkillsWithStoreUpdates(
        [explicitSource],
        [
          registrySkill({
            source_id: "different-source",
            source_url:
              "https://gitea.example.com/other/skills/tree/main/writer",
            version: "2.0.0",
          }),
          registrySkill({
            source_id: "shared-repo-other-skill",
            name: "Other",
            install_name: "other",
            slug: "other",
            version: "2.0.0",
          }),
        ],
      ),
    ).toEqual(new Set());
  });

  it("allows only a unique slug fallback for legacy Skills", () => {
    const legacy = installedSkill({
      source_id: undefined,
      source_url: undefined,
      content_url: undefined,
    });
    const first = registrySkill({ source_id: "source-one", version: "2.0.0" });
    const second = registrySkill({ source_id: "source-two", version: "3.0.0" });

    expect(getSkillsWithStoreUpdates([legacy], [first])).toEqual(
      new Set([legacy.id]),
    );
    expect(getSkillsWithStoreUpdates([legacy], [first, second])).toEqual(
      new Set(),
    );
    expect(
      getSkillsWithStoreUpdates(
        [{ ...legacy, registry_slug: undefined }],
        [first],
      ),
    ).toEqual(new Set());
  });

  it("prefers package fingerprints over noisy version labels", () => {
    const installed = installedSkill({
      installed_directory_fingerprint: "package-v1",
      fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    });

    expect(
      getSkillsWithStoreUpdates(
        [installed],
        [
          registrySkill({
            version: "2.0.0",
            directory_fingerprint: "package-v1",
          }),
        ],
      ),
    ).toEqual(new Set());
    expect(
      getSkillsWithStoreUpdates(
        [installed],
        [
          registrySkill({
            version: "1.0.0",
            directory_fingerprint: "package-v2",
          }),
        ],
      ),
    ).toEqual(new Set([installed.id]));

    expect(
      getSkillsWithStoreUpdates(
        [
          installedSkill({
            installed_directory_fingerprint: "legacy-package",
            fingerprint_algorithm: "legacy-stable-text-v1",
          }),
        ],
        [registrySkill({ directory_fingerprint: "package-v2" })],
      ),
    ).toEqual(new Set());
  });

  it("suppresses conflicting duplicate exact-source cache entries", () => {
    const installed = installedSkill();

    expect(
      getSkillsWithStoreUpdates(
        [installed],
        [
          registrySkill({ version: "2.0.0" }),
          registrySkill({ version: "1.0.0" }),
        ],
      ),
    ).toEqual(new Set());
    expect(
      getSkillsWithStoreUpdates(
        [installed],
        [
          registrySkill({ version: "2.0.0" }),
          registrySkill({ version: "3.0.0" }),
        ],
      ),
    ).toEqual(new Set([installed.id]));
  });
});
