import { useEffect, useMemo, useState } from "react";
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const visibleSkills = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return skills.filter((skill) => {
      const matchesSearch = [
        skill.name,
        skill.description,
        skill.author,
        ...skill.tags,
      ].some((value) => value?.toLocaleLowerCase().includes(query));
      const matchesFilter = filter !== "favorite" || skill.is_favorite;
      return matchesSearch && matchesFilter;
    });
  }, [filter, search, skills]);

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

      <SearchDock
        onChangeText={setSearch}
        placeholder={t("skills.searchPlaceholder")}
        value={search}
      />
      <SegmentPills
        activeId={filter}
        items={[
          { id: "all", label: t("filters.all") },
          { id: "favorite", label: t("filters.favorite") },
        ]}
        onChange={setFilter}
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
        {visibleSkills.map((skill) => (
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
