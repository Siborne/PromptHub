import type {
  RegistrySkill,
  Skill,
  SkillSourceStaleTarget,
} from "@prompthub/shared/types";
import { buildSkillSourceId } from "@prompthub/shared/utils/skill-identity";
import {
  getSkillSourceUpdateActionPolicy,
  SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
} from "@prompthub/shared/utils/skill-source-update";
import {
  getClawHubSkillContentUrl,
  getClawHubSkillPackageUrl,
  parseClawHubSkillUrl,
} from "../../services/clawhub-store";
import {
  getRegistrySkillDirectory,
  isLinkedLocalSkill,
  isLocalRegistrySkill,
  normalizeLocalRegistryDirectory,
  normalizeRemoteDirectoryFingerprint,
  parseGitHubSkillLocation,
  shouldCloneRegistrySkillPackage,
} from "../../services/skill-source-resolver";
import {
  computeSkillContentHash,
  hasRegistrySkillVersionChanged,
  type RegistrySkillUpdateCheck,
} from "../../services/skill-store-update";
import { getRemoteStoreSkills } from "../../services/remote-store-entry";
import { sanitizeSourceUpdateError } from "./skill-store-domain";
import {
  buildSourceBaselineFields,
  getRegistrySkillInstallPackageFingerprint,
} from "./skill-source-update-baseline";
import type {
  RegistrySkillUpdateResult,
  SkillState,
} from "./skill-store-types";

export {
  applyRegistrySkillUpdateToInstalledSkill,
  syncLocalRegistrySkillRepo,
  syncRemoteRegistrySkillRepo,
} from "./skill-source-update-remote";
export {
  buildSourceBaselineFields,
  getRegistrySkillInstallPackageFingerprint,
} from "./skill-source-update-baseline";

export async function loadBuiltinSkillRegistry(): Promise<RegistrySkill[]> {
  const { BUILTIN_SKILL_REGISTRY } =
    await import("@prompthub/shared/constants/skill-registry");
  return BUILTIN_SKILL_REGISTRY.map(ensureRegistrySkillSourceId);
}

function getRegistrySkillCandidates(state: SkillState): RegistrySkill[] {
  const remoteSkills = Object.values(state.remoteStoreEntries).flatMap(
    (entry) => getRemoteStoreSkills(entry),
  );
  return [...state.registrySkills, ...remoteSkills];
}

export function findRegistrySkillCandidateByKey(
  state: SkillState,
  key: string,
): RegistrySkill | null {
  const normalizedKey = key.trim().toLowerCase();
  if (!normalizedKey) return null;
  return (
    getRegistrySkillCandidates(state).find((skill) =>
      [skill.source_id, skill.slug, skill.source_url, skill.content_url].some(
        (value) => value?.trim().toLowerCase() === normalizedKey,
      ),
    ) || null
  );
}

function deriveGitHubSkillContentUrl(
  sourceUrl?: string,
  contentUrl?: string,
): string | undefined {
  if (contentUrl?.trim()) return contentUrl;
  const location = parseGitHubSkillLocation(sourceUrl, contentUrl);
  if (!location?.directoryPath) return undefined;
  return `https://raw.githubusercontent.com/${location.owner}/${location.repo}/${location.branch}/${location.directoryPath}/SKILL.md`;
}

function getInstalledSkillSourceCandidateKeys(skill: Skill): string[] {
  return [skill.source_id, skill.content_url, skill.source_url].filter(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );
}

function resolveInstalledSkillSourceUrls(skill: Skill) {
  const sourceUrl = skill.source_url?.trim();
  const clawHubLocation = parseClawHubSkillUrl(sourceUrl);
  const contentUrl =
    deriveGitHubSkillContentUrl(skill.source_url, skill.content_url) ||
    (clawHubLocation
      ? getClawHubSkillContentUrl(clawHubLocation.slug)
      : undefined);
  const packageUrl = clawHubLocation
    ? getClawHubSkillPackageUrl(clawHubLocation.slug)
    : undefined;
  return { sourceUrl, clawHubLocation, contentUrl, packageUrl };
}

