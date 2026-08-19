import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentScannedSkill,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { AgentAssetsWorkspace } from "../../../src/renderer/components/agent/AgentAssetsWorkspace";
import { useSkillStore } from "../../../src/renderer/stores/skill.store";
import {
  createScannedSkillFixture,
  createSkillFixture,
} from "../../fixtures/skills";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const codexAgent: ManagedAgentSummary = {
  id: "codex",
  name: "Codex",
  icon: "Terminal",
  isCustom: false,
  isConfigured: true,
  isDetected: true,
  isPinned: false,
  status: "installed",
  paths: {
    root: "/Users/test/.codex",
    skills: "/Users/test/.codex/skills",
    mcp: "/Users/test/.codex/config.toml",
    plugins: "/Users/test/.codex/plugins/cache/prompthub",
    rules: "/Users/test/.codex/AGENTS.md",
    configFiles: ["/Users/test/.codex/config.toml"],
    configFileRelativePaths: ["config.toml"],
  },
  capabilities: {
    overview: { status: "supported" },
    provider: { status: "partial", reason: "model-config-only" },
    appearance: { status: "unsupported", reason: "unavailable" },
    assets: { status: "partial", reason: "asset-paths-only" },
    configFiles: { status: "partial", reason: "direct-file-editing" },
    sessions: { status: "supported" },
    usage: { status: "supported" },
    maintenance: { status: "partial", reason: "refresh-and-settings" },
  },
};

function scannedSkill(): AgentScannedSkill {
  const localPath = "/Users/test/.codex/skills/filesystem-skill";
  return {
    ...createScannedSkillFixture({
      name: "filesystem-skill",
      localPath,
      filePath: `${localPath}/SKILL.md`,
    }),
    installMode: "copy",
    platformSkillPath: localPath,
  };
}

describe("Agent Skill cold scan", () => {
  beforeEach(() => {
    installWindowMocks();
    useSkillStore.setState({
      skills: [createSkillFixture()],
      agentScanState: {},
    });
  });

  it("scans the native directory on a direct cold open", async () => {
    const result = {
      platform: null as never,
      skillsDir: codexAgent.paths.skills!,
      scannedSkills: [scannedSkill()],
    };
    let releaseScan!: () => void;
    const scanGate = new Promise<void>((resolve) => {
      releaseScan = resolve;
    });
    const scanAgentPlatformSkills = vi.fn(async () => {
      await scanGate;
      useSkillStore.setState({
        agentScanState: {
          codex: {
            result,
            isScanning: false,
            scannedAt: Date.now(),
            error: null,
          },
        },
      });
      return result;
    });
    useSkillStore.setState({ scanAgentPlatformSkills });

    await renderWithI18n(
      <AgentAssetsWorkspace agent={codexAgent} domain="skills" />,
    );

    expect(screen.getByText("Scanning...")).toBeVisible();
    await waitFor(() =>
      expect(scanAgentPlatformSkills).toHaveBeenCalledWith("codex"),
    );
    releaseScan();

    expect(await screen.findByText("filesystem-skill")).toBeVisible();
    expect(scanAgentPlatformSkills).toHaveBeenCalledTimes(1);
  });

  it("shows a failed scan separately from a successful empty directory", async () => {
    const scanAgentPlatformSkills = vi.fn().mockResolvedValue({
      platform: null as never,
      skillsDir: codexAgent.paths.skills!,
      scannedSkills: [],
    });
    useSkillStore.setState({
      agentScanState: {
        codex: {
          result: null,
          isScanning: false,
          error: "redacted scan failure",
        },
      },
      scanAgentPlatformSkills,
    });

    await renderWithI18n(
      <AgentAssetsWorkspace agent={codexAgent} domain="skills" />,
    );

    expect(screen.getByText(/failed to scan agent skills/i)).toBeVisible();
    expect(
      screen.queryByText("No skills were detected for this Agent."),
    ).not.toBeInTheDocument();
    expect(scanAgentPlatformSkills).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(scanAgentPlatformSkills).toHaveBeenCalledWith("codex");
  });
});
