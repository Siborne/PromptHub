import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  profile,
  renderWorkbench,
  resetProviderWorkbenchTestState,
} from "./agent-provider-profile-workbench.harness";

describe("AgentProviderProfileWorkbench actions", () => {
  beforeEach(() => {
    resetProviderWorkbenchTestState();
  });

  it("supports rename, copy creation, text copy, and confirmed deletion without archive", async () => {
    const first = profile({
      id: "profile-first",
      name: "First",
      secretState: "missing",
      modelMappings: [],
    });
    const second = profile({
      id: "profile-second",
      name: "Second",
      secretState: "none",
    });
    const copy = profile({
      id: "profile-copy",
      name: "Second copy",
      secretState: "none",
    });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([first, second]);
    window.api.agent.updateProviderProfile = vi.fn().mockResolvedValue({
      ...second,
      name: "Renamed provider",
      updatedAt: 3,
    });
    window.api.agent.duplicateProviderProfile = vi.fn().mockResolvedValue(copy);
    window.api.agent.exportProviderProfile = vi.fn().mockResolvedValue({
      kind: "prompthub-agent-provider-profile",
      version: 1,
      exportedAt: 100,
      profile: copy,
    });
    window.api.agent.archiveProviderProfile = vi.fn();
    window.api.agent.deleteProviderProfile = vi
      .fn()
      .mockResolvedValue(undefined);
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);

    await renderWorkbench();
    expect(screen.getByText("Credential missing")).toBeVisible();
    expect(screen.getAllByText("No primary model").length).toBeGreaterThan(0);
    expect(screen.getByText("No model mappings")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Second/ }));
    expect(screen.getByRole("button", { name: /Second/ })).toHaveAttribute(
      "aria-current",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    const renameDialog = await screen.findByRole("dialog", {
      name: "Rename provider",
    });
    fireEvent.change(within(renameDialog).getByLabelText("Name"), {
      target: { value: " Renamed provider " },
    });
    fireEvent.click(within(renameDialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(window.api.agent.updateProviderProfile).toHaveBeenCalledWith({
        id: "profile-second",
        expectedUpdatedAt: 2,
        profile: { name: "Renamed provider" },
        secretAction: "preserve",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Create copy" }));
    await waitFor(() =>
      expect(window.api.agent.duplicateProviderProfile).toHaveBeenCalledWith(
        "profile-second",
        "Renamed provider copy",
      ),
    );
    expect((await screen.findAllByText("Second copy")).length).toBeGreaterThan(
      0,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy text" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('"kind": "prompthub-agent-provider-profile"'),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Text copied" }),
    ).toBeVisible();

    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(window.api.agent.archiveProviderProfile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: "Delete provider",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(window.api.agent.deleteProviderProfile).toHaveBeenCalledWith(
        "profile-copy",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", {
          name: "Delete provider",
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows a bounded error when profile export cannot reach the clipboard", async () => {
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([profile()]);
    window.api.agent.exportProviderProfile = vi.fn().mockResolvedValue({
      kind: "prompthub-agent-provider-profile",
      version: 1,
      exportedAt: 100,
      profile: profile(),
    });
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("clipboard denied with private details"),
    );
    const originalExecCommand = document.execCommand;
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    try {
      await renderWorkbench();
      fireEvent.click(screen.getByRole("button", { name: "Copy text" }));

      expect(
        await screen.findByText("Provider operation failed"),
      ).toBeVisible();
      expect(screen.queryByText(/private details/)).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: originalExecCommand,
      });
    }
  });

  it("shows a bounded public error instead of raw renderer failures", async () => {
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockRejectedValue(new Error("secret token leaked from native failure"));

    await renderWorkbench();

    expect(await screen.findByText("Provider operation failed")).toBeVisible();
    expect(screen.queryByText(/secret token/)).not.toBeInTheDocument();
  });
});
