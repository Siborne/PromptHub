import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/renderer/services/ai", () => ({
  chatCompletion: vi.fn(),
}));

vi.mock("../../../src/renderer/services/webdav-save-sync", () => ({
  scheduleAllSaveSync: vi.fn(),
}));

import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { resolveRemoteRegistryDirectoryFingerprint } from "../../../src/renderer/stores/skill/skill-source-update-workflow";
import { SKILL_PACKAGE_FINGERPRINT_ALGORITHM } from "@prompthub/shared/utils/skill-source-update";
import type { RegistrySkill } from "@prompthub/shared/types";
import { createSkillFixture } from "../../fixtures/skills";
import { installWindowMocks } from "../../helpers/window";

function resetStores(): void {
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
  useSettingsStore.setState({
    aiProvider: "openai",
    aiApiKey: "test-key",
    aiApiUrl: "https://example.com/v1",
    aiModel: "gpt-4o-mini",
    aiModels: [],
    scenarioModelDefaults: {},
    translationMode: "full",
  });
  localStorage.clear();
}

function createRemoteCandidate(
  overrides: Partial<RegistrySkill>,
): RegistrySkill {
  return {
    slug: "writer",
    source_id: "source-writer",
    name: "Writer",
    description: "Write better",
    category: "general",
    author: "PromptHub",
    source_url: "https://gitea.example.com/team/skills/tree/main/writer",
    content_url:
      "https://gitea.example.com/team/skills/raw/branch/main/writer/SKILL.md",
    tags: ["writing"],
    version: "1.1.0",
    content: "# Writer\n",
    ...overrides,
  };
}

