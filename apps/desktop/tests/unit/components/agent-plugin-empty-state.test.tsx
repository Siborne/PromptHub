import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ManagedAgentSummary,
  PluginLibraryFile,
} from "@prompthub/shared/types";
import { AgentPluginAssetPanel } from "../../../src/renderer/components/agent/AgentPluginAssetPanel";
import { usePluginStore } from "../../../src/renderer/stores/plugin.store";
import { renderWithI18n } from "../../helpers/i18n";

const showToast = vi.fn();

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

const emptyLibrary: PluginLibraryFile = {
  kind: "prompthub-plugin-library",
  version: 1,
  updatedAt: "2026-08-11T00:00:00.000Z",
  plugins: [],
};

const kimiAgent = {
  id: "kimi-code",
  name: "Kimi Code",
  paths: { root: "~/.kimi-code", plugins: "~/.kimi-code/plugins" },
} as ManagedAgentSummary;

describe("Agent Plugin empty state", () => {
  beforeEach(() => {
    showToast.mockClear();
    usePluginStore.setState({
      library: emptyLibrary,
      targetMatrix: [],
      isLoading: false,
      error: null,
      load: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("opens a plain empty picker instead of reporting an internal target error", async () => {
    await renderWithI18n(<AgentPluginAssetPanel agent={kimiAgent} />, {
      language: "zh",
    });

    expect(screen.getByText("暂无 Plugin")).toBeVisible();
    expect(
      screen.queryByText(/先从官方商店安装 Plugin 能力包/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "添加 Plugin" }));

    expect(screen.getByRole("dialog", { name: "添加 Plugin" })).toBeVisible();
    expect(screen.getByText("暂无可添加的 Plugin")).toBeVisible();
    expect(showToast).not.toHaveBeenCalled();
  });
});
