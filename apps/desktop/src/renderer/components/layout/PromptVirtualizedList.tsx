import { memo } from "react";
import type { Prompt } from "@prompthub/shared/types";
import { PromptVirtualizedRows } from "./PromptVirtualizedRows";
import {
  useCollapsedPromptIds,
  useEffectiveCollapsedPromptIds,
  usePromptListDrag,
} from "./usePromptListInteractions";
import type { VirtualizedPromptListProps } from "./prompt-list-types";
import { useVirtualizedPromptListModel } from "./useVirtualizedPromptListModel";
export {
  getHighlightTerms,
  renderHighlightedText,
} from "./prompt-list-highlight";
export { PromptCard } from "./PromptListCard";

export function getPromptDescendantIds(
  prompts: Prompt[],
  promptId: string,
): Set<string> {
  const childrenByParentId = new Map<string, Prompt[]>();

  for (const prompt of prompts) {
    if (!prompt.parentId || prompt.parentId === prompt.id) {
      continue;
    }

    const siblings = childrenByParentId.get(prompt.parentId) ?? [];
    siblings.push(prompt);
    childrenByParentId.set(prompt.parentId, siblings);
  }

  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    for (const child of childrenByParentId.get(parentId) ?? []) {
      if (descendants.has(child.id)) {
        continue;
      }

      descendants.add(child.id);
      visit(child.id);
    }
  };

  visit(promptId);
  return descendants;
}

export const VirtualizedPromptList = memo(function VirtualizedPromptList({
  prompts,
  selectedPromptIdSet,
  highlightTerms,
  collapsedPromptIds,
  onCollapsedPromptIdsChange,
  onSelect,
  onDoubleClick,
  onContextMenu,
  onMovePrompt,
}: VirtualizedPromptListProps) {
  const effectiveCollapsedPromptIds = useEffectiveCollapsedPromptIds(
    collapsedPromptIds,
    highlightTerms,
  );
  const model = useVirtualizedPromptListModel(
    prompts,
    effectiveCollapsedPromptIds,
  );

  const togglePromptCollapse = useCollapsedPromptIds({
    prompts,
    onCollapsedPromptIdsChange,
  });
  const drag = usePromptListDrag({ prompts, onMovePrompt });
  return (
    <PromptVirtualizedRows
      {...{
        prompts,
        selectedPromptIdSet,
        highlightTerms,
        collapsedPromptIds,
        onCollapsedPromptIdsChange,
        onSelect,
        onDoubleClick,
        onContextMenu,
        onMovePrompt,
        effectiveCollapsedPromptIds,
        togglePromptCollapse,
        ...model,
        ...drag,
      }}
    />
  );
});
