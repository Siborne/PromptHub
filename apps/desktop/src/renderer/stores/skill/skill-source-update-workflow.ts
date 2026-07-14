import type {
  RegistrySkill,
  Skill,
  SkillPackageSnapshot,
  SkillSourceStaleTarget,
} from "@prompthub/shared/types";
import { buildSkillSourceId } from "@prompthub/shared/utils/skill-identity";
import {
  getSkillSourceUpdateActionPolicy,
  SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
} from "@prompthub/shared/utils/skill-source-update";
import { computeSkillPackageFingerprintV1Sync } from "@prompthub/shared/utils/skill-source-update";
import {
  getClawHubSkillContentUrl,
  getClawHubSkillPackageUrl,
  parseClawHubSkillUrl,
} from "../../services/clawhub-store";
import {
  getRegistrySkillSourceReference,
  isLinkedLocalSkill,
  isLocalRegistrySkill,
  normalizeLocalRegistryDirectory,
  normalizeRemoteDirectoryFingerprint,
  parseGitHubSkillLocation,
  resolveRegistrySkillGitPackage,
  shouldCloneRegistrySkillPackage,
} from "../../services/skill-source-resolver";
import {
  computeSkillContentHash,
  hasRegistrySkillVersionChanged,
  type RegistrySkillUpdateCheck,
} from "../../services/skill-store-update";
import { getRemoteStoreSkills } from "../../services/remote-store-entry";
import {
  getCloudSkillMarkdown,
  getCloudStorePackage,
  isCloudRegistrySkill,
} from "../../services/cloud-store";
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

function normalizeSourceMatchValue(value?: string | null): string {
  return value?.trim().toLowerCase() ?? "";
}

function findRegistrySkillByExactField(
  state: SkillState,
  field: "source_id" | "content_url" | "slug",
  value?: string | null,
): RegistrySkill | null {
  const normalizedValue = normalizeSourceMatchValue(value);
  if (!normalizedValue) return null;
  return (
    getRegistrySkillCandidates(state).find(
      (candidate) =>
        normalizeSourceMatchValue(candidate[field]) === normalizedValue,
    ) ?? null
  );
}

function scoreInstalledRegistryCandidate(
  installedSkill: Skill,
  candidate: RegistrySkill,
): number {
  if (
    normalizeSourceMatchValue(installedSkill.source_directory) &&
    normalizeSourceMatchValue(installedSkill.source_directory) ===
      normalizeSourceMatchValue(candidate.source_directory)
  ) {
    return 100;
  }
  if (
    normalizeSourceMatchValue(installedSkill.canonical_skill_path) &&
    normalizeSourceMatchValue(installedSkill.canonical_skill_path) ===
      normalizeSourceMatchValue(candidate.canonical_skill_path)
  ) {
    return 90;
  }
  const installedName = normalizeSourceMatchValue(installedSkill.name);
  if (
    installedName &&
    [candidate.install_name, candidate.name].some(
      (value) => normalizeSourceMatchValue(value) === installedName,
    )
  ) {
    return 50;
  }
  return 0;
}

