import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillStore } from "../../../src/renderer/components/skill/SkillStore";
import { SkillStoreCustomSources } from "../../../src/renderer/components/skill/SkillStoreCustomSources";
import { SkillStoreSourceEditModal } from "../../../src/renderer/components/skill/SkillStoreSourceEditModal";
import { SkillStoreSourceForm } from "../../../src/renderer/components/skill/SkillStoreSourceForm";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";
import type { RegistrySkill } from "@prompthub/shared/types";
import { buildSkillSourceId } from "@prompthub/shared/utils/skill-identity";

const { showToast } = vi.hoisted(() => ({
  showToast: vi.fn(),
}));

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

function makeRegistrySkill(
  overrides: Partial<RegistrySkill> = {},
): RegistrySkill {
  return {
    slug: "docs-helper",
    name: "Docs Helper",
    description: "Helps with docs",
    category: "general",
    author: "tester",
    source_url: "https://example.com/docs-helper",
    source_id: "docs-helper-source",
    tags: [],
    version: "1.0.0",
    content: "# Docs Helper\n",
    ...overrides,
  };
}

describe("SkillStore custom sources", () => {
  beforeEach(() => {
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
      storeView: "store",
      registrySkills: [],
      isLoadingRegistry: false,
      storeCategory: "all",
      storeSearchQuery: "",
      selectedRegistrySlug: null,
      customStoreSources: [],
      selectedStoreSourceId: "official",
      remoteStoreEntries: {},
      translationCache: {},
    });
  });

  it("normalizes GitHub tree URLs before requesting remote branches", async () => {
    const listRemoteBranches = vi.fn().mockResolvedValue(["main", "release"]);

    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
          listRemoteBranches,
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

    useSkillStore.setState({ selectedStoreSourceId: "new-custom" } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Git Repository/i }));

    fireEvent.change(screen.getByPlaceholderText("Store URL / manifest URL"), {
      target: {
        value: "https://github.com/anthropics/skills/tree/main/skills/.curated",
      },
    });

    await waitFor(() => {
      expect(listRemoteBranches).toHaveBeenCalledWith(
        "https://github.com/anthropics/skills",
      );
    });
  });

  it("keeps main visible in branch suggestions when many branches exist", async () => {
    const listRemoteBranches = vi
      .fn()
      .mockResolvedValue([
        "andibrae/create-top-level-namespace",
        "klazuka/add-3p-notices",
        "klazuka/add-cc-instructions",
        "klazuka/add-cc-marketplace",
        "klazuka/doc-skills",
        "klazuka/export",
        "klazuka/export-20260203",
        "klazuka/frontend-design-skill",
        "klazuka/pptx-cleanup",
        "klazuka/spec",
        "mahesh/add-to-readme",
        "mahesh/clarify-claude-code-install",
        "main",
        "mattpic-ant/blog-small-fix",
      ]);

    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
          listRemoteBranches,
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

    useSkillStore.setState({ selectedStoreSourceId: "new-custom" } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Git Repository/i }));
    fireEvent.change(screen.getByPlaceholderText("Store URL / manifest URL"), {
      target: { value: "https://github.com/anthropics/skills/tree/main" },
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "main" })).toBeInTheDocument();
    });
  });

  it("hides the selected branch from the suggestion list", async () => {
    const listRemoteBranches = vi.fn().mockResolvedValue(["main", "release"]);

    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
          listRemoteBranches,
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

    useSkillStore.setState({ selectedStoreSourceId: "new-custom" } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Git Repository/i }));
    fireEvent.change(screen.getByPlaceholderText("Store URL / manifest URL"), {
      target: { value: "https://github.com/anthropics/skills" },
    });

    await waitFor(() => {
      expect(screen.getByText("Suggested branches")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "main" }));

    expect(screen.getByDisplayValue("main")).toBeInTheDocument();
    expect(screen.queryAllByRole("button", { name: "main" })).toHaveLength(0);
  });

  it("renders localized branch helper copy", async () => {
    const listRemoteBranches = vi.fn().mockResolvedValue(["main", "release"]);

    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
          listRemoteBranches,
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

    useSkillStore.setState({ selectedStoreSourceId: "new-custom" } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "zh" });
    });

    fireEvent.click(screen.getByRole("button", { name: /Git 仓库/i }));
    fireEvent.change(screen.getByPlaceholderText("商店地址 / manifest URL"), {
      target: { value: "https://github.com/anthropics/skills" },
    });

    await waitFor(() => {
      expect(screen.getByText("可选分支")).toBeInTheDocument();
    });

    expect(
      screen.getByPlaceholderText("分支（可选，留空则使用默认分支）"),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("目录（可选，例如 skills/.curated）"),
    ).toBeInTheDocument();
  });

  it("does not render duplicate custom store action cards in the main pane", async () => {
    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
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
      storeView: "store",
      customStoreSources: [
        {
          id: "custom-docs",
          name: "Docs Store",
          type: "marketplace-json",
          url: "https://example.com/store.json",
          enabled: true,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      selectedStoreSourceId: "custom-docs",
    } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    expect(
      screen.queryByRole("button", { name: "Disable" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Delete" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Enabled")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
    expect(
      screen.getByText("This store contains 0 skills"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No skills found")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Try a different search or category"),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByText("Docs Store")).toHaveLength(1);
    expect(screen.getByPlaceholderText("Search skills...")).toBeInTheDocument();
  });

  it("keeps selected custom store header actions semantic and decorative icons hidden", async () => {
    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
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
      storeView: "store",
      customStoreSources: [
        {
          id: "custom-docs",
          name: "Docs Store",
          type: "marketplace-json",
          url: "https://example.com/store.json",
          enabled: true,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      selectedStoreSourceId: "custom-docs",
    } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    for (const name of ["Batch manage store", "Refresh", "Edit"]) {
      const action = screen.getByRole("button", { name });
      expect(action).toHaveAttribute("type", "button");
      expect(action.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });

  it("exposes custom store category filters as pressed non-submit buttons", async () => {
    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
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
      storeView: "store",
      storeCategory: "all",
      customStoreSources: [
        {
          id: "custom-docs",
          name: "Docs Store",
          type: "marketplace-json",
          url: "https://example.com/store.json",
          enabled: true,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      selectedStoreSourceId: "custom-docs",
    } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    const all = screen.getByRole("button", { name: "All" });
    const development = screen.getByRole("button", { name: "Development" });

    expect(all).toHaveAttribute("type", "button");
    expect(all).toHaveAttribute("aria-pressed", "true");
    expect(development).toHaveAttribute("type", "button");
    expect(development).toHaveAttribute("aria-pressed", "false");
    expect(development.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await act(async () => {
      fireEvent.click(development);
    });

    expect(useSkillStore.getState().storeCategory).toBe("dev");
  });

  it("keeps custom store batch action icons decorative", async () => {
    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
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
      storeView: "store",
      customStoreSources: [
        {
          id: "custom-docs",
          name: "Docs Store",
          type: "marketplace-json",
          url: "https://example.com/store.json",
          enabled: true,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      selectedStoreSourceId: "custom-docs",
      remoteStoreEntries: {
        "custom-docs": {
          loadedAt: Date.now(),
          error: null,
          skills: [makeRegistrySkill()],
        },
      },
    } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Batch manage store" }),
      );
    });

    for (const name of [
      "Select visible store skills",
      "Install selected",
      "Update selected",
      "Remove selected from My Skills",
      "Deselect All",
    ]) {
      const action = screen.getByRole("button", { name });
      expect(action).toHaveAttribute("type", "button");
      expect(action.querySelector("svg")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
  });

  it("renders one custom store empty state even when a search query is active", async () => {
    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi
            .fn()
            .mockResolvedValue(JSON.stringify({ skills: [] })),
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
      storeView: "store",
      selectedStoreSourceId: "empty-custom",
      storeSearchQuery: "missing",
      customStoreSources: [
        {
          id: "empty-custom",
          name: "Empty Custom Store",
          type: "marketplace-json",
          url: "https://example.com/marketplace.json",
          enabled: true,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      remoteStoreEntries: {
        "empty-custom": {
          loadedAt: Date.now(),
          error: null,
          skills: [],
        },
      },
    } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    expect(
      screen.getByText("This store contains 0 skills"),
    ).toBeInTheDocument();
    expect(screen.queryByText("No skills found")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Try a different search or category"),
    ).not.toBeInTheDocument();
  });

  it("shows search-empty guidance when a non-empty custom store has no matches", async () => {
    installWindowMocks({
      api: {
        skill: {
          fetchRemoteContent: vi.fn(),
          scanLocalPreview: vi.fn(),
        },
      },
    });
    useSkillStore.setState({
      storeView: "store",
      selectedStoreSourceId: "custom-docs",
      storeSearchQuery: "missing",
      customStoreSources: [
        {
          id: "custom-docs",
          name: "Docs Store",
          type: "marketplace-json",
          url: "https://example.com/marketplace.json",
          enabled: true,
          order: 0,
          createdAt: Date.now(),
        },
      ],
      remoteStoreEntries: {
        "custom-docs": {
          loadedAt: Date.now(),
          error: null,
          skills: [makeRegistrySkill()],
        },
      },
    } as never);

    await act(async () => {
      await renderWithI18n(<SkillStore />, { language: "en" });
    });

    expect(screen.getByText("No skills found")).toBeInTheDocument();
    expect(
      screen.getByText("Try a different search or category"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("No skills in this custom store yet"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["marketplace-json", "https://example.com/marketplace.json"],
    ["git-repo", "https://github.com/example/skills"],
    ["local-dir", "/tmp/example-skills"],
  ] as const)(
    "searches loaded %s custom store skills without changing sources",
    async (sourceType, sourceUrl) => {
      const sourceId = `${sourceType}-store`;
      useSkillStore.setState({
        storeView: "store",
        selectedStoreSourceId: sourceId,
        customStoreSources: [
          {
            id: sourceId,
            name: "Team Store",
            type: sourceType,
            url: sourceUrl,
            enabled: true,
            order: 0,
            createdAt: Date.now(),
          },
        ],
        remoteStoreEntries: {
          [sourceId]: {
            loadedAt: Date.now(),
            error: null,
            skills: [
              makeRegistrySkill(),
              makeRegistrySkill({
                slug: "code-helper",
                name: "Code Helper",
                description: "Helps with code",
                source_id: "code-helper-source",
                source_url: "https://example.com/code-helper",
              }),
            ],
          },
        },
      } as never);

      await act(async () => {
        await renderWithI18n(<SkillStore />, { language: "en" });
      });

      const search = screen.getByRole("textbox", { name: "Search skills..." });
      fireEvent.change(search, { target: { value: "docs" } });
      fireEvent.submit(screen.getByTestId("skill-store-local-search-form"));

      await waitFor(() => {
        expect(screen.getByText("Docs Helper")).toBeInTheDocument();
        expect(screen.queryByText("Code Helper")).not.toBeInTheDocument();
      });
      expect(useSkillStore.getState().selectedStoreSourceId).toBe(sourceId);
    },
  );
});
