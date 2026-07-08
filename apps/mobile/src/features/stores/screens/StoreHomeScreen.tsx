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

  return (
    <AppScreen>
      <WorkbenchHeader
        description={t("store.subtitle")}
        eyebrow={t("common.discovery")}
        meta={`3 ${t("store.metrics.sources")}`}
        title={t("store.title")}
      />

      <SearchDock placeholder={t("store.searchPlaceholder")} />
      <SegmentPills
        active={t("store.official")}
        items={[t("store.official"), "Claude Code", t("store.custom")]}
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
        <WorkItemRow
          accent={palette.accentSoft}
          description="registry.prompthub.local/mobile-official"
          action="installed"
          chips={["registry", "builtin"]}
          source={t("store.official")}
          symbol={{
            ios: "storefront",
            android: "storefront",
            web: "storefront",
          }}
          title={t("store.official")}
          meta="registry"
        />
        <WorkItemRow
          accent={palette.accentSoft}
          description="github.com/anthropics/skills"
          action="download"
          chips={["SKILL.md", "GitHub"]}
          source="Claude"
          symbol={{ ios: "globe", android: "public", web: "public" }}
          title="Claude Code"
          meta="github"
        />
        <WorkItemRow
          accent={palette.surfacePressed}
          description="marketplace.json"
          action="more"
          chips={["json", "url"]}
          source={t("store.custom")}
          symbol={{ ios: "link", android: "link", web: "link" }}
          title={t("store.custom")}
          meta="url"
        />
      </WorkPanel>

      <WorkPanel label={t("store.featured")}>
        <WorkItemRow
          accent={palette.accentSoft}
          action="download"
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