function findRegistrySkillBySharedSourceUrl(
  state: SkillState,
  installedSkill: Skill,
): RegistrySkill | null {
  const sourceUrl = normalizeSourceMatchValue(installedSkill.source_url);
  if (!sourceUrl) return null;
  const candidates = getRegistrySkillCandidates(state).filter(
    (candidate) =>
      normalizeSourceMatchValue(candidate.source_url) === sourceUrl,
  );
  if (candidates.length === 1) return candidates[0];
  const ranked = candidates
    .map((candidate) => ({
      candidate,
      score: scoreInstalledRegistryCandidate(installedSkill, candidate),
    }))
    .sort((left, right) => right.score - left.score);
  if (!ranked[0]?.score || ranked[0].score === ranked[1]?.score) return null;
  return ranked[0].candidate;
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
  const installedSourceCandidate = buildInstalledSkillSourceCandidate(skill);
  if (
    installedSourceCandidate &&
    isLocalRegistrySkill(installedSourceCandidate)
  ) {
    return installedSourceCandidate;
  }
  const exactSourceCandidate =
    findRegistrySkillByExactField(state, "source_id", skill.source_id) ||
    findRegistrySkillByExactField(state, "content_url", skill.content_url) ||
    findRegistrySkillByExactField(state, "slug", skill.registry_slug);
  if (exactSourceCandidate) return exactSourceCandidate;
  const sharedSourceCandidate = findRegistrySkillBySharedSourceUrl(
    state,
    skill,
  );
  if (sharedSourceCandidate) return sharedSourceCandidate;
  return installedSourceCandidate;
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
  if (isCloudRegistrySkill(registrySkill)) {
    return getCloudSkillMarkdown(await getCloudStorePackage(registrySkill));
  }
  const packageSnapshot =
    await resolveRegistrySkillPackageSnapshot(registrySkill);
  if (packageSnapshot) {
    return packageSnapshot.content;
  }
  if (!registrySkill.content_url) return registrySkill.content;
  const freshContent = await window.api.skill.fetchRemoteContent(
    registrySkill.content_url,
  );
  return typeof freshContent === "string" && freshContent.trim()
    ? freshContent
    : registrySkill.content;
}

export async function resolveRegistrySkillPackageSnapshot(
  registrySkill: RegistrySkill,
): Promise<SkillPackageSnapshot | null> {
  if (isLocalRegistrySkill(registrySkill)) {
    const localDirectory = normalizeLocalRegistryDirectory(registrySkill);
    if (!localDirectory) return null;
    const snapshot =
      await window.api.skill.getLocalPackageSnapshot(localDirectory);
    return snapshot;
  }
  if (registrySkill.package_url?.trim()) {
    const snapshot = await window.api.skill.getRemoteZipPackageSnapshot({
      zipUrl: registrySkill.package_url.trim(),
    });
    return snapshot;
  }
  const gitPackage = shouldCloneRegistrySkillPackage(registrySkill)
    ? resolveRegistrySkillGitPackage(registrySkill)
    : null;
  if (!gitPackage) return null;
  const snapshot =
    await window.api.skill.getRemoteGitPackageSnapshot(gitPackage);
  return snapshot;
}

