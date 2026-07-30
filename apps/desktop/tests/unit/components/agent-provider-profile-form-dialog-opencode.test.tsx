import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AgentProviderProfilePublic } from "@prompthub/shared/types";
import { AgentProviderProfileFormDialog } from "../../../src/renderer/components/agent/AgentProviderProfileFormDialog";
import { renderWithI18n } from "../../helpers/i18n";

function renderDialog(profile: AgentProviderProfilePublic | null = null) {
  const onCreate = vi.fn().mockResolvedValue({ id: "created" });
  const onUpdate = vi.fn().mockResolvedValue({ id: "updated" });
  return {
    onCreate,
    onUpdate,
    render: renderWithI18n(
      <AgentProviderProfileFormDialog
        isOpen
        platformId="opencode"
        profile={profile}
        busy={false}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />,
    ),
  };
}

function managedProfile(
  secretState: AgentProviderProfilePublic["secretState"] = "available",
): AgentProviderProfilePublic {
  return {
    id: "managed-opencode",
    platformId: "opencode",
    name: "Team gateway",
    providerKind: "openai-compatible",
    protocol: "openai-chat",
    endpoint: "https://gateway.example/v1",
    config: {
      providerId: "team-gateway",
      package: "@ai-sdk/openai-compatible",
    },
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 2,
    secretState,
    modelMappings: [
      {
        id: "mapping-managed",
        providerProfileId: "managed-opencode",
        routeKey: "primary",
        modelId: "gpt-main",
        parameters: {},
      },
    ],
  };
}

