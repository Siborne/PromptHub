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
import type { SkillStoreSource } from "@prompthub/shared/types";

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

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function formatStoreSourceHint(source: SkillStoreSource): string {
  const parts = [source.url];
  if (source.branch) parts.push(`branch: ${source.branch}`);
  if (source.directory) parts.push(`dir: ${source.directory}`);
  return parts.join(" | ");
}
