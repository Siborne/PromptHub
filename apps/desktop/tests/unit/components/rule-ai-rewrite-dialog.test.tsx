import userEvent from "@testing-library/user-event";
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getRuleProviderDefaultModelId,
  getRuleRewriteErrorMessage,
  RuleAiRewriteDialog,
} from "../../../src/renderer/components/rules/RuleAiRewriteDialog";
import { useRulesStore } from "../../../src/renderer/stores/rules.store";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

const showToast = vi.fn();

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast }),
}));

describe("RuleAiRewriteDialog", () => {
  beforeEach(() => {
    showToast.mockReset();
    useRulesStore.setState({
      currentFile: {
        id: "claude-global",
        platformId: "claude",
        platformName: "Claude Code",
        platformIcon: "claude",
        platformDescription: "Claude rules",
        name: "CLAUDE.md",
        description: "Claude rules",
        path: "/Users/test/.claude/CLAUDE.md",
        exists: true,
        group: "assistant",
        content: "# Rules",
        versions: [],
      },
      selectedRuleId: "claude-global",
      draftContent: "# Rules",
      aiInstruction: "",
      isRewriting: false,
      error: null,
    });
    useSettingsStore.setState({
      aiProvider: "",
      aiApiProtocol: "openai",
      aiApiKey: "",
      aiApiUrl: "",
      aiModel: "",
      aiProviders: [
        {
          id: "openai-endpoint",
          name: "OpenAI Team",
          provider: "openai",
          apiProtocol: "openai",
          apiKey: "openai-secret",
          apiUrl: "https://api.openai.com/v1",
        },
        {
          id: "anthropic-endpoint",
          name: "Anthropic Custom",
          provider: "anthropic",
          apiProtocol: "anthropic",
          apiKey: "anthropic-secret",
          apiUrl: "https://anthropic.example/v1",
        },
      ],
      aiModels: [
        {
          id: "openai-chat",
          type: "chat",
          name: "GPT Primary",
          providerId: "openai-endpoint",
          provider: "openai",
          apiProtocol: "openai",
          apiKey: "openai-secret",
          apiUrl: "https://api.openai.com/v1",
          model: "gpt-5-mini",
          isDefault: true,
        },
        {
          id: "openai-unnamed-chat",
          type: "chat",
          providerId: "openai-endpoint",
          provider: "openai",
          apiProtocol: "openai",
          apiKey: "openai-secret",
          apiUrl: "https://api.openai.com/v1",
          model: "gpt-5-nano",
        },
        {
          id: "anthropic-chat",
          type: "chat",
          name: "Claude Review",
          providerId: "anthropic-endpoint",
          provider: "anthropic",
          apiProtocol: "anthropic",
          apiKey: "anthropic-secret",
          apiUrl: "https://anthropic.example/v1",
          model: "claude-sonnet-4",
        },
        {
          id: "anthropic-image",
          type: "image",
          name: "Image only",
          providerId: "anthropic-endpoint",
          provider: "anthropic",
          apiProtocol: "anthropic",
          apiKey: "anthropic-secret",
          apiUrl: "https://anthropic.example/v1",
          model: "image-model",
        },
      ],
    });
  });

  it("uses the explicitly selected provider and chat model without changing defaults", async () => {
    const user = userEvent.setup();
    const rewrite = vi.fn().mockResolvedValue({
      content: "# Improved rules",
      summary: "Updated",
    });
    installWindowMocks({
      api: { rules: { rewrite } },
    });
    const onClose = vi.fn();

    await act(async () => {
      await renderWithI18n(
        <RuleAiRewriteDialog isOpen={true} onClose={onClose} />,
        { language: "en" },
      );
    });

    const dialog = await screen.findByRole("dialog", {
      name: /Ask AI to improve/i,
    });
    await user.click(
      within(dialog).getByRole("button", { name: "AI provider" }),
    );
    await user.click(screen.getByRole("option", { name: "Anthropic Custom" }));

    expect(
      within(dialog).getByRole("button", { name: "AI model" }),
    ).toHaveTextContent("Claude Review");
    expect(screen.queryByText("Image only")).not.toBeInTheDocument();

    await user.type(
      within(dialog).getByRole("textbox", { name: /Ask AI to improve/i }),
      "Strengthen rollback requirements",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Improve with AI" }),
    );

    await waitFor(() => {
      expect(rewrite).toHaveBeenCalledWith(
        expect.objectContaining({
          instruction: "Strengthen rollback requirements",
          aiConfig: {
            apiKey: "anthropic-secret",
            apiUrl: "https://anthropic.example/v1",
            model: "claude-sonnet-4",
            provider: "anthropic",
            apiProtocol: "anthropic",
          },
        }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(
      useSettingsStore.getState().aiModels.find((model) => model.isDefault)?.id,
    ).toBe("openai-chat");
  });

  it("keeps the dialog open when no configured chat model is available", async () => {
    const user = userEvent.setup();
    installWindowMocks();
    useSettingsStore.setState({
      aiProviders: [],
      aiModels: [],
      aiProvider: "",
      aiApiKey: "",
      aiApiUrl: "",
      aiModel: "",
    });
    const onClose = vi.fn();

    await act(async () => {
      await renderWithI18n(
        <RuleAiRewriteDialog isOpen={true} onClose={onClose} />,
        { language: "en" },
      );
    });

    const dialog = await screen.findByRole("dialog", {
      name: /Ask AI to improve/i,
    });
    expect(within(dialog).getByText("No chat model configured")).toBeVisible();
    expect(
      within(dialog).getByRole("button", { name: "Improve with AI" }),
    ).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("maps stable model errors and provider defaults without exposing credentials", () => {
    const translate = ((_: string, fallback: string) => fallback) as Parameters<
      typeof getRuleRewriteErrorMessage
    >[1];
    const choices = [
      {
        providerId: "provider-a",
        providerLabel: "Provider A",
        model: {
          id: "first",
          type: "chat" as const,
          provider: "openai",
          apiProtocol: "openai" as const,
          apiKey: "secret",
          apiUrl: "https://example.test/v1",
          model: "first-model",
        },
      },
      {
        providerId: "provider-a",
        providerLabel: "Provider A",
        model: {
          id: "default",
          type: "chat" as const,
          provider: "openai",
          apiProtocol: "openai" as const,
          apiKey: "secret",
          apiUrl: "https://example.test/v1",
          model: "default-model",
          isDefault: true,
        },
      },
    ];

    expect(
      getRuleRewriteErrorMessage(
        new Error("RULE_AI_MODEL_UNAVAILABLE"),
        translate,
      ),
    ).toBe("No chat model configured");
    expect(
      getRuleRewriteErrorMessage(
        new Error("RULE_AI_MODEL_INCOMPLETE"),
        translate,
      ),
    ).toBe("The selected model configuration is incomplete.");
    expect(
      getRuleRewriteErrorMessage(new Error("Network failed"), translate),
    ).toBe("Network failed");
    expect(getRuleRewriteErrorMessage("Unknown failure", translate)).toBe(
      "AI rewrite failed",
    );
    expect(getRuleProviderDefaultModelId(choices, "provider-a")).toBe(
      "default",
    );
    expect(
      getRuleProviderDefaultModelId(
        choices.map((choice) => ({
          ...choice,
          model: { ...choice.model, isDefault: false },
        })),
        "provider-a",
      ),
    ).toBe("first");
    expect(getRuleProviderDefaultModelId(choices, "missing")).toBe("");
  });
});
