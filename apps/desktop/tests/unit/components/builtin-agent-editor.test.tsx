import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { getPlatformById } from "@prompthub/shared/constants/platforms";
import {
  BuiltinAgentEditor,
  type BuiltinAgentEditDraft,
} from "../../../src/renderer/components/settings/BuiltinAgentEditor";
import { DEFAULT_CODEX_IDENTITY } from "../../../src/renderer/services/agent-identity";
import { renderWithI18n } from "../../helpers/i18n";

const EMPTY_DRAFT: BuiltinAgentEditDraft = {
  rootPath: "~/.workbuddy",
  skillsPath: "skills",
  mcpPath: "mcp.json",
  pluginsPath: "",
  rulesPath: "",
  agentsPath: "",
  commandsPath: "",
  configPaths: "mcp.json",
  identity: DEFAULT_CODEX_IDENTITY,
};

describe("BuiltinAgentEditor", () => {
  it("shows only Tencent WorkBuddy's declared built-in fields", async () => {
    await act(async () => {
      await renderWithI18n(
        <BuiltinAgentEditor
          platform={getPlatformById("workbuddy")!}
          value={EMPTY_DRAFT}
          onChange={vi.fn()}
        />,
        { language: "en" },
      );
    });

    expect(screen.getByLabelText("Root directory")).toBeInTheDocument();
    expect(screen.getByLabelText("Skills")).toBeInTheDocument();
    expect(screen.getByLabelText("MCP")).toBeInTheDocument();
    expect(screen.getByLabelText("Config")).toBeInTheDocument();
    expect(screen.queryByLabelText("Rules")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Plugins")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Agents")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Commands")).not.toBeInTheDocument();
  });

  it("shows every path field for custom Agents", async () => {
    const onBrowseRoot = vi.fn();
    await act(async () => {
      await renderWithI18n(
        <BuiltinAgentEditor
          isCustom
          value={EMPTY_DRAFT}
          onChange={vi.fn()}
          onBrowseRoot={onBrowseRoot}
        />,
        { language: "en" },
      );
    });

    for (const label of [
      "Skills",
      "Rules",
      "MCP",
      "Plugins",
      "Agents",
      "Commands",
      "Config",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByRole("button", { name: "Browse" }));
    expect(onBrowseRoot).toHaveBeenCalledTimes(1);
  });
});
