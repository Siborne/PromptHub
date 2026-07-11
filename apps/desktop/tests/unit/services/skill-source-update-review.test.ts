import { describe, expect, it, vi } from "vitest";
import {
  saveRemotePackageWithTrustedReview,
  SkillUpdateSafetyReviewRequiredError,
} from "../../../src/renderer/services/skill-source-update-review";

const review = {
  report: {
    level: "high-risk" as const,
    summary: "Detected one high-risk and three warning findings",
    findings: [],
    recommendedAction: "review" as const,
    scannedAt: 1,
    checkedFileCount: 4,
    scanMethod: "preflight" as const,
  },
  packageFingerprint: "a".repeat(64),
  sourceKey: "source-private-gitea-writer",
};

describe("Skill source update review", () => {
  it("returns the structured review for an untrusted private source", async () => {
    const save = vi.fn().mockResolvedValue({
      status: "safety-review-required",
      review,
    });

    await expect(
      saveRemotePackageWithTrustedReview(save, []),
    ).rejects.toMatchObject<Partial<SkillUpdateSafetyReviewRequiredError>>({
      review,
    });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("retries a trusted exact source with only the staged fingerprint", async () => {
    const save = vi
      .fn()
      .mockResolvedValueOnce({ status: "safety-review-required", review })
      .mockResolvedValueOnce({ status: "saved", repoPath: "/managed/repo" });

    await saveRemotePackageWithTrustedReview(save, [review.sourceKey]);

    expect(save).toHaveBeenNthCalledWith(1, {
      approvedPackageFingerprint: undefined,
    });
    expect(save).toHaveBeenNthCalledWith(2, {
      approvedPackageFingerprint: review.packageFingerprint,
    });
  });

  it("requires another review when the package changes during retry", async () => {
    const changedReview = {
      ...review,
      packageFingerprint: "b".repeat(64),
    };
    const save = vi
      .fn()
      .mockResolvedValueOnce({ status: "safety-review-required", review })
      .mockResolvedValueOnce({
        status: "safety-review-required",
        review: changedReview,
      });

    await expect(
      saveRemotePackageWithTrustedReview(save, [review.sourceKey]),
    ).rejects.toMatchObject({ review: changedReview });
  });
});
