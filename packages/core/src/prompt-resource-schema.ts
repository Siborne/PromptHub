import crypto from "node:crypto";

import type { Prompt, PromptVersion, Variable } from "@prompthub/shared/types";

export const PROMPT_RESOURCE_KIND = "prompthub-prompt-resource";
export const PROMPT_VERSION_RESOURCE_KIND = "prompthub-prompt-version-resource";
export const PROMPT_RESOURCE_SCHEMA_VERSION = 1;

export interface CanonicalTagReference {
  id: string;
  label: string;
}

export interface PromptMediaReferences {
  images: string[];
  videos: string[];
}

export interface PromptMediaObjectReference {
  kind: "image" | "video";
  reference: string;
  sha256: string;
  byteSize: number;
}

export interface PromptResourceDocument {
  kind: typeof PROMPT_RESOURCE_KIND;
  schemaVersion: typeof PROMPT_RESOURCE_SCHEMA_VERSION;
  prompt: Prompt;
  tagReferences: CanonicalTagReference[];
  mediaReferences: PromptMediaReferences;
  mediaObjects?: PromptMediaObjectReference[];
  [key: string]: unknown;
}

export interface PromptVersionResourceDocument {
  kind: typeof PROMPT_VERSION_RESOURCE_KIND;
  schemaVersion: typeof PROMPT_RESOURCE_SCHEMA_VERSION;
  version: PromptVersion;
  [key: string]: unknown;
}

export interface PromptVersionDocumentEntry {
  path: string;
  document: PromptVersionResourceDocument;
}

export interface PromptResourceDocuments {
  promptDocument: PromptResourceDocument;
  versionDocuments: PromptVersionDocumentEntry[];
}

export interface SerializedPromptVersionDocument {
  path: string;
  text: string;
}

export interface ParsedPromptResourceDocuments extends PromptResourceDocuments {
  prompt: Prompt;
  versions: PromptVersion[];
}

const PROMPT_TYPES = new Set(["text", "image", "video"]);
const VISIBILITIES = new Set(["private", "shared"]);
const VARIABLE_TYPES = new Set(["text", "textarea", "number", "select"]);
const VERSION_PATH_PATTERN = /^versions\/(\d{6})\.json$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string") {
    throw new Error(`Prompt resource ${label} must be a string`);
  }
}

function assertId(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    Buffer.byteLength(value, "utf8") > 256 ||
    /[\u0000-\u001f\u007f/\\]/u.test(value)
  ) {
    throw new Error(`Prompt resource ${label} is invalid`);
  }
}

function assertOptionalString(
  value: unknown,
  label: string,
): asserts value is string | null | undefined {
  if (value !== undefined && value !== null && typeof value !== "string") {
    throw new Error(`Prompt resource ${label} must be a string or null`);
  }
}

function assertCanonicalTimestamp(
  value: unknown,
  label: string,
): asserts value is string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(
      `Prompt resource ${label} must be a canonical ISO timestamp`,
    );
  }
}

function assertPositiveVersion(value: unknown, label: string): number {
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 1 ||
    Number(value) > 999_999
  ) {
    throw new Error(
      `Prompt resource ${label} must be a supported positive version`,
    );
  }
  return Number(value);
}

function assertStringArray(value: unknown, label: string): string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== "string")
  ) {
    throw new Error(`Prompt resource ${label} must be a string array`);
  }
  return value;
}

function validateVariable(value: unknown, index: number): Variable {
  if (!isRecord(value)) {
    throw new Error(`Prompt resource variable ${index} must be an object`);
  }
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new Error(`Prompt resource variable name ${index} is invalid`);
  }
  if (typeof value.type !== "string" || !VARIABLE_TYPES.has(value.type)) {
    throw new Error(`Prompt resource variable type ${index} is invalid`);
  }
  if (typeof value.required !== "boolean") {
    throw new Error(`Prompt resource variable required ${index} is invalid`);
  }
  assertOptionalString(value.label, `variable label ${index}`);
  assertOptionalString(value.defaultValue, `variable defaultValue ${index}`);
  if (value.options !== undefined) {
    assertStringArray(value.options, `variable options ${index}`);
  }
  return value as unknown as Variable;
}

