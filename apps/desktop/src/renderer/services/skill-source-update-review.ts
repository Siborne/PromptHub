import type {
  RemoteSkillPackageSaveResult,
  SkillUpdateSafetyReview,
} from "@prompthub/shared/types";

type CompatibleRemoteSaveResult = RemoteSkillPackageSaveResult | string | void;

export class SkillUpdateSafetyReviewRequiredError extends Error {
  constructor(readonly review: SkillUpdateSafetyReview) {
    super("SAFETY_REVIEW_REQUIRED");
  }
}

interface SaveRemotePackageInput {
  approvedPackageFingerprint?: string;
}

/** Stage a package, auto-retrying only when its exact source is trusted. */
export async function saveRemotePackageWithTrustedReview(
  save: (input: SaveRemotePackageInput) => Promise<CompatibleRemoteSaveResult>,
  trustedSourceKeys: readonly string[],
  approvedPackageFingerprint?: string,
): Promise<void> {
  let result = await save({ approvedPackageFingerprint });
  if (
    typeof result === "object" &&
    result?.status === "safety-review-required" &&
    trustedSourceKeys.includes(result.review.sourceKey)
  ) {
    result = await save({
      approvedPackageFingerprint: result.review.packageFingerprint,
    });
  }
  if (
    typeof result === "object" &&
    result?.status === "safety-review-required"
  ) {
    throw new SkillUpdateSafetyReviewRequiredError(result.review);
  }
}
