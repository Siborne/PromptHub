const CACHE_KIND = "prompthub-prompt-variable-cache";
const CACHE_VERSION = 1;
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_VARIABLES = 64;
const MAX_VARIABLE_NAME_LENGTH = 128;
const MAX_VARIABLE_VALUE_LENGTH = 4096;

interface PromptVariableCacheDocument {
  kind: typeof CACHE_KIND;
  version: typeof CACHE_VERSION;
  updatedAt: number;
  values: Record<string, string>;
}

function storageKey(promptId: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(promptId)) {
    throw new Error("Invalid prompt id for variable cache");
  }
  return `prompt_vars_${promptId}`;
}

function normalizeValues(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([name, entry]) =>
          name.length > 0 &&
          name.length <= MAX_VARIABLE_NAME_LENGTH &&
          typeof entry === "string",
      )
      .slice(-MAX_VARIABLES)
      .map(([name, entry]) => [
        name,
        (entry as string).slice(0, MAX_VARIABLE_VALUE_LENGTH),
      ]),
  );
}

function persist(key: string, values: Record<string, string>, updatedAt: number): void {
  const document: PromptVariableCacheDocument = {
    kind: CACHE_KIND,
    version: CACHE_VERSION,
    updatedAt,
    values: normalizeValues(values),
  };
  localStorage.setItem(key, JSON.stringify(document));
}

export function loadPromptVariableCache(
  promptId: string,
  currentTime = Date.now(),
): Record<string, string> {
  const key = storageKey(promptId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      localStorage.removeItem(key);
      return {};
    }
    const record = parsed as Record<string, unknown>;
    if (record.kind !== CACHE_KIND || record.version !== CACHE_VERSION) {
      const legacyValues = normalizeValues(record);
      persist(key, legacyValues, currentTime);
      return legacyValues;
    }
    if (
      typeof record.updatedAt !== "number" ||
      currentTime - record.updatedAt > CACHE_TTL_MS
    ) {
      localStorage.removeItem(key);
      return {};
    }
    return normalizeValues(record.values);
  } catch {
    localStorage.removeItem(key);
    return {};
  }
}

export function savePromptVariableCache(
  promptId: string,
  values: Record<string, string>,
  currentTime = Date.now(),
): void {
  persist(storageKey(promptId), values, currentTime);
}
