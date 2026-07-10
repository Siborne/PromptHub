import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";

import { AppScreen } from "@/components/AppScreen";
import { AppText } from "@/components/AppText";
import {
  MetricCard,
  MetricGrid,
  SearchDock,
  SegmentPills,
  WorkbenchHeader,
  WorkItemRow,
  WorkPanel,
} from "@/components/WorkbenchChrome";
import {
  promptRepository,
  type MobilePromptSummary,
} from "@/features/prompts/data/promptRepository";
import { useThemePalette } from "@/theme/colors";
import {
  filterPrompts,
  type PromptFilter,
} from "@/features/prompts/promptFilters";

export function PromptListScreen() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const router = useRouter();
  const [prompts, setPrompts] = useState<MobilePromptSummary[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PromptFilter>("all");
  const visiblePrompts = useMemo(
    () => filterPrompts(prompts, search, filter),
    [filter, prompts, search],
  );
  const tagCount = useMemo(
    () => new Set(prompts.flatMap((prompt) => prompt.tags)).size,
    [prompts],
  );

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      void promptRepository.list().then((items) => {
        if (mounted) {
          setPrompts(items);
        }
      });

      return () => {
        mounted = false;
      };
    }, []),
  );

  return (
    <AppScreen>
      <WorkbenchHeader
        actionLabel={t("prompts.workflow.createTitle")}
        description={t("prompts.subtitle")}
        eyebrow={t("common.workspace")}
        meta={`${prompts.length} ${t("common.items")}`}
        title={t("prompts.title")}
        onAction={() => router.push("/(tabs)/prompts/edit")}
      />

      <SearchDock
        onChangeText={setSearch}
        placeholder={t("prompts.searchPlaceholder")}
        value={search}
      />
      <SegmentPills
        activeId={filter}
        items={[
          { id: "all", label: t("filters.all") },
          { id: "favorite", label: t("filters.favorite") },
          { id: "recent", label: t("filters.recent") },
          { id: "tags", label: t("filters.tags") },
        ]}
        onChange={(id) => setFilter(id as PromptFilter)}
      />

      <MetricGrid>
        <MetricCard
          label={t("prompts.metrics.local")}
          tone="accent"
          value={String(prompts.length)}
        />
        <MetricCard
          label={t("prompts.metrics.favorite")}
          value={String(prompts.filter((item) => item.isFavorite).length)}
        />
        <MetricCard
          label={t("prompts.metrics.tags")}
          value={String(tagCount)}
        />
      </MetricGrid>

      <WorkPanel label={t("prompts.recent")}>
        {visiblePrompts.length === 0 ? (
          <AppText variant="muted">{t("prompts.workflow.empty")}</AppText>
        ) : null}
        {visiblePrompts.map((prompt) => (
          <WorkItemRow
            key={prompt.id}
            accent={prompt.isFavorite ? palette.warning : palette.accentSoft}
            action="more"
            chips={prompt.tags}
            description={prompt.description || prompt.userPrompt}
            favorite={prompt.isFavorite}
            source={t("prompts.localCount")}
            symbol={{ ios: "text.quote", android: "article", web: "article" }}
            title={prompt.title}
            meta={new Date(prompt.updatedAt).toLocaleDateString()}
            onPress={() => router.push(`/(tabs)/prompts/${prompt.id}`)}
          />
        ))}
      </WorkPanel>
    </AppScreen>
  );
}
