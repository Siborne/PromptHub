import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { AgentMcpAssetPanel } from "../../../src/renderer/components/agent/AgentMcpAssetPanel";
import { AgentPluginAssetPanel } from "../../../src/renderer/components/agent/AgentPluginAssetPanel";
import { useMcpStore } from "../../../src/renderer/stores/mcp.store";
import { usePluginStore } from "../../../src/renderer/stores/plugin.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

const codexAgent = {
  id: "codex",
  name: "Codex",
  paths: {
    root: "/Users/test/.codex",
    mcp: "/Users/test/.codex/config.toml",
    plugins: "/Users/test/.codex/plugins/cache/prompthub",
  },
} as ManagedAgentSummary;

describe("Agent asset initial load failures", () => {
  beforeEach(() => {
    installWindowMocks();
  });

  it("shows a retryable MCP failure instead of a successful empty state", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    useMcpStore.setState({
      library: null,
      targetPresets: [],
      targetStatus: [],
      isLoading: false,
      error: "redacted MCP failure",
      hasLoadedTargetInventory: false,
      isLoadingTargetInventory: false,
      targetInventoryError: "redacted MCP failure",
      load,
    });

    await renderWithI18n(<AgentMcpAssetPanel agent={codexAgent} />);

    expect(screen.getByText("MCP targets could not be loaded.")).toBeVisible();
    expect(screen.queryByText("No MCP servers configured")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shows a retryable Plugin failure instead of a successful empty state", async () => {
    const load = vi.fn().mockResolvedValue(undefined);
    usePluginStore.setState({
      library: null,
      targetMatrix: [],
      isLoading: false,
      error: "redacted Plugin failure",
      hasLoadedTargetInventory: false,
      isLoadingTargetInventory: false,
      targetInventoryError: "redacted Plugin failure",
      load,
    });

    await renderWithI18n(<AgentPluginAssetPanel agent={codexAgent} />);

    expect(screen.getByText("Plugins could not be loaded.")).toBeVisible();
    expect(screen.queryByText("No Plugins")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps cached MCP cards visible after a target refresh failure", async () => {
    useMcpStore.setState({
      library: {
        kind: "prompthub-mcp-library",
        version: 1,
        updatedAt: "2026-08-19T00:00:00.000Z",
        servers: [],
        bindings: [],
      },
      targetPresets: [
        {
          id: "codex-global",
          target: "codex",
          scope: "global",
          label: "Codex",
          path: "/Users/test/.codex/config.toml",
          platformId: "codex",
        },
      ],
      targetStatus: [
        {
          presetId: "codex-global",
          path: "/Users/test/.codex/config.toml",
          exists: true,
          serverNames: ["filesystem"],
        },
      ],
      isLoading: false,
      error: null,
      hasLoadedTargetInventory: true,
      isLoadingTargetInventory: false,
      targetInventoryError: "refresh failed",
    });

    await renderWithI18n(<AgentMcpAssetPanel agent={codexAgent} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "MCP targets could not be loaded.",
    );
    expect(screen.getByTestId("agent-asset-card-title-row")).toHaveTextContent(
      "filesystem",
    );
    expect(screen.queryByText("No MCP servers configured")).toBeNull();
  });

  it("keeps cached Plugin cards visible after a target refresh failure", async () => {
    usePluginStore.setState({
      library: {
        kind: "prompthub-plugin-library",
        version: 1,
        updatedAt: "2026-08-19T00:00:00.000Z",
        plugins: [],
      },
      targetMatrix: [
        {
          id: "codex",
          displayName: "Codex",
          status: "native",
          enabled: true,
          installedPlugins: [
            {
              id: "formatter",
              name: "formatter",
              displayName: "Formatter",
              inventory: {
                skills: 0,
                mcpServers: 0,
                apps: 0,
                commands: 0,
                hooks: 0,
                agents: 0,
                assets: 0,
                docs: 0,
                lspServers: 0,
                scripts: 0,
              },
            },
          ],
        },
      ],
      isLoading: false,
      error: null,
      hasLoadedTargetInventory: true,
      isLoadingTargetInventory: false,
      targetInventoryError: "refresh failed",
    });

    await renderWithI18n(<AgentPluginAssetPanel agent={codexAgent} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Plugins could not be loaded.",
    );
    expect(screen.getByText("Formatter")).toBeVisible();
    expect(screen.queryByText("No Plugins")).toBeNull();
  });
});
