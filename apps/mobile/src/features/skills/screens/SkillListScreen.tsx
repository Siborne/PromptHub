import { useEffect, useState } from "react";
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
import {
  skillRepository,
  type MobileSkillSummary,
} from "@/features/skills/data/skillRepository";
import { useThemePalette } from "@/theme/colors";

export function SkillListScreen() {
  const { t } = useTranslation();
  const palette = useThemePalette();
  const [skills, setSkills] = useState<MobileSkillSummary[]>([]);

  useEffect(() => {
    let mounted = true;

    void skillRepository.list().then((items) => {
      if (mounted) {
        setSkills(items);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <AppScreen>
      <WorkbenchHeader
        description={t("skills.subtitle")}
        eyebrow={t("common.distributionCenter")}
        meta={`${skills.length} ${t("common.items")}`}
        title={t("skills.title")}
      />

      <SearchDock placeholder={t("skills.searchPlaceholder")} />
      <SegmentPills
        active={t("filters.all")}
        items={[
          t("filters.all"),
          t("filters.installed"),
          t("filters.store"),
          t("filters.favorite"),
        ]}
      />

      <MetricGrid>
        <MetricCard
          label={t("skills.metrics.packages")}
          tone="accent"
          value={String(skills.length)}
        />
        <MetricCard label="SKILL.md" value={String(skills.length)} />
        <MetricCard label={t("skills.metrics.sources")} value="2" />
      </MetricGrid>

      <WorkPanel label={t("skills.localPackages")}>
        {skills.map((skill) => (
          <WorkItemRow
            key={skill.id}
            accent={skill.is_favorite ? palette.warning : palette.accentSoft}
            action="installed"
            chips={skill.tags}
            description={skill.description ?? skill.contentPath}
            favorite={skill.is_favorite}
            source={skill.author ?? t("skills.package")}
            symbol={{
              ios: "shippingbox",
              android: "inventory_2",
              web: "inventory_2",
            }}
            title={skill.name}
            meta="SKILL.md"
          />
        ))}
      </WorkPanel>
    </AppScreen>
  );
}
