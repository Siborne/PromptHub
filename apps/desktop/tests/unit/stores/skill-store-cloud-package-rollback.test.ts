import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RegistrySkill } from "@prompthub/shared/types";
import { syncRemoteRegistrySkillRepo } from "../../../src/renderer/stores/skill/skill-source-update-remote";
import { installWindowMocks } from "../../helpers/window";

function cloudPackage() {
  return {
    listing: {
      id: "listing:rollback",
      sourceType: "skill",
      sourceId: "source-rollback",
      slug: "rollback",
      title: "Rollback",
      summary: "Rollback test",
    },
    updateStatus: "update_available" as const,
    release: {
      id: "release-rollback",
      packageVersionId: "package-rollback",
      versionLabel: "1.1.0",
      sourceRevision: null,
      fingerprintAlgorithm: "store-package-sha256-v1",
      contentFingerprint: "cloud-fingerprint",
      diff: {
        added: ["scripts/run.sh"],
        removed: [],
        modified: ["SKILL.md"],
        metadataChanged: false,
        compatibilityChanged: false,
        environmentChanged: false,
        permissionsChanged: false,
      },
      publishedAt: null,
    },
    package: {
      schemaVersion: "1",
      version: "1.1.0",
      metadata: {},
      files: [
        { path: "SKILL.md", content: "# New\n" },
        { path: "scripts/run.sh", content: "echo new\n" },
      ],
      compatibility: [],
      environment: [],
      permissions: [],
    },
  };
}

describe("Cloud Skill package writes", () => {
  beforeEach(() => {
    installWindowMocks();
  });

  it("restores already-written files and removes new files after a partial write", async () => {
    let writeCount = 0;
    const writeLocalFile = vi.fn(async () => {
      writeCount += 1;
      if (writeCount === 2) throw new Error("disk full");
    });
    const deleteLocalFile = vi.fn().mockResolvedValue(undefined);
    (window as any).api.skill.writeLocalFile = writeLocalFile;
    (window as any).api.skill.deleteLocalFile = deleteLocalFile;
    (window as any).api.skill.readLocalFiles = vi.fn().mockResolvedValue([
      { path: "SKILL.md", content: "# Old\n", isDirectory: false },
    ]);
    (window as any).api.cloud = {
      store: { getPackage: vi.fn().mockResolvedValue(cloudPackage()) },
    };

    const registrySkill = {
      slug: "rollback",
      source_id: "cloud:listing:rollback",
      name: "Rollback",
      description: "Rollback test",
      category: "general",
      author: "PromptHub Cloud",
      source_url: "cloud://store/listings/rollback",
      tags: [],
      version: "1.1.0",
      content: "# New\n",
    } satisfies RegistrySkill;

    await expect(
      syncRemoteRegistrySkillRepo("skill-rollback", registrySkill, "# New\n"),
    ).rejects.toThrow("disk full");
    expect(writeLocalFile).toHaveBeenNthCalledWith(
      3,
      "skill-rollback",
      "SKILL.md",
      "# Old\n",
      { skipVersionSnapshot: true },
    );
    expect(deleteLocalFile).toHaveBeenCalledWith(
      "skill-rollback",
      "scripts/run.sh",
    );
  });
});
