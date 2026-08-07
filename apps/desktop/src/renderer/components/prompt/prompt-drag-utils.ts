import type { PromptSummary } from "@prompthub/shared/types";

export type PromptDropPosition = "before" | "after" | "inside";

export interface FlattenedPromptNode {
  prompt: PromptSummary;
  depth: number;
}

export type PromptSiblingOrder = "stored" | "input";

export interface FlattenPromptTreeOptions {
  siblingOrder?: PromptSiblingOrder;
}

export interface PromptMoveTarget {
  parentId: string | null;
  order: number;
}

export interface PromptHierarchyMeta {
  childCountById: Map<string, number>;
  parentTitleById: Map<string, string>;
}

export function getPromptDropPosition(
  clientY: number,
  rect: Pick<DOMRect, "top" | "height">,
): PromptDropPosition {
  const y = clientY - rect.top;

  if (y < rect.height / 3) {
    return "before";
  }

  if (y > (rect.height * 2) / 3) {
    return "after";
  }

  return "inside";
}

export function flattenPromptTree(
  prompts: PromptSummary[],
  collapsedPromptIds: ReadonlySet<string> = new Set(),
  options: FlattenPromptTreeOptions = {},
): FlattenedPromptNode[] {
  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const inputIndexById = new Map(
    prompts.map((prompt, index) => [prompt.id, index]),
  );
  const childrenByParent = buildChildrenByParent(
    prompts,
    promptById,
    inputIndexById,
    options.siblingOrder ?? "stored",
  );
  const result: FlattenedPromptNode[] = [];
  const attachedIds = new Set<string>();

  const markDescendantsAttached = (prompt: PromptSummary, ancestors: Set<string>) => {
    for (const child of childrenByParent.get(prompt.id) ?? []) {
      if (ancestors.has(child.id)) {
        continue;
      }

      attachedIds.add(child.id);
      markDescendantsAttached(child, new Set(ancestors).add(child.id));
    }
  };

  const visit = (prompt: PromptSummary, depth: number, ancestors: Set<string>) => {
    if (ancestors.has(prompt.id)) {
      return;
    }

    result.push({ prompt, depth });
    attachedIds.add(prompt.id);

    const nextAncestors = new Set(ancestors).add(prompt.id);
    if (collapsedPromptIds.has(prompt.id)) {
      markDescendantsAttached(prompt, nextAncestors);
      return;
    }

    for (const child of childrenByParent.get(prompt.id) ?? []) {
      visit(child, depth + 1, nextAncestors);
    }
  };

  for (const root of childrenByParent.get(null) ?? []) {
    visit(root, 0, new Set());
  }

  for (const prompt of prompts) {
    if (!attachedIds.has(prompt.id)) {
      visit(prompt, 0, new Set());
    }
  }

  return result;
}

export function getPromptMoveTarget(
  prompts: PromptSummary[],
  sourcePromptId: string,
  targetPromptId: string,
  dropPosition: PromptDropPosition,
): PromptMoveTarget | null {
  if (sourcePromptId === targetPromptId) {
    return null;
  }

  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const targetPrompt = promptById.get(targetPromptId);
  if (!targetPrompt) {
    return null;
  }

  const inputIndexById = new Map(prompts.map((prompt, index) => [prompt.id, index]));
  const childrenByParent = buildChildrenByParent(prompts, promptById, inputIndexById);

  if (dropPosition === "inside") {
    if (!canMoveToParent(promptById, sourcePromptId, targetPromptId)) {
      return null;
    }

    return {
      parentId: targetPromptId,
      order: (childrenByParent.get(targetPromptId) ?? []).filter(
        (prompt) => prompt.id !== sourcePromptId,
      ).length,
    };
  }

  const parentId = getVisibleParentId(targetPrompt, promptById);
  if (!canMoveToParent(promptById, sourcePromptId, parentId)) {
    return null;
  }

  const siblings = (childrenByParent.get(parentId) ?? []).filter(
    (prompt) => prompt.id !== sourcePromptId,
  );
  const targetIndex = siblings.findIndex((prompt) => prompt.id === targetPromptId);

  return {
    parentId,
    order:
      targetIndex < 0
        ? siblings.length
        : targetIndex + (dropPosition === "after" ? 1 : 0),
  };
}