function getInstalledSkillCanonicalPath(
  skill: Skill,
  hasClawHubLocation: boolean,
): string | undefined {
  return (
    skill.canonical_skill_path || (hasClawHubLocation ? "SKILL.md" : undefined)
  );
}

function buildInstalledSkillSourceId(
  skill: Skill,
  sourceUrl: string | undefined,
  canonicalSkillPath: string | undefined,
  contentUrl: string | undefined,
): string {
  return (
    skill.source_id ||
    buildSkillSourceId({
      sourceType: "installed-source",
      sourceUrl,
      branch: skill.source_branch,
      directory: skill.source_directory,
      skillPath: canonicalSkillPath || contentUrl,
    })
  );
}

function buildInstalledSkillSourceCandidate(
  skill: Skill,
): RegistrySkill | null {
  const { sourceUrl, clawHubLocation, contentUrl, packageUrl } =
    resolveInstalledSkillSourceUrls(skill);
  const canonicalSkillPath = getInstalledSkillCanonicalPath(
    skill,
    Boolean(clawHubLocation),
  );
  const sourceLabel =
    skill.source_label || (clawHubLocation ? "ClawHub" : undefined);
  if (!sourceUrl && !contentUrl) return null;
  return {
    slug: skill.registry_slug || skill.logical_name || skill.name,
    name: skill.name,
    install_name: skill.name,
    source_id: buildInstalledSkillSourceId(
      skill,
      sourceUrl,
      canonicalSkillPath,
      contentUrl,
    ),
    source_label: sourceLabel,
    source_branch: skill.source_branch,
    source_directory: skill.source_directory,
    canonical_skill_path: canonicalSkillPath,
    directory_fingerprint: clawHubLocation
      ? undefined
      : skill.directory_fingerprint,
    description: skill.description || "",
    category: skill.category || "general",
    icon_url: skill.icon_url,
    icon_emoji: skill.icon_emoji,
    icon_background: skill.icon_background,
    author: skill.author || "Unknown",
    source_url: sourceUrl || contentUrl || "",
    tags: skill.original_tags || skill.tags || [],
    version: "source",
    content: skill.content || skill.instructions || "",
    content_url: contentUrl,
    package_url: packageUrl,
    prerequisites: skill.prerequisites,
    compatibility: skill.compatibility,
  };
}

export function findInstalledSkillSourceCandidate(
  state: SkillState,
  skill: Skill,
): RegistrySkill | null {
  for (const key of getInstalledSkillSourceCandidateKeys(skill)) {
    const candidate = findRegistrySkillCandidateByKey(state, key);
    if (candidate) return candidate;
  }
  return buildInstalledSkillSourceCandidate(skill);
}

export function ensureRegistrySkillSourceId(
  skill: RegistrySkill,
): RegistrySkill {
  if (skill.source_id) return skill;
  return {
    ...skill,
    source_id: buildSkillSourceId({
      sourceType: "builtin-registry",
      sourceUrl: skill.source_url,
      skillPath: skill.content_url || skill.slug,
    }),
  };
}

export async function resolveRegistrySkillContent(
  registrySkill: RegistrySkill,
): Promise<string> {
  if (isLocalRegistrySkill(registrySkill)) {
    const localDir = normalizeLocalRegistryDirectory(registrySkill);
    const localSkillMd = await window.api.skill.readLocalFileByPath(
      localDir,
      "SKILL.md",
    );
    return localSkillMd?.content?.trim()
      ? localSkillMd.content
      : registrySkill.content;
  }
  if (!registrySkill.content_url) return registrySkill.content;
  const freshContent = await window.api.skill.fetchRemoteContent(
    registrySkill.content_url,
  );
  return typeof freshContent === "string" && freshContent.trim()
    ? freshContent
    : registrySkill.content;
}

