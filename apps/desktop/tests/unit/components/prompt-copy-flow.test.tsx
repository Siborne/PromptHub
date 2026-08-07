import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OutputFormatItem, Prompt } from "@prompthub/shared/types";

import {
  copyTextToClipboard,
  hasUserDefinedPromptVariables,
} from "../../../src/renderer/components/prompt/prompt-copy-utils";
import { usePromptWorkspaceCopyFlow } from "../../../src/renderer/components/layout/usePromptWorkspaceCopyFlow";

vi.mock(
  "../../../src/renderer/components/prompt/prompt-copy-utils",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../../src/renderer/components/prompt/prompt-copy-utils")
      >();
    return {
      ...actual,
      copyTextToClipboard: vi.fn().mockResolvedValue(undefined),
      hasUserDefinedPromptVariables: vi.fn().mockReturnValue(false),
    };
  },
);

function createPrompt(id: string, userPrompt = `${id} body`): Prompt {
  return {
    id,
    title: id,
    description: "",
    systemPrompt: "",
    userPrompt,
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
}

const mapping: OutputFormatItem = {
  id: "mapping",
  sourcePromptId: "source",
  targetPromptId: "target",
  sortOrder: 0,
  createdAt: "2026-07-30T00:00:00.000Z",
  updatedAt: "2026-07-30T00:00:00.000Z",
};

function createParams(source: Prompt, target: Prompt) {
  const setCopyPrompt = vi.fn();
  const setCopyPromptSourceId = vi.fn();
  const setIsCopyVariableModalOpen = vi.fn();
  const incrementUsageCount = vi.fn().mockResolvedValue(undefined);
  const triggerCopied = vi.fn();
  return {
    params: {
      copy: {
        copyPromptQueue: [],
        copyPromptQueueIndex: -1,
        copyPromptResults: [],
        copyPromptSourceId: null,
        setCopyPrompt,
        setCopyPromptQueue: vi.fn(),
        setCopyPromptQueueIndex: vi.fn(),
        setCopyPromptResults: vi.fn(),
        setCopyPromptSourceId,
        setIsCopyVariableModalOpen,
      },
      incrementUsageCount,
      outputFormatItems: [mapping],
      getPromptDetail: vi.fn().mockResolvedValue(null),
      promptById: new Map([
        [source.id, source],
        [target.id, target],
      ]),
      showCopyNotification: false,
      showEnglish: false,
      showToast: vi.fn(),
      t: ((key: string) => key) as never,
      triggerCopied,
    },
    incrementUsageCount,
    setCopyPrompt,
    setCopyPromptSourceId,
    setIsCopyVariableModalOpen,
    triggerCopied,
  };
}

describe("Prompt workspace copy flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hasUserDefinedPromptVariables).mockReturnValue(false);
  });

  it("copies a single mapped target while attributing usage to the source", async () => {
    const source = createPrompt("source");
    const target = createPrompt("target", "mapped body");
    const fixture = createParams(source, target);
    const { result } = renderHook(() =>
      usePromptWorkspaceCopyFlow(fixture.params),
    );

    await act(() => result.current.handleCopyPrompt(source));

    expect(copyTextToClipboard).toHaveBeenCalledWith("mapped body");
    expect(fixture.incrementUsageCount).toHaveBeenCalledWith("source");
    expect(fixture.triggerCopied).toHaveBeenCalledTimes(1);
  });

  it("opens variable input for the mapped target and preserves source attribution", async () => {
    vi.mocked(hasUserDefinedPromptVariables).mockReturnValue(true);
    const source = createPrompt("source");
    const target = createPrompt("target", "{{topic}}");
    const fixture = createParams(source, target);
    const { result } = renderHook(() =>
      usePromptWorkspaceCopyFlow(fixture.params),
    );

    await act(() => result.current.handleCopyPrompt(source));

    expect(fixture.setCopyPrompt).toHaveBeenCalledWith(target);
    expect(fixture.setCopyPromptSourceId).toHaveBeenCalledWith("source");
    expect(fixture.setIsCopyVariableModalOpen).toHaveBeenCalledWith(true);
    expect(copyTextToClipboard).not.toHaveBeenCalled();
  });
});
