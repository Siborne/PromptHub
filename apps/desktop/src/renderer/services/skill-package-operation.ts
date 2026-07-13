import type {
  RegistrySkill,
  SkillPackageFileInput,
  SkillPackageOperationFailure,
  SkillPackageOperationFailureCode,
  SkillPackageOperationRequest,
  SkillPackageOperationResult,
  SkillPackageOperationSource,
  SkillUpdateSafetyReview,
  Skill,
} from "@prompthub/shared/types";
import type { TFunction } from "i18next";
import {
  getRegistrySkillDirectory,
  isLocalRegistrySkill,
  normalizeLocalRegistryDirectory,
  parseGitHubSkillLocation,
  shouldCloneRegistrySkillPackage,
} from "./skill-source-resolver";

export class SkillPackageOperationError extends Error {
  constructor(readonly failure: SkillPackageOperationFailure) {
    super(failure.summary || failure.code);
    this.name = "SkillPackageOperationError";
  }
}

const PACKAGE_FAILURE_COPY: Record<
  SkillPackageOperationFailureCode,
  { key: string; defaultValue: string }
> = {
  SOURCE_UNAVAILABLE: {
    key: "skill.packageFailure.sourceUnavailable",
    defaultValue: "The Skill source is unavailable. Check it and try again.",
  },
  INVALID_PACKAGE: {
    key: "skill.packageFailure.invalidPackage",
    defaultValue: "The Skill package is invalid.",
  },
  SAFETY_BLOCKED: {
    key: "skill.packageFailure.safetyBlocked",
    defaultValue: "Safety checks blocked this Skill package.",
  },
  DUPLICATE_SOURCE: {
    key: "skill.packageFailure.duplicateSource",
    defaultValue: "This exact Skill source is already installed.",
  },
  CONFLICT: {
    key: "skill.packageFailure.conflict",
    defaultValue:
      "The Skill changed during this operation. Check it and try again.",
  },
  STAGING_FAILED: {
    key: "skill.packageFailure.stagingFailed",
    defaultValue: "PromptHub could not prepare the Skill package.",
  },
  PACKAGE_APPLY_FAILED: {
    key: "skill.packageFailure.packageApplyFailed",
    defaultValue: "PromptHub could not replace the managed Skill files.",
  },
  DATABASE_FINALIZE_FAILED: {
    key: "skill.packageFailure.databaseFinalizeFailed",
    defaultValue: "PromptHub could not save the Skill operation.",
  },
  ROLLBACK_INCOMPLETE: {
    key: "skill.packageFailure.rollbackIncomplete",
    defaultValue:
      "PromptHub could not fully restore the previous state. Restart before retrying.",
  },
  OPERATION_IN_PROGRESS: {
    key: "skill.packageFailure.operationInProgress",
    defaultValue: "This Skill operation is already in progress.",
  },
};

/** Map stable lifecycle failures to localized copy without leaking diagnostics. */
export function formatSkillPackageOperationError(
  error: unknown,
  t: TFunction,
): string {
  if (!(error instanceof SkillPackageOperationError)) {
    return error instanceof Error ? error.message : String(error);
  }
  const copy = PACKAGE_FAILURE_COPY[error.failure.code];
  return t(copy.key, copy.defaultValue);
}

function buildGitHubRawSource(
  registrySkill: RegistrySkill,
): SkillPackageOperationSource | null {
  const location = parseGitHubSkillLocation(
    registrySkill.source_url,
    registrySkill.content_url,
  );
  if (!location) return null;
  return {
    kind: "remote-git",
    repoUrl: `https://github.com/${location.owner}/${location.repo}.git`,
    branch: registrySkill.source_branch || location.branch,
    directory:
      getRegistrySkillDirectory(registrySkill) || location.directoryPath,
  };
}

/** Resolve every Store source into the complete package shape sent to main. */
export function buildSkillPackageOperationSource(
  registrySkill: RegistrySkill,
  content: string,
  packageFiles?: SkillPackageFileInput[],
): SkillPackageOperationSource {
  if (packageFiles?.length) {
    return {
      kind: "files",
      sourceUrl: registrySkill.source_url,
      files: packageFiles,
    };
  }
  if (isLocalRegistrySkill(registrySkill)) {
    return {
      kind: "local-directory",
      directory: normalizeLocalRegistryDirectory(registrySkill),
    };
  }
  if (registrySkill.package_url?.trim()) {
    return { kind: "remote-zip", zipUrl: registrySkill.package_url.trim() };
  }
  if (shouldCloneRegistrySkillPackage(registrySkill)) {
    return {
      kind: "remote-git",
      repoUrl: registrySkill.source_url,
      branch: registrySkill.source_branch,
      directory: getRegistrySkillDirectory(registrySkill),
    };
  }
  return (
    buildGitHubRawSource(registrySkill) || {
      kind: "content",
      sourceUrl: registrySkill.content_url || registrySkill.source_url,
      content,
    }
  );
}

/** Preserve the trusted-source policy while pinning approval to exact bytes. */
export async function runTrustedSkillPackageOperation(
  request: SkillPackageOperationRequest,
  trustedSourceKeys: string[],
): Promise<SkillPackageOperationResult> {
  const result = await window.api.skill.runPackageOperation(request);
  if (
    result.status !== "review-required" ||
    !trustedSourceKeys.includes(result.review.sourceKey)
  ) {
    return result;
  }
  return window.api.skill.runPackageOperation({
    ...request,
    approvedPackageFingerprint: result.review.packageFingerprint,
  });
}

export type ResolvedSkillPackageOperation =
  | { status: "completed"; skill: Skill }
  | { status: "review-required"; review: SkillUpdateSafetyReview }
  | { status: "cancelled" };

/** Exhaustively turn structured main-process outcomes into renderer outcomes. */
export function resolveSkillPackageOperationResult(
  result: SkillPackageOperationResult,
): ResolvedSkillPackageOperation {
  switch (result.status) {
    case "completed":
      return { status: "completed", skill: result.skill };
    case "review-required":
      return { status: "review-required", review: result.review };
    case "cancelled":
      return { status: "cancelled" };
    case "blocked":
    case "conflict":
    case "source-unavailable":
    case "failed":
      throw new SkillPackageOperationError(result.failure);
  }
}
