import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { FormEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillStore } from "../../../src/renderer/components/skill/SkillStore";
import { SkillStoreDetail } from "../../../src/renderer/components/skill/SkillStoreDetail";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";

import { makeRegistrySkill } from "./skill-store-remote.test-fixtures";

const { showToast } = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

const originalSkillStoreActions = {
  installRegistrySkill: useSkillStore.getState().installRegistrySkill,
  uninstallRegistrySkill: useSkillStore.getState().uninstallRegistrySkill,
  updateRegistrySkill: useSkillStore.getState().updateRegistrySkill,
};

const resetSkillStore = () => {
  useSkillStore.setState({
    ...originalSkillStoreActions,
    skills: [],
    selectedSkillId: null,
    isLoading: false,
    error: null,
    viewMode: "gallery",
    searchQuery: "",
    filterType: "all",
    filterTags: [],
    deployedSkillNames: new Set<string>(),
    storeView: "store",
    registrySkills: [],
    isLoadingRegistry: false,
    storeCategory: "all",
    storeSearchQuery: "",
    selectedRegistrySlug: null,
    customStoreSources: [],
    selectedStoreSourceId: "claude-code",
    remoteStoreEntries: {},
    translationCache: {},
  });
};

describe("SkillStore remote loading", () => {
  beforeEach(() => {
    showToast.mockReset();
    localStorage.clear();
    resetSkillStore();
    useSettingsStore.setState({
      device: {
        storeAutoSync: false,
        storeSyncCadence: "1d",
      },
    } as Partial<ReturnType<typeof useSettingsStore.getState>>);
  });

  it("prefers local source content over installed stale content in store detail", async () => {
    useSkillStore.setState({
      getTranslationState: vi.fn().mockReturnValue({
        value: null,
        hasTranslation: false,
        isStale: false,
      }),
      skills: [
        {
          id: "installed-local-writer",
          name: "local-writer",
          registry_slug: "local-writer",
          description: "Installed stale skill",
          instructions: "# Local Writer\n\nInstalled stale content",
          content: "# Local Writer\n\nInstalled stale content",
          protocol_type: "skill",
          author: "Local",
          local_repo_path: "/tmp/local-writer",
          tags: ["local"],
          is_favorite: false,
          currentVersion: 0,
          created_at: 1,
          updated_at: 1,
        },
      ],
    } as never);

    const skill = {
      slug: "local-writer",
      name: "local-writer",
      description: "Original description",
      category: "general",
      author: "Local",
      tags: ["local"],
      version: "1.1.0",
      content: "# Local Writer\n\nFresh source content",
      source_url: "/tmp/local-writer",
      content_url: "/tmp/local-writer/SKILL.md",
      compatibility: ["claude"],
    } as never;

    const { getByText, queryByText } = await renderWithI18n(
      <SkillStoreDetail skill={skill} isInstalled={true} onClose={vi.fn()} />,
      { language: "en" },
    );

    await waitFor(() => {
      expect(getByText("Fresh source content")).toBeInTheDocument();
    });
    expect(queryByText("Installed stale content")).not.toBeInTheDocument();
  });

  it("uses batch mode card clicks for selection and keeps detail as an icon action", async () => {
    installWindowMocks({
      api: {
        settings: {
          get: vi.fn().mockResolvedValue({
            device: { storeAutoSync: false, storeSyncCadence: "1d" },
          }),
        },
        skill: {
          fetchRemoteContent: vi.fn().mockResolvedValue(""),
          scanLocalPreview: vi.fn().mockResolvedValue([]),
          scanSafety: vi.fn().mockResolvedValue({
            level: "safe",
            summary: "safe",
            findings: [],
            recommendedAction: "allow",
            scannedAt: Date.now(),
            checkedFileCount: 1,
            scanMethod: "ai",
          }),
        },
      },
    });

    const alpha = makeRegistrySkill("alpha");
    useSkillStore.setState({
      selectedStoreSourceId: "claude-code",
      remoteStoreEntries: {
        "claude-code": {
          loadedAt: Date.now(),
          skills: [alpha],
        },
      },
    } as never);

    await renderWithI18n(<SkillStore />, { language: "en" });
    await screen.findByText("Alpha");

    fireEvent.click(screen.getByRole("button", { name: "Batch manage store" }));
    fireEvent.click(screen.getByText("Alpha"));

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(useSkillStore.getState().selectedRegistrySlug).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "View detail" }));
    expect(useSkillStore.getState().selectedRegistrySlug).toBe("source-alpha");
  });

  it("toggles select visible back to deselect visible in store batch mode", async () => {
    installWindowMocks({
      api: {
        settings: {
          get: vi.fn().mockResolvedValue({
            device: { storeAutoSync: false, storeSyncCadence: "1d" },
          }),
        },
        skill: {
          fetchRemoteContent: vi.fn().mockResolvedValue(""),
          scanLocalPreview: vi.fn().mockResolvedValue([]),
          scanSafety: vi.fn().mockResolvedValue({
            level: "safe",
            summary: "safe",
            findings: [],
            recommendedAction: "allow",
            scannedAt: Date.now(),
            checkedFileCount: 1,
            scanMethod: "ai",
          }),
        },
      },
    });

    useSkillStore.setState({
      selectedStoreSourceId: "claude-code",
      remoteStoreEntries: {
        "claude-code": {
          loadedAt: Date.now(),
          skills: [makeRegistrySkill("alpha"), makeRegistrySkill("beta")],
        },
      },
    } as never);

    await renderWithI18n(<SkillStore />, { language: "en" });
    await screen.findByText("Beta");

    fireEvent.click(screen.getByRole("button", { name: "Batch manage store" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select visible store skills" }),
    );
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Deselect visible store skills" }),
    );
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Install selected" }),
    ).toBeDisabled();
  });

  it("batch installs only selected store skills that are not already imported", async () => {
    const installRegistrySkill = vi.fn().mockResolvedValue({
      status: "installed",
      skill: {
        id: "skill-beta",
        name: "Beta",
      },
    });
    installWindowMocks({
      api: {
        settings: {
          get: vi.fn().mockResolvedValue({
            device: { storeAutoSync: false, storeSyncCadence: "1d" },
          }),
        },
        skill: {
          fetchRemoteContent: vi.fn().mockResolvedValue(""),
          scanLocalPreview: vi.fn().mockResolvedValue([]),
          scanSafety: vi.fn().mockResolvedValue({
            level: "safe",
            summary: "safe",
            findings: [],
            recommendedAction: "allow",
            scannedAt: Date.now(),
            checkedFileCount: 1,
            scanMethod: "ai",
          }),
        },
      },
    });

    const alpha = makeRegistrySkill("alpha");
    const beta = makeRegistrySkill("beta");
    useSettingsStore.setState({
      autoScanStoreSkillsBeforeInstall: false,
    } as never);
    useSkillStore.setState({
      installRegistrySkill,
      selectedStoreSourceId: "claude-code",
      skills: [
        {
          id: "skill-alpha",
          name: "Alpha",
          registry_slug: "alpha",
          source_id: "source-alpha",
          description: "Installed alpha",
          instructions: "# alpha",
          content: "# alpha",
          protocol_type: "skill",
          tags: [],
          is_favorite: false,
          currentVersion: 0,
          created_at: 1,
          updated_at: 1,
        },
      ],
      remoteStoreEntries: {
        "claude-code": {
          loadedAt: Date.now(),
          skills: [alpha, beta],
        },
      },
    } as never);

    await renderWithI18n(<SkillStore />, { language: "en" });
    await screen.findByText("Beta");

    fireEvent.click(screen.getByRole("button", { name: "Batch manage store" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select visible store skills" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Install selected" }));

    await waitFor(() => {
      expect(installRegistrySkill).toHaveBeenCalledTimes(1);
    });
    expect(installRegistrySkill.mock.calls[0][0].slug).toBe("beta");
  });

  it("queues batch install reviews without reporting them as success or failure", async () => {
    const beta = makeRegistrySkill("beta");
    const installRegistrySkill = vi.fn().mockResolvedValue({
      status: "safety-review-required",
      review: {
        sourceKey: "git:https://gitea.example.com/team/skills#main:beta",
        packageFingerprint: "b".repeat(64),
        report: {
          level: "high-risk",
          summary: "Review the package script.",
          findings: [],
          recommendedAction: "review",
          scannedAt: 1,
          checkedFileCount: 4,
          scanMethod: "preflight",
        },
      },
    });
    installWindowMocks({
      api: {
        settings: {
          get: vi.fn().mockResolvedValue({
            device: { storeAutoSync: false, storeSyncCadence: "1d" },
          }),
        },
        skill: {
          fetchRemoteContent: vi.fn().mockResolvedValue(""),
          scanLocalPreview: vi.fn().mockResolvedValue([]),
        },
      },
    });
    useSettingsStore.setState({
      autoScanStoreSkillsBeforeInstall: false,
    } as never);
    useSkillStore.setState({
      installRegistrySkill,
      selectedStoreSourceId: "claude-code",
      remoteStoreEntries: {
        "claude-code": {
          loadedAt: Date.now(),
          skills: [beta],
        },
      },
    } as never);

    await renderWithI18n(<SkillStore />, { language: "en" });
    await screen.findByText("Beta");
    fireEvent.click(screen.getByRole("button", { name: "Batch manage store" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select visible store skills" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Install selected" }));

    await waitFor(() => {
      expect(screen.getByText("Review Skill Installation")).toBeInTheDocument();
    });
    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("1 awaiting review"),
      "info",
    );
  });

  it("batch removes only selected imported store skills from My Skills", async () => {
    const uninstallRegistrySkill = vi.fn().mockResolvedValue(true);
    installWindowMocks({
      api: {
        settings: {
          get: vi.fn().mockResolvedValue({
            device: { storeAutoSync: false, storeSyncCadence: "1d" },
          }),
        },
        skill: {
          fetchRemoteContent: vi.fn().mockResolvedValue(""),
          scanLocalPreview: vi.fn().mockResolvedValue([]),
          scanSafety: vi.fn().mockResolvedValue({
            level: "safe",
            summary: "safe",
            findings: [],
            recommendedAction: "allow",
            scannedAt: Date.now(),
            checkedFileCount: 1,
            scanMethod: "ai",
          }),
        },
      },
    });

    const alpha = makeRegistrySkill("alpha");
    const beta = makeRegistrySkill("beta");
    useSkillStore.setState({
      selectedStoreSourceId: "claude-code",
      uninstallRegistrySkill,
      skills: [
        {
          id: "skill-alpha",
          name: "Alpha",
          registry_slug: "alpha",
          source_id: "source-alpha",
          description: "Installed alpha",
          instructions: "# alpha",
          content: "# alpha",
          protocol_type: "skill",
          tags: [],
          is_favorite: false,
          currentVersion: 0,
          created_at: 1,
          updated_at: 1,
        },
      ],
      remoteStoreEntries: {
        "claude-code": {
          loadedAt: Date.now(),
          skills: [alpha, beta],
        },
      },
    } as never);

    await renderWithI18n(<SkillStore />, { language: "en" });
    await screen.findByText("Beta");

    fireEvent.click(screen.getByRole("button", { name: "Batch manage store" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select visible store skills" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Remove selected from My Skills",
      }),
    );

    const removeButtons = screen.getAllByRole("button", {
      name: "Remove selected from My Skills",
    });
    fireEvent.click(removeButtons[removeButtons.length - 1]);

    await waitFor(() => {
      expect(uninstallRegistrySkill).toHaveBeenCalledTimes(1);
    });
    expect(uninstallRegistrySkill).toHaveBeenCalledWith("source-alpha");
  });

  it("removes an imported store skill from the detail action when it was matched by slug", async () => {
    const deleteSkill = vi.fn().mockResolvedValue(true);
    const getAll = vi.fn().mockResolvedValue([]);
    installWindowMocks({
      api: {
        skill: {
          delete: deleteSkill,
          getAll,
          scanSafety: vi.fn().mockResolvedValue({
            level: "safe",
            summary: "safe",
            findings: [],
            recommendedAction: "allow",
            scannedAt: Date.now(),
            checkedFileCount: 1,
            scanMethod: "ai",
          }),
        },
      },
    });

    const storeSkill = {
      slug: "aspnet-core",
      name: "ASP.NET Core",
      description: "ASP.NET Core helper",
      category: "development",
      tags: ["dotnet"],
      version: "1.0.0",
      content: "# ASP.NET Core\n",
      compatibility: ["claude"],
    } as never;
    useSkillStore.setState({
      registrySkills: [storeSkill],
      skills: [
        {
          id: "skill-aspnet-core",
          name: "ASP.NET Core",
          registry_slug: "aspnet-core",
          description: "Installed ASP.NET Core helper",
          instructions: "# ASP.NET Core\n",
          content: "# ASP.NET Core\n",
          protocol_type: "skill",
          tags: ["dotnet"],
          is_favorite: false,
          currentVersion: 0,
          created_at: 1,
          updated_at: 1,
        },
      ],
    } as never);

    await renderWithI18n(
      <SkillStoreDetail
        skill={storeSkill}
        isInstalled={true}
        onClose={vi.fn()}
      />,
      { language: "en" },
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Remove from My Skills" }),
      );
    });

    await waitFor(() => {
      expect(deleteSkill).toHaveBeenCalledWith("skill-aspnet-core");
    });
    expect(getAll).toHaveBeenCalled();
  });

  it("prompts for retranslation when store translation is stale", async () => {
    useSkillStore.setState({
      getTranslationState: vi.fn().mockReturnValue({
        value: null,
        hasTranslation: true,
        isStale: true,
      }),
    } as never);

    const skill = {
      slug: "writer",
      name: "Writer",
      description: "Original description",
      category: "general",
      tags: ["writing"],
      version: "1.0.0",
      content: "# Writer\n\nOriginal content",
      compatibility: ["claude"],
    } as never;

    const { getByText } = await renderWithI18n(
      <SkillStoreDetail skill={skill} isInstalled={false} onClose={vi.fn()} />,
      { language: "en" },
    );

    await waitFor(() => {
      expect(getByText("Saved translation is outdated")).toBeInTheDocument();
    });
  });

  it("shows a clear timeout error when store translation request returns 504", async () => {
    const translateContent = vi
      .fn()
      .mockRejectedValue(new Error("API 请求失败 (504)"));
    useSkillStore.setState({
      translateContent,
    } as never);

    const skill = {
      slug: "writer",
      name: "Writer",
      description: "Original description",
      category: "general",
      tags: ["writing"],
      version: "1.0.0",
      content: "# Writer\n\nOriginal content",
      compatibility: ["claude"],
    } as never;

    const { getByRole } = await renderWithI18n(
      <SkillStoreDetail skill={skill} isInstalled={false} onClose={vi.fn()} />,
      { language: "en" },
    );

    await act(async () => {
      fireEvent.click(getByRole("button", { name: "AI Translate" }));
    });

    expect(showToast).toHaveBeenCalledWith(
      "The AI service timed out while translating. Please try again in a moment, or switch to a faster / more stable model endpoint.",
      "error",
    );
  });
});
