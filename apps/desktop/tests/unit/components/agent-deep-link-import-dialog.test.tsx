import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AgentDeepLinkCommand,
  AgentProviderProfilePublic,
} from "@prompthub/shared";
import { AgentDeepLinkImportDialog } from "../../../src/renderer/components/agent/AgentDeepLinkImportDialog";
import { useAgentProviderStore } from "../../../src/renderer/stores/agent-provider.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const previewCommand: Extract<
  AgentDeepLinkCommand,
  { type: "agent:import-provider" }
> = {
  type: "agent:import-provider",
  preview: {
    version: 1,
    profile: {
      platformId: "codex",
      name: "Team Provider",
      providerKind: "openai-compatible",
      protocol: "openai-responses",
      endpoint: "https://api.example.com/v1",
      config: { region: "global" },
      source: "import",
    },
    modelMappings: [
      {
        routeKey: "primary",
        modelId: "gpt-5.4",
        parameters: { reasoningEffort: "high" },
      },
    ],
    requiresSecret: true,
  },
};

const createdProfile: AgentProviderProfilePublic = {
  id: "profile-imported",
  platformId: "codex",
  name: "Team Provider",
  providerKind: "openai-compatible",
  protocol: "openai-responses",
  endpoint: "https://api.example.com/v1",
  config: { region: "global" },
  source: "import",
  archived: false,
  createdAt: 1,
  updatedAt: 1,
  modelMappings: [
    {
      id: "mapping-imported",
      providerProfileId: "profile-imported",
      routeKey: "primary",
      modelId: "gpt-5.4",
      parameters: { reasoningEffort: "high" },
    },
  ],
  secretState: "missing",
};

describe("AgentDeepLinkImportDialog", () => {
  beforeEach(() => {
    useAgentProviderStore.setState(
      useAgentProviderStore.getInitialState(),
      true,
    );
  });

  it("renders nothing without a pending command", async () => {
    await renderWithI18n(
      <AgentDeepLinkImportDialog command={null} onClose={vi.fn()} />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a complete non-secret preview and cancel performs no write", async () => {
    const createProviderProfile = vi.fn();
    installWindowMocks({
      api: {
        agent: {
          createProviderProfile,
        },
      },
    });
    const onClose = vi.fn();

    await renderWithI18n(
      <AgentDeepLinkImportDialog command={previewCommand} onClose={onClose} />,
    );

    expect(screen.getByRole("dialog")).toHaveTextContent("Team Provider");
    expect(screen.getByRole("dialog")).toHaveTextContent("Codex");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "https://api.example.com/v1",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("gpt-5.4");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "A credential is required",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("does not activate");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(createProviderProfile).not.toHaveBeenCalled();
  });

  it("confirms exactly once through the existing profile service without activation", async () => {
    let resolveCreate: (value: AgentProviderProfilePublic) => void = () =>
      undefined;
    const createProviderProfile = vi.fn(
      () =>
        new Promise<AgentProviderProfilePublic>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const activateProvider = vi.fn();
    installWindowMocks({
      api: {
        agent: {
          createProviderProfile,
          activateProvider,
        },
      },
    });
    const onClose = vi.fn();

    await renderWithI18n(
      <AgentDeepLinkImportDialog command={previewCommand} onClose={onClose} />,
    );
    const confirm = screen.getByRole("button", { name: "Import profile" });
    await act(async () => {
      confirm.click();
      confirm.click();
    });

    await waitFor(() => expect(createProviderProfile).toHaveBeenCalledOnce());
    expect(createProviderProfile).toHaveBeenCalledWith({
      profile: previewCommand.preview.profile,
      modelMappings: previewCommand.preview.modelMappings,
    });
    expect(confirm).toBeDisabled();
    expect(activateProvider).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();

    resolveCreate(createdProfile);
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(useAgentProviderStore.getState().selectedProfileId).toBe(
      "profile-imported",
    );
  });

  it("keeps a failed import open and reports a stable localized failure", async () => {
    const createProviderProfile = vi
      .fn()
      .mockRejectedValue(new Error("native details must stay private"));
    installWindowMocks({
      api: {
        agent: {
          createProviderProfile,
        },
      },
    });
    useAgentProviderStore.setState({ platformId: "codex" });

    await renderWithI18n(
      <AgentDeepLinkImportDialog command={previewCommand} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Import profile" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The profile could not be imported",
      ),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("falls back safely for an unknown display platform and no-secret profile", async () => {
    const command: typeof previewCommand = {
      ...previewCommand,
      preview: {
        ...previewCommand.preview,
        profile: {
          ...previewCommand.preview.profile,
          platformId: "future-agent",
          endpoint: null,
        },
        requiresSecret: false,
      },
    };

    await renderWithI18n(
      <AgentDeepLinkImportDialog command={command} onClose={vi.fn()} />,
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("future-agent");
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "No credential is required",
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Platform native");
  });

  it("uses the defensive failure fallback when a store action returns no result", async () => {
    useAgentProviderStore.setState({
      platformId: "codex",
      errorCode: null,
      createProfile: vi.fn().mockResolvedValue(null),
    });

    await renderWithI18n(
      <AgentDeepLinkImportDialog command={previewCommand} onClose={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Import profile" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "The profile could not be imported",
      ),
    );
  });

  it("renders stable errors without exposing raw launch input", async () => {
    const command: Extract<
      AgentDeepLinkCommand,
      { type: "agent:import-error" }
    > = {
      type: "agent:import-error",
      errorCode: "AGENT_DEEP_LINK_SENSITIVE_VALUE_REJECTED",
    };

    await renderWithI18n(
      <AgentDeepLinkImportDialog command={command} onClose={vi.fn()} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Deep links cannot carry credentials",
    );
    expect(screen.queryByText(/sk-/i)).not.toBeInTheDocument();
  });
});
