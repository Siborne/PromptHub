import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";

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
import {
  promptRepository,
  type MobilePromptSummary,
} from "@/features/prompts/data/promptRepository";
import { useThemePalette } from "@/theme/colors";

export function PromptListScreen() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const router = useRouter();
  const [prompts, setPrompts] = useState<MobilePromptSummary[]>([]);

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
    }, [])
  );

  return (
    <AppScreen>
      <WorkbenchHeader
        description={t("prompts.subtitle")}
        eyebrow={t("common.workspace")}
        meta={`${prompts.length} ${t("common.items")}`}
        title={t("prompts.title")}
        onAction={() => router.push("/(tabs)/prompts/edit")}
      />

      <SearchDock placeholder={t("prompts.searchPlaceholder")} />
      <SegmentPills
        active={t("filters.all")}
        items={[
          t("filters.all"),
          t("filters.favorite"),
          t("filters.recent"),
          t("filters.tags"),
        ]}
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
        <MetricCard label={t("prompts.metrics.tags")} value="0" />
      </MetricGrid>

      <WorkPanel label={t("prompts.recent")}>
        {prompts.map((prompt) => (
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
