import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAgentProviderStore } from "../../../src/renderer/stores/agent-provider.store";
import {
  activationPlan,
  createAgent,
  importPreview,
  profile,
  renderWorkbench,
  resetProviderWorkbenchTestState,
} from "./agent-provider-profile-workbench.harness";

describe("AgentProviderProfileWorkbench", () => {
  beforeEach(() => {
    resetProviderWorkbenchTestState();
  });

  it("loads the selected platform profile and shows only public readiness data", async () => {
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([profile({ secretState: "available" })]);

    await renderWorkbench();

    expect(screen.getByTestId("agent-provider-workbench")).toBeVisible();
    const toolbar = screen.getByTestId("agent-provider-workbench-toolbar");
    expect(toolbar).toBeVisible();
    expect(
      within(toolbar).getByText("Import current configuration"),
    ).toBeVisible();
    expect(within(toolbar).getByText("Import from PromptHub")).toBeVisible();
    expect(screen.getByTestId("agent-provider-workbench-sidebar")).toHaveClass(
      "overflow-hidden",
    );
    expect(
      screen.getByRole("navigation", { name: "Provider profiles" }),
    ).toHaveClass("h-full", "overflow-x-hidden", "overflow-y-auto");
    expect(window.api.agent.listProviderProfiles).toHaveBeenCalledWith({
      platformId: "claude",
    });
    expect(
      await screen.findByRole("button", { name: /Claude production/ }),
    ).toHaveAttribute("aria-current", "true");
    expect(screen.getAllByText("claude-sonnet-4").length).toBeGreaterThan(0);
    expect(screen.getByText("Credential available")).toBeVisible();
    expect(screen.queryByText(/agent-provider:/)).not.toBeInTheDocument();
  });

  it("uses Web-specific empty copy without promising native import or activation", async () => {
    (window as Window & { __PROMPTHUB_WEB__?: boolean }).__PROMPTHUB_WEB__ =
      true;
    window.api.agent.listProviderProfiles = vi.fn().mockResolvedValue([]);

    try {
      await renderWorkbench();

      expect(
        screen.getByText("No profiles yet. Create one to manage this Agent."),
      ).toBeVisible();
      expect(
        screen.getByText(
          "Create a provider profile to store model settings and write-only credentials on this server.",
        ),
      ).toBeVisible();
      expect(
        screen.queryByText(/native configuration/i),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/activation/i)).not.toBeInTheDocument();
    } finally {
      delete (window as Window & { __PROMPTHUB_WEB__?: boolean })
        .__PROMPTHUB_WEB__;
    }
  });

  it("shows the current native provider without a Profile and previews official restore", async () => {
    const officialProfile = profile({
      id: "profile-official",
      name: "Anthropic Official",
      providerKind: "anthropic",
      protocol: "platform-native",
      modelMappings: [
        {
          id: "mapping-official",
          providerProfileId: "profile-official",
          routeKey: "primary",
          modelId: "opus[1m]",
          parameters: {},
        },
      ],
    });
    window.api.agent.listProviderProfiles = vi.fn().mockResolvedValue([]);
    window.api.agent.getProviderCurrentState = vi.fn().mockResolvedValue({
      platformId: "claude",
      status: "none",
      currentProfileId: null,
      nativeConfig: {
        classification: "custom",
        name: "Claude custom provider",
        providerKind: "custom",
        protocol: "anthropic-messages",
        endpoint: "https://api.kimi.com/coding",
        model: "opus[1m]",
        credential: "configured-auth-token",
        officialRestoreAvailable: true,
      },
      checkedAt: 1_700_000_000_000,
    });
    window.api.agent.ensureOfficialProviderProfile = vi
      .fn()
      .mockResolvedValue(officialProfile);
    window.api.agent.previewProviderActivation = vi.fn().mockResolvedValue(
      activationPlan({
        profileId: officialProfile.id,
        status: "apply",
        canApply: true,
        requiresReview: false,
        decisions: [],
      }),
    );

    await renderWorkbench();

    expect(
      screen.getByRole("button", { name: /Current native configuration/ }),
    ).toBeVisible();
    expect(screen.getAllByText("Custom provider")).toHaveLength(2);
    expect(screen.getByText("https://api.kimi.com/coding")).toBeVisible();
    expect(screen.getAllByText("opus[1m]").length).toBeGreaterThan(0);
    expect(screen.getByText("Configured auth token")).toBeVisible();
    expect(screen.queryByText(/sk-|agent-provider:/i)).not.toBeInTheDocument();
    const nativeRow = screen.getByTestId("provider-native-card");
    expect(nativeRow).toHaveClass("rounded-lg", "border", "bg-card");
    expect(nativeRow).not.toHaveClass("m-1", "w-[calc(100%-0.5rem)]");
    expect(nativeRow.parentElement).toHaveClass("p-1");
    expect(nativeRow).not.toHaveClass("border-b");
    expect(
      screen.queryByText(
        "This native configuration remains owned by the Agent and is read-only here.",
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create editable profile" }),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Restore official configuration" }),
    );

    await waitFor(() =>
      expect(
        window.api.agent.ensureOfficialProviderProfile,
      ).toHaveBeenCalledWith("claude"),
    );
    expect(window.api.agent.previewProviderActivation).toHaveBeenCalledWith({
      agentId: "claude",
      profileId: officialProfile.id,
    });
    expect(
      await screen.findByRole("dialog", {
        name: "Review provider activation",
      }),
    ).toBeVisible();
  });

  it("imports a compatible PromptHub provider and explains incompatible sources", async () => {
    const imported = profile({
      id: "profile-imported",
      platformId: "codex",
      name: "Work Gateway",
      source: "import",
    });
    window.api.agent.listProviderSources = vi.fn().mockResolvedValue([
      {
        source: "prompthub",
        sourceId: "provider-work",
        name: "Work Gateway",
        providerKind: "openai-compatible",
        protocol: "openai-chat",
        endpoint: "https://gateway.example.com/v1",
        credentialReady: true,
        compatible: true,
        incompatibility: null,
        models: [
          {
            id: "model-work",
            name: "GPT Work",
            model: "gpt-work",
            isDefault: true,
          },
        ],
      },
      {
        source: "prompthub",
        sourceId: "provider-anthropic",
        name: "Anthropic Direct",
        providerKind: "anthropic",
        protocol: null,
        endpoint: "https://api.anthropic.com",
        credentialReady: true,
        compatible: false,
        incompatibility: "protocol-unsupported",
        models: [
          {
            id: "model-anthropic",
            name: "Claude Work",
            model: "claude-work",
            isDefault: false,
          },
        ],
      },
    ]);
    window.api.agent.importProviderSource = vi.fn().mockResolvedValue(imported);

    await renderWorkbench(createAgent("codex"));
    fireEvent.click(
      screen.getByRole("button", { name: "Import from PromptHub" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Import PromptHub provider",
    });
    expect(window.api.agent.listProviderSources).toHaveBeenCalledWith("codex");
    expect(within(dialog).getByText("Work Gateway")).toBeVisible();
    expect(within(dialog).getByText("Anthropic Direct")).toBeVisible();
    expect(within(dialog).getByText("Protocol is not supported")).toBeVisible();
    const importButton = within(dialog).getByRole("button", { name: "Import" });
    await waitFor(() => expect(importButton).toBeEnabled());
    fireEvent.click(importButton);

    await waitFor(() =>
      expect(window.api.agent.importProviderSource).toHaveBeenCalledWith({
        platformId: "codex",
        sourceId: "provider-work",
        modelId: "model-work",
      }),
    );
    expect(
      await screen.findByRole("button", { name: /Work Gateway/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole("dialog", { name: "Import PromptHub provider" }),
    ).not.toBeInTheDocument();
  });

  it("marks only the native-verified current profile and disables redundant activation", async () => {
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([
        profile(),
        profile({ id: "profile-2", name: "Lab" }),
      ]);
    window.api.agent.getProviderCurrentState = vi.fn().mockResolvedValue({
      platformId: "claude",
      status: "verified",
      currentProfileId: "profile-1",
      nativeConfig: null,
      checkedAt: 1_700_000_000_000,
    });

    await renderWorkbench();

    const currentProfile = await screen.findByRole("button", {
      name: /Claude production/,
    });
    expect(within(currentProfile).getByText("Current")).toBeVisible();
    expect(screen.getByRole("button", { name: "Current" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Lab/ }));
    expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled();
  });

  it("does not claim a stale or unavailable Profile is current", async () => {
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([profile()]);
    window.api.agent.getProviderCurrentState = vi.fn().mockResolvedValue({
      platformId: "claude",
      status: "stale",
      currentProfileId: null,
      nativeConfig: null,
      checkedAt: 1_700_000_000_000,
    });

    await renderWorkbench();

    expect(screen.queryByText("Current")).not.toBeInTheDocument();
    expect(screen.getByText("Native configuration changed")).toBeVisible();
    expect(screen.getByRole("button", { name: "Activate" })).toBeEnabled();
  });

  it("runs an isolated supported Profile connection test and renders its result", async () => {
    const geminiProfile = profile({
      platformId: "gemini",
      name: "Gemini paid API",
      providerKind: "google-gemini",
      protocol: "google-generative-language",
      endpoint: "https://generativelanguage.googleapis.com",
      secretState: "available",
      modelMappings: [
        {
          id: "mapping-gemini",
          providerProfileId: "profile-1",
          routeKey: "primary",
          modelId: "gemini-2.5-pro",
          parameters: {},
        },
      ],
    });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([geminiProfile]);
    const successfulResult = {
      platformId: "gemini",
      profileId: "profile-1",
      protocol: "google-generative-language",
      endpointOrigin: "https://generativelanguage.googleapis.com",
      model: "gemini-2.5-pro",
      status: "ok",
      startedAt: 10,
      finishedAt: 20,
      totalMs: 10,
      retryCount: 0,
      modelCount: 2,
      modelAvailable: true,
    } as const;
    let finishConnection: ((value: typeof successfulResult) => void) | null =
      null;
    window.api.agent.testProviderConnection = vi.fn().mockImplementation(
      () =>
        new Promise<typeof successfulResult>((resolve) => {
          finishConnection = resolve;
        }),
    );

    await renderWorkbench(createAgent("gemini"));
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(
      await screen.findByRole("button", { name: "Testing..." }),
    ).toBeDisabled();
    await waitFor(() =>
      expect(window.api.agent.testProviderConnection).toHaveBeenCalledWith({
        agentId: "gemini",
        profileId: "profile-1",
      }),
    );
    await act(async () => {
      finishConnection?.(successfulResult);
    });
    expect(await screen.findByText("Connection successful")).toBeVisible();
    expect(screen.getByText("2 models available")).toBeVisible();
    expect(screen.getByText("10 ms")).toBeVisible();
    expect(screen.queryByText(/secret/)).not.toBeInTheDocument();

    window.api.agent.testProviderConnection = vi.fn().mockResolvedValue({
      platformId: "gemini",
      profileId: "profile-1",
      protocol: "google-generative-language",
      endpointOrigin: "https://generativelanguage.googleapis.com",
      model: "gemini-2.5-pro",
      status: "auth-error",
      startedAt: 30,
      finishedAt: 35,
      totalMs: 5,
      retryCount: 0,
      modelCount: null,
      modelAvailable: null,
      errorCode: "http-401",
    });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    expect(await screen.findByText("Authentication failed")).toBeVisible();
    expect(screen.getByText("5 ms")).toBeVisible();
    expect(screen.queryByText("2 models available")).not.toBeInTheDocument();
  });

  it("requires quota confirmation before an explicit streaming model test", async () => {
    const codexProfile = profile({
      platformId: "codex",
      name: "Codex work",
      providerKind: "openai-compatible",
      protocol: "openai-responses",
      endpoint: "https://gateway.example.com/v1",
      config: { providerId: "work-gateway" },
      secretState: "available",
    });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([codexProfile]);
    window.api.agent.previewProviderMigration = vi.fn().mockResolvedValue({
      agentId: "codex",
      nativeDigest: "empty",
      candidates: [],
    });
    window.api.agent.testProviderModel = vi.fn().mockResolvedValue({
      platformId: "codex",
      profileId: "profile-1",
      protocol: "responses",
      endpointOrigin: "https://gateway.example.com",
      model: "claude-sonnet-4",
      status: "ok",
      startedAt: 10,
      finishedAt: 40,
      totalMs: 30,
      firstTokenMs: 12,
      retryCount: 0,
      inputTokens: 8,
      outputTokens: 1,
      outputPreview: "OK",
    });

    await renderWorkbench(createAgent("codex"));
    fireEvent.click(screen.getByRole("button", { name: "Test model" }));

    const confirmation = await screen.findByRole("alertdialog", {
      name: "Run model test?",
    });
    expect(
      within(confirmation).getByText(/may consume provider quota/i),
    ).toBeVisible();
    expect(window.api.agent.testProviderModel).not.toHaveBeenCalled();
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Run test" }),
    );

    expect(await screen.findByText("Model responded")).toBeVisible();
    expect(screen.getByText("12 ms to first token")).toBeVisible();
    expect(screen.getByText("OK")).toBeVisible();
    expect(window.api.agent.testProviderModel).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: "codex",
        profileId: "profile-1",
        requestId: expect.stringMatching(/^model-test-/),
      }),
    );
    expect(screen.queryByText(/secret/i)).not.toBeInTheDocument();
  });

  it("imports native configuration as an explicit preview before creating a profile", async () => {
    const imported = importPreview();
    const created = profile({
      id: "imported-profile",
      name: "anthropic",
      source: "native-import",
    });
    window.api.agent.importCurrentProvider = vi
      .fn()
      .mockResolvedValue(imported);
    window.api.agent.createProviderProfile = vi.fn().mockResolvedValue(created);

    await renderWorkbench();
    fireEvent.click(
      screen.getByRole("button", { name: "Import current configuration" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Import current configuration",
    });
    expect(within(dialog).getByText("claude-opus-4")).toBeVisible();
    expect(
      within(dialog).getByText("Native formatting may change"),
    ).toBeVisible();
    expect(within(dialog).getByText("custom-native-warning")).toBeVisible();
    expect(within(dialog).getByText("null")).toBeVisible();
    expect(within(dialog).getByText('{"region":"global"}')).toBeVisible();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Create and edit" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "claude",
          name: "anthropic",
          providerKind: "anthropic",
          protocol: "platform-native",
          endpoint: null,
          config: {},
          source: "native-import",
        },
        modelMappings: imported.modelMappings,
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Import current configuration",
        }),
      ).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByRole("region", { name: "Edit provider profile" }),
    ).toBeVisible();
    expect(screen.getAllByDisplayValue("anthropic")).toHaveLength(2);
  });

  it("requires an explicit per-field conflict choice before activation", async () => {
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([profile()]);
    window.api.agent.previewProviderActivation = vi
      .fn()
      .mockResolvedValue(activationPlan());
    window.api.agent.activateProvider = vi.fn().mockResolvedValue({
      status: "verified",
      plan: activationPlan({
        status: "apply",
        canApply: true,
        requiresReview: false,
        decisions: [
          {
            field: "model",
            status: "apply",
            current: "claude-opus-4",
            desired: "claude-sonnet-4",
          },
        ],
      }),
      verification: {
        verified: true,
        nativeDigest: "digest-after",
        state: {
          platformId: "claude",
          adapterVersion: "model-profile-v1",
          nativeDigest: "digest-after",
          values: { model: "claude-sonnet-4" },
        },
      },
      rollback: null,
    });

    await renderWorkbench();
    fireEvent.click(await screen.findByRole("button", { name: "Activate" }));

    const dialog = await screen.findByRole("dialog", {
      name: "Review provider activation",
    });
    const activate = within(dialog).getByRole("button", {
      name: "Activate profile",
    });
    expect(activate).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Keep current value" }),
    );
    expect(activate).toBeDisabled();
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Use profile value" }),
    );
    expect(activate).toBeEnabled();
    fireEvent.click(activate);

    await waitFor(() =>
      expect(window.api.agent.activateProvider).toHaveBeenCalledWith({
        agentId: "claude",
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
        resolutions: [{ field: "model", action: "use-profile" }],
      }),
    );
    expect(
      await within(dialog).findByText("Activation verified"),
    ).toBeVisible();
  });

  it("keeps rollback diagnostics visible after verification failure", async () => {
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([profile()]);
    window.api.agent.previewProviderActivation = vi.fn().mockResolvedValue(
      activationPlan({
        status: "apply",
        canApply: true,
        requiresReview: false,
        decisions: [
          {
            field: "model",
            status: "apply",
            current: "claude-opus-4",
            desired: "claude-sonnet-4",
          },
        ],
      }),
    );
    window.api.agent.activateProvider = vi.fn().mockResolvedValue({
      status: "rolled-back",
      plan: activationPlan({
        status: "apply",
        canApply: true,
        requiresReview: false,
      }),
      verification: {
        verified: false,
        nativeDigest: "digest-wrong",
        state: {
          platformId: "claude",
          adapterVersion: "model-profile-v1",
          nativeDigest: "digest-wrong",
          values: { model: "wrong" },
        },
        errorCode: "provider-state-mismatch",
      },
      rollback: {
        restored: true,
        nativeDigest: "digest-current",
      },
      errorCode: "provider-state-mismatch",
    });

    await renderWorkbench();
    fireEvent.click(await screen.findByRole("button", { name: "Activate" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Review provider activation",
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Activate profile" }),
    );

    expect(
      await within(dialog).findByText(
        "Activation failed; previous state restored",
      ),
    ).toBeVisible();
    expect(within(dialog).getByText("provider-state-mismatch")).toBeVisible();
  });

  it("keeps blocked activation and rollback failure diagnostics bounded in the dialog", async () => {
    const blockedPlan = activationPlan({
      status: "blocked",
      canApply: false,
      requiresReview: false,
      blockedReasons: ["profile-secret-missing"],
      decisions: [
        {
          field: "endpoint",
          status: "blocked",
          current: null,
          desired: "https://api.example.com",
        },
      ],
    });

    await renderWorkbench();
    act(() => {
      useAgentProviderStore.setState({
        activationPlan: blockedPlan,
        activationResult: null,
        errorCode: "AGENT_PROVIDER_OPERATION_FAILED",
      });
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Review provider activation",
    });
    expect(within(dialog).getByText("Activation is blocked")).toBeVisible();
    expect(within(dialog).getByText("profile-secret-missing")).toBeVisible();
    expect(within(dialog).getByText("Provider operation failed")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Activate profile" }),
    ).toBeDisabled();

    act(() => {
      useAgentProviderStore.setState({
        activationResult: {
          status: "failed",
          plan: blockedPlan,
          verification: null,
          rollback: {
            restored: false,
            nativeDigest: null,
            errorCode: "rollback-not-verified",
          },
        },
        errorCode: null,
      });
    });
    expect(
      await within(dialog).findByText(
        "Activation failed; rollback could not be verified",
      ),
    ).toBeVisible();
    fireEvent.click(within(dialog).getByText("Close"));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Review provider activation",
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("can dismiss a native import preview without warnings", async () => {
    await renderWorkbench();
    act(() => {
      useAgentProviderStore.setState({
        importPreview: { ...importPreview(), warnings: [] },
      });
    });

    const dialog = await screen.findByRole("dialog", {
      name: "Import current configuration",
    });
    expect(
      within(dialog).queryByText("Native formatting may change"),
    ).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", {
          name: "Import current configuration",
        }),
      ).not.toBeInTheDocument(),
    );
  });

  it("creates a Claude API profile with an explicit credential kind and no exposed secret reference", async () => {
    const created = profile({
      id: "profile-created",
      name: "Work",
      protocol: "anthropic-messages",
      config: { credentialEnvKey: "ANTHROPIC_API_KEY" },
    });
    window.api.agent.createProviderProfile = vi.fn().mockResolvedValue(created);

    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const dialog = await screen.findByRole("region", {
      name: "Add provider profile",
    });
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: " Work " },
    });
    fireEvent.change(within(dialog).getByLabelText("Provider kind"), {
      target: { value: "anthropic" },
    });
    fireEvent.change(within(dialog).getByLabelText("Primary model"), {
      target: { value: "claude-sonnet-4" },
    });
    fireEvent.change(within(dialog).getByLabelText("Credential (write-only)"), {
      target: { value: "new-secret" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "claude",
          name: "Work",
          providerKind: "anthropic",
          protocol: "anthropic-messages",
          endpoint: null,
          config: { credentialEnvKey: "ANTHROPIC_API_KEY" },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "claude-sonnet-4",
            parameters: {},
          },
        ],
        secret: "new-secret",
      }),
    );
    expect(
      vi.mocked(window.api.agent.createProviderProfile).mock.calls[0]?.[0],
    ).not.toHaveProperty("profile.secretRef");
  });

  it("creates a Gemini paid API profile with the verified protocol and credential contract", async () => {
    window.api.agent.listProviderProfiles = vi.fn().mockResolvedValue([]);
    window.api.agent.createProviderProfile = vi.fn().mockResolvedValue(
      profile({
        id: "profile-gemini",
        platformId: "gemini",
        name: "Gemini work",
        providerKind: "google-gemini",
        protocol: "google-generative-ai",
        config: { credentialEnvKey: "GEMINI_API_KEY" },
      }),
    );

    await renderWorkbench(createAgent("gemini"));
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const dialog = await screen.findByRole("region", {
      name: "Add provider profile",
    });
    expect(within(dialog).getByLabelText("Provider kind")).toHaveValue(
      "google-gemini",
    );
    expect(within(dialog).getByLabelText("Protocol")).toHaveValue(
      "google-generative-ai",
    );
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: " Gemini work " },
    });
    fireEvent.change(within(dialog).getByLabelText("Primary model"), {
      target: { value: " gemini-2.5-pro " },
    });
    fireEvent.change(within(dialog).getByLabelText("Endpoint (optional)"), {
      target: {
        value: " https://generativelanguage.googleapis.com ",
      },
    });
    fireEvent.change(within(dialog).getByLabelText("Credential (write-only)"), {
      target: { value: "gemini-secret" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "gemini",
          name: "Gemini work",
          providerKind: "google-gemini",
          protocol: "google-generative-ai",
          endpoint: "https://generativelanguage.googleapis.com",
          config: { credentialEnvKey: "GEMINI_API_KEY" },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "gemini-2.5-pro",
            parameters: {},
          },
        ],
        secret: "gemini-secret",
      }),
    );
  });

  it("clears a managed Gemini secret and records the native auth type when switching auth modes", async () => {
    const existing = profile({
      platformId: "gemini",
      providerKind: "google-gemini",
      protocol: "google-generative-ai",
      config: { credentialEnvKey: "GEMINI_API_KEY" },
      secretState: "available",
    });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([existing]);
    window.api.agent.updateProviderProfile = vi.fn().mockResolvedValue({
      ...existing,
      providerKind: "vertex-ai",
      protocol: "platform-native",
      config: { nativeAuthType: "vertex-ai" },
      secretState: "none",
    });

    await renderWorkbench(createAgent("gemini"));
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("region", {
      name: "Edit provider profile",
    });
    fireEvent.change(within(dialog).getByLabelText("Provider kind"), {
      target: { value: "vertex-ai" },
    });
    fireEvent.change(within(dialog).getByLabelText("Protocol"), {
      target: { value: "platform-native" },
    });
    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.updateProviderProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({
            providerKind: "vertex-ai",
            protocol: "platform-native",
            config: { nativeAuthType: "vertex-ai" },
          }),
          secretAction: "clear",
        }),
      ),
    );
  });

  it("creates a Kimi direct provider with native provider and model metadata", async () => {
    window.api.agent.listProviderProfiles = vi.fn().mockResolvedValue([]);
    window.api.agent.createProviderProfile = vi.fn().mockResolvedValue(
      profile({
        id: "profile-kimi",
        platformId: "kimi",
        name: "Kimi work",
        providerKind: "kimi",
        protocol: "openai-chat",
        config: { providerId: "work-kimi" },
      }),
    );

    await renderWorkbench(createAgent("kimi"));
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const dialog = await screen.findByRole("region", {
      name: "Add provider profile",
    });
    expect(within(dialog).getByLabelText("Provider kind")).toHaveValue("kimi");
    expect(within(dialog).getByLabelText("Protocol")).toHaveValue(
      "openai-chat",
    );
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: " Kimi work " },
    });
    fireEvent.change(within(dialog).getByLabelText("Provider ID"), {
      target: { value: " work-kimi " },
    });
    fireEvent.change(within(dialog).getByLabelText("Primary model"), {
      target: { value: " work/kimi-k2 " },
    });
    fireEvent.change(within(dialog).getByLabelText("Upstream model"), {
      target: { value: " kimi-k2 " },
    });
    fireEvent.change(within(dialog).getByLabelText("Maximum context size"), {
      target: { value: "131072" },
    });
    fireEvent.change(within(dialog).getByLabelText("Endpoint (optional)"), {
      target: { value: " https://api.moonshot.ai/v1 " },
    });
    fireEvent.change(within(dialog).getByLabelText("Credential (write-only)"), {
      target: { value: "kimi-secret" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "kimi",
          name: "Kimi work",
          providerKind: "kimi",
          protocol: "openai-chat",
          endpoint: "https://api.moonshot.ai/v1",
          config: { providerId: "work-kimi" },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "work/kimi-k2",
            parameters: {
              upstreamModelId: "kimi-k2",
              maxContextSize: 131_072,
            },
          },
        ],
        secret: "kimi-secret",
      }),
    );
  });

  it("creates a Qwen v4 direct provider with an explicit provider and environment key", async () => {
    window.api.agent.listProviderProfiles = vi.fn().mockResolvedValue([]);
    window.api.agent.createProviderProfile = vi.fn().mockResolvedValue(
      profile({
        id: "profile-qwen",
        platformId: "qwen",
        name: "Qwen work",
        providerKind: "openai",
        protocol: "openai-chat",
        config: {
          providerId: "team-dashscope",
          envKey: "DASHSCOPE_API_KEY",
        },
      }),
    );

    await renderWorkbench(createAgent("qwen"));
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const dialog = await screen.findByRole("region", {
      name: "Add provider profile",
    });
    expect(within(dialog).getByLabelText("Provider kind")).toHaveValue(
      "openai",
    );
    expect(within(dialog).getByLabelText("Protocol")).toHaveValue(
      "openai-chat",
    );
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: " Qwen work " },
    });
    fireEvent.change(within(dialog).getByLabelText("Provider ID"), {
      target: { value: " team-dashscope " },
    });
    fireEvent.change(within(dialog).getByLabelText("Environment variable"), {
      target: { value: " DASHSCOPE_API_KEY " },
    });
    fireEvent.change(within(dialog).getByLabelText("Primary model"), {
      target: { value: " qwen3.6-plus " },
    });
    fireEvent.change(within(dialog).getByLabelText("Endpoint"), {
      target: {
        value: " https://dashscope.aliyuncs.com/compatible-mode/v1 ",
      },
    });
    fireEvent.change(within(dialog).getByLabelText("Credential (write-only)"), {
      target: { value: "qwen-secret" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "qwen",
          name: "Qwen work",
          providerKind: "openai",
          protocol: "openai-chat",
          endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          config: {
            providerId: "team-dashscope",
            envKey: "DASHSCOPE_API_KEY",
          },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "qwen3.6-plus",
            parameters: {},
          },
        ],
        secret: "qwen-secret",
      }),
    );
  });

  it("validates required fields before creating a profile", async () => {
    window.api.agent.createProviderProfile = vi.fn();

    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const dialog = await screen.findByRole("region", {
      name: "Add provider profile",
    });
    fireEvent.change(within(dialog).getByLabelText("Provider kind"), {
      target: { value: " " },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    expect(within(dialog).getAllByText("This field is required.")).toHaveLength(
      3,
    );
    expect(window.api.agent.createProviderProfile).not.toHaveBeenCalled();
  });

  it("preserves imported config while editing profile fields and replacing the credential", async () => {
    const existing = profile({
      protocol: "anthropic-messages",
      endpoint: "https://old.example/v1",
      config: {
        region: "us-east-1",
        imported: true,
        credentialEnvKey: "ANTHROPIC_AUTH_TOKEN",
      },
      secretState: "available",
      modelMappings: [
        {
          id: "mapping-primary",
          providerProfileId: "profile-1",
          routeKey: "primary",
          modelId: "claude-sonnet-4",
          parameters: {},
        },
        {
          id: "mapping-secondary",
          providerProfileId: "profile-1",
          routeKey: "secondary",
          modelId: "claude-haiku-4",
          parameters: {},
        },
      ],
    });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([existing]);
    window.api.agent.updateProviderProfile = vi
      .fn()
      .mockResolvedValue({ ...existing, name: "Edited profile", updatedAt: 3 });

    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("region", {
      name: "Edit provider profile",
    });
    expect(
      within(dialog).queryByLabelText("Secondary model (optional)"),
    ).not.toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: " Edited profile " },
    });
    expect(within(dialog).getByLabelText("Credential type")).toHaveValue(
      "ANTHROPIC_AUTH_TOKEN",
    );
    fireEvent.change(within(dialog).getByLabelText("Endpoint (optional)"), {
      target: { value: " https://new.example/v1 " },
    });
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Replace credential" }),
    );
    fireEvent.change(within(dialog).getByLabelText("Credential (write-only)"), {
      target: { value: "replacement-secret" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.updateProviderProfile).toHaveBeenCalledWith({
        id: "profile-1",
        expectedUpdatedAt: 2,
        profile: {
          name: "Edited profile",
          providerKind: "anthropic",
          protocol: "anthropic-messages",
          endpoint: "https://new.example/v1",
          config: {
            region: "us-east-1",
            imported: true,
            credentialEnvKey: "ANTHROPIC_AUTH_TOKEN",
          },
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "claude-sonnet-4",
            parameters: {},
          },
        ],
        secretAction: "replace",
        secret: "replacement-secret",
      }),
    );
  });

  it("removes a managed Claude credential when switching to platform-native auth", async () => {
    const existing = profile({
      protocol: "anthropic-messages",
      config: { credentialEnvKey: "ANTHROPIC_API_KEY" },
      secretState: "available",
    });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([existing]);
    window.api.agent.updateProviderProfile = vi.fn().mockResolvedValue({
      ...existing,
      protocol: "platform-native",
      config: {},
      secretState: "none",
      updatedAt: 3,
    });

    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("region", {
      name: "Edit provider profile",
    });
    fireEvent.change(within(dialog).getByLabelText("Protocol"), {
      target: { value: "platform-native" },
    });
    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.updateProviderProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({
            protocol: "platform-native",
            config: {},
          }),
          secretAction: "clear",
        }),
      ),
    );
    expect(
      vi.mocked(window.api.agent.updateProviderProfile).mock.calls[0]?.[0],
    ).not.toHaveProperty("secret");
  });

  it("supports explicit credential clearing without returning the existing secret", async () => {
    const existing = profile({
      protocol: "anthropic-messages",
      config: { credentialEnvKey: "ANTHROPIC_API_KEY" },
      secretState: "missing",
    });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([existing]);
    window.api.agent.updateProviderProfile = vi
      .fn()
      .mockResolvedValue({ ...existing, secretState: "none", updatedAt: 3 });

    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("region", {
      name: "Edit provider profile",
    });
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Replace credential" }),
    );
    const credential = within(dialog).getByLabelText("Credential (write-only)");
    fireEvent.change(credential, { target: { value: "discard-me" } });
    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Remove credential" }),
    );
    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.updateProviderProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "profile-1",
          secretAction: "clear",
        }),
      ),
    );
    expect(
      vi.mocked(window.api.agent.updateProviderProfile).mock.calls[0]?.[0],
    ).not.toHaveProperty("secret");
  });

  it("preserves an absent credential and keeps the dialog open after a failed update", async () => {
    const existing = profile({ secretState: "none" });
    window.api.agent.listProviderProfiles = vi
      .fn()
      .mockResolvedValue([existing]);
    window.api.agent.updateProviderProfile = vi
      .fn()
      .mockRejectedValue(
        new Error("native details that must not reach the renderer"),
      );

    await renderWorkbench();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("region", {
      name: "Edit provider profile",
    });
    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(window.api.agent.updateProviderProfile).toHaveBeenCalledWith(
        expect.objectContaining({ secretAction: "preserve" }),
      ),
    );
    expect(
      await screen.findByRole("region", { name: "Edit provider profile" }),
    ).toBeVisible();
    expect(screen.getByText("Provider operation failed")).toBeVisible();
  });

  it("supports profile selection, duplication, export, archive, and confirmed deletion", async () => {
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
    window.api.agent.duplicateProviderProfile = vi.fn().mockResolvedValue(copy);
    window.api.agent.exportProviderProfile = vi.fn().mockResolvedValue({
      kind: "prompthub-agent-provider-profile",
      version: 1,
      exportedAt: 100,
      profile: copy,
    });
    window.api.agent.archiveProviderProfile = vi
      .fn()
      .mockResolvedValue({ ...copy, archived: true, updatedAt: 4 });
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

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    await waitFor(() =>
      expect(window.api.agent.duplicateProviderProfile).toHaveBeenCalledWith(
        "profile-second",
        "Second copy",
      ),
    );
    expect((await screen.findAllByText("Second copy")).length).toBeGreaterThan(
      0,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy export" }));
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('"kind": "prompthub-agent-provider-profile"'),
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Export copied" }),
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(window.api.agent.archiveProviderProfile).toHaveBeenCalledWith(
        "profile-copy",
        2,
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirmation = await screen.findByRole("alertdialog", {
      name: "Delete provider profile",
    });
    fireEvent.click(
      within(confirmation).getByRole("button", { name: "Delete" }),
    );
    await waitFor(() =>
      expect(window.api.agent.deleteProviderProfile).toHaveBeenCalledWith(
        "profile-first",
      ),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("alertdialog", {
          name: "Delete provider profile",
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
      fireEvent.click(screen.getByRole("button", { name: "Copy export" }));

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
