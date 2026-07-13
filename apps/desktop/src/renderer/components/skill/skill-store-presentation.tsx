import {
  BarChartIcon,
  BriefcaseIcon,
  CodeIcon,
  DatabaseIcon,
  FileSpreadsheetIcon,
  FolderIcon,
  GlobeIcon,
  LayoutGridIcon,
  PaletteIcon,
  RocketIcon,
  ShieldIcon,
  SparklesIcon,
  WandIcon,
} from "lucide-react";
import type { RegistrySkill, SkillStoreSource } from "@prompthub/shared/types";
import { SKILL_CATEGORIES } from "@prompthub/shared/constants/skill-registry";

export const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  all: <LayoutGridIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  office: <FileSpreadsheetIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  dev: <CodeIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  ai: <SparklesIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  data: <BarChartIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  management: <BriefcaseIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  deploy: <RocketIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  design: <PaletteIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  security: <ShieldIcon aria-hidden="true" className="w-3.5 h-3.5" />,
  meta: <WandIcon aria-hidden="true" className="w-3.5 h-3.5" />,
};

export const CUSTOM_SOURCE_TYPE_OPTIONS: Array<{
  value: Extract<
    SkillStoreSource["type"],
    "marketplace-json" | "git-repo" | "local-dir"
  >;
  icon: React.ReactNode;
}> = [
  { value: "marketplace-json", icon: <DatabaseIcon className="w-4 h-4" /> },
  { value: "git-repo", icon: <GlobeIcon className="w-4 h-4" /> },
  { value: "local-dir", icon: <FolderIcon className="w-4 h-4" /> },
];

const DETAIL_FOOTER_BUTTON_BASE =
  "h-10 inline-flex items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 active:scale-press-in";

export const SKILL_STORE_DETAIL_FOOTER_STYLES = {
  buttonBase: DETAIL_FOOTER_BUTTON_BASE,
  neutral: `${DETAIL_FOOTER_BUTTON_BASE} border-border bg-background/70 text-foreground hover:bg-muted/70`,
  primary: `${DETAIL_FOOTER_BUTTON_BASE} border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/15 hover:bg-primary/90`,
  danger: `${DETAIL_FOOTER_BUTTON_BASE} border-destructive/25 bg-destructive/5 text-destructive hover:bg-destructive/10`,
  imported:
    "h-10 inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-600 dark:text-emerald-400",
} as const;

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatStoreSourceHint(source: SkillStoreSource): string {
  const parts = [source.url];
  if (source.branch) parts.push(`branch: ${source.branch}`);
  if (source.directory) parts.push(`dir: ${source.directory}`);
  return parts.join(" | ");
}

export function humanizeSkillCategory(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function hasUnreliableSkillStoreCategory(
  skill: RegistrySkill,
  storeLabel?: string,
): boolean {
  return (
    [
      storeLabel,
      skill.source_label,
      skill.source_url,
      skill.store_url,
      skill.content_url,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .match(/skills\.sh|clawhub/) !== null
  );
}

export function getSkillTranslationTargetLanguage(language?: string): string {
  const normalized = (language || "").toLowerCase();
  if (normalized.startsWith("zh")) return "中文";
  if (normalized.startsWith("ja")) return "日本語";
  if (normalized.startsWith("ko")) return "한국어";
  return "English";
}

export function getVisibleSkillCategoryLabel(
  skill: RegistrySkill,
  storeLabel: string | undefined,
  isZh: boolean,
): string | null {
  if (!skill.category || hasUnreliableSkillStoreCategory(skill, storeLabel)) {
    return null;
  }
  const category =
    SKILL_CATEGORIES[skill.category as keyof typeof SKILL_CATEGORIES];
  return category
    ? isZh
      ? category.label
      : category.labelEn
    : humanizeSkillCategory(String(skill.category));
}
