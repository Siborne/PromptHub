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
        platformId="grok"
        profile={profile}
        busy={false}
        onClose={vi.fn()}
        onCreate={onCreate}
        onUpdate={onUpdate}
      />,
    ),
  };
}

describe("Grok Build Provider Profile form", () => {
  it("rejects credential-bearing endpoints before submitting", async () => {
    const view = renderDialog();
    await view.render;
    const dialog = screen.getByRole("dialog", {
      name: "Add provider profile",
    });

    for (const [label, value] of [
      ["Name", "Unsafe Grok"],
      ["Provider ID", "unsafe-grok"],
      ["Environment variable", "XAI_API_KEY"],
      ["Endpoint", "https://user:secret-token@example.com/v1"],
      ["Primary model", "grok"],
      ["Upstream model", "grok-4"],
      ["Maximum context size", "131072"],
    ]) {
      fireEvent.change(within(dialog).getByLabelText(label), {
        target: { value },
      });
    }
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    expect(
      within(dialog).getByText(
        "Use an HTTP(S) endpoint without embedded credentials or fragments.",
      ),
    ).toBeVisible();
    expect(view.onCreate).not.toHaveBeenCalled();
  });

  it("creates an environment-owned profile without a managed credential", async () => {
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
    expect(
      within(dialog).queryByLabelText("Credential (write-only)"),
    ).toBeNull();

    for (const [label, value] of [
      ["Name", "Team Grok"],
      ["Provider ID", "team-grok"],
      ["Environment variable", "TEAM_GROK_KEY"],
      ["Endpoint", "https://provider.example/v1"],
      ["Primary model", "team-grok"],
      ["Upstream model", "grok-4"],
      ["Maximum context size", "131072"],
    ]) {
      fireEvent.change(within(dialog).getByLabelText(label), {
        target: { value },
      });
    }
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Save profile" }),
    );

    await waitFor(() =>
      expect(view.onCreate).toHaveBeenCalledWith({
        profile: {
          platformId: "grok",
          name: "Team Grok",
          providerKind: "openai-compatible",
          protocol: "openai-chat",
          endpoint: "https://provider.example/v1",
          config: {
            providerId: "team-grok",
            envKey: "TEAM_GROK_KEY",
          },
          source: "manual",
        },
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "team-grok",
            parameters: {
              upstreamModelId: "grok-4",
              contextWindow: 131_072,
            },
          },
        ],
      }),
    );
  });

  it("keeps a native inline-auth import read-only", async () => {
    const imported: AgentProviderProfilePublic = {
      id: "native-grok",
      platformId: "grok",
      name: "Native Grok",
      providerKind: "grok",
      protocol: "platform-native",
      endpoint: "https://provider.example/v1",
      config: {
        providerId: "native-grok",
        nativeAuthOwnership: "native-inline",
      },
      source: "native-import",
      archived: false,
      createdAt: 1,
      updatedAt: 2,
      secretState: "none",
      modelMappings: [
        {
          id: "mapping-native",
          providerProfileId: "native-grok",
          routeKey: "primary",
          modelId: "native-grok",
          parameters: {
            upstreamModelId: "grok-4",
            contextWindow: 131_072,
          },
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
    expect(
      within(dialog).getByRole("button", { name: "Save profile" }),
    ).toBeDisabled();
    expect(view.onUpdate).not.toHaveBeenCalled();
  });
});
