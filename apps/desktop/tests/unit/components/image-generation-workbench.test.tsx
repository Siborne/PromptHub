import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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

const clipboard = vi.hoisted(() => ({
  writeText: vi.fn().mockResolvedValue(undefined),
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

Object.defineProperty(navigator, "clipboard", {
  value: clipboard,
  configurable: true,
});

function makeOutput(id: string, slotIndex: number, favorite = false) {
  return {
    id,
    slotIndex,
    fileName: `${id}.png`,
    mimeType: "image/png",
    byteSize: 20,
    sha256: "a".repeat(64),
    createdAt: "2026-07-15T08:00:00.000Z",
    favorite,
  };
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
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
      { index: 0, status: "succeeded", output: makeOutput("output-1", 0) },
      { index: 1, status: "succeeded", output: makeOutput("output-2", 1) },
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
    ...overrides,
  };
}

function emitBatches(batches: unknown[]) {
  act(() => runner.listeners.forEach((listener) => listener(batches)));
}

describe("ImageGenerationWorkbench", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    runner.listeners = [];
    runner.load.mockResolvedValue([]);
    runner.start.mockResolvedValue({ id: "batch-1" });
    runner.copyToPrompt.mockResolvedValue("copied-output.png");
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

  it("explains why generation is unavailable when no image model is configured", async () => {
    useSettingsStore.setState({ aiModels: [] });

    await renderWithI18n(<ImageGenerationWorkbench />);

    expect(
      screen.getByText("Please configure an image model in settings first"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate" })).toBeDisabled();
  });

  it("requires Prompt variables and submits the resolved snapshot without an Advanced toggle", async () => {
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
    expect(
      screen.queryByRole("button", { name: "Advanced" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("style")).toBeInTheDocument();
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

  it("renders the three-pane desktop layout with a permanent batch rail", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);

    const rail = screen.getByTestId("generation-batch-rail");
    const gallery = screen.getByTestId("generation-gallery");
    const config = screen.getByTestId("generation-config-panel");
    expect(rail).toHaveClass("w-64");
    expect(rail.compareDocumentPosition(gallery)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(gallery.compareDocumentPosition(config)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(gallery).toHaveClass("flex-1");
    expect(config).toHaveClass("w-[clamp(300px,32vw,352px)]");
    expect(within(rail).getByText("No batch yet")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Batch queue" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the batch rail permanent and switches the gallery from the rail", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    const batchA = makeBatch();
    const batchB = makeBatch({
      id: "batch-2",
      title: "Neon city",
      slots: [
        { index: 0, status: "succeeded", output: makeOutput("output-9", 0) },
      ],
      counts: {
        total: 1,
        pending: 0,
        running: 0,
        succeeded: 1,
        failed: 0,
        cancelled: 0,
        interrupted: 0,
      },
    });
    emitBatches([batchA, batchB]);

    const rail = screen.getByTestId("generation-batch-rail");
    expect(within(rail).getByText("Architecture poster")).toBeInTheDocument();
    expect(within(rail).getByText("Neon city")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(within(rail).getByRole("button", { name: /Neon city/ }));

    expect(
      screen.getByRole("button", { name: "Switch batch" }),
    ).toHaveTextContent("Neon city");
    expect(
      screen.getByRole("button", { name: "Generated image 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generated image 2" }),
    ).not.toBeInTheDocument();
  });

  it("resets the draft and expands the composer from the rail new-batch action", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse settings" }));
    expect(
      screen.queryByRole("heading", { name: "Generation settings" }),
    ).not.toBeInTheDocument();

    const rail = screen.getByTestId("generation-batch-rail");
    fireEvent.click(within(rail).getByRole("button", { name: "New batch" }));

    expect(
      screen.getByRole("heading", { name: "Generation settings" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("");
  });

  it("collapses the composer after a successful submit and restores it from the strip", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    expect(
      screen.getByRole("heading", { name: "Generation settings" }),
    ).toBeInTheDocument();

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "image-prompt-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() => expect(runner.start).toHaveBeenCalled());

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Expand settings" }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("heading", { name: "Generation settings" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("generation-config-panel")).toHaveClass("w-10");

    fireEvent.click(screen.getByRole("button", { name: "Expand settings" }));
    expect(
      screen.getByRole("heading", { name: "Generation settings" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("generation-config-panel")).toHaveClass(
      "w-[clamp(300px,32vw,352px)]",
    );
  });

  it("collapses and expands the composer manually", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse settings" }));
    expect(screen.getByTestId("generation-config-panel")).toHaveClass("w-10");
    expect(
      screen.queryByRole("heading", { name: "Generation settings" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand settings" }));
    expect(
      screen.getByRole("heading", { name: "Generation settings" }),
    ).toBeInTheDocument();
  });

  it("shows the current batch identity, a batch switcher, and live header progress", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    const running = makeBatch({
      id: "batch-run",
      title: "Running batch",
      status: "running",
      targetCount: 4,
      slots: [
        { index: 0, status: "succeeded", output: makeOutput("output-1", 0) },
        { index: 1, status: "running" },
        { index: 2, status: "pending" },
        { index: 3, status: "pending" },
      ],
      counts: {
        total: 4,
        pending: 2,
        running: 1,
        succeeded: 1,
        failed: 0,
        cancelled: 0,
        interrupted: 0,
      },
      completedAt: undefined,
    });
    const done = makeBatch({ id: "batch-2", title: "Neon city" });
    emitBatches([running, done]);

    const switcher = screen.getByRole("button", { name: "Switch batch" });
    expect(switcher).toHaveTextContent("Running batch");
    expect(switcher).toHaveTextContent("1/4");
    expect(
      screen.getByRole("progressbar", { name: "Batch progress" }),
    ).toHaveAttribute("aria-valuenow", "25");

    fireEvent.click(switcher);
    const listbox = screen.getByRole("listbox", { name: "Switch batch" });
    fireEvent.click(within(listbox).getByText("Neon city"));

    expect(
      screen.getByRole("button", { name: "Switch batch" }),
    ).toHaveTextContent("Neon city");
    expect(
      screen.queryByRole("progressbar", { name: "Batch progress" }),
    ).not.toBeInTheDocument();
  });

  it("opens the lightbox from a tile and navigates with arrow keys and Escape", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    emitBatches([makeBatch()]);

    fireEvent.click(screen.getByRole("button", { name: "Generated image 1" }));

    const dialog = screen.getByRole("dialog", { name: "Architecture poster" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    // Newest-first ordering places slot 2 before slot 1 in the visible sequence.
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: "Generated image 1" }),
    ).toHaveAttribute("src", expect.stringContaining("output-1.png"));

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: "Generated image 2" }),
    ).toHaveAttribute("src", expect.stringContaining("output-2.png"));

    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(within(dialog).getByText("2 / 2")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "ArrowLeft" });
    expect(within(dialog).getByText("1 / 2")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("runs favorite, copy-prompt, download, and attach actions from the lightbox", async () => {
    const updatePrompt = vi.fn().mockResolvedValue(undefined);
    usePromptStore.setState({ updatePrompt });
    const anchorClick = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    await renderWithI18n(<ImageGenerationWorkbench />);
    emitBatches([makeBatch({ sourcePromptId: "image-prompt-1" })]);

    fireEvent.click(screen.getByRole("button", { name: "Generated image 1" }));
    const dialog = screen.getByRole("dialog", { name: "Architecture poster" });

    fireEvent.click(within(dialog).getByRole("button", { name: "Favorite" }));
    await waitFor(() =>
      expect(runner.favorite).toHaveBeenCalledWith("batch-1", "output-1", true),
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Copy Prompt" }),
    );
    await waitFor(() =>
      expect(clipboard.writeText).toHaveBeenCalledWith(
        "Minimal white concrete house",
      ),
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Download" }));
    expect(anchorClick).toHaveBeenCalledTimes(1);

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Add to Prompt" }),
    );
    await waitFor(() =>
      expect(runner.copyToPrompt).toHaveBeenCalledWith("batch-1", "output-1"),
    );
    await waitFor(() =>
      expect(updatePrompt).toHaveBeenCalledWith("image-prompt-1", {
        images: ["copied-output.png"],
      }),
    );

    fireEvent.click(
      within(dialog).getByRole("button", { name: "Close viewer" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    anchorClick.mockRestore();
  });

  it("toggles selection via hover checkbox and Shift+click without a multi-select mode", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    emitBatches([makeBatch()]);

    expect(
      screen.queryByRole("checkbox", { name: "Multi-select" }),
    ).not.toBeInTheDocument();

    const firstCheckbox = screen.getByRole("checkbox", {
      name: "Select image 1",
    });
    expect(firstCheckbox).toHaveClass("group-hover:flex");
    expect(firstCheckbox).toHaveAttribute("aria-checked", "false");

    fireEvent.click(firstCheckbox);
    expect(firstCheckbox).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generated image 2" }), {
      shiftKey: true,
    });
    expect(screen.getByText("2 selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Generated image 1" }));
    expect(
      screen.getByRole("dialog", { name: "Architecture poster" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    fireEvent.click(screen.getByRole("checkbox", { name: "Select image 1" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("favorites every selected output from the bottom action bar", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    emitBatches([makeBatch()]);

    fireEvent.click(screen.getByRole("checkbox", { name: "Select image 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Generated image 2" }), {
      ctrlKey: true,
    });
    const actionBar = screen.getByText("2 selected").parentElement;
    expect(actionBar).not.toBeNull();
    fireEvent.click(
      within(actionBar as HTMLElement).getByRole("button", {
        name: "Favorite",
      }),
    );

    await waitFor(() => {
      expect(runner.favorite).toHaveBeenCalledWith("batch-1", "output-1", true);
      expect(runner.favorite).toHaveBeenCalledWith("batch-1", "output-2", true);
    });
  });

  it("switches gallery layouts and sort order", async () => {
    await renderWithI18n(<ImageGenerationWorkbench />);
    emitBatches([makeBatch()]);

    const compact = screen.getByRole("button", { name: "Compact grid" });
    const large = screen.getByRole("button", { name: "Large grid" });
    expect(compact).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(large);
    expect(large).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Latest first" }));
    expect(
      screen.getByRole("button", { name: "Oldest first" }),
    ).toBeInTheDocument();
  });
});
