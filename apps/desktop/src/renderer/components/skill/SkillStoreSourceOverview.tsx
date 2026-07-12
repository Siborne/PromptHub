import type { TFunction } from "i18next";
import { BoxesIcon, GlobeIcon, StoreIcon } from "lucide-react";

interface SkillStoreSourceOverviewProps {
  selectedStoreSourceId: string;
  t: TFunction;
}

interface SourceOverview {
  description: string;
  examples: React.ReactNode;
  formats: React.ReactNode;
  headerClassName?: string;
  icon: typeof GlobeIcon;
  title: string;
}

function getClaudeOverview(t: TFunction): SourceOverview {
  return {
    description: t(
      "skill.claudeCodeStoreDetail",
      "This built-in source is meant for the Claude Code ecosystem. It is designed to work first with the official skills repository and marketplace.json indexes, and can later become a browsable remote store.",
    ),
    examples: (
      <>
        <span>https://github.com/anthropics/skills</span>
        <br />
        <span>
          https://raw.githubusercontent.com/docker/claude-code-plugin-manager/main/marketplace.json
        </span>
      </>
    ),
    formats: (
      <>
        {t(
          "skill.formatDirectoryRepo",
          "`SKILL.md` directory-style repository",
        )}
        <br />
        {t("skill.formatIndexStore", "`marketplace.json` index-style store")}
      </>
    ),
    icon: GlobeIcon,
    title: t("skill.claudeCodeStore", "Claude Code Store"),
  };
}

function getOpenAiOverview(t: TFunction): SourceOverview {
  return {
    description: t(
      "skill.openaiCodexStoreDetail",
      "This built-in source is meant for the OpenAI Codex ecosystem. It focuses on the curated openai/skills catalog and keeps the install flow compatible with directory-style SKILL.md repositories.",
    ),
    examples: <>https://github.com/openai/skills/tree/main/skills/.curated</>,
    formats: (
      <>
        {t(
          "skill.formatDirectoryRepo",
          "`SKILL.md` directory-style repository",
        )}
        <br />
        {t(
          "skill.formatCuratedSubdir",
          "Curated subdirectory inside a larger Git repository",
        )}
      </>
    ),
    icon: GlobeIcon,
    title: t("skill.openaiCodexStore", "OpenAI Codex Store"),
  };
}

function getCommunityOverview(t: TFunction): SourceOverview {
  return {
    description: t(
      "skill.communityStoreHint",
      "This area will aggregate third-party community skill sources. The entry is ready for connecting a community registry next.",
    ),
    examples: <>https://skills.sh/</>,
    formats: (
      <>
        {t(
          "skill.formatCommunityLeaderboard",
          "skills.sh community leaderboard",
        )}
        <br />
        {t("skill.formatSkillDetailPage", "skills.sh skill detail page")}
      </>
    ),
    headerClassName: "mb-3",
    icon: BoxesIcon,
    title: t("skill.communityStore", "Community Store"),
  };
}

function getClawHubOverview(t: TFunction): SourceOverview {
  return {
    description: t(
      "skill.clawHubStoreHint",
      "Built-in ClawHub source for browsing public community skills from clawhub.ai.",
    ),
    examples: (
      <>
        <span>https://clawhub.ai/</span>
        <br />
        <span>https://clawhub.ai/api/v1/skills</span>
      </>
    ),
    formats: (
      <>
        {t("skill.formatClawHubApi", "ClawHub public skill registry API")}
        <br />
        {t("skill.formatSkillMdFile", "`SKILL.md` file endpoint")}
      </>
    ),
    headerClassName: "mb-3",
    icon: GlobeIcon,
    title: t("skill.clawHubStore", "ClawHub Store"),
  };
}

function getPromptHubCloudOverview(t: TFunction): SourceOverview {
  return {
    description: t(
      "skill.promptHubCloudStoreHint",
      "Published PromptHub Cloud releases with package fingerprints, safety checks, and confirmation before installation.",
    ),
    examples: <>https://api.prompthub.cloud/api/v1/store/feed</>,
    formats: (
      <>
        {t("skill.formatPromptHubCloudPackage", "PromptHub Store package v1")}
        <br />
        {t("skill.formatSkillMdFile", "`SKILL.md` file")}
      </>
    ),
    headerClassName: "mb-3",
    icon: StoreIcon,
    title: t("skill.promptHubCloudStore", "PromptHub Cloud"),
  };
}

const SOURCE_OVERVIEW_BUILDERS: Record<
  string,
  (t: TFunction) => SourceOverview
> = {
  "claude-code": getClaudeOverview,
  "openai-codex": getOpenAiOverview,
  community: getCommunityOverview,
  clawhub: getClawHubOverview,
  "prompthub-cloud": getPromptHubCloudOverview,
};

function OfficialStoreEmptyState({ t }: { t: TFunction }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-20 text-center text-muted-foreground">
      <StoreIcon className="mb-4 h-12 w-12 opacity-25" />
      <h3 className="mb-1 text-lg font-semibold text-foreground">
        {t("skill.officialStoreComingSoon", "Official store coming soon")}
      </h3>
      <p className="max-w-md text-sm leading-6 opacity-80">
        {t(
          "skill.officialStoreComingSoonHint",
          "The official store is not open yet. You can import skills from Claude Code, OpenAI Codex, or a custom store for now.",
        )}
      </p>
    </div>
  );
}

function SourceOverviewPanel({
  overview,
  t,
}: {
  overview: SourceOverview;
  t: TFunction;
}) {
  const Icon = overview.icon;
  return (
    <div className="app-wallpaper-panel space-y-4 rounded-2xl border border-border p-6">
      <div
        className={`flex items-center gap-2 text-foreground ${overview.headerClassName ?? ""}`}
      >
        <Icon className="h-5 w-5 text-primary" />
        <h3 className="text-base font-semibold">{overview.title}</h3>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">
        {overview.description}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-1 text-sm font-medium text-foreground">
            {t("skill.supportedFormat", "Supported Formats")}
          </div>
          <div className="text-xs leading-6 text-muted-foreground">
            {overview.formats}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="mb-1 text-sm font-medium text-foreground">
            {t("skill.exampleSources", "Built-in Reference Sources")}
          </div>
          <div className="break-all text-xs leading-6 text-muted-foreground">
            {overview.examples}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkillStoreSourceOverview({
  selectedStoreSourceId,
  t,
}: SkillStoreSourceOverviewProps) {
  if (selectedStoreSourceId === "official")
    return <OfficialStoreEmptyState t={t} />;
  const overview = SOURCE_OVERVIEW_BUILDERS[selectedStoreSourceId]?.(t);
  return overview ? <SourceOverviewPanel overview={overview} t={t} /> : null;
}