describe("OpenCode Provider Profile form", () => {
  it("creates the documented OpenAI-compatible package contract", async () => {
    const view = renderDialog();
    await view.render;
    const dialog = screen.getByRole("dialog", {
      name: "Add provider profile",
    });

    expect(within(dialog).getByLabelText("Provider kind")).toHaveValue(
      "openai-compatible",
    );
    expect(within(dialog).getByLabelText("Protocol")).toHaveValue(
      "openai-chat",
    );
    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: { value: " Team gateway " },
    });
    fireEvent.change(within(dialog).getByLabelText("Provider ID"), {
      target: { value: " team-gateway " },
    });
    fireEvent.change(within(dialog).getByLabelText("Endpoint"), {
      target: { value: " https://gateway.example/v1 " },
    });
    fireEvent.change(within(dialog).getByLabelText("Primary model"), {
      target: { value: " gpt-main " },
    });
    fireEvent.change(
      within(dialog).getByLabelText("Secondary model (optional)"),
      { target: { value: " gpt-small " } },
    );
    fireEvent.change(within(dialog).getByLabelText("Credential (write-only)"), {
      target: { value: "main-only-secret" },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(view.onCreate).toHaveBeenCalledWith({
        profile: {
          platformId: "opencode",
          name: "Team gateway",
          providerKind: "openai-compatible",
          protocol: "openai-chat",
          endpoint: "https://gateway.example/v1",
          config: {
            providerId: "team-gateway",
            package: "@ai-sdk/openai-compatible",
          },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "gpt-main",
            parameters: {},
          },
          {
            routeKey: "secondary",
            modelId: "gpt-small",
            parameters: {},
          },
        ],
        secret: "main-only-secret",
      }),
    );
  });

  it("maps the official Responses package without asking users for npm details", async () => {
    const view = renderDialog();
    await view.render;
    const dialog = screen.getByRole("dialog", {
      name: "Add provider profile",
    });
    fireEvent.change(within(dialog).getByLabelText("Provider kind"), {
      target: { value: "openai" },
    });
    expect(within(dialog).getByLabelText("Protocol")).toHaveValue(
      "openai-responses",
    );

    for (const [label, value] of [
      ["Name", "Responses gateway"],
      ["Provider ID", "responses"],
      ["Endpoint", "https://responses.example/v1"],
      ["Primary model", "gpt-main"],
      ["Credential (write-only)", "responses-secret"],
    ]) {
      fireEvent.change(within(dialog).getByLabelText(label), {
        target: { value },
      });
    }
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(view.onCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          profile: expect.objectContaining({
            providerKind: "openai",
            protocol: "openai-responses",
            config: {
              providerId: "responses",
              package: "@ai-sdk/openai",
            },
          }),
        }),
      ),
    );
  });

  it("replaces a credential only after an explicit choice and reveals only the new draft", async () => {
    const view = renderDialog(managedProfile());
    await view.render;
    const dialog = screen.getByRole("dialog", {
      name: "Edit provider profile",
    });

    expect(
      within(dialog).getByRole("radio", {
        name: "Keep current credential",
      }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).toBeNull();
    expect(within(dialog).queryByText(/existing-secret/)).toBeNull();

    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Replace credential" }),
    );
    const credential = within(dialog).getByLabelText("Credential (write-only)");
    expect(credential).toHaveAttribute("type", "password");
    fireEvent.change(credential, { target: { value: "new-main-only-secret" } });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Show credential" }),
    );
    expect(credential).toHaveAttribute("type", "text");
    expect(credential).toHaveValue("new-main-only-secret");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Hide credential" }),
    );
    expect(credential).toHaveAttribute("type", "password");

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );
    await waitFor(() =>
      expect(view.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "managed-opencode",
          expectedUpdatedAt: 2,
          secretAction: "replace",
          secret: "new-main-only-secret",
        }),
      ),
    );
  });

  it("removes a managed credential without exposing or sending a secret value", async () => {
    const view = renderDialog(managedProfile());
    await view.render;
    const dialog = screen.getByRole("dialog", {
      name: "Edit provider profile",
    });

    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Remove credential" }),
    );
    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).toBeNull();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(view.onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "managed-opencode",
          secretAction: "clear",
        }),
      ),
    );
    expect(view.onUpdate.mock.calls[0]?.[0]).not.toHaveProperty("secret");
  });

  it("rejects an empty explicit credential replacement before IPC", async () => {
    const view = renderDialog(managedProfile("missing"));
    await view.render;
    const dialog = screen.getByRole("dialog", {
      name: "Edit provider profile",
    });

    fireEvent.click(
      within(dialog).getByRole("radio", { name: "Replace credential" }),
    );
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    expect(
      within(dialog).getByText("Enter a new credential to replace it."),
    ).toBeVisible();
    expect(view.onUpdate).not.toHaveBeenCalled();
  });

  it("keeps an imported native profile read-only and never exposes credentials", async () => {
    const imported: AgentProviderProfilePublic = {
      id: "native-xai",
      platformId: "opencode",
      name: "OpenCode xai",
      providerKind: "platform-native",
      protocol: "platform-native",
      endpoint: "https://api.x.ai/v1",
      config: {
        providerId: "xai",
        package: "@ai-sdk/xai",
        nativeAuthOwnership: "oauth",
      },
      source: "native-import",
      archived: false,
      createdAt: 1,
      updatedAt: 2,
      secretState: "none",
      modelMappings: [
        {
          id: "mapping-native",
          providerProfileId: "native-xai",
          routeKey: "primary",
          modelId: "grok-code",
          parameters: {},
        },
      ],
    };
    const view = renderDialog(imported);
    await view.render;
    const dialog = screen.getByRole("dialog", {
      name: "Edit provider profile",
    });

    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).toBeNull();
    expect(within(dialog).getByLabelText("Provider kind")).toBeDisabled();
    expect(within(dialog).getByLabelText("Provider ID")).toBeDisabled();
    expect(within(dialog).getByLabelText("Protocol")).toBeDisabled();
    expect(
      within(dialog).getByRole("button", { name: "Save profile" }),
    ).toBeDisabled();
    expect(view.onUpdate).not.toHaveBeenCalled();
  });
});
