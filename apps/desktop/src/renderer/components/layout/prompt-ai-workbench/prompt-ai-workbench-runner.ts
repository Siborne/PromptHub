import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { flushSync } from "react-dom";
import type { TFunction } from "i18next";
import type { PromptSummary } from "@prompthub/shared/types";
import type {
  AIConfig,
  AITestResult,
  StreamCallbacks,
} from "../../../services/ai";
import type {
  OutputFormatConfig,
  VariableInputImageAttachment,
} from "../../prompt/VariableInputModal";
import type { usePromptStore } from "../../../stores/prompt.store";
import type { useToast } from "../../ui/Toast";
import type { PromptAiTestState } from "./prompt-ai-workbench-state";

type PromptStoreState = ReturnType<typeof usePromptStore.getState>;
type Toast = ReturnType<typeof useToast>["showToast"];
type PromptAiConfig = Pick<
  AIConfig,
  | "id"
  | "provider"
  | "apiProtocol"
  | "apiKey"
  | "apiUrl"
  | "model"
  | "chatParams"
  | "imageParams"
>;
type CompareBuffer = Record<
  string,
  { response: string; thinkingContent: string }
>;

let aiServicePromise: Promise<typeof import("../../../services/ai")> | null =
  null;

function loadAIService() {
  aiServicePromise ??= import("../../../services/ai");
  return aiServicePromise;
}

interface PromptAiRunnerInput {
  prompts: PromptSummary[];
  selectedId: string | null;
  inlineAiTestImages: VariableInputImageAttachment[];
  singleChatConfig: PromptAiConfig;
  defaultImageModel: PromptAiConfig | null;
  compareModels: PromptAiConfig[];
  selectedModelIds: string[];
  canRunSingleAiTest: boolean;
  t: TFunction;
  showToast: Toast;
  incrementUsageCount: PromptStoreState["incrementUsageCount"];
  updatePrompt: PromptStoreState["updatePrompt"];
  flags: {
    setIsTestingAI: (value: boolean) => void;
    setIsComparingModels: (value: boolean) => void;
  };
  response: {
    setAiResponse: (
      value: string | null | ((previous: string | null) => string | null),
    ) => void;
    setAiThinking: (
      value: string | null | ((previous: string | null) => string | null),
    ) => void;
    setIsAiResponseImage: (value: boolean) => void;
  };
  comparison: {
    setCompareResults: (
      value:
        | AITestResult[]
        | null
        | ((previous: AITestResult[] | null) => AITestResult[] | null),
    ) => void;
    setCompareError: (value: string | null) => void;
  };
  selection: {
    setIsAiTestVariableModalOpen: (value: boolean) => void;
    setIsCompareVariableModalOpen: (value: boolean) => void;
  };
  streaming: {
    setStreamingContent: (value: string) => void;
    setStreamingThinking: (value: string) => void;
    setIsStreaming: (value: boolean) => void;
  };
}

function createComparisonBuffers(configs: PromptAiConfig[]) {
  return Object.fromEntries(
    configs.map((config) => [
      config.id ?? "",
      { response: "", thinkingContent: "" },
    ]),
  );
}

function createComparePlaceholders(configs: PromptAiConfig[]): AITestResult[] {
  return configs.map((config) => ({
    id: config.id,
    success: true,
    response: "",
    thinkingContent: "",
    latency: 0,
    model: config.model,
    provider: config.provider,
  }));
}

function getImageDisplayUrl(result: {
  data: { url?: string; b64_json?: string }[];
}) {
  const image = result.data[0];
  if (!image?.url && !image?.b64_json) return null;
  return {
    imageUrl: image.url,
    imageBase64: image.b64_json,
    displayUrl: image.url ?? `data:image/png;base64,${image.b64_json}`,
  };
}

async function saveGeneratedPromptImage(
  imageUrl: string | undefined,
  imageBase64: string | undefined,
  prompt: PromptSummary,
  updatePrompt: PromptStoreState["updatePrompt"],
) {
  const savedFileName = imageUrl
    ? await (window.electron as any).downloadImage(imageUrl)
    : imageBase64
      ? await saveGeneratedImageBase64(imageBase64)
      : null;
  if (savedFileName)
    await updatePrompt(prompt.id, {
      images: [...(prompt.images || []), savedFileName],
    });
  return Boolean(savedFileName);
}

