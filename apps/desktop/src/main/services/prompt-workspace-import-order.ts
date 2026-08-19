import type { Folder, Prompt } from "@prompthub/shared/types";

export function orderFoldersForImport(
  folders: readonly Folder[],
  existingFolderIds: ReadonlySet<string>,
  strict: boolean,
): Folder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder] as const));
  const parentCounts = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const folder of byId.values()) {
    const parentId = folder.parentId;
    if (!parentId || !byId.has(parentId)) {
      if (strict && parentId && !existingFolderIds.has(parentId)) {
        throw new Error(
          `Prompt folder references a missing parent: ${folder.id}`,
        );
      }
      parentCounts.set(folder.id, 0);
    } else {
      parentCounts.set(folder.id, 1);
      children.set(parentId, [...(children.get(parentId) ?? []), folder.id]);
    }
  }
  const queue = [...byId.keys()].filter((id) => parentCounts.get(id) === 0);
  const ordered: Folder[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    ordered.push(byId.get(id) as Folder);
    queue.push(...(children.get(id) ?? []));
  }
  if (ordered.length === byId.size) return ordered;
  if (strict) throw new Error("Prompt folder graph contains a cycle");
  const emitted = new Set(ordered.map((folder) => folder.id));
  return [
    ...ordered,
    ...[...byId.values()].filter((folder) => !emitted.has(folder.id)),
  ];
}

interface PromptImportEntry {
  prompt: Pick<Prompt, "id" | "parentId">;
}

export function orderPromptsForImport<T extends PromptImportEntry>(
  entries: ReadonlyMap<string, T>,
  strict: boolean,
): T[] {
  const parentCounts = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const [id, entry] of entries) {
    const parentId = entry.prompt.parentId;
    if (!parentId || !entries.has(parentId)) {
      if (strict && parentId) {
        throw new Error(`Prompt references a missing parent: ${id}`);
      }
      parentCounts.set(id, 0);
    } else {
      parentCounts.set(id, 1);
      children.set(parentId, [...(children.get(parentId) ?? []), id]);
    }
  }
  const queue = [...entries.keys()].filter((id) => parentCounts.get(id) === 0);
  const ordered: T[] = [];
  for (let index = 0; index < queue.length; index += 1) {
    const id = queue[index];
    ordered.push(entries.get(id) as T);
    queue.push(...(children.get(id) ?? []));
  }
  if (ordered.length === entries.size) return ordered;
  if (strict) throw new Error("Prompt parent graph contains a cycle");
  const emitted = new Set(ordered.map((entry) => entry.prompt.id));
  return [
    ...ordered,
    ...[...entries.values()].filter((entry) => !emitted.has(entry.prompt.id)),
  ];
}
