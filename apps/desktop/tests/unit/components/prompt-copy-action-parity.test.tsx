import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Prompt } from "@prompthub/shared/types";

import { PromptDetailActionBar } from "../../../src/renderer/components/layout/PromptDetailActionBar";
import { PromptWorkspaceDetailProvider } from "../../../src/renderer/components/layout/PromptWorkspaceDetailContext";
import type { PromptWorkspaceDetailPaneProps } from "../../../src/renderer/components/layout/prompt-workspace-detail-types";
import { renderWithI18n } from "../../helpers/i18n";

vi.mock("../../../src/renderer/stores/prompt.store", () => ({
  usePromptStore: (selector: (state: object) => unknown) =>
    selector({ incrementUsageCount: vi.fn() }),
}));

vi.mock("../../../src/renderer/stores/settings.store", () => ({
  useSettingsStore: (selector: (state: object) => unknown) =>
    selector({ showCopyNotification: false }),
}));

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock(
  "../../../src/renderer/components/prompt/prompt-copy-utils",
  () => ({
    copyTextToClipboard: vi.fn(),
    hasUserDefinedPromptVariables: () => false,
  }),
);

const prompt: Prompt = {
  id: "source",
  title: "Source",
  description: "",
  systemPrompt: "",
  userPrompt: "Source body",
  variables: [],
  tags: [],
  folderId: null,
  parentId: null,
  order: 0,
  isFavorite: false,
  isPinned: false,
  version: 1,
  currentVersion: 1,
  usageCount: 0,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

describe("Prompt copy action parity", () => {
  it("routes the bottom Copy Prompt button through the workspace copy command", async () => {
    const handleCopyPrompt = vi.fn().mockResolvedValue(undefined);
    const value = {
      selectedPrompt: prompt,
      copied: false,
      isDetailInlineEditing: false,
      handleCopyPrompt,
      handleAiTest: vi.fn(),
      handleVersionHistory: vi.fn(),
      handleDeletePrompt: vi.fn(),
    } as unknown as PromptWorkspaceDetailPaneProps;

    await renderWithI18n(
      <PromptWorkspaceDetailProvider value={value}>
        <PromptDetailActionBar />
      </PromptWorkspaceDetailProvider>,
      { language: "en" },
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy Prompt" }));

    expect(handleCopyPrompt).toHaveBeenCalledWith(prompt);
  });
});
