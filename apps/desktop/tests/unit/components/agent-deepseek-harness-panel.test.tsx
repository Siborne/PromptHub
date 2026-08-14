import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentDeepSeekHarnessPanel } from "../../../src/renderer/components/agent/AgentDeepSeekHarnessPanel";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";
import { ToastProvider } from "../../../src/renderer/components/ui/Toast";

function panel() {
  return (
    <ToastProvider>
      <AgentDeepSeekHarnessPanel />
    </ToastProvider>
  );
}

const overview = {
  agentId: "deepseek-harness" as const,
  cliAvailable: true,
  profiles: [
    {
      name: "web",
      status: "valid" as const,
      bundleCount: 2,
      dependencyCount: 1,
      updatedAt: 1_700_000_000_000,
      warnings: [],
    },
  ],
};

const detail = {
  ...overview.profiles[0],
  agentId: "deepseek-harness" as const,
  plugins: [
    {
      name: "@demo/search",
      version: "1.2.3",
      description: "Search tools",
      license: "MIT",
      repositoryUrl: "https://github.com/demo/search",
      homepage: "https://example.com/search",
      enabled: true,
      directDependency: true,
      sourceSpec: "1.2.3",
      status: "installed" as const,
      lifecycleScripts: ["prepare"],
      warnings: [],
    },
  ],
};

describe("DeepSeek Harness plugin panel", () => {
  beforeEach(() => {
    installWindowMocks({
      api: {
        agent: {
          listHarnessProfiles: vi.fn().mockResolvedValue(overview),
          readHarnessProfile: vi.fn().mockResolvedValue(detail),
          mutateHarnessPlugin: vi.fn().mockResolvedValue({
            success: true,
            profile: detail,
          }),
        },
      },
    });
  });

  it("renders the profile-owned plugin inventory and selected detail", async () => {
    await renderWithI18n(panel(), { settleAsyncEffects: true });

    expect(await screen.findAllByText("@demo/search")).toHaveLength(2);
    expect(screen.getByText("Search tools")).toBeVisible();
    expect(screen.getAllByText("1.2.3")).toHaveLength(3);
    expect(screen.getByText(/prepare/i)).toBeVisible();
    expect(screen.getByText("MIT")).toBeVisible();
    expect(screen.getByText("https://github.com/demo/search")).toBeVisible();
    expect(screen.getByText("https://example.com/search")).toBeVisible();
    expect(
      screen.getByRole("button", { name: /select profile/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /install plugin/i }),
    ).toBeVisible();
  });

  it("requires explicit lifecycle-script acknowledgement before install", async () => {
    await renderWithI18n(panel(), { settleAsyncEffects: true });

    fireEvent.click(
      await screen.findByRole("button", { name: /install plugin/i }),
    );
    fireEvent.change(screen.getByLabelText(/package source/i), {
      target: { value: "@demo/new-plugin" },
    });
    expect(screen.getByRole("button", { name: /^install$/i })).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /^install$/i }));

    await waitFor(() =>
      expect(window.api.agent.mutateHarnessPlugin).toHaveBeenCalledWith({
        agentId: "deepseek-harness",
        operation: "install",
        profileName: "web",
        packageSpec: "@demo/new-plugin",
        acknowledgeLifecycleScripts: true,
      }),
    );
  });

  it("keeps mutating actions unavailable when the official CLI is missing", async () => {
    vi.mocked(window.api.agent.listHarnessProfiles).mockResolvedValue({
      ...overview,
      cliAvailable: false,
    });

    await renderWithI18n(panel(), { settleAsyncEffects: true });

    expect(
      await screen.findByRole("button", { name: /install plugin/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /update plugin/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /remove plugin/i }),
    ).toBeDisabled();
  });

  it("confirms permanent removal and delegates only the direct dependency", async () => {
    await renderWithI18n(panel(), { settleAsyncEffects: true });

    fireEvent.click(
      await screen.findByRole("button", { name: /remove plugin/i }),
    );
    expect(screen.getByRole("alertdialog")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /^remove$/i }));

    await waitFor(() =>
      expect(window.api.agent.mutateHarnessPlugin).toHaveBeenCalledWith({
        agentId: "deepseek-harness",
        operation: "remove",
        profileName: "web",
        packageName: "@demo/search",
        acknowledgeLifecycleScripts: true,
      }),
    );
  });
});
