import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/services/ai", () => ({
  chatCompletion: vi.fn(),
}));

vi.mock("../../../src/renderer/services/webdav-save-sync", () => ({
  scheduleAllSaveSync: vi.fn(),
}));

import { chatCompletion } from "../../../src/renderer/services/ai";
import { scheduleAllSaveSync } from "../../../src/renderer/services/webdav-save-sync";
import {
  getProjectScanPaths,
  useSkillStore,
} from "../../../src/renderer/stores/skill.store";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { buildSkillSourceId } from "@prompthub/shared/utils/skill-identity";
import { SKILL_PACKAGE_FINGERPRINT_ALGORITHM } from "@prompthub/shared/utils/skill-source-update";
import type { RegistrySkill } from "@prompthub/shared/types";
import { createSkillFixture } from "../../fixtures/skills";
import { installWindowMocks } from "../../helpers/window";

const resetSkillStore = () => {
  useSkillStore.setState({
    skills: [],
    selectedSkillId: null,
    isLoading: false,
    error: null,
    viewMode: "gallery",
    searchQuery: "",
    filterType: "all",
    filterTags: [],
    deployedSkillNames: new Set<string>(),
    storeView: "my-skills",
    registrySkills: [],
    isLoadingRegistry: false,
    storeCategory: "all",
    storeSearchQuery: "",
    selectedRegistrySlug: null,
    customStoreSources: [],
    selectedStoreSourceId: "official",
    remoteStoreEntries: {},
    pendingPluginChildDeploySkillIds: [],
    translationCache: {},
  });
  localStorage.clear();
};