export function getPromptChildCount(prompts: PromptSummary[], promptId: string): number {
  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  return prompts.filter((prompt) => getVisibleParentId(prompt, promptById) === promptId).length;
}

export function getPromptHierarchyMeta(prompts: PromptSummary[]): PromptHierarchyMeta {
  const promptById = new Map(prompts.map((prompt) => [prompt.id, prompt]));
  const childCountById = new Map<string, number>();
  const parentTitleById = new Map<string, string>();

  for (const prompt of prompts) {
    const parentId = getVisibleParentId(prompt, promptById);
    if (!parentId) {
      continue;
    }

    childCountById.set(parentId, (childCountById.get(parentId) ?? 0) + 1);
    const parent = promptById.get(parentId);
    if (parent) {
      parentTitleById.set(prompt.id, parent.title);
    }
  }

  return { childCountById, parentTitleById };
}

function buildChildrenByParent(
  prompts: PromptSummary[],
  promptById: Map<string, PromptSummary>,
  inputIndexById: Map<string, number>,
  siblingOrder: PromptSiblingOrder = "stored",
): Map<string | null, PromptSummary[]> {
  const groups = new Map<string | null, PromptSummary[]>();

  for (const prompt of prompts) {
    const parentId = getVisibleParentId(prompt, promptById);
    const siblings = groups.get(parentId) ?? [];
    siblings.push(prompt);
    groups.set(parentId, siblings);
  }

  for (const [parentId, siblings] of groups) {
    groups.set(
      parentId,
      sortPromptSiblings(siblings, inputIndexById, siblingOrder),
    );
  }

  return groups;
}

function sortPromptSiblings(
  siblings: PromptSummary[],
  inputIndexById: Map<string, number>,
  siblingOrder: PromptSiblingOrder,
): PromptSummary[] {
  if (siblingOrder === "input") {
    return [...siblings].sort((left, right) =>
      comparePromptInputIndex(left, right, inputIndexById),
    );
  }

  const hasMeaningfulOrder = siblings.some(
    (prompt) => Boolean(prompt.parentId) || (prompt.order ?? 0) !== 0,
  );

  return [...siblings].sort((left, right) => {
    if (hasMeaningfulOrder) {
      const byOrder = (left.order ?? 0) - (right.order ?? 0);
      if (byOrder !== 0) return byOrder;
    }

    return comparePromptInputIndex(left, right, inputIndexById);
  });
}

function comparePromptInputIndex(
  left: PromptSummary,
  right: PromptSummary,
  inputIndexById: Map<string, number>,
): number {
  return (inputIndexById.get(left.id) ?? 0) - (inputIndexById.get(right.id) ?? 0);
}

function getVisibleParentId(
  prompt: PromptSummary,
  promptById: Map<string, PromptSummary>,
): string | null {
  if (!prompt.parentId || prompt.parentId === prompt.id) {
    return null;
  }

  return promptById.has(prompt.parentId) ? prompt.parentId : null;
}

function canMoveToParent(
  promptById: Map<string, PromptSummary>,
  promptId: string,
  parentId: string | null,
): boolean {
  if (!parentId) {
    return true;
  }

  if (parentId === promptId) {
    return false;
  }

  let current = promptById.get(parentId);
  const visited = new Set<string>();

  while (current) {
    const currentParentId = getVisibleParentId(current, promptById);
    if (!currentParentId) {
      return true;
    }
    if (currentParentId === promptId || visited.has(currentParentId)) {
      return false;
    }

    visited.add(currentParentId);
    current = promptById.get(currentParentId);
  }

  return true;
}
