import { fireEvent, screen } from "@testing-library/react";
import { useTranslation } from "react-i18next";
import { describe, expect, it, vi } from "vitest";

import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import type {
  Skill,
  SkillPlatformInstallStatusMap,
} from "@prompthub/shared/types";

import { SkillAssetTopology } from "../../../src/renderer/components/skill/SkillAssetTopology";
import { renderWithI18n } from "../../helpers/i18n";

const platforms: SkillPlatform[] = [
  {
    id: "codex",
    name: "Codex CLI",
    icon: "terminal",
    rootDir: { darwin: "~/.codex", win32: "~/.codex", linux: "~/.codex" },
    skillsRelativePath: "skills",
  },
  {
    id: "claude",
    name: "Claude Code",
    icon: "terminal",
    rootDir: {
      darwin: "~/.claude",
      win32: "~/.claude",
      linux: "~/.claude",
    },
    skillsRelativePath: "skills",
  },
];

const baseSkill: Skill = {
  id: "skill-1",
  name: "writer",
  content: "# Writer",
  protocol_type: "skill",
  is_favorite: false,
  created_at: 1,
  updated_at: 2,
};

function TopologyHarness({
  skill,
  installDetails,
  onOpenLocalPath = vi.fn(),
}: {
  skill: Skill;
  installDetails: SkillPlatformInstallStatusMap;
  onOpenLocalPath?: (path: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <SkillAssetTopology
      availablePlatforms={platforms}
      installDetails={installDetails}
      onOpenLocalPath={onOpenLocalPath}
      selectedSkill={skill}
      t={t}
    />
  );
}

describe("SkillAssetTopology", () => {
  it("separates remote source, managed package, and mixed platform copies", async () => {
    const onOpenLocalPath = vi.fn();
    await renderWithI18n(
      <TopologyHarness
        skill={{
          ...baseSkill,
          source_url: "https://github.com/example/writer-skill",
          local_repo_path: "/PromptHub/data/skills/writer",
        }}
        installDetails={{
          codex: { installed: true, mode: "copy" },
          claude: { installed: true, mode: "symlink" },
        }}
        onOpenLocalPath={onOpenLocalPath}
      />,
      { language: "en" },
    );

    expect(screen.getByText("Upstream source")).toBeInTheDocument();
    expect(screen.getByText("example/writer-skill")).toBeInTheDocument();
    expect(screen.getByText("PromptHub managed package")).toBeInTheDocument();
    expect(
      screen.getByText("/PromptHub/data/skills/writer"),
    ).toBeInTheDocument();
    expect(screen.getByText("Codex CLI")).toBeInTheDocument();
    expect(screen.getByText("Claude Code")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText("Symlink")).toBeInTheDocument();
    expect(
      screen.getByText("Redistribution overwrites this target."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Edits follow the editable package immediately."),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "/PromptHub/data/skills/writer",
      }),
    );
    expect(onOpenLocalPath).toHaveBeenCalledWith(
      "/PromptHub/data/skills/writer",
    );
  });

  it("labels a linked external package without implying PromptHub ownership", async () => {
    const linkedPath = "/Users/demo/.codex/skills/writer";
    const onOpenLocalPath = vi.fn();
    await renderWithI18n(
      <TopologyHarness
        skill={{
          ...baseSkill,
          source_url: linkedPath,
          local_repo_path: linkedPath,
        }}
        installDetails={{}}
        onOpenLocalPath={onOpenLocalPath}
      />,
      { language: "en" },
    );

    expect(screen.getByText("Linked external package")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Edits write directly to this external folder; PromptHub does not replace it with a managed copy.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Not distributed")).toBeInTheDocument();
    expect(
      screen.queryByText("PromptHub managed package"),
    ).not.toBeInTheDocument();
    for (const pathButton of screen.getAllByRole("button", {
      name: linkedPath,
    })) {
      fireEvent.click(pathButton);
    }
    expect(onOpenLocalPath).toHaveBeenCalledTimes(2);
    expect(onOpenLocalPath).toHaveBeenNthCalledWith(1, linkedPath);
    expect(onOpenLocalPath).toHaveBeenNthCalledWith(2, linkedPath);
  });

  it("labels database-only content and preserves unknown target identifiers", async () => {
    await renderWithI18n(
      <TopologyHarness
        skill={baseSkill}
        installDetails={{
          external: { installed: true, mode: "copy" },
        }}
      />,
      { language: "en" },
    );

    expect(screen.getByText("Database content only")).toBeInTheDocument();
    expect(
      screen.getByText("This Skill has no editable package directory."),
    ).toBeInTheDocument();
    expect(screen.getByText("external")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