export async function resolveRemoteRegistryDirectoryFingerprint(
  registrySkill: RegistrySkill,
  options: {
    remoteContentHash?: string;
    installedSkill?: Skill | null;
  } = {},
): Promise<string | undefined> {
  const sourceUrl = registrySkill.source_url;
  if (!sourceUrl || !shouldCloneRegistrySkillPackage(registrySkill)) {
    return normalizeRemoteDirectoryFingerprint(registrySkill, {
      remoteContentHash: options.remoteContentHash,
      installedSkill: options.installedSkill,
    });
  }
  const location = parseGitHubSkillLocation(sourceUrl);
  const resolvedDirectoryFingerprint =
    await window.api.skill.getRemoteGitPackageFingerprint({
      repoUrl: sourceUrl,
      branch: registrySkill.source_branch || location?.branch,
      directory:
        getRegistrySkillDirectory(registrySkill) || location?.directoryPath,
    });
  return normalizeRemoteDirectoryFingerprint(registrySkill, {
    remoteContentHash: options.remoteContentHash,
    resolvedDirectoryFingerprint,
    installedSkill: options.installedSkill,
  });
}

export function getLinkedLocalRemoteUpdateBlock(
  skill: Skill,
  check: RegistrySkillUpdateCheck,
): RegistrySkillUpdateResult | null {
  if (!isLinkedLocalSkill(skill) || check.status === "not-installed")
    return null;
  const policy = getSkillSourceUpdateActionPolicy({
    status: check.status,
    sourceMode: "local-linked",
  });
  if (
    policy.canApplyRemoteUpdate ||
    policy.recommendedAction !== "convert-to-managed-copy"
  ) {
    return null;
  }
  return {
    status: "linked-local-blocked",
    check,
    recommendedAction: "convert-to-managed-copy",
  };
}

type ScannedSourceSkill = {
  name: string;
  localPath: string;
  installMode?: "copy" | "symlink";
  directory_fingerprint?: string;
};

function getStaleSourceTarget(
  skillName: string,
  expectedFingerprint: string,
  targetType: SkillSourceStaleTarget["targetType"],
  targetId: string,
  scannedSkill: ScannedSourceSkill,
): SkillSourceStaleTarget | null {
  const currentFingerprint = scannedSkill.directory_fingerprint?.trim();
  const isSameSource = scannedSkill.name.trim().toLowerCase() === skillName;
  const isManagedCopy = (scannedSkill.installMode ?? "copy") === "copy";
  if (!isSameSource || !isManagedCopy || !currentFingerprint) return null;
  if (currentFingerprint === expectedFingerprint) return null;
  return {
    targetType,
    targetId: `${targetId}:${scannedSkill.localPath}`,
    installMode: "copy",
    currentFingerprint,
    expectedFingerprint,
  };
}

function appendStaleTargets(
  targets: SkillSourceStaleTarget[],
  skillName: string,
  expectedFingerprint: string,
  targetType: SkillSourceStaleTarget["targetType"],
  targetId: string,
  scannedSkills: ScannedSourceSkill[],
): void {
  for (const scannedSkill of scannedSkills) {
    const target = getStaleSourceTarget(
      skillName,
      expectedFingerprint,
      targetType,
      targetId,
      scannedSkill,
    );
    if (target) targets.push(target);
  }
}

export function getSkillSourceStaleTargets(
  state: Pick<SkillState, "projectScanState" | "agentScanState">,
  skill: Skill,
): SkillSourceStaleTarget[] {
  const expectedFingerprint = skill.directory_fingerprint?.trim();
  if (!expectedFingerprint) return [];
  const skillName = skill.name.trim().toLowerCase();
  const targets: SkillSourceStaleTarget[] = [];
  for (const [id, scan] of Object.entries(state.projectScanState)) {
    appendStaleTargets(
      targets,
      skillName,
      expectedFingerprint,
      "project",
      id,
      scan.scannedSkills,
    );
  }
  for (const [id, scan] of Object.entries(state.agentScanState)) {
    appendStaleTargets(
      targets,
      skillName,
      expectedFingerprint,
      "agent",
      id,
      scan.result?.scannedSkills ?? [],
    );
  }
  return targets;
}

