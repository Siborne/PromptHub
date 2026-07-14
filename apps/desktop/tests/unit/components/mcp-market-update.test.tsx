import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { McpMarketDetailModal } from "../../../src/renderer/components/mcp/McpMarketDetailModal";
import type {
  McpMarketTemplate,
  McpMarketUpdateCheck,
  McpServerConfig,
} from "@prompthub/shared/types/mcp";
import { renderWithI18n } from "../../helpers/i18n";

const template: McpMarketTemplate = {
  id: "prompthub-official:github",
  version: "2.0.0",
  name: "github",
  displayName: "GitHub",
  description: "Access GitHub repositories and issues.",
  transport: "stdio",
  command: "npx",
  args: ["-y", "@prompthub/github-mcp@2"],
  tags: ["code"],
  source: {
    id: "prompthub-official",
    label: "Official Store",
    trustLevel: "official",
  },
};

const installedServer: McpServerConfig = {
  id: "mcp_github",
  name: "github",
  displayName: "GitHub",
  description: template.description,
  transport: "stdio",
  command: "npx",
  args: ["-y", "@prompthub/github-mcp@1"],
  enabled: true,
  source: {
    type: "market",
    id: template.id,
    label: "Official Store",
    installedTemplateVersion: "1.0.0",
    installedTemplateFingerprint: "sha256:v1",
  },
  createdAt: 1,
  updatedAt: 1,
};

function createCheck(
  status: McpMarketUpdateCheck["status"],
): McpMarketUpdateCheck {
  const current = status === "up-to-date" ? "sha256:v2" : "sha256:v1";
  return {
    serverId: installedServer.id,
    templateId: template.id,
    status,
    localModified: false,
    remoteChanged: status === "update-available",
    installedFingerprint: current,
    localFingerprint: current,
    remoteFingerprint: "sha256:v2",
    checkedAt: 2,
    reason: status,
  };
}

describe("MCP market update detail", () => {
  it("checks and applies a safe upstream update", async () => {
    const user = userEvent.setup();
    const onCheckUpdate = vi
      .fn()
      .mockResolvedValueOnce(createCheck("update-available"))
      .mockResolvedValue(createCheck("up-to-date"));
    const onUpdate = vi.fn().mockResolvedValue({
      status: "updated",
      check: createCheck("up-to-date"),
      server: installedServer,
    });

    await act(async () => {
      await renderWithI18n(
        <McpMarketDetailModal
          installedServer={installedServer}
          template={template}
          onCheckUpdate={onCheckUpdate}
          onUpdate={onUpdate}
          onInstall={vi.fn()}
          onClose={vi.fn()}
        />,
        { language: "en" },
      );
    });

    const dialog = screen.getByRole("dialog", { name: "GitHub" });
    expect(
      await within(dialog).findByText("Update available"),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Update" }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(
        installedServer.id,
        template,
        false,
      );
      expect(within(dialog).getAllByText("Up to date").length).toBeGreaterThan(
        0,
      );
    });
  });

  it("requires an explicit force action when local and upstream templates conflict", async () => {
    const user = userEvent.setup();
    const conflict = {
      ...createCheck("conflict"),
      localModified: true,
      remoteChanged: true,
    };
    const onCheckUpdate = vi
      .fn()
      .mockResolvedValueOnce(conflict)
      .mockResolvedValue(createCheck("up-to-date"));
    const onUpdate = vi.fn().mockResolvedValue({
      status: "updated",
      check: createCheck("up-to-date"),
      server: installedServer,
    });

    await act(async () => {
      await renderWithI18n(
        <McpMarketDetailModal
          installedServer={installedServer}
          template={template}
          onCheckUpdate={onCheckUpdate}
          onUpdate={onUpdate}
          onInstall={vi.fn()}
          onClose={vi.fn()}
        />,
        { language: "en" },
      );
    });

    const dialog = screen.getByRole("dialog", { name: "GitHub" });
    await user.click(
      await within(dialog).findByRole("button", { name: "Update anyway" }),
    );

    expect(onUpdate).toHaveBeenCalledWith(installedServer.id, template, true);
  });

  it("surfaces a failed check and retries against the same installed source", async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onCheckUpdate = vi
      .fn()
      .mockRejectedValueOnce(new Error("registry offline"))
      .mockResolvedValue(createCheck("up-to-date"));

    await act(async () => {
      await renderWithI18n(
        <McpMarketDetailModal
          installedServer={installedServer}
          template={template}
          onCheckUpdate={onCheckUpdate}
          onUpdate={vi.fn()}
          onInstall={vi.fn()}
          onClose={vi.fn()}
        />,
        { language: "en" },
      );
    });

    const dialog = screen.getByRole("dialog", { name: "GitHub" });
    await user.click(
      await within(dialog).findByRole("button", {
        name: "Retry update check",
      }),
    );

    await waitFor(() => {
      expect(onCheckUpdate).toHaveBeenCalledTimes(2);
      expect(within(dialog).getAllByText("Up to date").length).toBeGreaterThan(
        0,
      );
    });
    errorSpy.mockRestore();
  });
});
