import { describe, expect, it } from "vitest";

import {
  buildSkillStoreCategories,
  resolveSkillStoreSourceMeta,
} from "../../../src/renderer/components/skill/skill-store-view-model";

const t = ((key: string, fallback: string) => fallback || key) as never;

describe("skill store view model", () => {
  it("builds localized categories without mutating the shared registry", () => {
    const english = buildSkillStoreCategories(false, t);
    const chinese = buildSkillStoreCategories(true, t);

    expect(english[0]).toEqual({ key: "all", label: "All" });
    expect(english).toHaveLength(chinese.length);
    expect(
      english
        .slice(1)
        .some((item, index) => item.label !== chinese[index + 1]?.label),
    ).toBe(true);
  });

  it("resolves remote, custom, add-source, and unavailable source metadata", () => {
    const base = {
      customStoreSourcesCount: 2,
      displayedStoreCount: 12,
      displayedStoreCountLabel: "12 skills",
      selectedCustomSource: null,
      t,
    };

    expect(
      resolveSkillStoreSourceMeta({
        ...base,
        selectedStoreSourceId: "community",
      }),
    ).toMatchObject({ title: "Community Store", showCatalog: true });
    expect(
      resolveSkillStoreSourceMeta({
        ...base,
        selectedStoreSourceId: "new-custom",
      }),
    ).toMatchObject({ title: "Add Store", count: 2, showCatalog: false });
    expect(
      resolveSkillStoreSourceMeta({
        ...base,
        selectedCustomSource: {
          id: "custom",
          name: "Private Store",
          type: "git-repo",
          url: "https://example.com/store.git",
          enabled: true,
          createdAt: 1,
        },
        selectedStoreSourceId: "custom",
      }),
    ).toMatchObject({ title: "Private Store", showCatalog: true });
    expect(
      resolveSkillStoreSourceMeta({
        ...base,
        selectedStoreSourceId: "official",
      }),
    ).toMatchObject({ title: "Official Store", count: 0, showCatalog: false });
  });
});
