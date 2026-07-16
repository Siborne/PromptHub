import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import type { FormEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CLISettings } from "../../../src/renderer/components/settings/CLISettings";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const showToast = vi.fn();
const FALLBACK_CLI_STATUS = {
  installed: false,
  command: "prompthub",
  version: null,
  packageManager: null,
  packageManagerVersion: null,
  releaseTag: "v0.5.9",
  installCommand: null,
  manualInstallCommands: { pnpm: "", npm: "" },
  installSource: "",
};

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

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

describe("CLISettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows detected CLI status and install source", async () => {
    installWindowMocks({
      electron: {
        cli: {
          getStatus: vi.fn().mockResolvedValue({
            installed: true,
            command: "prompthub",
            version: "0.5.8-beta.2",
            packageManager: "pnpm",
            packageManagerVersion: "9.15.0",
            releaseTag: "v0.5.8-beta.2",
            installCommand:
              "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
            manualInstallCommands: {
              pnpm: "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
              npm: "npm install -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
            },
            installSource:
              "https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
          }),
        },
      },
    });

    await act(async () => {
      await renderWithI18n(<CLISettings />, { language: "en" });
    });

    await waitFor(() => {
      expect(screen.getByText("Installed")).toBeInTheDocument();
    });

    expect(screen.getByText("Version")).toBeInTheDocument();
    expect(screen.getByText("0.5.8-beta.2")).toBeInTheDocument();
    expect(screen.getByText("Detected Package Manager")).toBeInTheDocument();
    expect(screen.getByText(/pnpm 9.15.0/)).toBeInTheDocument();
    expect(screen.queryByText("Manual install")).not.toBeInTheDocument();
  });

  it("installs the CLI with the detected package manager", async () => {
    const install = vi.fn().mockResolvedValue({
      success: true,
      method: "pnpm",
      command:
        "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
    });
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        installed: false,
        command: "prompthub",
        version: null,
        packageManager: "pnpm",
        packageManagerVersion: "9.15.0",
        releaseTag: "v0.5.8-beta.2",
        installCommand:
          "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
        manualInstallCommands: {
          pnpm: "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
          npm: "npm install -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
        },
        installSource:
          "https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
      })
      .mockResolvedValueOnce({
        installed: true,
        command: "prompthub",
        version: "0.5.8-beta.2",
        packageManager: "pnpm",
        packageManagerVersion: "9.15.0",
        releaseTag: "v0.5.8-beta.2",
        installCommand:
          "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
        manualInstallCommands: {
          pnpm: "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
          npm: "npm install -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
        },
        installSource:
          "https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
      });

    installWindowMocks({
      electron: {
        cli: {
          getStatus,
          install,
        },
      },
    });
    const onSubmit = vi.fn((event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
    });

    await act(async () => {
      await renderWithI18n(
        <form onSubmit={onSubmit}>
          <CLISettings />
        </form>,
        { language: "en" },
      );
    });

    const installWithPnpm = await screen.findByRole("button", {
      name: "Install with pnpm",
    });
    const installWithNpm = screen.getByRole("button", {
      name: "Install with npm",
    });
    const refreshStatus = screen.getByRole("button", {
      name: "Refresh Status",
    });

    for (const button of [installWithPnpm, installWithNpm, refreshStatus]) {
      expect(button).toHaveAttribute("type", "button");
    }

    const exposedIconMarkup = Array.from(
      document.body.querySelectorAll("button svg"),
    )
      .filter((icon) => !hasHiddenSvgAncestor(icon))
      .map((icon) => icon.outerHTML);

    expect(exposedIconMarkup, exposedIconMarkup.join("\n")).toHaveLength(0);

    fireEvent.click(installWithPnpm);

    await waitFor(() => {
      expect(install).toHaveBeenCalledWith("pnpm");
    });
    expect(showToast).toHaveBeenCalledWith(
      "PromptHub CLI installed successfully",
      "success",
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("explains and completes migration from the retired desktop wrapper", async () => {
    const legacyCommandPath = "/tmp/PromptHub/bin/prompthub";
    const install = vi.fn().mockResolvedValue({
      success: true,
      method: "pnpm",
      command: "pnpm add -g prompthub-cli.tgz",
      removedLegacyCommand: true,
    });
    const getStatus = vi
      .fn()
      .mockResolvedValueOnce({
        ...FALLBACK_CLI_STATUS,
        packageManager: "pnpm",
        packageManagerVersion: "10.0.0",
        legacyCommandPath,
      })
      .mockResolvedValueOnce({
        ...FALLBACK_CLI_STATUS,
        installed: true,
        version: "0.5.9",
        packageManager: "pnpm",
        packageManagerVersion: "10.0.0",
        legacyCommandPath: null,
      });
    installWindowMocks({ electron: { cli: { getStatus, install } } });

    await act(async () => {
      await renderWithI18n(<CLISettings />, { language: "en" });
    });

    expect(
      await screen.findByText("Legacy desktop CLI wrapper detected"),
    ).toBeInTheDocument();
    expect(screen.getByText(legacyCommandPath)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replace with pnpm" }));

    await waitFor(() => expect(install).toHaveBeenCalledWith("pnpm"));
    expect(showToast).toHaveBeenCalledWith(
      "Standalone PromptHub CLI installed; the legacy desktop wrapper was removed",
      "success",
    );
  });

  it("does not attempt one-click install when no package manager is detected", async () => {
    const install = vi.fn();
    const writeText = vi
      .spyOn(navigator.clipboard, "writeText")
      .mockResolvedValue(undefined);

    installWindowMocks({
      electron: {
        cli: {
          getStatus: vi.fn().mockResolvedValue({
            installed: false,
            command: "prompthub",
            version: null,
            packageManager: null,
            packageManagerVersion: null,
            releaseTag: "v0.5.8-beta.2",
            installCommand: null,
            manualInstallCommands: {
              pnpm: "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
              npm: "npm install -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
            },
            installSource:
              "https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
          }),
          install,
        },
      },
    });

    await act(async () => {
      await renderWithI18n(<CLISettings />, { language: "en" });
    });

    const installWithPnpm = await screen.findByRole("button", {
      name: "Install with pnpm",
    });
    const installWithNpm = screen.getByRole("button", {
      name: "Install with npm",
    });

    expect(installWithPnpm).toBeDisabled();
    expect(installWithNpm).toBeDisabled();
    expect(
      screen.getByText(
        "PromptHub could not see pnpm or npm from this app window. You can still copy a command and run it in your terminal.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "npm install -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
      ),
    ).toBeInTheDocument();

    fireEvent.click(installWithPnpm);

    expect(install).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Copy pnpm command" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.8-beta.2/prompthub-cli-0.5.8-beta.2.tgz",
      );
    });
    expect(showToast).toHaveBeenCalledWith("Install command copied", "success");
  });
});
