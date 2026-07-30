import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AgentCliDiagnosticDialog } from "../../../src/renderer/components/agent/AgentCliDiagnosticDialog";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const agent = {
  id: "codex",
  name: "Codex",
  icon: "Terminal",
  isCustom: false,
  isConfigured: true,
  isDetected: true,
  isPinned: false,
  status: "installed" as const,
  paths: {
    root: "~/.codex",
    skills: "~/.codex/skills",
    configFiles: [],
    configFileRelativePaths: [],
  },
  capabilities: {
    overview: { status: "supported" as const },
    provider: { status: "supported" as const },
    appearance: { status: "unsupported" as const },
    assets: { status: "partial" as const },
    configFiles: { status: "partial" as const },
    sessions: { status: "supported" as const },
    usage: { status: "supported" as const },
    maintenance: { status: "partial" as const },
  },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe("Agent CLI diagnostic dialog", () => {
  beforeEach(() => {
    installWindowMocks({
      api: {
        agent: {
          diagnoseCli: vi.fn().mockResolvedValue({
            agentId: "codex",
            status: "installed",
            executablePath: "/Users/test/.local/bin/codex",
            version: "codex-cli 0.137.0",
            installSource: "user-local",
            errorCode: null,
            checkedAt: 1_700_000_000_000,
          }),
        },
      },
    });
  });

  it("runs on open and presents bounded version, path and source fields", async () => {
    await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );

    expect(
      await screen.findByRole("heading", { name: "CLI diagnostics" }),
    ).toBeVisible();
    expect(screen.getByText("codex-cli 0.137.0")).toBeVisible();
    expect(screen.getByText("/Users/test/.local/bin/codex")).toBeVisible();
    expect(screen.getByText("User-local install")).toBeVisible();
    expect(window.api.agent.diagnoseCli).toHaveBeenCalledWith("codex");
  });

  it("retries explicitly without exposing install or update actions", async () => {
    await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );
    await screen.findByText("codex-cli 0.137.0");

    fireEvent.click(screen.getByRole("button", { name: "Run again" }));

    await waitFor(() =>
      expect(window.api.agent.diagnoseCli).toHaveBeenCalledTimes(2),
    );
    expect(
      screen.queryByRole("button", { name: /install/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /update/i }),
    ).not.toBeInTheDocument();
  });

  it("renders stable unsupported and failure states without raw errors", async () => {
    vi.mocked(window.api.agent.diagnoseCli).mockResolvedValueOnce({
      agentId: "codex",
      status: "unsupported",
      executablePath: null,
      version: null,
      installSource: null,
      errorCode: "unsupported",
      checkedAt: 1_700_000_000_000,
    });
    const { unmount } = await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );

    expect(
      await screen.findByText(
        "CLI diagnostics are not supported for this Agent.",
      ),
    ).toBeVisible();
    unmount();

    installWindowMocks({
      api: {
        agent: {
          diagnoseCli: vi
            .fn()
            .mockRejectedValue(new Error("Authorization: Bearer secret")),
        },
      },
    });
    await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );

    expect(
      await screen.findByText("CLI diagnostics could not be completed."),
    ).toBeVisible();
    expect(screen.queryByText(/Bearer secret/i)).not.toBeInTheDocument();
  });

  it("renders not-installed fields without inventing version or source data", async () => {
    vi.mocked(window.api.agent.diagnoseCli).mockResolvedValueOnce({
      agentId: "codex",
      status: "not-installed",
      executablePath: null,
      version: null,
      installSource: null,
      errorCode: "not-found",
      checkedAt: 1_700_000_000_000,
    });
    await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );

    expect(screen.getByText("Not found", { selector: "dd" })).toBeVisible();
    expect(screen.getAllByText("Unknown")).toHaveLength(2);
  });

  it("renders an unhealthy diagnostic with a stable public error", async () => {
    vi.mocked(window.api.agent.diagnoseCli).mockResolvedValueOnce({
      agentId: "codex",
      status: "unhealthy",
      executablePath: "/usr/local/bin/codex",
      version: null,
      installSource: "system",
      errorCode: "timeout",
      checkedAt: 1_700_000_000_000,
    });
    await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );

    expect(screen.getByText("CLI needs attention")).toBeVisible();
    expect(screen.getByText("The version check timed out.")).toBeVisible();
  });

  it("keeps custom Agent diagnostics local and unsupported", async () => {
    await renderWithI18n(
      <AgentCliDiagnosticDialog
        agent={{ ...agent, id: "custom-team", isCustom: true }}
        isOpen
        onClose={vi.fn()}
      />,
      { settleAsyncEffects: true },
    );

    expect(screen.getByText("Not supported")).toBeVisible();
    expect(window.api.agent.diagnoseCli).not.toHaveBeenCalled();
  });

  it("ignores stale success and failure responses after the dialog target changes", async () => {
    const first =
      deferred<Awaited<ReturnType<typeof window.api.agent.diagnoseCli>>>();
    vi.mocked(window.api.agent.diagnoseCli)
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({
        agentId: "claude",
        status: "installed",
        executablePath: "/usr/local/bin/claude",
        version: "claude 2.0.0",
        installSource: "system",
        errorCode: null,
        checkedAt: 1_700_000_000_001,
      });
    const view = await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
    );

    view.rerender(
      <AgentCliDiagnosticDialog
        agent={{ ...agent, id: "claude", name: "Claude Code" }}
        isOpen
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByText("claude 2.0.0")).toBeVisible();
    await act(async () => {
      first.resolve({
        agentId: "codex",
        status: "installed",
        executablePath: "/usr/local/bin/codex",
        version: "stale-version",
        installSource: "system",
        errorCode: null,
        checkedAt: 1_700_000_000_000,
      });
      await first.promise;
    });
    expect(screen.queryByText("stale-version")).not.toBeInTheDocument();

    const staleFailure =
      deferred<Awaited<ReturnType<typeof window.api.agent.diagnoseCli>>>();
    vi.mocked(window.api.agent.diagnoseCli).mockReturnValueOnce(
      staleFailure.promise,
    );
    view.rerender(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
    );
    view.rerender(
      <AgentCliDiagnosticDialog
        agent={null}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    await act(async () => {
      staleFailure.reject(new Error("stale failure"));
      await staleFailure.promise.catch(() => undefined);
    });
    expect(
      screen.queryByText("CLI diagnostics could not be completed."),
    ).not.toBeInTheDocument();
  });

  it("reviews and applies an evidence-backed update using only opaque ids", async () => {
    vi.mocked(window.api.agent.diagnoseCli).mockResolvedValueOnce({
      agentId: "opencode",
      status: "installed",
      executablePath: "/opt/homebrew/bin/opencode",
      version: "1.0.0",
      installSource: "homebrew",
      errorCode: null,
      checkedAt: 1_700_000_000_000,
      canUpdate: true,
    });
    vi.mocked(window.api.agent.planCliUpdate).mockResolvedValueOnce({
      id: "plan-1",
      agentId: "opencode",
      operation: "update",
      command: {
        executable: "/opt/homebrew/bin/opencode",
        args: ["upgrade"],
      },
      currentVersion: "1.0.0",
      installSource: "homebrew",
      expiresAt: 1_700_000_300_000,
    });
    vi.mocked(window.api.agent.applyCliUpdate).mockResolvedValueOnce({
      agentId: "opencode",
      operation: "update",
      status: "applied",
      previousVersion: "1.0.0",
      currentVersion: "1.1.0",
      errorCode: null,
    });
    await renderWithI18n(
      <AgentCliDiagnosticDialog
        agent={{ ...agent, id: "opencode", name: "OpenCode" }}
        isOpen
        onClose={vi.fn()}
      />,
      { settleAsyncEffects: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "Review update" }));
    expect(
      await screen.findByRole("heading", { name: "Review CLI update" }),
    ).toBeVisible();
    expect(
      screen.getByText("/opt/homebrew/bin/opencode upgrade"),
    ).toBeVisible();
    expect(window.api.agent.planCliUpdate).toHaveBeenCalledWith("opencode");

    fireEvent.click(screen.getByRole("button", { name: "Update CLI" }));

    expect(await screen.findByText("CLI updated and verified.")).toBeVisible();
    expect(screen.getByText("1.0.0 → 1.1.0")).toBeVisible();
    expect(window.api.agent.applyCliUpdate).toHaveBeenCalledWith("plan-1");
    expect(window.api.agent.applyCliUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({ command: expect.anything() }),
    );
  });

  it("reviews the canonical npm command for an npm-managed Codex CLI", async () => {
    vi.mocked(window.api.agent.diagnoseCli).mockResolvedValueOnce({
      agentId: "codex",
      status: "installed",
      executablePath:
        "/Users/test/.nvm/versions/node/v22/lib/node_modules/@openai/codex/bin/codex.js",
      version: "codex-cli 0.137.0",
      installSource: "node-version-manager",
      errorCode: null,
      checkedAt: 1_700_000_000_000,
      canUpdate: true,
    });
    vi.mocked(window.api.agent.planCliUpdate).mockResolvedValueOnce({
      id: "codex-plan",
      agentId: "codex",
      operation: "update",
      command: {
        executable:
          "/Users/test/.nvm/versions/node/v22/lib/node_modules/npm/bin/npm-cli.js",
        args: ["install", "-g", "@openai/codex@latest"],
      },
      currentVersion: "0.137.0",
      installSource: "node-version-manager",
      expiresAt: 1_700_000_300_000,
    });
    await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "Review update" }));

    expect(
      await screen.findByText(
        "/Users/test/.nvm/versions/node/v22/lib/node_modules/npm/bin/npm-cli.js install -g @openai/codex@latest",
      ),
    ).toBeVisible();
    expect(window.api.agent.planCliUpdate).toHaveBeenCalledWith("codex");
    expect(window.api.agent.applyCliUpdate).not.toHaveBeenCalled();
  });

  it("does not expose update actions without a main-owned update contract", async () => {
    await renderWithI18n(
      <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
      { settleAsyncEffects: true },
    );

    expect(
      screen.queryByRole("button", { name: "Review update" }),
    ).not.toBeInTheDocument();
    expect(window.api.agent.planCliUpdate).not.toHaveBeenCalled();
  });

  it("shows stable lifecycle failures without leaking raw process errors", async () => {
    vi.mocked(window.api.agent.diagnoseCli).mockResolvedValueOnce({
      agentId: "opencode",
      status: "installed",
      executablePath: "/opt/homebrew/bin/opencode",
      version: "1.0.0",
      installSource: "homebrew",
      errorCode: null,
      checkedAt: 1_700_000_000_000,
      canUpdate: true,
    });
    vi.mocked(window.api.agent.planCliUpdate).mockRejectedValueOnce(
      new Error("Authorization: Bearer secret"),
    );
    await renderWithI18n(
      <AgentCliDiagnosticDialog
        agent={{ ...agent, id: "opencode", name: "OpenCode" }}
        isOpen
        onClose={vi.fn()}
      />,
      { settleAsyncEffects: true },
    );

    fireEvent.click(screen.getByRole("button", { name: "Review update" }));

    expect(
      await screen.findByText("The CLI update could not be prepared."),
    ).toBeVisible();
    expect(screen.queryByText(/Bearer secret/i)).not.toBeInTheDocument();
  });

  it.each(["en", "zh", "zh-TW", "ja", "fr", "de", "es"] as const)(
    "has localized diagnostic copy in %s",
    async (language) => {
      const { i18n, unmount } = await renderWithI18n(
        <AgentCliDiagnosticDialog agent={agent} isOpen onClose={vi.fn()} />,
        { language, settleAsyncEffects: true },
      );

      expect(i18n.exists("agents.cliDiagnostics.title")).toBe(true);
      expect(i18n.exists("agents.cliDiagnostics.runAgain")).toBe(true);
      expect(i18n.exists("agents.cliDiagnostics.status.installed")).toBe(true);
      expect(i18n.exists("agents.cliDiagnostics.errors.timeout")).toBe(true);
      expect(i18n.exists("agents.cliDiagnostics.update.review")).toBe(true);
      expect(i18n.exists("agents.cliDiagnostics.update.confirm")).toBe(true);
      expect(i18n.exists("agents.cliDiagnostics.update.status.applied")).toBe(
        true,
      );
      unmount();
    },
  );
});
