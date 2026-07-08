import type { RegistrySkill, Skill } from "@prompthub/shared/types";
import { isGitHubHost, parseGitRepo } from "@prompthub/shared/utils/git-repo";
import {
  isLikelyLocalSource,
  normalizeLocalSkillDirectoryPath,
} from "./skill-store-source";

export type SkillSourceResolverKind =
  | "remote-store"
  | "remote-git"
  | "remote-zip"
  | "content-url"
  | "local-linked"
  | "managed-copy";

export interface ParsedGitHubSkillLocation {
  owner: string;
  repo: string;
  branch: string;
  directoryPath: string;
}

type RegistrySkillSourceDescriptor = Pick<
  RegistrySkill,
  | "source_url"
  | "content_url"
  | "package_url"
  | "store_url"
  | "source_label"
  | "source_directory"
  | "canonical_skill_path"
  | "directory_fingerprint"
>;

function normalizeLocalSourceKey(value?: string | null): string | null {
  const normalized = value?.trim().replace(/\\/g, "/").replace(/\/+$/g, "");
  return normalized || null;
}

export function parseGitHubSkillLocation(
  sourceUrl?: string,
  contentUrl?: string,
): ParsedGitHubSkillLocation | null {
  if (sourceUrl) {
    try {
      const parsed = new URL(sourceUrl);
      if (parsed.hostname.toLowerCase() === "github.com") {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length >= 4 && parts[2] === "tree") {
          return {
            owner: parts[0],
            repo: parts[1],
            branch: parts[3],
            directoryPath: parts.slice(4).join("/"),
          };
        }
      }
    } catch {
      // Invalid source URL can still be resolved from contentUrl.
    }
  }

  if (contentUrl) {
    try {
      const parsed = new URL(contentUrl);
      if (parsed.hostname.toLowerCase() === "raw.githubusercontent.com") {
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length >= 4) {
          return {
            owner: parts[0],
            repo: parts[1],
            branch: parts[2],
            directoryPath: parts.slice(3, -1).join("/"),
          };
        }
      }
    } catch {
      // Invalid content URL has no GitHub location.
    }
  }

  return null;
}

export function getRegistrySkillDirectory(
  regSkill: Pick<
    RegistrySkill,
    "source_directory" | "canonical_skill_path"
  >,
): string | undefined {
  const explicitDirectory = regSkill.source_directory
    ?.trim()
    .replace(/^\/+|\/+$/g, "");
  if (explicitDirectory) {
    return explicitDirectory;
  }

  const canonicalPath = regSkill.canonical_skill_path
    ?.trim()
    .replace(/^\/+|\/+$/g, "");
  if (!canonicalPath || canonicalPath.toLowerCase() === "skill.md") {
    return undefined;
  }

  const parts = canonicalPath.split("/");
  parts.pop();
  return parts.join("/") || undefined;
}

export function isLocalRegistrySkill(
  skill: Pick<RegistrySkill, "content_url" | "source_url">,
): boolean {
  return Boolean(
    (typeof skill.content_url === "string" &&
      isLikelyLocalSource(skill.content_url)) ||
      (typeof skill.source_url === "string" &&
        isLikelyLocalSource(skill.source_url)),
  );
}

export function normalizeLocalRegistryDirectory(
  regSkill: Pick<RegistrySkill, "content_url" | "source_url">,
): string {
  const candidates = [regSkill.content_url, regSkill.source_url]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .map((value) => normalizeLocalSkillDirectoryPath(value));

  return candidates[0] ?? "";
}

export function isLinkedLocalSkill(
  skill: Pick<Skill, "local_repo_path" | "source_url">,
): boolean {
  const localRepoPath = normalizeLocalSourceKey(skill.local_repo_path);
  const sourceUrl = normalizeLocalSourceKey(skill.source_url);
  return Boolean(
    localRepoPath &&
      sourceUrl &&
      localRepoPath === sourceUrl &&
      isLikelyLocalSource(sourceUrl),
  );
}

function getPublicDirectoryStoreValues(
  regSkill: RegistrySkillSourceDescriptor,
): string[] {
  return [
    regSkill.store_url,
    regSkill.content_url,
    regSkill.source_label,
  ]
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.toLowerCase());
}

function hasPackageMetadata(regSkill: RegistrySkillSourceDescriptor): boolean {
  return Boolean(
    getRegistrySkillDirectory(regSkill) ||
      regSkill.canonical_skill_path ||
      regSkill.directory_fingerprint,
  );
}

export function shouldCloneRegistrySkillPackage(
  regSkill: RegistrySkillSourceDescriptor,
): boolean {
  const publicDirectoryStoreValues = getPublicDirectoryStoreValues(regSkill);
  if (
    publicDirectoryStoreValues.some((value) => value.includes("clawhub.ai")) &&
    !getRegistrySkillDirectory(regSkill)
  ) {
    return false;
  }

  if (!regSkill.source_url || isLikelyLocalSource(regSkill.source_url)) {
    return false;
  }

  const parsedRepo = parseGitRepo(regSkill.source_url);
  if (!parsedRepo) {
    return false;
  }

  if (publicDirectoryStoreValues.some((value) => value.includes("skills.sh"))) {
    return true;
  }

  if (
    regSkill.content_url &&
    isGitHubHost(parsedRepo.host) &&
    !hasPackageMetadata(regSkill)
  ) {
    return false;
  }

  return hasPackageMetadata(regSkill);
}

export function getRegistrySkillSourceResolverKind(
  regSkill: RegistrySkillSourceDescriptor,
  installedSkill?: Pick<Skill, "local_repo_path" | "source_url"> | null,
): SkillSourceResolverKind {
  if (installedSkill && isLinkedLocalSkill(installedSkill)) {
    return "local-linked";
  }
  if (isLocalRegistrySkill(regSkill)) {
    return "local-linked";
  }
  if (regSkill.package_url?.trim()) {
    return "remote-zip";
  }
  if (shouldCloneRegistrySkillPackage(regSkill)) {
    return "remote-git";
  }
  if (regSkill.content_url?.trim()) {
    return "content-url";
  }
  if (installedSkill?.local_repo_path?.trim()) {
    return "managed-copy";
  }
  return "remote-store";
}

export function normalizeRemoteDirectoryFingerprint(
  regSkill: RegistrySkillSourceDescriptor,
  options: {
    remoteContentHash?: string;
    resolvedDirectoryFingerprint?: string;
    installedSkill?: Pick<Skill, "local_repo_path" | "source_url"> | null;
  },
): string | undefined {
  const kind = getRegistrySkillSourceResolverKind(
    regSkill,
    options.installedSkill,
  );
  if (kind === "content-url") {
    return options.remoteContentHash || undefined;
  }
  return (
    options.resolvedDirectoryFingerprint?.trim() ||
    regSkill.directory_fingerprint?.trim() ||
    undefined
  );
}
