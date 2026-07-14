import type {
  MarketplaceRegistryDocument,
  SkillStoreSource,
} from "@prompthub/shared/types";

import {
  parseGitHubTreeLocation,
  parseGitRepo,
} from "@prompthub/shared/utils/git-repo";

export type CustomStoreSourceType = Extract<
  SkillStoreSource["type"],
  "marketplace-json" | "git-repo" | "local-dir"
>;

export interface NormalizedStoreSourceInput {
  url: string;
  branch?: string;
  directory?: string;
}

export interface MarketplaceStoreDocumentValidation {
  referenceCount: number;
  skillCount: number;
}

function normalizeWindowsPath(path: string) {
  if (/^\/[A-Za-z]:[\\/]/.test(path)) {
    return path.slice(1);
  }
  return path;
}

export function normalizeLocalSourcePath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("INVALID_STORE_SOURCE_URL");
  }

  if (/^file:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return normalizeWindowsPath(decodeURIComponent(parsed.pathname));
    } catch {
      throw new Error("INVALID_STORE_SOURCE_URL");
    }
  }

  return trimmed;
}

export function normalizeLocalSkillDirectoryPath(input: string): string {
  const normalizedPath = normalizeLocalSourcePath(input).replace(/\\/g, "/");
  return normalizedPath.replace(/\/SKILL\.md$/i, "");
}

export function isLikelyLocalSource(input: string): boolean {
  const value = input.trim();
  return (
    /^file:\/\//i.test(value) ||
    value.startsWith("/") ||
    value.startsWith("~/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith(".\\") ||
    value.startsWith("..\\") ||
    /^[A-Za-z]:[\\/]/.test(value) ||
    value.startsWith("\\\\")
  );
}

export function isSupportedGitRepoSource(input: string): boolean {
  const value = input.trim();
  if (!value) return false;
  if (isLikelyLocalSource(value)) return true;

  return parseGitRepo(value) !== null;
}

function normalizeOptionalBranch(input?: string): string | undefined {
  const trimmed = input?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeOptionalDirectory(input?: string): string | undefined {
  const trimmed = input?.trim().replace(/^\/+|\/+$/g, "");
  return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getArrayFieldCount(
  record: Record<string, unknown>,
  key: string,
): number {
  if (!(key in record)) {
    return 0;
  }

  const value = record[key];
  if (!Array.isArray(value)) {
    throw new Error("MARKETPLACE_STORE_INVALID_SHAPE");
  }

  return value.length;
}

export function validateMarketplaceStoreDocument(
  raw: string,
): MarketplaceStoreDocumentValidation {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as MarketplaceRegistryDocument;
  } catch {
    throw new Error("MARKETPLACE_STORE_INVALID_JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("MARKETPLACE_STORE_INVALID_SHAPE");
  }

  const skillCount = getArrayFieldCount(parsed, "skills");
  const referenceCount =
    getArrayFieldCount(parsed, "marketplaces") +
    getArrayFieldCount(parsed, "sources") +
    getArrayFieldCount(parsed, "registries");

  if (skillCount === 0 && referenceCount === 0) {
    throw new Error("MARKETPLACE_STORE_EMPTY");
  }

  return { referenceCount, skillCount };
}

export function normalizeGitStoreSourceInput(
  input: string,
  branch?: string,
  directory?: string,
): NormalizedStoreSourceInput {
  const trimmed = input.trim();
  if (!isSupportedGitRepoSource(trimmed)) {
    throw new Error("INVALID_GIT_REPO_SOURCE");
  }

  if (isLikelyLocalSource(trimmed)) {
    return {
      url: normalizeLocalSourcePath(trimmed),
      branch: normalizeOptionalBranch(branch),
      directory: normalizeOptionalDirectory(directory),
    };
  }

  const parsedRepo = parseGitRepo(trimmed);
  if (!parsedRepo) {
    throw new Error("INVALID_GIT_REPO_SOURCE");
  }

  const treeLocation = parseGitHubTreeLocation(trimmed);
  return {
    url: parsedRepo.repositoryUrl,
    branch: normalizeOptionalBranch(branch) ?? treeLocation?.branch,
    directory: normalizeOptionalDirectory(directory) ?? treeLocation?.directory,
  };
}

export function validateStoreSourceInput(
  input: string,
  type: CustomStoreSourceType,
  options: { allowInsecureHttp?: boolean } = {},
): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("INVALID_STORE_SOURCE_URL");
  }

  if (type === "local-dir") {
    return normalizeLocalSourcePath(trimmed);
  }

  if (type === "git-repo") {
    return normalizeGitStoreSourceInput(trimmed).url;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error("INVALID_STORE_SOURCE_URL");
  }

  const allowedProtocols = options.allowInsecureHttp
    ? new Set(["http:", "https:"])
    : new Set(["https:"]);
  if (!allowedProtocols.has(parsedUrl.protocol)) {
    throw new Error("STORE_SOURCE_HTTPS_REQUIRED");
  }

  return parsedUrl.toString();
}
