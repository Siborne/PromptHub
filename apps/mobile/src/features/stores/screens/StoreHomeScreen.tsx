import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppScreen } from "@/components/AppScreen";
import {
  MetricCard,
  MetricGrid,
  SearchDock,
  SegmentPills,
  WorkbenchHeader,
  WorkItemRow,
  WorkPanel,
} from "@/components/WorkbenchChrome";
import { useThemePalette } from "@/theme/colors";

export function StoreHomeScreen() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const sources = useMemo(
    () => [
      {
        id: "official",
        description: "registry.prompthub.local/mobile-official",
        source: t("store.official"),
        title: t("store.official"),
        meta: "registry",
      },
      {
        id: "claude",
        description: "github.com/anthropics/skills",
        source: "Claude",
        title: "Claude Code",
        meta: "github",
      },
      {
        id: "custom",
        description: "marketplace.json",
        source: t("store.custom"),
        title: t("store.custom"),
        meta: "url",
      },
    ],
    [t],
  );
  const visibleSources = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return sources.filter(
      (source) =>
        (sourceFilter === "all" || source.id === sourceFilter) &&
        [source.title, source.description, source.source].some((value) =>
          value.toLocaleLowerCase().includes(query),
        ),
    );
  }, [search, sourceFilter, sources]);

  return (
    <AppScreen>
      <WorkbenchHeader
        description={t("store.subtitle")}
        eyebrow={t("common.discovery")}
        meta={`3 ${t("store.metrics.sources")}`}
        title={t("store.title")}
      />

      <SearchDock
        onChangeText={setSearch}
        placeholder={t("store.searchPlaceholder")}
        value={search}
      />
      <SegmentPills
        activeId={sourceFilter}
        items={[
          { id: "all", label: t("filters.all") },
          { id: "official", label: t("store.official") },
          { id: "claude", label: "Claude Code" },
          { id: "custom", label: t("store.custom") },
        ]}
        onChange={setSourceFilter}
      />

      <MetricGrid>
        <MetricCard
          label={t("store.metrics.sources")}
          tone="accent"
          value="3"
        />
        <MetricCard label={t("store.metrics.cached")} value="54" />
        <MetricCard
          label={t("store.metrics.ready")}
          tone="success"
          value="12"
        />
      </MetricGrid>

      <WorkPanel label={t("store.sources")}>
        {visibleSources.map((source) => (
          <WorkItemRow
            key={source.id}
            accent={
              source.id === "custom"
                ? palette.surfacePressed
                : palette.accentSoft
            }
            action={source.id === "official" ? "installed" : "more"}
            chips={
              source.id === "claude" ? ["SKILL.md", "GitHub"] : [source.meta]
            }
            description={source.description}
            source={source.source}
            symbol={{ ios: "globe", android: "public", web: "public" }}
            title={source.title}
            meta={source.meta}
          />
        ))}
      </WorkPanel>

      <WorkPanel label={t("store.featured")}>
        <WorkItemRow
          accent={palette.accentSoft}
          action="more"
          chips={["prompt", "quality"]}
          description={t("store.featuredPromptDescription")}
          source="Official"
          symbol={{
            ios: "wand.and.stars",
            android: "auto_awesome",
            web: "auto_awesome",
          }}
          title="Prompt Optimizer"
          meta="SKILL.md"
        />
      </WorkPanel>
    </AppScreen>
  );
}