function validateVariables(value: unknown): Variable[] {
  if (!Array.isArray(value)) {
    throw new Error("Prompt resource variables must be an array");
  }
  return value.map(validateVariable);
}

function validateLogicalMediaReference(value: string, label: string): void {
  const segments = value.split("/");
  if (
    value.length === 0 ||
    /[\u0000-\u001f\u007f\\]/u.test(value) ||
    value.startsWith("/") ||
    /^[a-zA-Z]:/u.test(value) ||
    segments.includes(".") ||
    segments.includes("..") ||
    segments.includes("")
  ) {
    throw new Error(
      `Prompt resource ${label} contains an unsafe media reference`,
    );
  }
}

function validateMediaReferences(value: unknown, label: string): string[] {
  const references = assertStringArray(value, label);
  for (const reference of references) {
    validateLogicalMediaReference(reference, label);
  }
  return references;
}

function validatePromptOptionalFields(value: Record<string, unknown>): void {
  for (const field of [
    "ownerUserId",
    "description",
    "systemPrompt",
    "systemPromptEn",
    "userPromptEn",
    "source",
    "notes",
    "lastAiResponse",
  ]) {
    assertOptionalString(value[field], field);
  }
  if (
    value.visibility !== undefined &&
    !VISIBILITIES.has(String(value.visibility))
  ) {
    throw new Error("Prompt resource visibility is invalid");
  }
  if (
    value.promptType !== undefined &&
    !PROMPT_TYPES.has(String(value.promptType))
  ) {
    throw new Error("Prompt resource promptType is invalid");
  }
}

function validatePromptRelations(value: Record<string, unknown>): void {
  if (value.folderId !== undefined && value.folderId !== null) {
    assertId(value.folderId, "folderId");
  }
  if (value.parentId !== undefined && value.parentId !== null) {
    assertId(value.parentId, "parentId");
  }
  if (value.order !== undefined && !Number.isSafeInteger(value.order)) {
    throw new Error("Prompt resource order must be a safe integer");
  }
}

function validatePromptCounters(value: Record<string, unknown>): void {
  if (
    typeof value.isFavorite !== "boolean" ||
    typeof value.isPinned !== "boolean"
  ) {
    throw new Error(
      "Prompt resource favorite and pinned flags must be boolean",
    );
  }
  const version = assertPositiveVersion(value.version, "version");
  const currentVersion = assertPositiveVersion(
    value.currentVersion,
    "currentVersion",
  );
  if (version !== currentVersion) {
    throw new Error("Prompt resource version must equal currentVersion");
  }
  if (!Number.isSafeInteger(value.usageCount) || Number(value.usageCount) < 0) {
    throw new Error(
      "Prompt resource usageCount must be a non-negative integer",
    );
  }
}

function validatePrompt(value: unknown): Prompt {
  if (!isRecord(value))
    throw new Error("Prompt resource prompt must be an object");
  assertId(value.id, "id");
  assertString(value.title, "title");
  assertString(value.userPrompt, "userPrompt");
  validatePromptOptionalFields(value);
  validatePromptRelations(value);
  value.variables = validateVariables(value.variables);
  const tags = assertStringArray(value.tags, "tags");
  for (const tag of tags) normalizeTagLabel(tag);
  value.tags = tags;
  value.images = validateMediaReferences(value.images ?? [], "images");
  value.videos = validateMediaReferences(value.videos ?? [], "videos");
  validatePromptCounters(value);
  assertCanonicalTimestamp(value.createdAt, "createdAt");
  assertCanonicalTimestamp(value.updatedAt, "updatedAt");
  return value as unknown as Prompt;
}

