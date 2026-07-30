import userEvent from "@testing-library/user-event";
import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RuleVersionSnapshot } from "@prompthub/shared/types";
import { RuleHistoryDialog } from "../../../src/renderer/components/rules/RuleHistoryDialog";
import { renderWithI18n } from "../../helpers/i18n";

const versions: RuleVersionSnapshot[] = [
  {
    id: "current",
    savedAt: "2026-07-30T08:00:00.000Z",
    source: "manual-save",
    content: "# Current\n\nKeep this line",
  },
  {
    id: "older",
    savedAt: "2026-07-29T08:00:00.000Z",
    source: "ai-rewrite",
    content: "# Older\n\nRestore this line",
  },
  {
    id: "created",
    savedAt: "2026-07-28T08:00:00.000Z",
    source: "create",
    content: "# First version",
  },
];

describe("RuleHistoryDialog", () => {
  it("compares snapshots inside the dialog and restores only on request", async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();

    await act(async () => {
      await renderWithI18n(
        <RuleHistoryDialog
          currentContent={"# Current\n\nDraft-only line"}
          currentSavedVersionId="current"
          isOpen={true}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onRestore={onRestore}
          versions={versions}
        />,
        { language: "en" },
      );
    });

    const dialog = await screen.findByRole("dialog", {
      name: /Version Snapshots/i,
    });

    expect(dialog).toBeVisible();
    expect(dialog).toHaveStyle({ maxWidth: "1000px" });
    expect(within(dialog).getByText("Snapshot vs Current Draft")).toBeVisible();
    expect(within(dialog).getByText("Restore this line")).toBeVisible();
    expect(within(dialog).getByText("Draft-only line")).toBeVisible();
    expect(within(dialog).getByText(/\+\d+/)).toBeVisible();
    expect(within(dialog).getByText(/-\d+/)).toBeVisible();
    expect(
      within(dialog).getByTestId("rule-version-current").querySelector("svg"),
    ).not.toBeNull();
    for (const badge of within(dialog).getAllByTestId("rule-version-source")) {
      expect(badge).toHaveClass("text-muted-foreground");
      expect(badge.querySelector("svg")).not.toBeNull();
    }

    await user.click(
      within(dialog).getByRole("button", { name: "Restore to Draft" }),
    );
    expect(onRestore).toHaveBeenCalledWith(versions[1]);
  });

  it("shows an explicit no-difference state for the current saved snapshot", async () => {
    await act(async () => {
      await renderWithI18n(
        <RuleHistoryDialog
          currentContent={versions[0].content}
          currentSavedVersionId="current"
          isOpen={true}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          versions={[versions[0]]}
        />,
        { language: "en" },
      );
    });

    const dialog = await screen.findByRole("dialog", {
      name: /Version Snapshots/i,
    });

    expect(within(dialog).getByText("No line differences")).toBeVisible();
  });

  it("shows an empty state when no snapshots exist", async () => {
    await act(async () => {
      await renderWithI18n(
        <RuleHistoryDialog
          currentContent="# Current"
          currentSavedVersionId={null}
          isOpen={true}
          onClose={vi.fn()}
          onDelete={vi.fn()}
          onRestore={vi.fn()}
          versions={[]}
        />,
        { language: "en" },
      );
    });

    const dialog = await screen.findByRole("dialog", {
      name: /Version Snapshots/i,
    });
    expect(within(dialog).getByText(/No snapshots yet\./)).toBeVisible();
  });
});
