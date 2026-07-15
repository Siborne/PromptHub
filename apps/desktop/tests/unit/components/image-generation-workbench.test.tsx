import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImageGenerationWorkbench } from "../../../src/renderer/components/prompt/ImageGenerationWorkbench";
import { usePromptStore } from "../../../src/renderer/stores/prompt.store";
import { useSettingsStore } from "../../../src/renderer/stores/settings.store";
import { renderWithI18n } from "../../helpers/i18n";

const runner = vi.hoisted(() => ({
  load: vi.fn().mockResolvedValue([]),
  start: vi.fn(),
  cancel: vi.fn(),
  favorite: vi.fn(),
  retry: vi.fn(),
  copyToPrompt: vi.fn(),
  listeners: [] as Array<(batches: unknown[]) => void>,
}));

vi.mock("../../../src/renderer/services/generation-workbench-runner", () => ({
  loadGenerationBatches: runner.load,
  startGenerationBatch: runner.start,
  cancelGenerationBatch: runner.cancel,
  setGenerationOutputFavorite: runner.favorite,
  retryGenerationBatch: runner.retry,
  copyGenerationOutputToPromptMedia: runner.copyToPrompt,
  supportsGenerationReferenceImages: (model: { provider?: string }) =>
    model.provider === "google",
  getSupportedGenerationAspectRatios: () => ["1:1", "4:5", "16:9", "9:16"],
  subscribeGenerationBatches: (listener: (batches: unknown[]) => void) => {
    runner.listeners.push(listener);
    return () => {
      runner.listeners = runner.listeners.filter((item) => item !== listener);
    };
  },
}));

vi.mock("../../../src/renderer/components/ui/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe("ImageGenerationWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runner.listeners = [];
    usePromptStore.setState({
      prompts: [
        {
          id: "image-prompt-1",
          title: "Architecture poster",
          promptType: "image",
          userPrompt: "Minimal white concrete house",
          variables: [],
          tags: [],
          isFavorite: false,
          isPinned: false,
          version: 2,
          currentVersion: 2,
          usageCount: 0,
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-01T00:00:00.000Z",
        },
      ],
    });
    useSettingsStore.setState({
      aiModels: [
        {
          id: "image-model-1",
          type: "image",
          provider: "openai",
          apiProtocol: "openai",
          apiKey: "test-key",
          apiUrl: "https://example.com/v1",
          model: "gpt-image-1",
        },
      ],
    });
    runner.start.mockResolvedValue({ id: "batch-1" });
  });

  it("prefills an image Prompt and submits a bounded local batch", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "image-prompt-1" },
    });
    expect(screen.getByRole("textbox")).toHaveValue(
      "Minimal white concrete house",
    );
    fireEvent.change(screen.getByLabelText("Image count"), {
      target: { value: "12" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(runner.start).toHaveBeenCalledTimes(1));
    expect(runner.start.mock.calls[0][0]).toMatchObject({
      title: "Architecture poster",
      sourcePromptId: "image-prompt-1",
      sourcePromptVersion: 2,
      prompt: "Minimal white concrete house",
      targetCount: 12,
    });
  });

  it("submits visible Prompt references only with a compatible model", async () => {
    usePromptStore.setState({
      prompts: [
        {
          ...usePromptStore.getState().prompts[0],
          images: ["reference.webp"],
        },
      ],
    });
    useSettingsStore.setState({
      aiModels: [
        {
          ...useSettingsStore.getState().aiModels[0],
          provider: "google",
          apiProtocol: "gemini",
          model: "gemini-2.5-flash-image",
        },
      ],
    });
    await renderWithI18n(<ImageGenerationWorkbench />);

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "image-prompt-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(runner.start).toHaveBeenCalled());
    expect(runner.start.mock.calls[0][0]).toMatchObject({
      referenceImages: [{ source: "prompt", fileName: "reference.webp" }],
    });
  });

  it("keeps generation disabled for invalid counts", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Poster" },
    });
    fireEvent.change(screen.getByLabelText("Image count"), {
      target: { value: "101" },
    });
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("uses intrinsic wrapping instead of overflowing the narrowed workbench", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);

    expect(screen.getByTestId("generation-config")).toHaveStyle({
      gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
    });
    expect(screen.getByTestId("generation-gallery-toolbar")).toHaveClass(
      "flex-wrap",
    );
    expect(screen.getByTestId("generation-gallery-toolbar")).not.toHaveClass(
      "overflow-x-auto",
    );
    expect(screen.getByRole("button", { name: "Generate" })).toHaveClass(
      "whitespace-nowrap",
    );
  });

  it("requires Prompt variables and submits the resolved snapshot", async () => {
    usePromptStore.setState({
      prompts: [
        {
          ...usePromptStore.getState().prompts[0],
          userPrompt: "A {{style}} poster for {{subject:PromptHub}}",
          variables: [
            { name: "style", type: "text", required: true },
            { name: "subject", type: "text", required: false },
          ],
        },
      ],
    });
    await renderWithI18n(<ImageGenerationWorkbench />);

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "image-prompt-1" },
    });
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("style"), {
      target: { value: "Swiss" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    await waitFor(() => expect(runner.start).toHaveBeenCalled());
    expect(runner.start.mock.calls[0][0]).toMatchObject({
      prompt: "A Swiss poster for PromptHub",
      variableValues: { style: "Swiss", subject: "" },
    });
  });

  it("switches gallery layouts, sort order, and multi-selects outputs", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    const batch = {
      kind: "prompthub-generation-batch",
      version: 1,
      id: "batch-1",
      title: "Architecture poster",
      status: "succeeded",
      resolvedPrompt: "Minimal white concrete house",
      model: {
        id: "image-model-1",
        provider: "openai",
        model: "gpt-image-1",
      },
      parameters: { aspectRatio: "4:5" },
      targetCount: 2,
      slots: [
        {
          index: 0,
          status: "succeeded",
          output: {
            id: "output-1",
            slotIndex: 0,
            fileName: "1.png",
            mimeType: "image/png",
            byteSize: 20,
            sha256: "a".repeat(64),
            createdAt: "2026-07-15T08:00:00.000Z",
            favorite: false,
          },
        },
        {
          index: 1,
          status: "succeeded",
          output: {
            id: "output-2",
            slotIndex: 1,
            fileName: "2.png",
            mimeType: "image/png",
            byteSize: 20,
            sha256: "b".repeat(64),
            createdAt: "2026-07-15T08:01:00.000Z",
            favorite: false,
          },
        },
      ],
      counts: {
        total: 2,
        pending: 0,
        running: 0,
        succeeded: 2,
        failed: 0,
        cancelled: 0,
        interrupted: 0,
      },
      createdAt: "2026-07-15T08:00:00.000Z",
      updatedAt: "2026-07-15T08:01:00.000Z",
      completedAt: "2026-07-15T08:01:00.000Z",
    };

    act(() => runner.listeners.forEach((listener) => listener([batch])));

    const compact = screen.getByRole("button", { name: "Compact grid" });
    const large = screen.getByRole("button", { name: "Large grid" });
    expect(compact).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(large);
    expect(large).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Latest first" }));
    expect(
      screen.getByRole("button", { name: "Oldest first" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Multi-select" }));
    fireEvent.click(screen.getByRole("button", { name: "Generated image 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Generated image 2" }));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });
});