describe("skill store", () => {
  beforeEach(() => {
    resetSkillStore();
    useSettingsStore.setState({
      aiProvider: "openai",
      aiApiKey: "test-key",
      aiApiUrl: "https://example.com/v1",
      aiModel: "gpt-4o-mini",
      aiModels: [],
      scenarioModelDefaults: {},
      translationMode: "full",
    });
    installWindowMocks({
      api: {
        skill: {
          getAll: vi.fn(),
          update: vi.fn(),
          writeLocalFile: vi.fn(),
          writeLocalFileBufferByPath: vi.fn(),
          getRepoPath: vi.fn(),
          getRemoteGitPackageFingerprint: vi.fn(),
          fetchRemoteContentBytes: vi.fn(),
          saveSafetyReport: vi.fn().mockResolvedValue(undefined),
        },
      },
    });
  });

  it("covers the installed source update integration status matrix", async () => {
    const originalContent = "# Matrix Skill\n\nOriginal\n";
    const localContent = "# Matrix Skill\n\nLocal edit\n";
    const remoteContent = "# Matrix Skill\n\nRemote edit\n";
    const originalHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(originalContent);
    const contentUrl = "https://example.com/skills/matrix/SKILL.md";
    const registrySkill: RegistrySkill = {
      slug: "matrix-skill",
      source_id: "source-matrix-skill",
      name: "Matrix Skill",
      description: "Status matrix",
      category: "general",
      author: "PromptHub",
      source_url: "",
      content_url: contentUrl,
      tags: ["testing"],
      version: "1.1.0",
      content: remoteContent,
    };
    const checkStatus = async (options: {
      skillId?: string;
      content: string;
      installedContentHash?: string;
      remoteResult: string | Error;
      projectFingerprint?: string;
    }) => {
      const fetchRemoteContent =
        options.remoteResult instanceof Error
          ? vi.fn().mockRejectedValue(options.remoteResult)
          : vi.fn().mockResolvedValue(options.remoteResult);
      (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
      const localHash = await useSkillStore
        .getState()
        .computeRegistrySkillHash(options.content);
      useSkillStore.setState({
        skills: [
          createSkillFixture({
            id: options.skillId || "skill-matrix",
            name: "matrix-skill",
            source_id: "source-matrix-skill",
            registry_slug: "matrix-skill",
            content_url: contentUrl,
            content: options.content,
            instructions: options.content,
            installed_content_hash: options.installedContentHash,
            directory_fingerprint: localHash,
            installed_directory_fingerprint: options.installedContentHash,
            fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
          }),
        ],
        registrySkills: [registrySkill],
        projectScanState: options.projectFingerprint
          ? {
              "project-1": {
                isScanning: false,
                scannedSkills: [
                  {
                    name: "matrix-skill",
                    description: "Old project copy",
                    author: "PromptHub",
                    tags: [],
                    instructions: originalContent,
                    filePath: "/project/.agents/skills/matrix/SKILL.md",
                    localPath: "/project/.agents/skills/matrix",
                    platforms: [],
                    installMode: "copy",
                    directory_fingerprint: options.projectFingerprint,
                  },
                ],
              },
            }
          : {},
        agentScanState: {},
      });

      return useSkillStore
        .getState()
        .getRegistrySkillUpdateStatus(registrySkill);
    };

    await expect(
      checkStatus({
        content: originalContent,
        installedContentHash: originalHash,
        remoteResult: remoteContent,
      }),
    ).resolves.toMatchObject({
      status: "update-available",
      localModified: false,
      remoteChanged: true,
    });

    await expect(
      checkStatus({
        content: localContent,
        installedContentHash: originalHash,
        remoteResult: originalContent,
      }),
    ).resolves.toMatchObject({
      status: "local-modified",
      localModified: true,
      remoteChanged: false,
    });

    await expect(
      checkStatus({
        content: localContent,
        installedContentHash: originalHash,
        remoteResult: remoteContent,
      }),
    ).resolves.toMatchObject({
      status: "conflict",
      localModified: true,
      remoteChanged: true,
    });

    await expect(
      checkStatus({
        content: localContent,
        installedContentHash: undefined,
        remoteResult: remoteContent,
      }),
    ).resolves.toMatchObject({
      status: "baseline-missing",
      localModified: false,
      remoteChanged: false,
    });

    await expect(
      checkStatus({
        content: originalContent,
        installedContentHash: originalHash,
        remoteResult: new Error(
          "GET https://example.com/skills/matrix/SKILL.md?token=secret failed",
        ),
      }),
    ).resolves.toMatchObject({
      status: "source-unavailable",
      localModified: false,
      remoteChanged: false,
    });

    await expect(
      checkStatus({
        content: originalContent,
        installedContentHash: originalHash,
        remoteResult: originalContent,
        projectFingerprint: "old-project-copy",
      }),
    ).resolves.toMatchObject({
      status: "up-to-date",
      hasStaleTargets: true,
      staleTargets: [
        expect.objectContaining({
          targetType: "project",
          installMode: "copy",
          currentFingerprint: "old-project-copy",
          expectedFingerprint: originalHash,
        }),
      ],
    });
  });

  it("checks package source updates against the synced repo content instead of stale DB content", async () => {
    const remoteContent = `# Large Skill\n\n${"Use this synced package instruction.\n".repeat(600)}`;
    const truncatedDbContent = remoteContent.slice(0, 10_000);
    const staleHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash("# Large Skill\n\nOld baseline\n");
    const currentHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(remoteContent);
    const fetchRemoteContent = vi.fn().mockResolvedValue(remoteContent);
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-large-package",
        name: "large-package",
        source_id: "large-package-source",
        source_url:
          "https://github.com/example/skills/tree/main/skills/large-package",
        source_branch: "main",
        source_directory: "skills/large-package",
        canonical_skill_path: "skills/large-package/SKILL.md",
        directory_fingerprint: "full-package-fingerprint",
        content: remoteContent,
        instructions: remoteContent,
        installed_content_hash: staleHash,
        installed_version: "source",
        local_repo_path: "/managed/large-package/repo",
      }),
    );
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({
        id: "skill-large-package",
        name: "large-package",
        content: remoteContent,
        instructions: remoteContent,
      }),
      ...data,
    }));

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.syncFromRepo = syncFromRepo;
    (window as any).api.skill.update = update;

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-large-package",
          name: "large-package",
          source_id: "large-package-source",
          source_url:
            "https://github.com/example/skills/tree/main/skills/large-package",
          source_branch: "main",
          source_directory: "skills/large-package",
          canonical_skill_path: "skills/large-package/SKILL.md",
          directory_fingerprint: "full-package-fingerprint",
          local_repo_path: "/managed/large-package/repo",
          content_url:
            "https://raw.githubusercontent.com/example/skills/main/skills/large-package/SKILL.md",
          content: truncatedDbContent,
          instructions: truncatedDbContent,
          installed_content_hash: staleHash,
          installed_version: "source",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {},
    });

    const check = await useSkillStore
      .getState()
      .getInstalledSkillSourceUpdateStatus("skill-large-package");

    expect(syncFromRepo).toHaveBeenCalledWith("skill-large-package");
    expect(check?.status).toBe("up-to-date");
    expect(check?.localModified).toBe(false);
    expect(update).toHaveBeenCalledWith(
      "skill-large-package",
      expect.objectContaining({
        installed_content_hash: currentHash,
        installed_version: "source",
      }),
    );
  });

  it("detects installed package source updates when only non-SKILL files changed remotely", async () => {
    const skillContent = "# Package Skill\n\nCurrent entrypoint\n";
    const installedHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(skillContent);
    const fetchRemoteContent = vi.fn().mockResolvedValue(skillContent);
    const getRemoteGitPackageFingerprint = vi
      .fn()
      .mockResolvedValue("remote-package-fingerprint");
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-package",
        name: "package",
        source_url:
          "https://github.com/example/skills/tree/main/skills/package",
        source_branch: "main",
        source_directory: "skills/package",
        canonical_skill_path: "skills/package/SKILL.md",
        directory_fingerprint: "local-package-fingerprint",
        local_repo_path: "/managed/package/repo",
        content_url:
          "https://raw.githubusercontent.com/example/skills/main/skills/package/SKILL.md",
        content: skillContent,
        instructions: skillContent,
        installed_content_hash: installedHash,
        installed_version: "source",
      }),
    );

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.getRemoteGitPackageFingerprint =
      getRemoteGitPackageFingerprint;
    (window as any).api.skill.syncFromRepo = syncFromRepo;
    (window as any).api.skill.update = vi.fn();

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-package",
          name: "package",
          source_url:
            "https://github.com/example/skills/tree/main/skills/package",
          source_branch: "main",
          source_directory: "skills/package",
          canonical_skill_path: "skills/package/SKILL.md",
          directory_fingerprint: "local-package-fingerprint",
          local_repo_path: "/managed/package/repo",
          content_url:
            "https://raw.githubusercontent.com/example/skills/main/skills/package/SKILL.md",
          content: skillContent,
          instructions: skillContent,
          installed_content_hash: installedHash,
          installed_version: "source",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {},
    });

    const check = await useSkillStore
      .getState()
      .getInstalledSkillSourceUpdateStatus("skill-package");

    expect(check?.status).toBe("update-available");
    expect(check?.remoteChanged).toBe(true);
    expect(getRemoteGitPackageFingerprint).toHaveBeenCalledWith({
      repoUrl: "https://github.com/example/skills/tree/main/skills/package",
      branch: "main",
      directory: "skills/package",
    });
  });

  it("does not report package source updates after the synced package fingerprint matches remote", async () => {
    const skillContent = "# Package Skill\n\nCurrent entrypoint\n";
    const installedHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(skillContent);
    const fetchRemoteContent = vi.fn().mockResolvedValue(skillContent);
    const getRemoteGitPackageFingerprint = vi
      .fn()
      .mockResolvedValue("package-fingerprint-after-update");
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-package",
        name: "package",
        source_url:
          "https://github.com/example/skills/tree/main/skills/package",
        source_branch: "main",
        source_directory: "skills/package",
        canonical_skill_path: "skills/package/SKILL.md",
        directory_fingerprint: "package-fingerprint-after-update",
        local_repo_path: "/managed/package/repo",
        content_url:
          "https://raw.githubusercontent.com/example/skills/main/skills/package/SKILL.md",
        content: skillContent,
        instructions: skillContent,
        installed_content_hash: installedHash,
        installed_version: "source",
      }),
    );

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.getRemoteGitPackageFingerprint =
      getRemoteGitPackageFingerprint;
    (window as any).api.skill.syncFromRepo = syncFromRepo;
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({
        id: "skill-package",
        name: "package",
        source_url:
          "https://github.com/example/skills/tree/main/skills/package",
        source_branch: "main",
        source_directory: "skills/package",
        canonical_skill_path: "skills/package/SKILL.md",
        directory_fingerprint: "package-fingerprint-after-update",
        local_repo_path: "/managed/package/repo",
        content_url:
          "https://raw.githubusercontent.com/example/skills/main/skills/package/SKILL.md",
        content: skillContent,
        instructions: skillContent,
        installed_content_hash: installedHash,
        installed_version: "source",
      }),
      ...data,
    }));
    (window as any).api.skill.update = update;

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-package",
          name: "package",
          source_url:
            "https://github.com/example/skills/tree/main/skills/package",
          source_branch: "main",
          source_directory: "skills/package",
          canonical_skill_path: "skills/package/SKILL.md",
          directory_fingerprint: "package-fingerprint-before-update",
          local_repo_path: "/managed/package/repo",
          content_url:
            "https://raw.githubusercontent.com/example/skills/main/skills/package/SKILL.md",
          content: skillContent,
          instructions: skillContent,
          installed_content_hash: installedHash,
          installed_version: "source",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {},
    });

    const check = await useSkillStore
      .getState()
      .getInstalledSkillSourceUpdateStatus("skill-package");

    expect(check?.status).toBe("up-to-date");
    expect(check?.localDirectoryFingerprint).toBe(
      "package-fingerprint-after-update",
    );
    expect(check?.remoteDirectoryFingerprint).toBe(
      "package-fingerprint-after-update",
    );
    expect(getRemoteGitPackageFingerprint).toHaveBeenCalledWith({
      repoUrl: "https://github.com/example/skills/tree/main/skills/package",
      branch: "main",
      directory: "skills/package",
    });
    expect(update).toHaveBeenCalledWith(
      "skill-package",
      expect.objectContaining({
        installed_directory_fingerprint: "package-fingerprint-after-update",
        fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
        source_binding_state: "bound",
        source_last_checked_at: expect.any(Number),
        source_last_error: null,
      }),
    );
  });

  it("updates a GitHub-imported skill from its own source metadata without a cached store entry", async () => {
    const remoteContent = "# Writer\n\nRemote update\n";
    const fetchRemoteContent = vi.fn().mockResolvedValue(remoteContent);
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-github" });
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({
        id: "skill-github-writer",
        name: "github-writer",
      }),
      ...data,
      id: "skill-github-writer",
      updated_at: 2,
    }));

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.versionCreate = versionCreate;
    (window as any).api.skill.update = update;

    const originalHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash("# Writer\n\nOriginal\n");

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-github-writer",
          name: "github-writer",
          source_id: "github-writer-source",
          source_url: "https://github.com/example/skills/tree/main/writer",
          content: "# Writer\n\nOriginal\n",
          instructions: "# Writer\n\nOriginal\n",
          installed_content_hash: originalHash,
          installed_version: "1.0.0",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {},
    });

    const result = await useSkillStore
      .getState()
      .updateInstalledSkillFromSource("skill-github-writer");

    expect(result?.status).toBe("updated");
    expect(versionCreate).toHaveBeenCalledWith(
      "skill-github-writer",
      expect.stringContaining("Source update"),
    );
    expect(update).toHaveBeenCalledWith(
      "skill-github-writer",
      expect.objectContaining({
        content: remoteContent,
        instructions: remoteContent,
        source_url: "https://github.com/example/skills/tree/main/writer",
        content_url:
          "https://raw.githubusercontent.com/example/skills/main/writer/SKILL.md",
        installed_version: "source",
      }),
    );
  });

  it("updates an installed GitHub package skill by cloning its package source instead of raw asset fetches", async () => {
    const remoteContent = "# Spec Init\n\nRemote update\n";
    const fetchRemoteContent = vi.fn().mockResolvedValue(remoteContent);
    const fetchRemoteContentBytes = vi
      .fn()
      .mockRejectedValue(new Error("raw asset fetch should not be used"));
    const saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/spec-init/repo");
    const originalHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash("# Spec Init\n\nOriginal\n");
    const syncedOriginalSkill = createSkillFixture({
      id: "skill-spec-init",
      name: "spec-init",
      source_id: "spec-init-source",
      source_url:
        "https://github.com/legeling/spec-init/tree/main/skills/spec-init",
      source_branch: "main",
      source_directory: "skills/spec-init",
      canonical_skill_path: "skills/spec-init/SKILL.md",
      directory_fingerprint: "full-package-fingerprint",
      local_repo_path: "/managed/spec-init/repo",
      content_url:
        "https://raw.githubusercontent.com/legeling/spec-init/main/skills/spec-init/SKILL.md",
      content: "# Spec Init\n\nOriginal\n",
      instructions: "# Spec Init\n\nOriginal\n",
      installed_content_hash: originalHash,
      installed_version: "source",
    });
    const syncFromRepo = vi
      .fn()
      .mockResolvedValueOnce(syncedOriginalSkill)
      .mockResolvedValueOnce(
        createSkillFixture({
          id: "skill-spec-init",
          name: "spec-init",
          source_id: "spec-init-source",
          source_url:
            "https://github.com/legeling/spec-init/tree/main/skills/spec-init",
          source_branch: "main",
          source_directory: "skills/spec-init",
          canonical_skill_path: "skills/spec-init/SKILL.md",
          directory_fingerprint: "full-package-fingerprint",
          content: remoteContent,
          instructions: remoteContent,
          local_repo_path: "/managed/spec-init/repo",
        }),
      );
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-spec" });
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({ id: "skill-spec-init", name: "spec-init" }),
      ...data,
      id: "skill-spec-init",
      updated_at: 2,
    }));

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.fetchRemoteContentBytes = fetchRemoteContentBytes;
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.syncFromRepo = syncFromRepo;
    (window as any).api.skill.versionCreate = versionCreate;
    (window as any).api.skill.update = update;

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-spec-init",
          name: "spec-init",
          source_id: "spec-init-source",
          source_url:
            "https://github.com/legeling/spec-init/tree/main/skills/spec-init",
          source_branch: "main",
          source_directory: "skills/spec-init",
          canonical_skill_path: "skills/spec-init/SKILL.md",
          directory_fingerprint: "full-package-fingerprint",
          local_repo_path: "/managed/spec-init/repo",
          content_url:
            "https://raw.githubusercontent.com/legeling/spec-init/main/skills/spec-init/SKILL.md",
          content: "# Spec Init\n\nOriginal\n",
          instructions: "# Spec Init\n\nOriginal\n",
          installed_content_hash: originalHash,
          installed_version: "source",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {},
    });

    const result = await useSkillStore
      .getState()
      .updateInstalledSkillFromSource("skill-spec-init");

    expect(result?.status).toBe("updated");
    expect(saveRemoteGitToRepo).toHaveBeenCalledWith("skill-spec-init", {
      repoUrl:
        "https://github.com/legeling/spec-init/tree/main/skills/spec-init",
      branch: "main",
      directory: "skills/spec-init",
    });
    expect(syncFromRepo).toHaveBeenCalledTimes(2);
    expect(syncFromRepo).toHaveBeenCalledWith("skill-spec-init");
    expect(fetchRemoteContentBytes).not.toHaveBeenCalled();
  });

  it("preserves SSH source URLs when updating installed package skills", async () => {
    const remoteContent = "# SSH Skill\n\nRemote update\n";
    const originalHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash("# SSH Skill\n\nOriginal\n");
    const saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/ssh-skill/repo");
    const syncFromRepo = vi
      .fn()
      .mockResolvedValueOnce(
        createSkillFixture({
          id: "skill-ssh",
          name: "ssh-skill",
          source_id: "ssh-skill-source",
          source_url: "git@github.com:private/skills.git",
          source_branch: "main",
          source_directory: "skills/ssh-skill",
          canonical_skill_path: "skills/ssh-skill/SKILL.md",
          directory_fingerprint: "ssh-package-fingerprint",
          content_url:
            "https://raw.githubusercontent.com/private/skills/main/skills/ssh-skill/SKILL.md",
          content: "# SSH Skill\n\nOriginal\n",
          instructions: "# SSH Skill\n\nOriginal\n",
          installed_content_hash: originalHash,
          installed_version: "source",
        }),
      )
      .mockResolvedValueOnce(
        createSkillFixture({
          id: "skill-ssh",
          name: "ssh-skill",
          source_id: "ssh-skill-source",
          source_url: "git@github.com:private/skills.git",
          source_branch: "main",
          source_directory: "skills/ssh-skill",
          canonical_skill_path: "skills/ssh-skill/SKILL.md",
          content: remoteContent,
          instructions: remoteContent,
        }),
      );
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({ id: "skill-ssh", name: "ssh-skill" }),
      ...data,
      id: "skill-ssh",
      updated_at: 2,
    }));

    (window as any).api.skill.fetchRemoteContent = vi
      .fn()
      .mockResolvedValue(remoteContent);
    (window as any).api.skill.fetchRemoteContentBytes = vi.fn();
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.syncFromRepo = syncFromRepo;
    (window as any).api.skill.versionCreate = vi
      .fn()
      .mockResolvedValue({ id: "version-ssh" });
    (window as any).api.skill.update = update;

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-ssh",
          name: "ssh-skill",
          source_id: "ssh-skill-source",
          source_url: "git@github.com:private/skills.git",
          source_branch: "main",
          source_directory: "skills/ssh-skill",
          canonical_skill_path: "skills/ssh-skill/SKILL.md",
          directory_fingerprint: "ssh-package-fingerprint",
          content_url:
            "https://raw.githubusercontent.com/private/skills/main/skills/ssh-skill/SKILL.md",
          content: "# SSH Skill\n\nOriginal\n",
          instructions: "# SSH Skill\n\nOriginal\n",
          installed_content_hash: originalHash,
          installed_version: "source",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {},
    });

    const result = await useSkillStore
      .getState()
      .updateInstalledSkillFromSource("skill-ssh");

    expect(result?.status).toBe("updated");
    expect(saveRemoteGitToRepo).toHaveBeenCalledWith("skill-ssh", {
      repoUrl: "git@github.com:private/skills.git",
      branch: "main",
      directory: "skills/ssh-skill",
    });
    expect(
      (window as any).api.skill.fetchRemoteContentBytes,
    ).not.toHaveBeenCalled();
  });

  it("updates a pristine skill from a cached remote store source", async () => {
    const remoteContent = "# Community Writer\n\nRemote update\n";
    const fetchRemoteContent = vi.fn().mockResolvedValue(remoteContent);
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-remote" });
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({
        id: "skill-community-writer",
        name: "community-writer",
      }),
      ...data,
      id: "skill-community-writer",
      updated_at: 2,
    }));

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.versionCreate = versionCreate;
    (window as any).api.skill.update = update;

    const originalHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash("# Community Writer\n\nOriginal\n");

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-community-writer",
          name: "community-writer",
          source_id: "source-community-writer",
          registry_slug: "community-writer",
          content: "# Community Writer\n\nOriginal\n",
          instructions: "# Community Writer\n\nOriginal\n",
          installed_content_hash: originalHash,
          installed_version: "1.0.0",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {
        community: {
          loadedAt: 1,
          error: null,
          skills: [
            {
              slug: "community-writer",
              source_id: "source-community-writer",
              name: "Community Writer",
              description: "Write better",
              category: "general",
              author: "Community",
              source_url:
                "https://github.com/example/community/tree/main/writer",
              content_url:
                "https://raw.githubusercontent.com/example/community/main/writer/SKILL.md",
              tags: ["writing"],
              version: "1.1.0",
              content: remoteContent,
            },
          ],
        },
      },
    });

    const result = await useSkillStore
      .getState()
      .updateRegistrySkill("source-community-writer");

    expect(result?.status).toBe("updated");
    expect(versionCreate).toHaveBeenCalledWith(
      "skill-community-writer",
      expect.stringContaining("Store update"),
    );
    expect(update).toHaveBeenCalledWith(
      "skill-community-writer",
      expect.objectContaining({
        content: remoteContent,
        installed_content_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        installed_version: "1.1.0",
      }),
    );
  });

  it("keeps a private Gitea store install up to date and preserves the store label", async () => {
    const remoteContent = "# clouddrive2-cli\n\nCloudDrive2 commands\n";
    const fetchRemoteContent = vi.fn().mockResolvedValue(remoteContent);
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-gitea" });
    const create = vi.fn().mockImplementation(async (data) => ({
      id: "skill-clouddrive2-cli",
      created_at: 1,
      updated_at: 1,
      ...data,
    }));
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({
        id: "skill-clouddrive2-cli",
        name: "clouddrive2-cli",
        source_id: "source-private-gitea-clouddrive2-cli",
        source_label: "Personal Store",
        source_url:
          "https://gitea.example.com/icelemon/skills/tree/main/clouddrive2-cli",
        content_url:
          "https://gitea.example.com/icelemon/skills/raw/branch/main/clouddrive2-cli/SKILL.md",
        content: remoteContent,
        instructions: remoteContent,
      }),
      ...data,
      id: "skill-clouddrive2-cli",
      updated_at: 2,
    }));

    (window as any).api.skill.create = create;
    (window as any).api.skill.update = update;
    (window as any).api.skill.versionCreate = versionCreate;
    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.getAll = vi.fn().mockResolvedValue([]);

    const registrySkill = {
      slug: "clouddrive2-cli",
      source_id: "source-private-gitea-clouddrive2-cli",
      name: "clouddrive2-cli",
      description: "CloudDrive2 command-line skill",
      category: "dev" as const,
      author: "icelemon",
      source_label: "Personal Store",
      source_url:
        "https://gitea.example.com/icelemon/skills/tree/main/clouddrive2-cli",
      content_url:
        "https://gitea.example.com/icelemon/skills/raw/branch/main/clouddrive2-cli/SKILL.md",
      tags: ["cli"],
      version: "1.0.0",
      content: remoteContent,
    };

    const installed = await useSkillStore
      .getState()
      .installRegistrySkill(registrySkill);
    const installedHash = installed?.installed_content_hash;

    expect(installedHash).toMatch(/^[a-f0-9]{64}$/);

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-clouddrive2-cli",
          name: "clouddrive2-cli",
          source_id: registrySkill.source_id,
          source_label: "Personal Store",
          source_url: registrySkill.source_url,
          content_url: registrySkill.content_url,
          content: remoteContent,
          instructions: remoteContent,
          installed_content_hash: installedHash,
          installed_version: "1.0.0",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {
        "personal-store": {
          loadedAt: 1,
          error: null,
          skills: [
            {
              ...registrySkill,
              source_label: "icelemon/skills",
              version: "1.0.0",
            },
          ],
        },
      },
    });

    const check = await useSkillStore
      .getState()
      .getRegistrySkillUpdateStatus(registrySkill);

    expect(check.status).toBe("up-to-date");

    fetchRemoteContent.mockResolvedValue("# clouddrive2-cli\n\nUpdated\n");

    const result = await useSkillStore
      .getState()
      .updateRegistrySkill(registrySkill.source_id);

    expect(result?.status).toBe("updated");
    expect(update).toHaveBeenCalledWith(
      "skill-clouddrive2-cli",
      expect.objectContaining({
        source_label: "Personal Store",
      }),
    );
  });

  it("installs a skill from a cached local store source entry using the latest local file", async () => {
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-local-writer",
        name: "local-writer",
        source_id: "source-local-writer",
        registry_slug: "local-writer",
      }),
    );
    const getAll = vi.fn().mockResolvedValue([]);

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = getAll;
    (window as any).api.skill.readLocalFileByPath = vi.fn().mockResolvedValue({
      content: "# Local Writer\n\nLatest local content\n",
    });
    (window as any).api.skill.writeLocalFile = vi
      .fn()
      .mockResolvedValue(undefined);
    (window as any).api.skill.saveToRepo = vi.fn().mockResolvedValue(undefined);
    (window as any).api.skill.syncFromRepo = vi
      .fn()
      .mockResolvedValue(undefined);

    useSkillStore.setState({
      registrySkills: [],
      remoteStoreEntries: {
        local: {
          loadedAt: 1,
          error: null,
          skills: [
            {
              slug: "local-writer",
              source_id: "source-local-writer",
              name: "Local Writer",
              description: "Local source skill",
              category: "general",
              author: "Local",
              source_url: "/tmp/local-writer",
              content_url: "/tmp/local-writer/SKILL.md",
              tags: ["local"],
              version: "1.0.0",
              content: "# Local Writer\n\nStale cached content\n",
            },
          ],
        },
      },
    });

    await useSkillStore.getState().installFromRegistry("source-local-writer");

    expect((window as any).api.skill.readLocalFileByPath).toHaveBeenCalledWith(
      "/tmp/local-writer",
      "SKILL.md",
    );
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        registry_slug: "local-writer",
        content: "# Local Writer\n\nLatest local content\n",
        instructions: "# Local Writer\n\nLatest local content\n",
      }),
    );
    expect((window as any).api.skill.saveToRepo).toHaveBeenCalledWith(
      "skill-local-writer",
      "/tmp/local-writer",
      "copy",
    );
    expect((window as any).api.skill.syncFromRepo).toHaveBeenCalledWith(
      "skill-local-writer",
    );
  });
});