describe("skill source transport routing", () => {
  beforeEach(() => {
    resetStores();
    installWindowMocks({
      api: {
        skill: {
          getAll: vi.fn(),
          update: vi.fn(),
          getRemoteGitPackageFingerprint: vi.fn(),
          getRemoteGitPackageSnapshot: vi.fn(),
          getRemoteZipPackageSnapshot: vi.fn(),
          getLocalPackageSnapshot: vi.fn(),
          fetchRemoteContent: vi.fn(),
          readLocalFileByPath: vi.fn(),
          getLocalPackageFingerprint: vi.fn(),
        },
      },
    });
  });

  it("routes a legacy raw-only private Gitea source through Git", async () => {
    const baselineContent = "# Writer\n\nOriginal\n";
    const remoteContent = "# Writer\n\nUpdated\n";
    const baselineHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(baselineContent);
    const installedSkill = createSkillFixture({
      id: "skill-writer",
      name: "writer",
      source_id: "source-writer",
      source_url: undefined,
      content_url:
        "http://10.0.0.8/team/skills/raw/branch/main/tools/writer/SKILL.md",
      local_repo_path: "/managed/writer/repo",
      content: baselineContent,
      instructions: baselineContent,
      installed_content_hash: baselineHash,
      directory_fingerprint: "a".repeat(64),
      installed_directory_fingerprint: "a".repeat(64),
      fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    });
    const remotePackageSnapshot = {
      content: remoteContent,
      directoryFingerprint: "b".repeat(64),
      scope: "package" as const,
      files: [
        {
          path: "SKILL.md",
          kind: "text" as const,
          sizeBytes: 26,
          contentHash: "remote-skill",
          content: remoteContent,
        },
        {
          path: "references/guide.md",
          kind: "text" as const,
          sizeBytes: 10,
          contentHash: "remote-guide",
          content: "New guide\n",
        },
      ],
    };
    const localPackageSnapshot = {
      content: baselineContent,
      directoryFingerprint: "a".repeat(64),
      scope: "package" as const,
      files: [
        {
          path: "SKILL.md",
          kind: "text" as const,
          sizeBytes: 27,
          contentHash: "local-skill",
          content: baselineContent,
        },
      ],
    };
    const getRemoteGitPackageSnapshot = vi
      .fn()
      .mockResolvedValue(remotePackageSnapshot);
    const getLocalPackageSnapshot = vi
      .fn()
      .mockResolvedValue(localPackageSnapshot);
    const fetchRemoteContent = vi
      .fn()
      .mockRejectedValue(
        new Error("Access to internal network addresses is not allowed"),
      );
    (window as any).api.skill.getRemoteGitPackageSnapshot =
      getRemoteGitPackageSnapshot;
    (window as any).api.skill.getLocalPackageSnapshot = getLocalPackageSnapshot;
    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.syncFromRepo = vi
      .fn()
      .mockResolvedValue(installedSkill);
    useSkillStore.setState({ skills: [installedSkill] });

    const check = await useSkillStore
      .getState()
      .getInstalledSkillSourceUpdateStatus(installedSkill.id);

    expect(check).toMatchObject({
      status: "update-available",
      remoteContent,
      remoteDirectoryFingerprint: "b".repeat(64),
      localPackageSnapshot,
      remotePackageSnapshot,
    });
    expect(getRemoteGitPackageSnapshot).toHaveBeenCalledWith({
      repoUrl: "http://10.0.0.8/team/skills",
      branch: "main",
      directory: "tools/writer",
    });
    expect(fetchRemoteContent).not.toHaveBeenCalled();
    expect(getLocalPackageSnapshot).toHaveBeenCalledWith(
      installedSkill.local_repo_path,
    );
  });

  it("keeps a copied local source authoritative over a colliding remote catalog entry", async () => {
    const sourceDirectory = "/Users/me/.claude/skills/writer";
    const baselineContent = "# Writer\n\nOriginal\n";
    const localContent = "# Writer\n\nUpdated locally\n";
    const baselineHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(baselineContent);
    const installedSkill = createSkillFixture({
      id: "skill-local-writer",
      name: "writer",
      source_id: "source-writer",
      source_url: sourceDirectory,
      local_repo_path: "/managed/writer/repo",
      content: baselineContent,
      instructions: baselineContent,
      installed_content_hash: baselineHash,
      directory_fingerprint: "a".repeat(64),
      installed_directory_fingerprint: "a".repeat(64),
      fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    });
    const getLocalPackageSnapshot = vi.fn().mockResolvedValue({
      content: localContent,
      directoryFingerprint: "b".repeat(64),
    });
    const readLocalFileByPath = vi.fn();
    const getLocalPackageFingerprint = vi.fn();
    (window as any).api.skill.getLocalPackageSnapshot = getLocalPackageSnapshot;
    const getRemoteGitPackageSnapshot = vi.fn();
    (window as any).api.skill.readLocalFileByPath = readLocalFileByPath;
    (window as any).api.skill.getLocalPackageFingerprint =
      getLocalPackageFingerprint;
    (window as any).api.skill.getRemoteGitPackageSnapshot =
      getRemoteGitPackageSnapshot;
    (window as any).api.skill.syncFromRepo = vi
      .fn()
      .mockResolvedValue(installedSkill);
    useSkillStore.setState({
      skills: [installedSkill],
      registrySkills: [createRemoteCandidate({})],
    });

    const check = await useSkillStore
      .getState()
      .getInstalledSkillSourceUpdateStatus(installedSkill.id);

    expect(check).toMatchObject({
      status: "update-available",
      registrySkill: { source_url: sourceDirectory },
      remoteContent: localContent,
    });
    expect(getLocalPackageSnapshot).toHaveBeenCalledWith(sourceDirectory);
    expect(readLocalFileByPath).not.toHaveBeenCalled();
    expect(getLocalPackageFingerprint).not.toHaveBeenCalled();
    expect(getRemoteGitPackageSnapshot).not.toHaveBeenCalled();
  });

  it("does not route an installed Skill to a sibling from the same repository", async () => {
    const repositoryUrl =
      "https://github.com/agentspace-so/runcomfy-agent-skills";
    const baselineContent = "# Image to Video\n\nOriginal\n";
    const imageRemoteContent = baselineContent;
    const baselineHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(baselineContent);
    const installedSkill = createSkillFixture({
      id: "skill-image-to-video",
      name: "image-to-video",
      registry_slug: "agentspace-so-runcomfy-agent-skills-image-to-video",
      source_id: "legacy-image-source-id",
      source_url: "https://github.com/agentspace-so/r…t-skills",
      source_directory: "skills/image-to-video",
      canonical_skill_path: "skills/image-to-video/SKILL.md",
      local_repo_path: "/managed/image-to-video/repo",
      content: baselineContent,
      instructions: baselineContent,
      installed_content_hash: baselineHash,
      version: "1.1.0",
      installed_version: "1.1.0",
      directory_fingerprint: "a".repeat(64),
      installed_directory_fingerprint: "a".repeat(64),
      fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    });
    const videoEdit = createRemoteCandidate({
      slug: "agentspace-so-runcomfy-agent-skills-video-edit",
      source_id: "current-video-source-id",
      name: "Video Edit",
      install_name: "video-edit",
      source_url: repositoryUrl,
      content_url: undefined,
      store_url:
        "https://skills.sh/agentspace-so/runcomfy-agent-skills/video-edit",
    });
    const imageToVideo = createRemoteCandidate({
      slug: "agentspace-so-runcomfy-agent-skills-image-to-video",
      source_id: "current-image-source-id",
      name: "Image to Video",
      install_name: "image-to-video",
      source_url: repositoryUrl,
      content_url: undefined,
      store_url:
        "https://skills.sh/agentspace-so/runcomfy-agent-skills/image-to-video",
    });
    const getRemoteGitPackageSnapshot = vi
      .fn()
      .mockImplementation(async ({ skillName }: { skillName?: string }) => ({
        content:
          skillName === "image-to-video"
            ? imageRemoteContent
            : "# Video Edit\n\nWrong sibling\n",
        directoryFingerprint: "a".repeat(64),
        resolvedDirectory: "image-to-video",
        scope: "package",
        files: [],
      }));
    (window as any).api.skill.getRemoteGitPackageSnapshot =
      getRemoteGitPackageSnapshot;
    (window as any).api.skill.getLocalPackageSnapshot = vi
      .fn()
      .mockResolvedValue({
        content: baselineContent,
        directoryFingerprint: "a".repeat(64),
        scope: "package",
        files: [],
      });
    (window as any).api.skill.syncFromRepo = vi
      .fn()
      .mockResolvedValue(installedSkill);
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...installedSkill,
      ...data,
    }));
    (window as any).api.skill.update = update;
    useSkillStore.setState({
      skills: [installedSkill],
      registrySkills: [videoEdit, imageToVideo],
    });

    const check = await useSkillStore
      .getState()
      .getInstalledSkillSourceUpdateStatus(installedSkill.id);

    expect(check).toMatchObject({
      status: "up-to-date",
      registrySkill: {
        slug: imageToVideo.slug,
        source_directory: "image-to-video",
      },
      remoteContent: imageRemoteContent,
    });
    expect(getRemoteGitPackageSnapshot).toHaveBeenCalledWith({
      repoUrl: repositoryUrl,
      branch: undefined,
      directory: undefined,
      skillName: "image-to-video",
    });
    expect(update).toHaveBeenCalledWith(
      installedSkill.id,
      expect.objectContaining({
        source_id: imageToVideo.source_id,
        source_url: repositoryUrl,
        registry_slug: imageToVideo.slug,
        source_directory: "image-to-video",
        canonical_skill_path: "image-to-video/SKILL.md",
      }),
    );
  });

  it("uses the canonical repository for a standalone Gitea fingerprint lookup", async () => {
    const getRemoteGitPackageFingerprint = vi
      .fn()
      .mockResolvedValue("c".repeat(64));
    (window as any).api.skill.getRemoteGitPackageFingerprint =
      getRemoteGitPackageFingerprint;
    const registrySkill = createRemoteCandidate({
      source_url:
        "https://gitea.example.com/team/skills/src/branch/develop/tools/writer",
      content_url:
        "https://gitea.example.com/team/skills/raw/branch/develop/tools/writer/SKILL.md",
      source_branch: undefined,
      source_directory: undefined,
      canonical_skill_path: undefined,
    });

    await expect(
      resolveRemoteRegistryDirectoryFingerprint(registrySkill),
    ).resolves.toBe("c".repeat(64));
    expect(getRemoteGitPackageFingerprint).toHaveBeenCalledWith({
      repoUrl: "https://gitea.example.com/team/skills",
      branch: "develop",
      directory: "tools/writer",
    });
  });

  it("checks a ZIP-backed source from the extracted package snapshot", async () => {
    const baselineContent = "# Zip Writer\n\nOriginal\n";
    const remoteContent = "# Zip Writer\n\nUpdated package\n";
    const baselineHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(baselineContent);
    const installedSkill = createSkillFixture({
      id: "skill-zip-writer",
      name: "zip-writer",
      source_id: "source-zip-writer",
      source_url: "https://store.example.com/zip-writer",
      content_url: "https://store.example.com/zip-writer/SKILL.md",
      local_repo_path: "/managed/zip-writer/repo",
      content: baselineContent,
      instructions: baselineContent,
      installed_content_hash: baselineHash,
      directory_fingerprint: "a".repeat(64),
      installed_directory_fingerprint: "a".repeat(64),
      fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    });
    const getRemoteZipPackageSnapshot = vi.fn().mockResolvedValue({
      content: remoteContent,
      directoryFingerprint: "b".repeat(64),
    });
    const fetchRemoteContent = vi.fn();
    (window as any).api.skill.getRemoteZipPackageSnapshot =
      getRemoteZipPackageSnapshot;
    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.syncFromRepo = vi
      .fn()
      .mockResolvedValue(installedSkill);
    useSkillStore.setState({
      skills: [installedSkill],
      registrySkills: [
        createRemoteCandidate({
          slug: "zip-writer",
          source_id: "source-zip-writer",
          name: "Zip Writer",
          source_url: "https://store.example.com/zip-writer",
          content_url: "https://store.example.com/zip-writer/SKILL.md",
          package_url: "https://downloads.example.com/zip-writer.zip",
          content: baselineContent,
        }),
      ],
    });

    const check = await useSkillStore
      .getState()
      .getInstalledSkillSourceUpdateStatus(installedSkill.id);

    expect(check).toMatchObject({
      status: "update-available",
      remoteContent,
      remoteDirectoryFingerprint: "b".repeat(64),
    });
    expect(getRemoteZipPackageSnapshot).toHaveBeenCalledWith({
      zipUrl: "https://downloads.example.com/zip-writer.zip",
    });
    expect(fetchRemoteContent).not.toHaveBeenCalled();
  });
});
