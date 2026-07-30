import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AgentProviderMigrationPreview } from "@prompthub/shared";
import { AgentProviderMigrationNotice } from "../../../src/renderer/components/agent/AgentProviderMigrationNotice";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const preview: AgentProviderMigrationPreview = {
  agentId: "codex",
  nativeDigest: "digest-before-confirmation",
  candidates: [
    {
      providerId: "deepseek",
      name: "DeepSeek",
      baseUrl: "https://api.deepseek.com/v1",
      wireApi: "chat",
      envKey: null,
      credentialSource: "legacy-managed",
      credentialReady: true,
      isActive: true,
      profileModel: "deepseek-chat",
      alreadyMigrated: false,
    },
    {
      providerId: "groq",
      name: "Groq",
      baseUrl: "https://api.groq.com/openai/v1",
      wireApi: "responses",
      envKey: "GROQ_API_KEY",
      credentialSource: "environment",
      credentialReady: true,
      isActive: false,
      profileModel: null,
      alreadyMigrated: false,
    },
    {
      providerId: "done",
      name: "Already migrated",
      baseUrl: "https://example.com",
      wireApi: "chat",
      envKey: null,
      credentialSource: "none",
      credentialReady: false,
      isActive: false,
      profileModel: null,
      alreadyMigrated: true,
    },
  ],
};

describe("AgentProviderMigrationNotice", () => {
  beforeEach(() => {
    installWindowMocks();
  });

  it("requires an explicit provider selection before migrating", async () => {
    const migrate = vi.fn().mockResolvedValue({ profiles: [] });
    window.api.agent.previewProviderMigration = vi
      .fn()
      .mockResolvedValueOnce(preview)
      .mockResolvedValueOnce({ ...preview, candidates: [] });
    window.api.agent.migrateProviderProfiles = migrate;

    await renderWithI18n(<AgentProviderMigrationNotice />, {
      settleAsyncEffects: true,
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Review migration" }),
    );

    const submit = screen.getByRole("button", {
      name: "Migrate selected (0)",
    });
    expect(submit).toBeDisabled();
    expect(screen.queryByText("Already migrated")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /DeepSeek/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Migrate selected (1)" }),
    );

    await waitFor(() =>
      expect(migrate).toHaveBeenCalledWith({
        agentId: "codex",
        expectedNativeDigest: "digest-before-confirmation",
        providerIds: ["deepseek"],
      }),
    );
  });

  it("does not migrate when the user postpones the prompt", async () => {
    const migrate = vi.fn();
    window.api.agent.previewProviderMigration = vi
      .fn()
      .mockResolvedValue(preview);
    window.api.agent.migrateProviderProfiles = migrate;

    await renderWithI18n(<AgentProviderMigrationNotice />, {
      settleAsyncEffects: true,
    });
    fireEvent.click(await screen.findByRole("button", { name: "Later" }));

    expect(
      screen.queryByRole("button", { name: "Review migration" }),
    ).not.toBeInTheDocument();
    expect(migrate).not.toHaveBeenCalled();
  });

  it("shows only a generic failure and never renders credential material", async () => {
    window.api.agent.previewProviderMigration = vi
      .fn()
      .mockResolvedValue(preview);
    window.api.agent.migrateProviderProfiles = vi
      .fn()
      .mockRejectedValue(
        new Error("database failed with token=private-secret"),
      );

    const view = await renderWithI18n(<AgentProviderMigrationNotice />, {
      settleAsyncEffects: true,
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Review migration" }),
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /DeepSeek/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Migrate selected (1)" }),
    );

    expect(
      await screen.findByText(
        "Migration failed. Existing configuration and credentials were preserved. Try again.",
      ),
    ).toBeVisible();
    expect(view.container.textContent).not.toContain("private-secret");
    expect(view.container.textContent).not.toContain("codex-provider:");
  });

  it("handles preview failure without exposing an unusable action", async () => {
    window.api.agent.previewProviderMigration = vi
      .fn()
      .mockRejectedValue(new Error("token=private-secret"));

    const view = await renderWithI18n(<AgentProviderMigrationNotice />, {
      settleAsyncEffects: true,
    });

    expect(
      screen.queryByRole("button", { name: "Review migration" }),
    ).not.toBeInTheDocument();
    expect(view.container.textContent).not.toContain("private-secret");
  });

  it("supports deselection, missing credentials, and closing the review", async () => {
    window.api.agent.previewProviderMigration = vi.fn().mockResolvedValue({
      ...preview,
      candidates: [
        {
          ...preview.candidates[0]!,
          credentialReady: false,
          profileModel: null,
        },
      ],
    });

    await renderWithI18n(<AgentProviderMigrationNotice />, {
      settleAsyncEffects: true,
    });
    fireEvent.click(
      await screen.findByRole("button", { name: "Review migration" }),
    );
    const checkbox = screen.getByRole("checkbox", { name: /DeepSeek/ });
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(
      screen.getByRole("button", { name: "Migrate selected (0)" }),
    ).toBeDisabled();
    expect(
      screen.queryByLabelText("Credential ready to migrate"),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Migrate provider credentials" }),
      ).not.toBeInTheDocument(),
    );
  });
});