export async function resolveRemoteRegistryDirectoryFingerprint(
  registrySkill: RegistrySkill,
  options: {
    remoteContentHash?: string;
    installedSkill?: Skill | null;
  } = {},
): Promise<string | undefined> {
  if (isLocalRegistrySkill(registrySkill)) {
    const localDir = normalizeLocalRegistryDirectory(registrySkill);
    const resolvedDirectoryFingerprint = localDir
      ? (await window.api.skill.getLocalPackageSnapshot(localDir))
          .directoryFingerprint
      : undefined;
    return normalizeRemoteDirectoryFingerprint(registrySkill, {
      remoteContentHash: options.remoteContentHash,
      resolvedDirectoryFingerprint,
      installedSkill: options.installedSkill,
    });
  }
  if (isCloudRegistrySkill(registrySkill)) {
    const packageResponse = await getCloudStorePackage(registrySkill);
    const fingerprint = computeSkillPackageFingerprintV1Sync(
      packageResponse.package.files.map((file) => ({
        path: file.path,
        content: file.content,
      })),
    ).fingerprint;
    return normalizeRemoteDirectoryFingerprint(registrySkill, {
      remoteContentHash: options.remoteContentHash,
      resolvedDirectoryFingerprint: fingerprint,
      installedSkill: options.installedSkill,
    });
  }
  if (!shouldCloneRegistrySkillPackage(registrySkill)) {
    return normalizeRemoteDirectoryFingerprint(registrySkill, {
      remoteContentHash: options.remoteContentHash,
      installedSkill: options.installedSkill,
    });
  }
  const gitPackage = resolveRegistrySkillGitPackage(registrySkill);
  if (!gitPackage) {
    return normalizeRemoteDirectoryFingerprint(registrySkill, {
      remoteContentHash: options.remoteContentHash,
      installedSkill: options.installedSkill,
    });
  }
  const resolvedDirectoryFingerprint =
    await window.api.skill.getRemoteGitPackageFingerprint(gitPackage);
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

function buildRegistrySourceMetadata(
  registrySkill: RegistrySkill,
): Partial<Skill> {
  return {
    ...(registrySkill.source_id ? { source_id: registrySkill.source_id } : {}),
    ...(registrySkill.source_url
      ? { source_url: registrySkill.source_url }
      : {}),
    ...(registrySkill.content_url
      ? { content_url: registrySkill.content_url }
      : {}),
    ...(registrySkill.source_label
      ? { source_label: registrySkill.source_label }
      : {}),
    ...(registrySkill.slug ? { registry_slug: registrySkill.slug } : {}),
    ...(registrySkill.source_branch
      ? { source_branch: registrySkill.source_branch }
      : {}),
    ...(registrySkill.source_directory
      ? { source_directory: registrySkill.source_directory }
      : {}),
    ...(registrySkill.canonical_skill_path
      ? { canonical_skill_path: registrySkill.canonical_skill_path }
      : {}),
  };
}

function hasRegistrySourceMetadataChanged(
  installedSkill: Skill,
  sourceMetadata: Partial<Skill>,
): boolean {
  const comparableKeys = [
    "source_id",
    "source_url",
    "content_url",
    "source_label",
    "registry_slug",
    "source_branch",
    "source_directory",
    "canonical_skill_path",
  ] as const;
  return comparableKeys.some(
    (key) =>
      sourceMetadata[key] !== undefined &&
      sourceMetadata[key] !== installedSkill[key],
  );
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
  const sourceMetadata = buildRegistrySourceMetadata(check.registrySkill);
  const needsRefresh =
    installedSkill.installed_content_hash !== check.remoteHash ||
    hasRegistrySkillVersionChanged(installedSkill, check.registrySkill) ||
    installedSkill.installed_directory_fingerprint !== directoryFingerprint ||
    installedSkill.fingerprint_algorithm !==
      SKILL_PACKAGE_FINGERPRINT_ALGORITHM ||
    installedSkill.source_binding_state !== "bound" ||
    installedSkill.source_last_error != null ||
    hasRegistrySourceMetadataChanged(installedSkill, sourceMetadata);
  if (!needsRefresh) return null;
  const checkedAt = Date.now();
  return updateSkill(installedSkill.id, {
    installed_content_hash: check.remoteHash,
    installed_version: check.registrySkill.version,
    ...sourceMetadata,
    ...buildSourceBaselineFields({
      contentHash: check.remoteHash,
      directoryFingerprint,
      checkedAt,
    }),
  });
}

export async function clearSourceErrorAfterSuccessfulCheck(
  check: RegistrySkillUpdateCheck,
  updateSkill: SkillState["updateSkill"],
): Promise<void> {
  const installedSkill = check.installedSkill;
  if (
    !installedSkill ||
    check.status === "source-unavailable" ||
    !installedSkill.source_last_error?.trim()
  ) {
    return;
  }
  await updateSkill(installedSkill.id, {
    source_last_checked_at: Date.now(),
    source_last_error: null,
    source_binding_state: installedSkill.source_binding_state || "bound",
  });
}

async function buildSourceUnavailableCheck(
  registrySkill: RegistrySkill,
  installedSkill: Skill | null,
  options: {
    staleTargets?: SkillSourceStaleTarget[];
    sourceError?: string;
  } = {},
): Promise<RegistrySkillUpdateCheck> {
  const staleTargets = options.staleTargets || [];
  const sourceReference = getRegistrySkillSourceReference(
    registrySkill,
    installedSkill,
  );
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
    sourceKind: sourceReference.kind,
    sourceReference: sourceReference.reference,
    ...(options.sourceError ? { sourceError: options.sourceError } : {}),
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
  return buildSourceUnavailableCheck(options.registrySkill, installedSkill, {
    staleTargets: options.staleTargets,
    sourceError: sourceLastError,
  });
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
