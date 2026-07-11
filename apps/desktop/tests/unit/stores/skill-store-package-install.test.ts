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

  it("imports scanned local skills in link mode without copying into a managed repo", async () => {
    const linkedPath = "/Users/demo/skills/local-writer";
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-local-writer",
        name: "local-writer",
        source_url: linkedPath,
        local_repo_path: linkedPath,
      }),
    );
    const update = vi.fn().mockImplementation(async (_id, data) =>
      createSkillFixture({
        id: "skill-content-url-writer",
        name: "content-url-writer",
        ...data,
      }),
    );
    const saveToRepo = vi.fn().mockResolvedValue("/managed/local-writer/repo");
    const getAll = vi.fn().mockResolvedValue([
      createSkillFixture({
        id: "skill-local-writer",
        name: "local-writer",
        source_url: linkedPath,
        local_repo_path: linkedPath,
      }),
    ]);

    (window as any).api.skill.create = create;
    (window as any).api.skill.update = update;
    (window as any).api.skill.saveToRepo = saveToRepo;
    (window as any).api.skill.getAll = getAll;

    const result = await useSkillStore.getState().importScannedSkills(
      [
        {
          name: "local-writer",
          description: "Local writer",
          author: "Local",
          tags: ["writing"],
          instructions: "# Local Writer",
          filePath: `${linkedPath}/SKILL.md`,
          localPath: linkedPath,
          platforms: ["Claude"],
          directory_fingerprint: "fingerprint-linked",
        },
      ],
      {},
      "symlink",
    );

    expect(result.importedCount).toBe(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "local-writer",
        source_url: linkedPath,
        local_repo_path: linkedPath,
        directory_fingerprint: "fingerprint-linked",
      }),
    );
    expect(saveToRepo).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(getAll).toHaveBeenCalled();
  });

  it("installs a custom Git store skill by cloning the package instead of writing only SKILL.md", async () => {
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-gitea-writer",
        name: "writer",
        source_id: "source-gitea-writer",
        registry_slug: "writer",
      }),
    );
    const getAll = vi.fn().mockResolvedValue([]);
    const writeLocalFile = vi.fn().mockResolvedValue(undefined);
    const saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/writer/repo");
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-gitea-writer",
        name: "writer",
        local_repo_path: "/managed/writer/repo",
      }),
    );

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = getAll;
    (window as any).api.skill.writeLocalFile = writeLocalFile;
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.syncFromRepo = syncFromRepo;

    await useSkillStore.getState().installRegistrySkill({
      slug: "writer",
      source_id: "source-gitea-writer",
      name: "Writer",
      description: "Custom Gitea writer",
      category: "general",
      author: "icelemon",
      source_url: "https://gitea.example.com/team/skills",
      source_branch: "main",
      source_directory: "skills/writer",
      canonical_skill_path: "skills/writer/SKILL.md",
      directory_fingerprint: "full-tree-fingerprint",
      tags: ["writing"],
      version: "1.0.0",
      content: "# Writer\n\nUse the package resources.\n",
    });

    expect(saveRemoteGitToRepo).toHaveBeenCalledWith("skill-gitea-writer", {
      repoUrl: "https://gitea.example.com/team/skills",
      branch: "main",
      directory: "skills/writer",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        directory_fingerprint: "full-tree-fingerprint",
        installed_directory_fingerprint: "full-tree-fingerprint",
        fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
        source_binding_state: "bound",
        source_last_checked_at: expect.any(Number),
        source_last_error: null,
      }),
    );
    expect(syncFromRepo).toHaveBeenCalledWith("skill-gitea-writer");
    expect(writeLocalFile).not.toHaveBeenCalledWith(
      "skill-gitea-writer",
      "SKILL.md",
      expect.any(String),
      expect.anything(),
    );
  });

  it("marks a cloned custom Git install as pristine after repo sync changes the content baseline", async () => {
    const cachedContent = "# Writer\n\nCached registry content.\n";
    const repoContent = "# Writer\n\nContent from cloned repo.\n";
    const cachedHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(cachedContent);
    const repoHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(repoContent);
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-gitea-writer",
        name: "writer",
        source_id: "source-gitea-writer",
        registry_slug: "writer",
        content: cachedContent,
        instructions: cachedContent,
        installed_content_hash: cachedHash,
      }),
    );
    const syncedSkill = createSkillFixture({
      id: "skill-gitea-writer",
      name: "writer",
      source_id: "source-gitea-writer",
      registry_slug: "writer",
      content: repoContent,
      instructions: repoContent,
      installed_content_hash: cachedHash,
      local_repo_path: "/managed/writer/repo",
    });
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...syncedSkill,
      ...data,
    }));

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = vi.fn().mockResolvedValue([
      {
        ...syncedSkill,
        installed_content_hash: repoHash,
      },
    ]);
    (window as any).api.skill.update = update;
    (window as any).api.skill.saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/writer/repo");
    (window as any).api.skill.syncFromRepo = vi
      .fn()
      .mockResolvedValue(syncedSkill);

    await useSkillStore.getState().installRegistrySkill({
      slug: "writer",
      source_id: "source-gitea-writer",
      name: "Writer",
      description: "Custom Gitea writer",
      category: "general",
      author: "icelemon",
      source_url: "https://gitea.example.com/team/skills",
      source_branch: "main",
      source_directory: "skills/writer",
      canonical_skill_path: "skills/writer/SKILL.md",
      directory_fingerprint: "full-tree-fingerprint",
      tags: ["writing"],
      version: "0.5.9-beta.1",
      content: cachedContent,
    });

    expect(update).toHaveBeenCalledWith(
      "skill-gitea-writer",
      expect.objectContaining({
        installed_content_hash: repoHash,
        installed_version: "0.5.9-beta.1",
      }),
    );
  });

  it("derives the package directory from canonical_skill_path when source_directory is absent", async () => {
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-canonical-writer",
        name: "writer",
        source_id: "source-canonical-writer",
        registry_slug: "writer",
      }),
    );
    const saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/canonical-writer/repo");
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-canonical-writer",
        name: "writer",
        local_repo_path: "/managed/canonical-writer/repo",
      }),
    );

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = vi.fn().mockResolvedValue([]);
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.syncFromRepo = syncFromRepo;

    await useSkillStore.getState().installRegistrySkill({
      slug: "writer",
      source_id: "source-canonical-writer",
      name: "Writer",
      description: "Canonical path writer",
      category: "general",
      author: "icelemon",
      source_url: "https://gitea.example.com/team/skills",
      source_branch: "stable",
      canonical_skill_path: "catalog/writer/SKILL.md",
      tags: ["writing"],
      version: "1.0.0",
      content: "# Writer\n\nUse the package resources.\n",
    });

    expect(saveRemoteGitToRepo).toHaveBeenCalledWith("skill-canonical-writer", {
      repoUrl: "https://gitea.example.com/team/skills",
      branch: "stable",
      directory: "catalog/writer",
    });
    expect(syncFromRepo).toHaveBeenCalledWith("skill-canonical-writer");
  });

  it("uses the content path for GitHub raw registry entries that do not advertise a package", async () => {
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-github-single",
        name: "single",
        source_id: "source-github-single",
        registry_slug: "single",
      }),
    );
    const writeLocalFile = vi.fn().mockResolvedValue(undefined);
    const saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/single/repo");
    const fetchRemoteContent = vi
      .fn()
      .mockResolvedValue("# Single\n\nA single-file registry skill.\n");

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = vi.fn().mockResolvedValue([]);
    (window as any).api.skill.writeLocalFile = writeLocalFile;
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;

    await useSkillStore.getState().installRegistrySkill({
      slug: "single",
      source_id: "source-github-single",
      name: "Single",
      description: "GitHub single file",
      category: "general",
      author: "demo",
      source_url: "https://github.com/team/skills",
      content_url:
        "https://raw.githubusercontent.com/team/skills/main/single/SKILL.md",
      tags: ["single"],
      version: "1.0.0",
      content: "# Cached Single\n",
    });

    expect(writeLocalFile).toHaveBeenCalledWith(
      "skill-github-single",
      "SKILL.md",
      "# Single\n\nA single-file registry skill.\n",
      { skipVersionSnapshot: true },
    );
    expect(saveRemoteGitToRepo).not.toHaveBeenCalled();
  });

  it("installs skills.sh skills by cloning the package directory instead of writing only SKILL.md", async () => {
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-write-a-skill",
        name: "write-a-skill",
        source_id: "skills-sh-write-a-skill",
        registry_slug: "mattpocock-skills-write-a-skill",
      }),
    );
    const writeLocalFile = vi.fn().mockResolvedValue(undefined);
    const saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/write-a-skill/repo");
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-write-a-skill",
        name: "write-a-skill",
        local_repo_path: "/managed/write-a-skill/repo",
      }),
    );

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = vi.fn().mockResolvedValue([]);
    (window as any).api.skill.writeLocalFile = writeLocalFile;
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.syncFromRepo = syncFromRepo;

    await useSkillStore.getState().installRegistrySkill({
      slug: "mattpocock-skills-write-a-skill",
      source_id: "skills-sh-write-a-skill",
      name: "Write A Skill",
      install_name: "write-a-skill",
      description: "Scaffold new agent skills.",
      category: "dev",
      author: "mattpocock",
      source_url: "https://github.com/mattpocock/skills",
      store_url: "https://skills.sh/mattpocock/skills/write-a-skill",
      source_directory: "skills/write-a-skill",
      canonical_skill_path: "skills/write-a-skill/SKILL.md",
      tags: ["skills"],
      version: "1.0.0",
      content: "# Write A Skill\n\nScaffold new agent skills.\n",
    });

    expect(saveRemoteGitToRepo).toHaveBeenCalledWith("skill-write-a-skill", {
      repoUrl: "https://github.com/mattpocock/skills",
      branch: undefined,
      directory: "skills/write-a-skill",
    });
    expect(syncFromRepo).toHaveBeenCalledWith("skill-write-a-skill");
    expect(writeLocalFile).not.toHaveBeenCalledWith(
      "skill-write-a-skill",
      "SKILL.md",
      expect.any(String),
      expect.anything(),
    );
  });

  it("lets the main process locate skills.sh packages for non-standard repo layouts", async () => {
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-vercel-react",
        name: "vercel-react-best-practices",
        source_id: "skills-sh-vercel-react",
        registry_slug: "vercel-labs-agent-skills-vercel-react-best-practices",
      }),
    );
    const writeLocalFile = vi.fn().mockResolvedValue(undefined);
    const saveRemoteGitToRepo = vi
      .fn()
      .mockResolvedValue("/managed/vercel-react/repo");
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-vercel-react",
        name: "vercel-react-best-practices",
        local_repo_path: "/managed/vercel-react/repo",
      }),
    );

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = vi.fn().mockResolvedValue([]);
    (window as any).api.skill.writeLocalFile = writeLocalFile;
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.syncFromRepo = syncFromRepo;

    await useSkillStore.getState().installRegistrySkill({
      slug: "vercel-labs-agent-skills-vercel-react-best-practices",
      source_id: "skills-sh-vercel-react",
      name: "vercel-react-best-practices",
      install_name: "vercel-react-best-practices",
      description: "Review React apps against Vercel guidance.",
      category: "general",
      author: "vercel-labs",
      source_url: "https://github.com/vercel-labs/agent-skills",
      store_url:
        "https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices",
      tags: ["react"],
      version: "1.0.0",
      content: "# React Best Practices\n\nReview React apps.\n",
    });

    expect(saveRemoteGitToRepo).toHaveBeenCalledWith("skill-vercel-react", {
      repoUrl: "https://github.com/vercel-labs/agent-skills",
      branch: undefined,
      directory: undefined,
    });
    expect(syncFromRepo).toHaveBeenCalledWith("skill-vercel-react");
    expect(writeLocalFile).not.toHaveBeenCalledWith(
      "skill-vercel-react",
      "SKILL.md",
      expect.any(String),
      expect.anything(),
    );
  });

  it("installs ClawHub skills from the package download zip instead of only writing SKILL.md", async () => {
    const create = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-gifgrep",
        name: "gifgrep",
        source_id: "clawhub-gifgrep",
        registry_slug: "clawhub-gifgrep",
      }),
    );
    const writeLocalFile = vi.fn().mockResolvedValue(undefined);
    const saveRemoteZipToRepo = vi
      .fn()
      .mockResolvedValue("/managed/gifgrep/repo");
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-gifgrep",
        name: "gifgrep",
        local_repo_path: "/managed/gifgrep/repo",
      }),
    );

    (window as any).api.skill.create = create;
    (window as any).api.skill.getAll = vi.fn().mockResolvedValue([]);
    (window as any).api.skill.writeLocalFile = writeLocalFile;
    (window as any).api.skill.saveRemoteZipToRepo = saveRemoteZipToRepo;
    (window as any).api.skill.syncFromRepo = syncFromRepo;

    await useSkillStore.getState().installRegistrySkill({
      slug: "clawhub-gifgrep",
      source_id: "clawhub-gifgrep",
      name: "GifGrep",
      install_name: "gifgrep",
      description: "Search GIF providers.",
      category: "general",
      author: "clawhub",
      source_url: "https://clawhub.ai/clawhub/gifgrep",
      source_label: "ClawHub",
      store_url: "https://clawhub.ai/clawhub/gifgrep",
      canonical_skill_path: "SKILL.md",
      tags: ["gif"],
      version: "1.0.1",
      content: "# GifGrep\n",
      content_url:
        "https://clawhub.ai/api/v1/skills/gifgrep/file?path=SKILL.md",
      package_url: "https://clawhub.ai/api/v1/download?slug=gifgrep",
    });

    expect(saveRemoteZipToRepo).toHaveBeenCalledWith("skill-gifgrep", {
      zipUrl: "https://clawhub.ai/api/v1/download?slug=gifgrep",
    });
    expect(syncFromRepo).toHaveBeenCalledWith("skill-gifgrep");
    expect(writeLocalFile).not.toHaveBeenCalledWith(
      "skill-gifgrep",
      "SKILL.md",
      expect.any(String),
      expect.anything(),
    );
  });

  it("updates ClawHub skills from package zip without treating the page URL as git", async () => {
    const localContent = "# MinerU\n\nOld extractor.\n";
    const remoteContent = "# MinerU\n\nUpdated extractor.\n";
    const installedHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(localContent);
    const sourceId = "source-clawhub-mineru-document-extractor";
    const fetchRemoteContent = vi.fn().mockResolvedValue(remoteContent);
    const getRemoteGitPackageFingerprint = vi.fn();
    const saveRemoteZipToRepo = vi
      .fn()
      .mockResolvedValue("/managed/mineru/repo");
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-mineru" });
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-mineru-document-extractor",
        name: "mineru-document-extractor",
        local_repo_path: "/managed/mineru/repo",
        content: remoteContent,
        instructions: remoteContent,
        directory_fingerprint: "zip-package-fingerprint-v2",
        installed_directory_fingerprint: "zip-package-fingerprint-v2",
      }),
    );
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({
        id: "skill-mineru-document-extractor",
        name: "mineru-document-extractor",
        source_id: sourceId,
        registry_slug: "clawhub-mineru-document-extractor",
        source_url:
          "https://clawhub.ai/mineru-extract/mineru-document-extractor",
        content_url:
          "https://clawhub.ai/api/v1/skills/mineru-document-extractor/file?path=SKILL.md",
        local_repo_path: "/managed/mineru/repo",
        content: remoteContent,
        instructions: remoteContent,
      }),
      ...data,
    }));

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.getRemoteGitPackageFingerprint =
      getRemoteGitPackageFingerprint;
    (window as any).api.skill.saveRemoteZipToRepo = saveRemoteZipToRepo;
    (window as any).api.skill.versionCreate = versionCreate;
    (window as any).api.skill.syncFromRepo = syncFromRepo;
    (window as any).api.skill.update = update;

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-mineru-document-extractor",
          name: "mineru-document-extractor",
          source_id: sourceId,
          registry_slug: "clawhub-mineru-document-extractor",
          source_url:
            "https://clawhub.ai/mineru-extract/mineru-document-extractor",
          content_url:
            "https://clawhub.ai/api/v1/skills/mineru-document-extractor/file?path=SKILL.md",
          content: localContent,
          instructions: localContent,
          installed_content_hash: installedHash,
          installed_directory_fingerprint: "zip-package-fingerprint-v1",
          directory_fingerprint: "zip-package-fingerprint-v1",
          fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
          installed_version: "1.0.0",
        }),
      ],
      registrySkills: [
        {
          slug: "clawhub-mineru-document-extractor",
          source_id: sourceId,
          name: "mineru-document-extractor",
          description: "MinerU document extraction",
          category: "general",
          author: "mineru-extract",
          source_label: "ClawHub",
          source_url:
            "https://clawhub.ai/mineru-extract/mineru-document-extractor",
          store_url:
            "https://clawhub.ai/mineru-extract/mineru-document-extractor",
          canonical_skill_path: "SKILL.md",
          content_url:
            "https://clawhub.ai/api/v1/skills/mineru-document-extractor/file?path=SKILL.md",
          package_url:
            "https://clawhub.ai/api/v1/download?slug=mineru-document-extractor",
          tags: ["mineru"],
          version: "1.1.0",
          content: remoteContent,
        },
      ],
    });

    const result = await useSkillStore.getState().updateRegistrySkill(sourceId);

    expect(result?.status).toBe("updated");
    expect(getRemoteGitPackageFingerprint).not.toHaveBeenCalled();
    expect(saveRemoteZipToRepo).toHaveBeenCalledWith(
      "skill-mineru-document-extractor",
      {
        zipUrl:
          "https://clawhub.ai/api/v1/download?slug=mineru-document-extractor",
      },
    );
    expect(syncFromRepo).toHaveBeenCalledWith(
      "skill-mineru-document-extractor",
    );
    expect(update).toHaveBeenCalledWith(
      "skill-mineru-document-extractor",
      expect.objectContaining({
        content: remoteContent,
        source_last_error: null,
        source_binding_state: "bound",
      }),
    );
  });

  it("updates installed ClawHub page-url sources through package zip when store entry is absent", async () => {
    const localContent = "# MinerU\n\nOld extractor.\n";
    const remoteContent = "# MinerU\n\nUpdated extractor.\n";
    const installedHash = await useSkillStore
      .getState()
      .computeRegistrySkillHash(localContent);
    const getRemoteGitPackageFingerprint = vi.fn();
    const saveRemoteGitToRepo = vi.fn();
    const saveRemoteZipToRepo = vi
      .fn()
      .mockResolvedValue("/managed/mineru/repo");
    const fetchRemoteContent = vi.fn().mockResolvedValue(remoteContent);
    const versionCreate = vi.fn().mockResolvedValue({ id: "version-mineru" });
    const syncFromRepo = vi.fn().mockResolvedValue(
      createSkillFixture({
        id: "skill-mineru-document-extractor",
        name: "mineru-document-extractor",
        local_repo_path: "/managed/mineru/repo",
        content: remoteContent,
        instructions: remoteContent,
        directory_fingerprint: "zip-package-fingerprint-v2",
        installed_directory_fingerprint: "zip-package-fingerprint-v2",
      }),
    );
    const update = vi.fn().mockImplementation(async (_id, data) => ({
      ...createSkillFixture({
        id: "skill-mineru-document-extractor",
        name: "mineru-document-extractor",
        source_url:
          "https://clawhub.ai/mineru-extract/mineru-document-extractor",
        content: remoteContent,
        instructions: remoteContent,
      }),
      ...data,
    }));

    (window as any).api.skill.fetchRemoteContent = fetchRemoteContent;
    (window as any).api.skill.getRemoteGitPackageFingerprint =
      getRemoteGitPackageFingerprint;
    (window as any).api.skill.saveRemoteGitToRepo = saveRemoteGitToRepo;
    (window as any).api.skill.saveRemoteZipToRepo = saveRemoteZipToRepo;
    (window as any).api.skill.versionCreate = versionCreate;
    (window as any).api.skill.syncFromRepo = syncFromRepo;
    (window as any).api.skill.update = update;

    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-mineru-document-extractor",
          name: "mineru-document-extractor",
          source_url:
            "https://clawhub.ai/mineru-extract/mineru-document-extractor",
          local_repo_path: undefined,
          source_label: "ClawHub",
          canonical_skill_path: "SKILL.md",
          content: localContent,
          instructions: localContent,
          installed_content_hash: installedHash,
          installed_directory_fingerprint: "zip-package-fingerprint-v1",
          directory_fingerprint: "zip-package-fingerprint-v1",
          fingerprint_algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
          installed_version: "1.0.0",
        }),
      ],
      registrySkills: [],
      remoteStoreEntries: {},
    });

    const result = await useSkillStore
      .getState()
      .updateInstalledSkillFromSource("skill-mineru-document-extractor");

    expect(result?.status).toBe("updated");
    expect(getRemoteGitPackageFingerprint).not.toHaveBeenCalled();
    expect(saveRemoteGitToRepo).not.toHaveBeenCalled();
    expect(fetchRemoteContent).toHaveBeenCalledWith(
      "https://clawhub.ai/api/v1/skills/mineru-document-extractor/file?path=SKILL.md",
    );
    expect(saveRemoteZipToRepo).toHaveBeenCalledWith(
      "skill-mineru-document-extractor",
      {
        zipUrl:
          "https://clawhub.ai/api/v1/download?slug=mineru-document-extractor",
      },
    );
  });
});
