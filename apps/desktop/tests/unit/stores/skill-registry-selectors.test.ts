import { beforeEach, describe, expect, it, vi } from "vitest";

import { useSkillStore } from "../../../src/renderer/stores/skill.store";
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
  localStorage.clear();
};

describe("skill registry selectors", () => {
  beforeEach(() => {
    resetSkillStore();
    installWindowMocks({
      api: {
        skill: {
          getAll: vi.fn(),
        },
      },
    });
  });

  it("uses canonical skill identity for installed and recommended registry groups", () => {
    useSkillStore.setState({
      skills: [
        createSkillFixture({
          id: "skill-legacy-writer",
          name: "writer",
          registry_slug: "writer",
          content_url:
            "https://raw.githubusercontent.com/anthropics/skills/main/writer/SKILL.md",
        }),
      ],
      registrySkills: [
        {
          slug: "writer",
          name: "Writer",
          install_name: "writer",
          source_id: "claude-code:writer:refreshed",
          description: "Official Claude Code writer",
          category: "general",
          author: "Anthropic",
          source_url: "https://github.com/anthropics/skills/tree/main/writer",
          content_url:
            "https://raw.githubusercontent.com/anthropics/skills/main/writer/SKILL.md",
          tags: ["writing"],
          version: "1.0.0",
          content: "# Writer\n",
        },
        {
          slug: "fork-writer",
          name: "Writer",
          install_name: "writer",
          source_id: "claude-code:fork-writer",
          description: "Same install name, different package",
          category: "general",
          author: "Community",
          source_url: "https://github.com/anthropics/skills/tree/main/fork-writer",
          content_url:
            "https://raw.githubusercontent.com/anthropics/skills/main/fork-writer/SKILL.md",
          tags: ["writing"],
          version: "1.0.0",
          content: "# Fork Writer\n",
        },
      ],
    } as never);

    const grouped = useSkillStore.getState().getFilteredRegistrySkills();

    expect(grouped.installed.map((skill) => skill.source_id)).toEqual([
      "claude-code:writer:refreshed",
    ]);
    expect(grouped.recommended.map((skill) => skill.source_id)).toEqual([
      "claude-code:fork-writer",
    ]);
    expect(
      useSkillStore.getState().getRecommendedSkills().map((skill) => skill.source_id),
    ).toEqual(["claude-code:fork-writer"]);
  });

  it("clears source-scoped search when the selected store changes", () => {
    useSkillStore.setState({
      selectedStoreSourceId: "community",
      selectedRegistrySlug: "community:docs-helper",
      storeSearchQuery: "docs",
    });

    useSkillStore.getState().selectStoreSource("claude-code");

    expect(useSkillStore.getState()).toMatchObject({
      selectedStoreSourceId: "claude-code",
      selectedRegistrySlug: null,
      storeSearchQuery: "",
    });
  });
});