export async function refreshRegistrySkillBaselineIfNeeded(
  check: RegistrySkillUpdateCheck,
  updateSkill: SkillState["updateSkill"],
): Promise<Skill | null> {
  const installedSkill = check.installedSkill;
  if (!installedSkill || check.status !== "up-to-date") return null;
  const directoryFingerprint =
    check.remoteDirectoryFingerprint ||
    installedSkill.directory_fingerprint ||
    check.remoteHash;
  const needsRefresh =
    installedSkill.installed_content_hash !== check.remoteHash ||
    hasRegistrySkillVersionChanged(installedSkill, check.registrySkill) ||
    installedSkill.installed_directory_fingerprint !== directoryFingerprint ||
    installedSkill.fingerprint_algorithm !==
      SKILL_PACKAGE_FINGERPRINT_ALGORITHM ||
    installedSkill.source_binding_state !== "bound" ||
    installedSkill.source_last_error != null;
  if (!needsRefresh) return null;
  const checkedAt = Date.now();
  return updateSkill(installedSkill.id, {
    installed_content_hash: check.remoteHash,
    installed_version: check.registrySkill.version,
    ...buildSourceBaselineFields({
      contentHash: check.remoteHash,
      directoryFingerprint,
      checkedAt,
    }),
  });
}

async function buildSourceUnavailableCheck(
  registrySkill: RegistrySkill,
  installedSkill: Skill | null,
  staleTargets: SkillSourceStaleTarget[] = [],
): Promise<RegistrySkillUpdateCheck> {
  const localContent = installedSkill
    ? (installedSkill.content ?? installedSkill.instructions ?? "")
    : "";
  const localHash = installedSkill
    ? await computeSkillContentHash(localContent)
    : undefined;
  const remoteContent = registrySkill.content || "";
  const remoteHash =
    installedSkill?.installed_content_hash ||
    (remoteContent
      ? await computeSkillContentHash(remoteContent)
      : localHash || "");
  return {
    status: "source-unavailable",
    skillId:
      installedSkill?.id || registrySkill.source_id || registrySkill.slug,
    ...(registrySkill.source_id || installedSkill?.source_id
      ? { sourceIdentity: registrySkill.source_id || installedSkill?.source_id }
      : {}),
    ...(installedSkill ? { installedSkill } : {}),
    registrySkill,
    ...(localHash ? { localHash } : {}),
    installedHash: installedSkill?.installed_content_hash,
    remoteHash,
    remoteContent,
    localModified: false,
    remoteChanged: false,
    shouldInitializeBaseline: false,
    hasStaleTargets: staleTargets.length > 0,
    ...(staleTargets.length > 0 ? { staleTargets } : {}),
  };
}

export async function recordSourceUnavailableCheck(options: {
  registrySkill: RegistrySkill;
  installedSkill: Skill | null;
  error: unknown;
  updateSkill: SkillState["updateSkill"];
  staleTargets?: SkillSourceStaleTarget[];
}): Promise<RegistrySkillUpdateCheck> {
  const sourceLastError = sanitizeSourceUpdateError(options.error);
  let installedSkill = options.installedSkill;
  if (installedSkill) {
    installedSkill =
      (await options.updateSkill(installedSkill.id, {
        source_last_checked_at: Date.now(),
        source_last_error: sourceLastError,
        source_binding_state: installedSkill.source_binding_state || "bound",
      })) ?? installedSkill;
  }
  return buildSourceUnavailableCheck(
    options.registrySkill,
    installedSkill,
    options.staleTargets,
  );
}

export function isDeferredSourceUpdateStatus(
  status: RegistrySkillUpdateCheck["status"],
): status is "no-source" | "source-unavailable" | "baseline-missing" {
  return (
    status === "no-source" ||
    status === "source-unavailable" ||
    status === "baseline-missing"
  );
}
