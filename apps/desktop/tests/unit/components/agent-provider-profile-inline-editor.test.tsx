import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAgent,
  profile,
  renderWorkbench,
  resetProviderWorkbenchTestState,
} from "./agent-provider-profile-workbench.harness";

describe("AgentProviderProfileWorkbench inline editor", () => {
  beforeEach(() => {
    resetProviderWorkbenchTestState();
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
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const editor = await screen.findByRole("region", {
      name: "Add provider profile",
    });
    expect(
      screen.queryByRole("dialog", { name: "Add provider profile" }),
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
    fireEvent.change(within(editor).getByLabelText("Credential (write-only)"), {
      target: { value: "secret-token" },
    });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save profile" }),
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
          { routeKey: "primary", modelId: "gpt-5.4", parameters: {} },
        ],
        secret: "secret-token",
      }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("region", { name: "Add provider profile" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.queryByDisplayValue("secret-token")).not.toBeInTheDocument();
  });

  it("discards an unsaved right-pane draft without creating a profile", async () => {
    await renderWorkbench(createAgent("codex"));

    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const editor = await screen.findByRole("region", {
      name: "Add provider profile",
    });
    fireEvent.change(within(editor).getByLabelText("Name"), {
      target: { value: "Unsaved provider" },
    });
    fireEvent.click(within(editor).getByRole("button", { name: "Cancel" }));

    expect(window.api.agent.createProviderProfile).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("region", { name: "Add provider profile" }),
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
    fireEvent.click(screen.getByRole("button", { name: "Add profile" }));
    const editor = await screen.findByRole("region", {
      name: "Add provider profile",
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
    fireEvent.change(within(editor).getByLabelText("Authentication source"), {
      target: { value: "environment" },
    });
    fireEvent.change(within(editor).getByLabelText("Environment variable"), {
      target: { value: "1_INVALID_ENV_KEY" },
    });
    expect(
      within(editor).queryByLabelText("Credential (write-only)"),
    ).not.toBeInTheDocument();
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save profile" }),
    );
    expect(
      within(editor).getByText("Use a valid environment variable name."),
    ).toBeVisible();
    expect(window.api.agent.createProviderProfile).not.toHaveBeenCalled();

    fireEvent.change(within(editor).getByLabelText("Authentication source"), {
      target: { value: "managed" },
    });
    expect(
      within(editor).getByLabelText("Credential (write-only)"),
    ).toHaveValue("");
    fireEvent.change(within(editor).getByLabelText("Authentication source"), {
      target: { value: "environment" },
    });
    fireEvent.change(within(editor).getByLabelText("Environment variable"), {
      target: { value: "OPENAI_API_KEY" },
    });
    fireEvent.click(
      within(editor).getByRole("button", { name: "Save profile" }),
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
