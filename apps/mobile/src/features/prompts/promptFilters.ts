import type { MobilePromptSummary } from "./data/promptRepository";

export type PromptFilter = "all" | "favorite" | "recent" | "tags";

const RECENT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function matchesSearch(prompt: MobilePromptSummary, query: string): boolean {
  if (!query) return true;
  return [
    prompt.title,
    prompt.description,
    prompt.systemPrompt,
    prompt.userPrompt,
    ...prompt.tags,
  ].some((value) => value?.toLocaleLowerCase().includes(query));
}

function matchesFilter(
  prompt: MobilePromptSummary,
  filter: PromptFilter,
  now: Date,
): boolean {
  if (filter === "favorite") return prompt.isFavorite;
  if (filter === "tags") return prompt.tags.length > 0;
  if (filter === "recent") {
    return (
      now.getTime() - new Date(prompt.updatedAt).getTime() <= RECENT_WINDOW_MS
    );
  }
  return true;
}

export function filterPrompts(
  prompts: MobilePromptSummary[],
  search: string,
  filter: PromptFilter,
  now = new Date(),
): MobilePromptSummary[] {
  const query = search.trim().toLocaleLowerCase();
  return prompts.filter(
    (prompt) =>
      matchesSearch(prompt, query) && matchesFilter(prompt, filter, now),
  );
}