async function saveGeneratedImageBase64(imageBase64: string) {
  const fileName = `ai-generated-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const saved = await (window.electron as any).saveImageBase64(
    fileName,
    imageBase64,
  );
  return saved ? fileName : null;
}

function createStreamCallbacks(
  input: Pick<PromptAiRunnerInput, "streaming" | "response">,
) {
  const content = { current: "" };
  const thinking = { current: "" };
  const scheduler = createStreamScheduler(input.streaming, content, thinking);
  const callbacks: StreamCallbacks = {
    onContent: (chunk) => {
      content.current += chunk;
      scheduler.scheduleContent();
    },
    onThinking: (chunk) => {
      thinking.current += chunk;
      scheduler.scheduleThinking();
    },
    onComplete: (fullContent, thinkingContent) => {
      scheduler.cancel();
      input.streaming.setIsStreaming(false);
      input.response.setAiResponse(fullContent);
      if (thinkingContent) input.response.setAiThinking(thinkingContent);
    },
  };
  return { callbacks, content, thinking };
}

function createStreamScheduler(
  streaming: PromptAiRunnerInput["streaming"],
  content: { current: string },
  thinking: { current: string },
) {
  let contentFrame: number | null = null;
  let thinkingFrame: number | null = null;
  const flush = (kind: "content" | "thinking") =>
    flushSync(() =>
      kind === "content"
        ? streaming.setStreamingContent(content.current)
        : streaming.setStreamingThinking(thinking.current),
    );
  const schedule = (kind: "content" | "thinking") => {
    const frame = kind === "content" ? contentFrame : thinkingFrame;
    if (frame !== null) return;
    const nextFrame = requestAnimationFrame(() => {
      kind === "content" ? (contentFrame = null) : (thinkingFrame = null);
      flush(kind);
    });
    kind === "content"
      ? (contentFrame = nextFrame)
      : (thinkingFrame = nextFrame);
  };
  return {
    scheduleContent: () => schedule("content"),
    scheduleThinking: () => schedule("thinking"),
    cancel: () => {
      if (contentFrame !== null) cancelAnimationFrame(contentFrame);
      if (thinkingFrame !== null) cancelAnimationFrame(thinkingFrame);
      contentFrame = null;
      thinkingFrame = null;
    },
  };
}

async function runImagePromptTest(
  input: PromptAiRunnerInput,
  currentPrompt: PromptSummary | undefined,
  targetId: string | null | undefined,
  userPrompt: string,
) {
  if (!input.defaultImageModel)
    throw new Error(
      input.t("prompt.mismatchImage") ||
        "Prompt type is Image but no Image Model configured",
    );
  const { generateImage } = await loadAIService();
  const result = await generateImage(
    input.defaultImageModel as AIConfig,
    userPrompt,
  );
  const display = getImageDisplayUrl(result);
  if (!display) return;
  input.response.setIsAiResponseImage(true);
  input.response.setAiResponse(display.displayUrl);
  if (targetId && currentPrompt)
    await persistGeneratedImage(input, currentPrompt, display);
}

async function persistGeneratedImage(
  input: PromptAiRunnerInput,
  prompt: PromptSummary,
  display: NonNullable<ReturnType<typeof getImageDisplayUrl>>,
) {
  try {
    const saved = await saveGeneratedPromptImage(
      display.imageUrl,
      display.imageBase64,
      prompt,
      input.updatePrompt,
    );
    if (saved) input.showToast(input.t("toast.imageSaved"), "success");
  } catch (error) {
    console.warn("[PromptAiWorkbench] Failed to save generated image:", error);
  }
}

function ensureChatConfiguration(input: PromptAiRunnerInput) {
  const { apiKey, apiUrl, model } = input.singleChatConfig;
  if (apiKey && apiUrl && model) return;
  throw new Error(
    input.defaultImageModel
      ? input.t("prompt.mismatchText")
      : input.t("toast.configAI"),
  );
}

async function runTextPromptTest(
  input: PromptAiRunnerInput,
  systemPrompt: string | undefined,
  userPrompt: string,
  outputFormat: OutputFormatConfig | undefined,
  imageAttachments: VariableInputImageAttachment[],
) {
  ensureChatConfiguration(input);
  const { buildMessagesFromPrompt, chatCompletion } = await loadAIService();
  const useStream = Boolean(input.singleChatConfig.chatParams?.stream);
  const stream = createStreamCallbacks(input);
  if (useStream) startStreaming(input.streaming);
  const result = await chatCompletion(
    input.singleChatConfig as AIConfig,
    buildMessagesFromPrompt(
      systemPrompt,
      userPrompt,
      undefined,
      imageAttachments,
    ),
    {
      stream: useStream,
      enableThinking: Boolean(
        input.singleChatConfig.chatParams?.enableThinking,
      ),
      responseFormat: outputFormat,
      streamCallbacks: useStream ? stream.callbacks : undefined,
    },
  );
  finishTextPromptTest(input, result, useStream, stream);
}

function startStreaming(streaming: PromptAiRunnerInput["streaming"]) {
  streaming.setIsStreaming(true);
  streaming.setStreamingContent("");
  streaming.setStreamingThinking("");
}

function finishTextPromptTest(
  input: PromptAiRunnerInput,
  result: { content: string; thinkingContent?: string },
  useStream: boolean,
  stream: ReturnType<typeof createStreamCallbacks>,
) {
  input.streaming.setIsStreaming(false);
  input.response.setAiResponse(
    useStream ? stream.content.current || result.content : result.content,
  );
  input.response.setAiThinking(
    useStream
      ? stream.thinking.current || null
      : result.thinkingContent || null,
  );
}

async function runPromptAiTest(
  input: PromptAiRunnerInput,
  systemPrompt: string | undefined,
  userPrompt: string,
  promptId?: string,
  outputFormat?: OutputFormatConfig,
  imageAttachments: VariableInputImageAttachment[] = input.inlineAiTestImages,
) {
  input.flags.setIsTestingAI(true);
  resetPromptAiResult(input);
  const targetId = promptId || input.selectedId;
  if (targetId) await input.incrementUsageCount(targetId);
  try {
    if (!input.canRunSingleAiTest)
      throw new Error(input.t("toast.configAI") || "Please configure AI");
    const prompt = input.prompts.find((item) => item.id === targetId);
    if (prompt?.promptType === "image")
      return await runImagePromptTest(input, prompt, targetId, userPrompt);
    if (prompt?.promptType === "video")
      return showUnsupportedVideoResult(input);
    await runTextPromptTest(
      input,
      systemPrompt,
      userPrompt,
      outputFormat,
      imageAttachments,
    );
  } catch (error) {
    showAiTestError(input, error);
  } finally {
    input.flags.setIsTestingAI(false);
  }
}

function resetPromptAiResult(input: PromptAiRunnerInput) {
  input.response.setAiResponse(null);
  input.response.setAiThinking(null);
  input.response.setIsAiResponseImage(false);
  input.selection.setIsAiTestVariableModalOpen(false);
}

function showUnsupportedVideoResult(input: PromptAiRunnerInput) {
  input.response.setAiResponse(input.t("prompt.videoNotSupported"));
  input.showToast(input.t("prompt.videoNotSupported"), "info");
}

function showAiTestError(input: PromptAiRunnerInput, error: unknown) {
  input.streaming.setIsStreaming(false);
  input.response.setAiResponse(
    `${input.t("common.error")}: ${error instanceof Error ? error.message : input.t("common.error")}`,
  );
  input.showToast(input.t("toast.aiFailed"), "error");
}

function buildComparisonStreamCallbacks(
  configs: PromptAiConfig[],
  buffers: MutableRefObject<CompareBuffer>,
  scheduleFlush: () => void,
) {
  const callbacks = new Map<string, StreamCallbacks>();
  configs
    .filter((config) => config.chatParams?.stream)
    .forEach((config) => {
      if (!config.id) return;
      callbacks.set(config.id, {
        onContent: (chunk) =>
          appendCompareBuffer(
            buffers,
            config.id!,
            "response",
            chunk,
            scheduleFlush,
          ),
        onThinking: (chunk) =>
          appendCompareBuffer(
            buffers,
            config.id!,
            "thinkingContent",
            chunk,
            scheduleFlush,
          ),
      });
    });
  return callbacks;
}

function appendCompareBuffer(
  buffers: MutableRefObject<CompareBuffer>,
  id: string,
  field: "response" | "thinkingContent",
  chunk: string,
  scheduleFlush: () => void,
) {
  const buffer = buffers.current[id];
  if (!buffer) return;
  buffer[field] += chunk;
  scheduleFlush();
}

async function runPromptModelCompare(
  input: PromptAiRunnerInput,
  buffers: MutableRefObject<CompareBuffer>,
  flushBuffers: () => void,
  resetBuffers: () => void,
  scheduleFlush: () => void,
  systemPrompt: string | undefined,
  userPrompt: string,
  imageAttachments: VariableInputImageAttachment[] = input.inlineAiTestImages,
) {
  input.selection.setIsCompareVariableModalOpen(false);
  const configs = input.compareModels.filter(
    (model) => model.id && input.selectedModelIds.includes(model.id),
  );
  input.flags.setIsComparingModels(true);
  input.comparison.setCompareError(null);
  try {
    const { buildMessagesFromPrompt, multiModelCompare } =
      await loadAIService();
    resetBuffers();
    buffers.current = createComparisonBuffers(configs);
    input.comparison.setCompareResults(createComparePlaceholders(configs));
    const result = await multiModelCompare(
      configs as AIConfig[],
      buildMessagesFromPrompt(
        systemPrompt,
        userPrompt,
        undefined,
        imageAttachments,
      ),
      {
        streamCallbacksMap: buildComparisonStreamCallbacks(
          configs,
          buffers,
          scheduleFlush,
        ),
      },
    );
    flushBuffers();
    input.comparison.setCompareResults(result.results);
  } catch (error) {
    input.comparison.setCompareError(
      error instanceof Error ? error.message : input.t("common.error"),
    );
  } finally {
    resetBuffers();
    input.flags.setIsComparingModels(false);
  }
}

function usePromptAiComparisonBuffers(
  setCompareResults: PromptAiRunnerInput["comparison"]["setCompareResults"],
) {
  const buffers = useRef<CompareBuffer>({});
  const frame = useRef<number | null>(null);
  const flushBuffers = useCallback(
    () =>
      setCompareResults(
        (results) =>
          results?.map((result) =>
            mergeBufferedResult(result, buffers.current[result.id ?? ""]),
          ) ?? null,
      ),
    [setCompareResults],
  );
  const scheduleFlush = useCallback(() => {
    if (frame.current === null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        flushSync(flushBuffers);
      });
  }, [flushBuffers]);
  const resetBuffers = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    buffers.current = {};
  }, []);
  useEffect(() => resetBuffers, [resetBuffers]);
  return { buffers, flushBuffers, scheduleFlush, resetBuffers };
}

function mergeBufferedResult(
  result: AITestResult,
  buffered: CompareBuffer[string] | undefined,
) {
  return buffered
    ? {
        ...result,
        response: buffered.response,
        thinkingContent: buffered.thinkingContent,
      }
    : result;
}

export function usePromptAiRunner(input: PromptAiRunnerInput) {
  const buffers = usePromptAiComparisonBuffers(
    input.comparison.setCompareResults,
  );
  const runAiTest = useCallback(
    (
      systemPrompt: string | undefined,
      userPrompt: string,
      promptId?: string,
      outputFormat?: OutputFormatConfig,
      imageAttachments?: VariableInputImageAttachment[],
    ) =>
      runPromptAiTest(
        input,
        systemPrompt,
        userPrompt,
        promptId,
        outputFormat,
        imageAttachments,
      ),
    [input],
  );
  const runModelCompare = useCallback(
    (
      systemPrompt: string | undefined,
      userPrompt: string,
      imageAttachments?: VariableInputImageAttachment[],
    ) =>
      runPromptModelCompare(
        input,
        buffers.buffers,
        buffers.flushBuffers,
        buffers.resetBuffers,
        buffers.scheduleFlush,
        systemPrompt,
        userPrompt,
        imageAttachments,
      ),
    [buffers, input],
  );
  return { runAiTest, runModelCompare };
}