function validateVersion(value: unknown): PromptVersion {
  if (!isRecord(value))
    throw new Error("Prompt version resource must be an object");
  assertId(value.id, "version id");
  assertId(value.promptId, "version promptId");
  value.version = assertPositiveVersion(value.version, "version number");
  assertOptionalString(value.systemPrompt, "version systemPrompt");
  assertOptionalString(value.systemPromptEn, "version systemPromptEn");
  assertString(value.userPrompt, "version userPrompt");
  assertOptionalString(value.userPromptEn, "version userPromptEn");
  value.variables = validateVariables(value.variables);
  assertOptionalString(value.note, "version note");
  assertOptionalString(value.aiResponse, "version aiResponse");
  assertCanonicalTimestamp(value.createdAt, "version createdAt");
  return value as unknown as PromptVersion;
}

function normalizeTagLabel(label: string): string {
  const normalized = label.trim().normalize("NFC");
  if (!normalized || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error("Prompt resource tag label is invalid");
  }
  return normalized;
}

export function deriveCanonicalTagId(label: string): string {
  const normalized = normalizeTagLabel(label);
  return crypto
    .createHash("sha256")
    .update(`prompthub-tag-v1\0${normalized}`, "utf8")
    .digest("hex");
}

function createTagReferences(tags: readonly string[]): CanonicalTagReference[] {
  const references = new Map<string, CanonicalTagReference>();
  for (const rawLabel of tags) {
    const label = normalizeTagLabel(rawLabel);
    const id = deriveCanonicalTagId(label);
    references.set(id, { id, label });
  }
  return [...references.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

function versionPath(version: number): string {
  return `versions/${String(version).padStart(6, "0")}.json`;
}

function validateVersionSet(prompt: Prompt, versions: PromptVersion[]): void {
  const ids = new Set<string>();
  const numbers = new Set<number>();
  for (const version of versions) {
    if (version.promptId !== prompt.id) {
      throw new Error("Prompt version does not belong to the owning Prompt");
    }
    if (ids.has(version.id) || numbers.has(version.version)) {
      throw new Error("Prompt resource contains a duplicate version");
    }
    ids.add(version.id);
    numbers.add(version.version);
  }
  if (!numbers.has(prompt.currentVersion)) {
    throw new Error("Prompt resource current version is missing");
  }
  if (Math.max(...numbers) !== prompt.currentVersion) {
    throw new Error(
      "Prompt resource contains a version newer than currentVersion",
    );
  }
}

export function createPromptResourceDocuments(
  promptInput: Prompt,
  versionInputs: readonly PromptVersion[],
  mediaObjects: readonly PromptMediaObjectReference[] = [],
): PromptResourceDocuments {
  const prompt = validatePrompt(structuredClone(promptInput));
  const versions = versionInputs.map((version) =>
    validateVersion(structuredClone(version)),
  );
  validateVersionSet(prompt, versions);
  const promptDocument: PromptResourceDocument = {
    kind: PROMPT_RESOURCE_KIND,
    schemaVersion: PROMPT_RESOURCE_SCHEMA_VERSION,
    prompt,
    tagReferences: createTagReferences(prompt.tags),
    mediaReferences: {
      images: [...prompt.images!],
      videos: [...prompt.videos!],
    },
    ...(mediaObjects.length > 0
      ? { mediaObjects: validateMediaObjects(prompt, mediaObjects) }
      : {}),
  };
  const versionDocuments = versions
    .sort((left, right) => left.version - right.version)
    .map((version) => ({
      path: versionPath(version.version),
      document: {
        kind: PROMPT_VERSION_RESOURCE_KIND,
        schemaVersion: PROMPT_RESOURCE_SCHEMA_VERSION,
        version,
      } as PromptVersionResourceDocument,
    }));
  return { promptDocument, versionDocuments };
}

function validateMediaObjects(
  prompt: Prompt,
  value: unknown,
): PromptMediaObjectReference[] {
  if (!Array.isArray(value)) {
    throw new Error("Prompt resource mediaObjects must be an array");
  }
  const expected = new Set([
    ...prompt.images!.map((reference) => `image\0${reference}`),
    ...prompt.videos!.map((reference) => `video\0${reference}`),
  ]);
  const seen = new Set<string>();
  const objects = value.map((entry) => {
    if (!isRecord(entry) || (entry.kind !== "image" && entry.kind !== "video")) {
      throw new Error("Prompt resource media object is invalid");
    }
    assertString(entry.reference, "media object reference");
    validateLogicalMediaReference(entry.reference, "media object reference");
    const key = `${entry.kind}\0${entry.reference}`;
    if (!expected.has(key) || seen.has(key)) {
      throw new Error("Prompt resource media object does not match media references");
    }
    if (
      typeof entry.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(entry.sha256) ||
      !Number.isSafeInteger(entry.byteSize) ||
      Number(entry.byteSize) < 0
    ) {
      throw new Error("Prompt resource media object identity is invalid");
    }
    seen.add(key);
    return entry as unknown as PromptMediaObjectReference;
  });
  if (seen.size !== expected.size) {
    throw new Error("Prompt resource media objects are incomplete");
  }
  return objects.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.reference.localeCompare(right.reference),
  );
}

function parseJsonRecord(text: string, label: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Prompt resource ${label} contains invalid JSON`, {
      cause: error,
    });
  }
  if (!isRecord(parsed)) {
    throw new Error(`Prompt resource ${label} must be an object`);
  }
  return parsed;
}

function assertDocumentHeader(
  document: Record<string, unknown>,
  kind: string,
  label: string,
): void {
  if (document.kind !== kind) {
    throw new Error(`Prompt resource ${label} kind is unsupported`);
  }
  if (document.schemaVersion !== PROMPT_RESOURCE_SCHEMA_VERSION) {
    throw new Error(`Prompt resource ${label} schema version is unsupported`);
  }
}

function validatePromptDocument(
  value: Record<string, unknown>,
): PromptResourceDocument {
  assertDocumentHeader(value, PROMPT_RESOURCE_KIND, "prompt document");
  const prompt = validatePrompt(value.prompt);
  const expectedTags = createTagReferences(prompt.tags);
  if (JSON.stringify(value.tagReferences) !== JSON.stringify(expectedTags)) {
    throw new Error("Prompt resource tag references do not match the Prompt");
  }
  const expectedMedia = {
    images: [...prompt.images!],
    videos: [...prompt.videos!],
  };
  if (JSON.stringify(value.mediaReferences) !== JSON.stringify(expectedMedia)) {
    throw new Error("Prompt resource media references do not match the Prompt");
  }
  const mediaObjects =
    value.mediaObjects === undefined
      ? undefined
      : validateMediaObjects(prompt, value.mediaObjects);
  return {
    ...value,
    kind: PROMPT_RESOURCE_KIND,
    schemaVersion: 1,
    prompt,
    tagReferences: expectedTags,
    mediaReferences: expectedMedia,
    ...(mediaObjects ? { mediaObjects } : {}),
  } as PromptResourceDocument;
}

function parseVersionDocument(
  entry: SerializedPromptVersionDocument,
): PromptVersionDocumentEntry {
  const raw = parseJsonRecord(entry.text, entry.path);
  assertDocumentHeader(raw, PROMPT_VERSION_RESOURCE_KIND, entry.path);
  const version = validateVersion(raw.version);
  if (entry.path !== versionPath(version.version)) {
    throw new Error(
      `Prompt resource version path does not match version ${version.version}`,
    );
  }
  return {
    path: entry.path,
    document: {
      ...raw,
      kind: PROMPT_VERSION_RESOURCE_KIND,
      schemaVersion: 1,
      version,
    } as PromptVersionResourceDocument,
  };
}

export function parsePromptResourceDocuments(
  promptText: string,
  versionFiles: readonly SerializedPromptVersionDocument[],
): ParsedPromptResourceDocuments {
  const promptDocument = validatePromptDocument(
    parseJsonRecord(promptText, "prompt document"),
  );
  const versionDocuments = versionFiles
    .map(parseVersionDocument)
    .sort(
      (left, right) =>
        left.document.version.version - right.document.version.version,
    );
  const versions = versionDocuments.map((entry) => entry.document.version);
  validateVersionSet(promptDocument.prompt, versions);
  return {
    promptDocument,
    versionDocuments,
    prompt: promptDocument.prompt,
    versions,
  };
}
