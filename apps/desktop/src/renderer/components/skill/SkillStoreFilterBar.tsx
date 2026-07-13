import type { FormEvent, ReactNode } from "react";
import type { TFunction } from "i18next";
import { SearchIcon, XIcon } from "lucide-react";
import type { SkillCategory, SkillStoreSource } from "@prompthub/shared/types";
import {
  SKILLS_SH_FILTERS,
  normalizeSkillsShFilterKey,
} from "../../services/skills-sh-store";
import { SkillStoreSourceForm } from "./SkillStoreSourceForm";
import {
  CATEGORY_ICONS,
  CUSTOM_SOURCE_TYPE_OPTIONS,
} from "./skill-store-presentation";

type EditableSourceType = Extract<
  SkillStoreSource["type"],
  "marketplace-json" | "git-repo" | "local-dir"
>;

interface SkillStoreFilterBarProps {
  t: TFunction;
  visible: boolean;
  showSearch: boolean;
  searchDraft: string;
  onSearchDraftChange: (value: string) => void;
  onSearchSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClearSearch: () => void;
  showGenericCategories: boolean;
  showSkillsShFilters: boolean;
  categories: Array<{ key: SkillCategory | "all"; label: string }>;
  category: SkillCategory | "all";
  onCategoryChange: (category: SkillCategory | "all") => void;
  selectedSourceId: string;
  sourceName: string;
  sourceType: EditableSourceType;
  sourceUrl: string;
  sourceBranch: string;
  sourceDirectory: string;
  onSourceNameChange: (value: string) => void;
  onSourceTypeChange: (value: EditableSourceType) => void;
  onSourceUrlChange: (value: string) => void;
  onSourceBranchChange: (value: string) => void;
  onSourceDirectoryChange: (value: string) => void;
  onAddSource: () => void;
}

export function SkillStoreFilterBar(props: SkillStoreFilterBarProps) {
  if (!props.visible) return null;
  return (
    <div
      className="px-6 py-3 border-b border-border app-wallpaper-section space-y-3"
      data-testid="skill-store-filter-bar"
    >
      {props.showSearch ? <StoreSearch {...props} /> : null}
      {props.showGenericCategories ? <GenericCategories {...props} /> : null}
      {props.showSkillsShFilters ? <SkillsShFilters {...props} /> : null}
      {props.selectedSourceId === "new-custom" ? (
        <SkillStoreSourceForm
          branch={props.sourceBranch}
          directory={props.sourceDirectory}
          handleAddSource={props.onAddSource}
          setBranch={props.onSourceBranchChange}
          setDirectory={props.onSourceDirectoryChange}
          setSourceName={props.onSourceNameChange}
          setSourceType={props.onSourceTypeChange}
          setSourceUrl={props.onSourceUrlChange}
          sourceName={props.sourceName}
          sourceType={props.sourceType}
          sourceUrl={props.sourceUrl}
          t={props.t}
          typeOptions={CUSTOM_SOURCE_TYPE_OPTIONS}
        />
      ) : null}
    </div>
  );
}

function StoreSearch(props: SkillStoreFilterBarProps) {
  return (
    <form
      data-testid="skill-store-local-search-form"
      onSubmit={props.onSearchSubmit}
      className="flex w-full items-center gap-2 rounded-xl border border-border/70 bg-card/70 px-3 py-2 transition-colors focus-within:bg-background"
    >
      <SearchIcon
        aria-hidden="true"
        className="h-4 w-4 shrink-0 text-muted-foreground"
      />
      <input
        type="text"
        value={props.searchDraft}
        onChange={(event) => props.onSearchDraftChange(event.target.value)}
        placeholder={props.t("skill.searchStore", "Search skills...")}
        aria-label={props.t("skill.searchStore", "Search skills...")}
        className="h-6 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-0 focus-visible:ring-0"
      />
      {props.searchDraft ? (
        <button
          type="button"
          onClick={props.onClearSearch}
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={props.t("common.clearSearch", "Clear search")}
          title={props.t("common.clearSearch", "Clear search")}
        >
          <XIcon aria-hidden="true" className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </form>
  );
}

function GenericCategories(props: SkillStoreFilterBarProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {props.categories.map((category) => (
        <CategoryButton
          key={category.key}
          active={props.category === category.key}
          icon={CATEGORY_ICONS[category.key]}
          label={category.label}
          onClick={() => props.onCategoryChange(category.key)}
        />
      ))}
    </div>
  );
}

function SkillsShFilters(props: SkillStoreFilterBarProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      {SKILLS_SH_FILTERS.map((filter) => (
        <CategoryButton
          key={filter.key}
          active={
            normalizeSkillsShFilterKey(String(props.category)) === filter.key
          }
          label={filter.label}
          onClick={() =>
            props.onCategoryChange(filter.key as SkillCategory | "all")
          }
        />
      ))}
    </div>
  );
}

function CategoryButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
        active
          ? "bg-primary text-white shadow-sm"
          : "bg-muted hover:bg-muted/80 text-muted-foreground"
      }`}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      {label}
    </button>
  );
}
