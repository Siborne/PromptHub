import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { primaryModelExample } from "../../../src/renderer/components/agent/AgentProviderFormSelect";
import {
  chooseProviderFormOption,
  createAgent,
  profile,
  renderWorkbench,
  resetProviderWorkbenchTestState,
} from "./agent-provider-profile-workbench.harness";

describe("AgentProviderProfileWorkbench inline editor", () => {
  beforeEach(() => {
    resetProviderWorkbenchTestState();
  });

  it("uses a generic model example for an unknown adapter", () => {
    expect(primaryModelExample("custom-agent")).toBe("model-id");
  });

  it("renders the right-pane editor as one layered white form surface", async () => {
    await renderWorkbench(createAgent("codex"));

    fireEvent.click(
      screen.getByRole("button", { name: "Add custom provider" }),
    );
    const editor = await screen.findByRole("region", {
      name: "Add provider",
    });
    const surface = within(editor).getByTestId("agent-provider-form-surface");
    const sections = within(surface).getAllByTestId(
      "agent-provider-form-section",
    );
    const fieldGroups = within(surface).getAllByTestId(
      "agent-provider-form-fields",
    );

    expect(editor).toHaveClass("bg-muted/30");
    expect(surface).toHaveClass("bg-card", "border", "shadow-sm");
    expect(sections).toHaveLength(4);
    expect(fieldGroups).toHaveLength(4);
    for (const fieldGroup of fieldGroups) {
      expect(fieldGroup).toHaveClass("grid-cols-1", "gap-5");
      expect(fieldGroup).not.toHaveClass("sm:grid-cols-2");
    }
    expect(sections[0]).toHaveClass("border-b", "p-5");
    expect(within(editor).getByLabelText("Name")).toHaveClass(
      "border-input",
      "bg-background",
      "rounded-md",
    );
    expect(within(editor).getByLabelText("Protocol")).toHaveClass(
      "border-input",
      "bg-background",
      "rounded-md",
      "w-full",
    );
    expect(editor.querySelector("select")).toBeNull();
    expect(within(editor).getByLabelText("Name")).toHaveAttribute(
      "placeholder",
      "e.g., My NewAPI",
    );
    expect(within(editor).getByLabelText("Provider ID")).toHaveAttribute(
      "placeholder",
      "e.g., deepseek",
    );
    expect(within(editor).getByLabelText("Endpoint")).toHaveAttribute(
      "placeholder",
      "https://your-api-endpoint.com/v1",
    );
    expect(within(editor).getByLabelText("Primary model")).toHaveAttribute(
      "placeholder",
      "e.g., gpt-5.6-sol",
    );
    expect(
      within(editor).getByLabelText("Credential (write-only)"),
    ).toHaveAttribute("placeholder", "Enter API key");

    fireEvent.click(
      within(editor).getByRole("button", {
        name: "Authentication source",
      }),
    );
    const listbox = await screen.findByRole("listbox", {
      name: "Authentication source",
    });
    expect(listbox).toHaveClass("rounded-md", "shadow-md");
    expect(listbox).not.toHaveClass("rounded-xl");
    expect(
      within(listbox).getByRole("option", {
        name: "PromptHub-managed credential",
      }),
    ).toHaveClass("bg-muted", "text-foreground");
  });

  it("stores the explicit Codex provider id from the right-pane editor", async () => {
    const created = profile({
      id: "profile-codex",
      platformId: "codex",
      name: "Codex work",
      providerKind: "openai-compatible",
      protocol: "openai-responses",
      endpoint: "https://gateway.example.com/v1",
      config: { providerId: "work-gateway" },
      secretState: "available",
      modelMappings: [
        {
          id: "mapping-codex",
          providerProfileId: "profile-codex",
          routeKey: "primary",
          modelId: "gpt-5.4",
          parameters: {},
        },
      ],
    });
    window.api.agent.createProviderProfile = vi.fn().mockResolvedValue(created);
    window.api.agent.previewProviderMigration = vi.fn().mockResolvedValue({
      agentId: "codex",
      nativeDigest: "empty",
      candidates: [],
    });

    await renderWorkbench(createAgent("codex"));
    fireEvent.click(
      screen.getByRole("button", { name: "Add custom provider" }),
    );
    const editor = await screen.findByRole("region", {
      name: "Add provider",
    });
    expect(
      screen.queryByRole("dialog", { name: "Add provider" }),
    ).not.toBeInTheDocument();
    expect(within(editor).getByText("Identity")).toBeVisible();
    expect(within(editor).getByText("Connection & protocol")).toBeVisible();
    expect(within(editor).getByText("Models")).toBeVisible();
    expect(within(editor).getByText("Authentication")).toBeVisible();
    expect(window.api.agent.createProviderProfile).not.toHaveBeenCalled();

    fireEvent.change(within(editor).getByLabelText("Name"), {
      target: { value: "Codex work" },
    });
    fireEvent.change(within(editor).getByLabelText("Provider kind"), {
      target: { value: "openai-compatible" },
    });
    fireEvent.change(within(editor).getByLabelText("Provider ID"), {
      target: { value: "work-gateway" },
    });
    fireEvent.change(within(editor).getByLabelText("Endpoint"), {
      target: { value: "https://gateway.example.com/v1" },
    });
    fireEvent.change(within(editor).getByLabelText("Primary model"), {
      target: { value: "gpt-5.4" },
    });
    chooseProviderFormOption(editor, "Reasoning effort (optional)", "High");
    fireEvent.change(
      within(editor).getByLabelText("Context window (optional)"),
      {
        target: { value: "262144" },
      },
    );
    fireEvent.change(within(editor).getByLabelText("Credential (write-only)"), {
      target: { value: "secret-token" },
    });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save provider" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "codex",
          name: "Codex work",
          providerKind: "openai-compatible",
          protocol: "openai-responses",
          endpoint: "https://gateway.example.com/v1",
          config: { providerId: "work-gateway" },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "gpt-5.4",
            parameters: {
              reasoningEffort: "high",
              contextWindow: 262144,
            },
          },
        ],
        secret: "secret-token",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Add provider" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByDisplayValue("secret-token")).not.toBeInTheDocument();
  });

  it("stores Claude Code native role model routes and omits blank routes", async () => {
    window.api.agent.createProviderProfile = vi.fn().mockResolvedValue(
      profile({
        id: "profile-claude-routes",
        name: "Claude gateway",
        providerKind: "anthropic-compatible",
        protocol: "anthropic-messages",
        endpoint: "https://gateway.example.com",
      }),
    );

    await renderWorkbench(createAgent("claude"));
    fireEvent.click(
      screen.getByRole("button", { name: "Add custom provider" }),
    );
    const editor = await screen.findByRole("region", {
      name: "Add provider",
    });

    fireEvent.change(within(editor).getByLabelText("Name"), {
      target: { value: "Claude gateway" },
    });
    fireEvent.change(within(editor).getByLabelText("Provider kind"), {
      target: { value: "anthropic-compatible" },
    });
    fireEvent.change(within(editor).getByLabelText("Endpoint (optional)"), {
      target: { value: "https://gateway.example.com" },
    });
    fireEvent.change(within(editor).getByLabelText("Primary model"), {
      target: { value: "claude-sonnet-4-6" },
    });
    fireEvent.change(within(editor).getByLabelText("Sonnet model (optional)"), {
      target: { value: "claude-sonnet-4-6" },
    });
    fireEvent.change(within(editor).getByLabelText("Opus model (optional)"), {
      target: { value: "claude-opus-4-6" },
    });
    fireEvent.change(within(editor).getByLabelText("Haiku model (optional)"), {
      target: { value: "" },
    });
    fireEvent.change(
      within(editor).getByLabelText("Subagent model (optional)"),
      { target: { value: "claude-haiku-4-5" } },
    );
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save provider" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "claude",
          name: "Claude gateway",
          providerKind: "anthropic-compatible",
          protocol: "anthropic-messages",
          endpoint: "https://gateway.example.com",
          config: { credentialEnvKey: "ANTHROPIC_API_KEY" },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "claude-sonnet-4-6",
            parameters: {},
          },
          {
            routeKey: "sonnet",
            modelId: "claude-sonnet-4-6",
            parameters: {},
          },
          {
            routeKey: "opus",
            modelId: "claude-opus-4-6",
            parameters: {},
          },
          {
            routeKey: "subagent",
            modelId: "claude-haiku-4-5",
            parameters: {},
          },
        ],
      }),
    );
  });

  it("discards an unsaved right-pane draft without creating a profile", async () => {
    await renderWorkbench(createAgent("codex"));

    fireEvent.click(
      screen.getByRole("button", { name: "Add custom provider" }),
    );
    const editor = await screen.findByRole("region", {
      name: "Add provider",
    });
    fireEvent.change(within(editor).getByLabelText("Name"), {
      target: { value: "Unsaved provider" },
    });
    fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));

    expect(window.api.agent.createProviderProfile).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "Add provider" }),
    ).not.toBeInTheDocument();
  });

  it("creates a Codex profile that uses an environment-owned credential", async () => {
    window.api.agent.createProviderProfile = vi
      .fn()
      .mockImplementation(async (request) =>
        profile({
          id: "profile-env",
          platformId: "codex",
          name: request.profile.name,
          providerKind: request.profile.providerKind,
          protocol: request.profile.protocol,
          endpoint: request.profile.endpoint,
          config: request.profile.config,
          modelMappings: request.modelMappings.map((mapping, index) => ({
            ...mapping,
            id: `mapping-env-${index}`,
            providerProfileId: "profile-env",
          })),
        }),
      );

    await renderWorkbench(createAgent("codex"));
    fireEvent.click(
      screen.getByRole("button", { name: "Add custom provider" }),
    );
    const editor = await screen.findByRole("region", {
      name: "Add provider",
    });
    fireEvent.change(within(editor).getByLabelText("Name"), {
      target: { value: "Environment gateway" },
    });
    fireEvent.change(within(editor).getByLabelText("Provider kind"), {
      target: { value: "openai-compatible" },
    });
    fireEvent.change(within(editor).getByLabelText("Provider ID"), {
      target: { value: "environment-gateway" },
    });
    fireEvent.change(within(editor).getByLabelText("Endpoint"), {
      target: { value: "https://gateway.example.com/v1" },
    });
    fireEvent.change(within(editor).getByLabelText("Primary model"), {
      target: { value: "gpt-5.4" },
    });
    fireEvent.change(within(editor).getByLabelText("Credential (write-only)"), {
      target: { value: "discarded-draft-secret" },
    });
    chooseProviderFormOption(
      editor,
      "Authentication source",
      "Environment variable",
    );
    fireEvent.change(within(editor).getByLabelText("Environment variable"), {
      target: { value: "1_INVALID_ENV_KEY" },
    });
    expect(
      within(editor).queryByLabelText("Credential (write-only)"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save provider" }),
    );
    expect(
      within(editor).getByText("Use a valid environment variable name."),
    ).toBeVisible();
    expect(window.api.agent.createProviderProfile).not.toHaveBeenCalled();

    chooseProviderFormOption(
      editor,
      "Authentication source",
      "PromptHub-managed credential",
    );
    expect(
      within(editor).getByLabelText("Credential (write-only)"),
    ).toHaveValue("");
    chooseProviderFormOption(
      editor,
      "Authentication source",
      "Environment variable",
    );
    fireEvent.change(within(editor).getByLabelText("Environment variable"), {
      target: { value: "OPENAI_API_KEY" },
    });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save provider" }),
    );

    await waitFor(() =>
      expect(window.api.agent.createProviderProfile).toHaveBeenCalledWith({
        profile: {
          platformId: "codex",
          name: "Environment gateway",
          providerKind: "openai-compatible",
          protocol: "openai-responses",
          endpoint: "https://gateway.example.com/v1",
          config: {
            providerId: "environment-gateway",
            envKey: "OPENAI_API_KEY",
          },
          source: "manual",
        },
        modelMappings: [
          { routeKey: "primary", modelId: "gpt-5.4", parameters: {} },
        ],
      }),
    );
  });
});
