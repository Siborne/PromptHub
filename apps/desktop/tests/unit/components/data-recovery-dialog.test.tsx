import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DataRecoveryDialog } from "../../../src/renderer/components/ui/DataRecoveryDialog";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

function hasHiddenSvgAncestor(element: Element): boolean {
  let current: Element | null = element;

  while (current) {
    if (current.getAttribute("aria-hidden") === "true") {
      return true;
    }
    current = current.parentElement;
  }

  return false;
}

describe("DataRecoveryDialog", () => {
  const dismissRecoveryMock = vi.fn();
  const previewRecoveryMock = vi.fn();
  const performRecoveryMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    dismissRecoveryMock.mockResolvedValue({ success: true });
    previewRecoveryMock.mockResolvedValue({
      sourcePath: "C:/Users/test/AppData/Roaming/PromptHub",
      previewAvailable: true,
      items: [
        {
          kind: "prompt",
          id: "prompt-1",
          title: "Customer Support Prompt",
          subtitle: "workspace/prompts/support/prompt.md",
          updatedAt: "2026-04-18T10:00:00.000Z",
        },
      ],
      truncated: false,
    });
    performRecoveryMock.mockResolvedValue({ success: true });

    installWindowMocks({
      electron: {
        previewRecovery: previewRecoveryMock,
        performRecovery: performRecoveryMock,
        dismissRecovery: dismissRecoveryMock,
      },
    });
  });

  it("does not close or dismiss when startup recovery dialog receives Escape", async () => {
    const onClose = vi.fn();

    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={onClose}
          databases={[
            {
              sourcePath: "C:/Users/test/AppData/Roaming/PromptHub",
              sourceType: "external-user-data",
              displayName: "Previous data directory",
              displayPath: "C:/Users/test/AppData/Roaming/PromptHub",
              promptCount: 3,
              folderCount: 1,
              skillCount: 0,
              dbSizeBytes: 8192,
              lastModified: "2026-04-18T10:00:00.000Z",
              previewAvailable: true,
              dataSources: ["sqlite", "workspace"],
            },
          ]}
        />,
        { language: "en" },
      );
    });

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(dismissRecoveryMock).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("allows settings-triggered recovery browser to close without writing dismiss marker", async () => {
    const onClose = vi.fn();

    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={onClose}
          allowWindowClose={true}
          persistDismiss={false}
          databases={[
            {
              sourcePath: "C:/Users/test/AppData/Roaming/PromptHub",
              sourceType: "external-user-data",
              displayName: "Previous data directory",
              displayPath: "C:/Users/test/AppData/Roaming/PromptHub",
              promptCount: 3,
              folderCount: 1,
              skillCount: 0,
              dbSizeBytes: 8192,
              lastModified: "2026-04-18T10:00:00.000Z",
              previewAvailable: true,
              dataSources: ["sqlite", "workspace"],
            },
          ]}
        />,
        { language: "en" },
      );
    });

    await act(async () => {
      fireEvent.keyDown(document, { key: "Escape" });
    });

    expect(dismissRecoveryMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides start-fresh action in settings-triggered recovery browser", async () => {
    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={vi.fn()}
          allowWindowClose={true}
          persistDismiss={false}
          allowStartFresh={false}
          databases={[
            {
              sourcePath: "C:/Users/test/AppData/Roaming/PromptHub",
              sourceType: "external-user-data",
              displayName: "Previous data directory",
              displayPath: "C:/Users/test/AppData/Roaming/PromptHub",
              promptCount: 3,
              folderCount: 1,
              skillCount: 0,
              dbSizeBytes: 8192,
              lastModified: "2026-04-18T10:00:00.000Z",
              previewAvailable: true,
              dataSources: ["sqlite", "workspace"],
            },
          ]}
        />,
        { language: "en" },
      );
    });

    expect(
      screen.queryByRole("button", { name: "Start Fresh" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Restore Selected Source" }),
    ).toBeInTheDocument();
  });

  it("keeps failed mandatory recovery escapable without claiming to start fresh", async () => {
    const onClose = vi.fn();
    performRecoveryMock.mockResolvedValue({
      success: false,
      error: "Canonical storage rebuild failed",
    });

    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={onClose}
          allowStartFresh={false}
          databases={[
            {
              sourcePath: "/root/data/prompthub.db",
              sourceType: "current-canonical-db",
              displayName: "Current SQLite catalog",
              displayPath: "/root/data/prompthub.db",
              promptCount: 3,
              folderCount: 1,
              skillCount: 2,
              dbSizeBytes: 8192,
              lastModified: "2026-08-21T00:00:00.000Z",
              previewAvailable: true,
              dataSources: ["sqlite"],
            },
          ]}
        />,
        { language: "en" },
      );
    });

    expect(
      screen.queryByRole("button", { name: "Start Fresh" }),
    ).not.toBeInTheDocument();
    const continueButton = screen.getByRole("button", {
      name: "Continue Without Recovery",
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Restore Selected Source" }),
      );
    });

    expect(
      await screen.findByText(
        "Recovery failed: Canonical storage rebuild failed",
      ),
    ).toBeInTheDocument();
    expect(continueButton).toBeEnabled();

    await act(async () => {
      fireEvent.click(continueButton);
    });

    expect(dismissRecoveryMock).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("continues without persisting dismissal when the caller opts out", async () => {
    const onClose = vi.fn();

    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={onClose}
          allowStartFresh={false}
          persistDismiss={false}
          databases={[
            {
              sourcePath: "/root/data/prompts",
              sourceType: "current-file-workspace",
              displayName: "Current Markdown workspace",
              displayPath: "/root/data/prompts",
              promptCount: 3,
              folderCount: 1,
              skillCount: 2,
              dbSizeBytes: 0,
              lastModified: "2026-08-21T00:00:00.000Z",
              previewAvailable: true,
              dataSources: ["workspace"],
            },
          ]}
        />,
        { language: "en" },
      );
    });

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Continue Without Recovery" }),
      );
    });

    expect(dismissRecoveryMock).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows a clear database status and compact shell for skills-only residuals", async () => {
    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={vi.fn()}
          databases={[
            {
              sourcePath: "/Users/test/Library/Application Support/PromptHub",
              sourceType: "current-residual",
              displayName: "Current data directory residuals",
              displayPath: "/Users/test/Library/Application Support/PromptHub",
              promptCount: 0,
              folderCount: 0,
              skillCount: 104,
              dbSizeBytes: 0,
              lastModified: "2026-04-18T10:00:00.000Z",
              previewAvailable: true,
              dataSources: ["workspace", "legacy-layout"],
            },
          ]}
        />,
        { language: "en" },
      );
    });

    expect(screen.getByText("No effective database file")).toBeInTheDocument();
    expect(screen.queryByText("Database size: 0 B")).not.toBeInTheDocument();
    expect(screen.getByText("Skills only")).toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveStyle({ maxWidth: "1000px" });
    const actionBar = screen.getByRole("button", {
      name: "Restore Selected Source",
    }).parentElement;
    expect(actionBar).not.toHaveClass("sticky");
    expect(actionBar).not.toHaveClass("-mb-6");
  });

  it("shows the complete durable inventory for a manually selected directory", async () => {
    previewRecoveryMock.mockResolvedValue({
      sourcePath: "D:/Program Files/PromptHub",
      previewAvailable: true,
      items: [
        { kind: "mcp", title: "library.json" },
        { kind: "rule", title: "AGENTS.md" },
        { kind: "plugin", title: "writer-kit" },
        { kind: "config", title: "settings.json" },
      ],
      truncated: false,
    });

    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={vi.fn()}
          allowWindowClose={true}
          databases={[
            {
              sourcePath: "D:/Program Files/PromptHub",
              sourceType: "external-user-data",
              displayName: "Selected historical directory",
              displayPath: "D:/Program Files/PromptHub",
              promptCount: 0,
              folderCount: 0,
              skillCount: 0,
              dbSizeBytes: 4096,
              lastModified: "2026-07-15T14:12:00.000Z",
              previewAvailable: true,
              dataSources: ["mcp", "rules", "plugins", "config"],
              contentCounts: { mcp: 3, rules: 2, plugins: 1, config: 4 },
            } as any,
          ]}
        />,
        { language: "en" },
      );
    });

    expect(await screen.findByText("library.json")).toBeInTheDocument();
    expect(screen.getAllByText("3 MCP files").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 Rule files").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 Plugin file").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4 Config files").length).toBeGreaterThan(0);
  });

  it("keeps rendered recovery actions non-submit with decorative icons hidden", async () => {
    const handleSubmit = vi.fn();

    await act(async () => {
      await renderWithI18n(
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <DataRecoveryDialog
            isOpen={true}
            onClose={vi.fn()}
            currentPromptCount={2}
            databases={[
              {
                sourcePath: "C:/Users/test/AppData/Roaming/PromptHub",
                sourceType: "external-user-data",
                displayName: "Previous data directory",
                displayPath: "C:/Users/test/AppData/Roaming/PromptHub",
                promptCount: 3,
                folderCount: 1,
                skillCount: 0,
                dbSizeBytes: 8192,
                lastModified: "2026-04-18T10:00:00.000Z",
                previewAvailable: true,
                dataSources: ["sqlite", "workspace"],
              },
            ]}
          />
        </form>,
        { language: "en" },
      );
    });

    await screen.findByText("Customer Support Prompt");

    const buttons = Array.from(document.body.querySelectorAll("button"));
    const implicitButtonMarkup = buttons
      .filter((button) => button.getAttribute("type") !== "button")
      .map((button) => button.outerHTML);
    const exposedIconMarkup = Array.from(document.body.querySelectorAll("svg"))
      .filter((icon) => !hasHiddenSvgAncestor(icon))
      .map((icon) => icon.outerHTML);

    expect(implicitButtonMarkup, implicitButtonMarkup.join("\n")).toHaveLength(
      0,
    );
    expect(exposedIconMarkup, exposedIconMarkup.join("\n")).toHaveLength(0);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Start Fresh" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Restore Selected Source" }),
      );
    });

    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("renders multiple candidates, previews the selected source, and restores the chosen one", async () => {
    await act(async () => {
      await renderWithI18n(
        <DataRecoveryDialog
          isOpen={true}
          onClose={vi.fn()}
          databases={[
            {
              sourcePath: "C:/Users/test/AppData/Roaming/PromptHub",
              sourceType: "external-user-data",
              displayName: "Previous data directory",
              displayPath: "C:/Users/test/AppData/Roaming/PromptHub",
              promptCount: 3,
              folderCount: 1,
              skillCount: 0,
              dbSizeBytes: 8192,
              lastModified: "2026-04-18T10:00:00.000Z",
              previewAvailable: true,
              dataSources: ["sqlite", "workspace"],
            },
            {
              sourcePath:
                "C:/Users/test/AppData/Roaming/PromptHub/prompthub.db.backup-before-0.5.3.db",
              sourceType: "standalone-db-backup",
              displayName: "Standalone database backup",
              displayPath:
                "C:/Users/test/AppData/Roaming/PromptHub/prompthub.db.backup-before-0.5.3.db",
              promptCount: 7,
              folderCount: 2,
              skillCount: 1,
              dbSizeBytes: 16384,
              lastModified: "2026-04-18T11:00:00.000Z",
              previewAvailable: true,
              dataSources: ["sqlite"],
            },
          ]}
        />,
        { language: "en" },
      );
    });

    await waitFor(() => {
      expect(previewRecoveryMock).toHaveBeenCalledWith(
        "C:/Users/test/AppData/Roaming/PromptHub",
      );
    });

    expect(screen.getByText("Customer Support Prompt")).toBeInTheDocument();
    const previousDataButton = screen.getByRole("button", {
      name: /previous data directory/i,
    });
    const standaloneBackupButton = screen.getByRole("button", {
      name: /standalone database backup/i,
    });
    expect(previousDataButton).toHaveAttribute("aria-pressed", "true");
    expect(standaloneBackupButton).toHaveAttribute("aria-pressed", "false");

    previewRecoveryMock.mockResolvedValueOnce({
      sourcePath:
        "C:/Users/test/AppData/Roaming/PromptHub/prompthub.db.backup-before-0.5.3.db",
      previewAvailable: true,
      items: [
        {
          kind: "prompt",
          id: "prompt-2",
          title: "Standalone Backup Prompt",
          updatedAt: "2026-04-18T11:00:00.000Z",
        },
      ],
      truncated: false,
    });

    await act(async () => {
      fireEvent.click(standaloneBackupButton);
    });

    await waitFor(() => {
      expect(previewRecoveryMock).toHaveBeenLastCalledWith(
        "C:/Users/test/AppData/Roaming/PromptHub/prompthub.db.backup-before-0.5.3.db",
      );
    });

    expect(screen.getByText("Standalone Backup Prompt")).toBeInTheDocument();
    expect(previousDataButton).toHaveAttribute("aria-pressed", "false");
    expect(standaloneBackupButton).toHaveAttribute("aria-pressed", "true");

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Restore Selected Source" }),
      );
    });

    await waitFor(() => {
      expect(performRecoveryMock).toHaveBeenCalledWith(
        "C:/Users/test/AppData/Roaming/PromptHub/prompthub.db.backup-before-0.5.3.db",
      );
    });
  });
});
