import { useCallback, useRef, useState } from "react";
import type {
  RegistrySkill,
  RegistrySkillInstallOptions,
  RegistrySkillInstallResult,
  SkillUpdateSafetyReview,
} from "@prompthub/shared/types";
import { useSettingsStore } from "../../stores/settings.store";
import { useSkillStore } from "../../stores/skill.store";
import type { RegistrySkillUpdateResult } from "../../stores/skill/skill-store-types";
import { getRegistrySkillSelectionId } from "./skill-store-identifiers";

export interface PendingSkillInstallReview {
  skill: RegistrySkill;
  review: SkillUpdateSafetyReview;
  options?: RegistrySkillInstallOptions;
}

function getReviewKey(review: PendingSkillInstallReview): string {
  return `${review.review.sourceKey}:${review.review.packageFingerprint}`;
}

/** Shared controller for resumable, fingerprint-pinned Skill installations. */
export function useSkillPackageInstall() {
  const installRegistrySkill = useSkillStore(
    (state) => state.installRegistrySkill,
  );
  const trustSource = useSettingsStore((state) => state.trustSkillUpdateSource);
  const [pendingReviews, setPendingReviews] = useState<
    PendingSkillInstallReview[]
  >([]);
  const [trustReviewedSource, setTrustReviewedSource] = useState(false);
  const [isConfirmingReview, setIsConfirmingReview] = useState(false);
  const confirmInFlightRef = useRef(false);
  const pendingReview = pendingReviews[0] ?? null;

  const enqueueReview = useCallback((review: PendingSkillInstallReview) => {
    setPendingReviews((current) => {
      const key = getReviewKey(review);
      return current.some((item) => getReviewKey(item) === key)
        ? current
        : [...current, review];
    });
  }, []);

  const install = useCallback(
    async (
      skill: RegistrySkill,
      options?: RegistrySkillInstallOptions,
    ): Promise<RegistrySkillInstallResult | null> => {
      const result = options
        ? await installRegistrySkill(skill, options)
        : await installRegistrySkill(skill);
      if (result?.status === "safety-review-required") {
        enqueueReview({ skill, review: result.review, options });
      }
      return result;
    },
    [enqueueReview, installRegistrySkill],
  );

  const removeCurrentReview = useCallback(() => {
    setPendingReviews((current) => current.slice(1));
    setTrustReviewedSource(false);
  }, []);

  const confirmReview = useCallback(async () => {
    if (!pendingReview || confirmInFlightRef.current) return null;
    confirmInFlightRef.current = true;
    setIsConfirmingReview(true);
    try {
      const result = await installRegistrySkill(pendingReview.skill, {
        ...pendingReview.options,
        approvedPackageFingerprint: pendingReview.review.packageFingerprint,
      });
      if (result?.status === "safety-review-required") {
        setPendingReviews((current) => [
          {
            skill: pendingReview.skill,
            review: result.review,
            options: pendingReview.options,
          },
          ...current.slice(1),
        ]);
        setTrustReviewedSource(false);
        return result;
      }
      if (result?.status === "installed" && trustReviewedSource) {
        trustSource(pendingReview.review.sourceKey);
      }
      if (result?.status === "installed") removeCurrentReview();
      return result;
    } finally {
      confirmInFlightRef.current = false;
      setIsConfirmingReview(false);
    }
  }, [
    installRegistrySkill,
    pendingReview,
    removeCurrentReview,
    trustReviewedSource,
    trustSource,
  ]);

  const closeReview = useCallback(() => {
    if (!confirmInFlightRef.current) removeCurrentReview();
  }, [removeCurrentReview]);

  const resetReviews = useCallback(() => {
    if (confirmInFlightRef.current) return;
    setPendingReviews([]);
    setTrustReviewedSource(false);
  }, []);

  return {
    install,
    pendingReview,
    pendingReviewCount: pendingReviews.length,
    trustReviewedSource,
    setTrustReviewedSource,
    isConfirmingReview,
    confirmReview,
    closeReview,
    resetReviews,
  };
}

interface PendingSkillUpdateReview {
  skill: RegistrySkill;
  review: SkillUpdateSafetyReview;
  options?: Parameters<
    ReturnType<typeof useSkillStore.getState>["updateRegistrySkill"]
  >[1];
}

/** Review queue used when batch Store updates require fingerprint approval. */
export function useRegistrySkillUpdateReview() {
  const updateRegistrySkill = useSkillStore(
    (state) => state.updateRegistrySkill,
  );
  const trustSource = useSettingsStore((state) => state.trustSkillUpdateSource);
  const [pendingReviews, setPendingReviews] = useState<
    PendingSkillUpdateReview[]
  >([]);
  const [trustReviewedSource, setTrustReviewedSource] = useState(false);
  const [isConfirmingReview, setIsConfirmingReview] = useState(false);
  const confirmInFlightRef = useRef(false);
  const pendingReview = pendingReviews[0] ?? null;

  const enqueueReview = useCallback(
    (
      skill: RegistrySkill,
      review: SkillUpdateSafetyReview,
      options?: PendingSkillUpdateReview["options"],
    ) => {
      setPendingReviews((current) => {
        const key = `${review.sourceKey}:${review.packageFingerprint}`;
        if (
          current.some(
            (item) =>
              `${item.review.sourceKey}:${item.review.packageFingerprint}` ===
              key,
          )
        ) {
          return current;
        }
        return [...current, { skill, review, options }];
      });
    },
    [],
  );

  const removeCurrentReview = useCallback(() => {
    setPendingReviews((current) => current.slice(1));
    setTrustReviewedSource(false);
  }, []);

  const confirmReview =
    useCallback(async (): Promise<RegistrySkillUpdateResult | null> => {
      if (!pendingReview || confirmInFlightRef.current) return null;
      confirmInFlightRef.current = true;
      setIsConfirmingReview(true);
      try {
        const result = await updateRegistrySkill(
          getRegistrySkillSelectionId(pendingReview.skill),
          {
            ...pendingReview.options,
            approvedPackageFingerprint: pendingReview.review.packageFingerprint,
          },
        );
        if (result?.status === "safety-review-required") {
          setPendingReviews((current) => [
            {
              skill: pendingReview.skill,
              review: result.review,
              options: pendingReview.options,
            },
            ...current.slice(1),
          ]);
          setTrustReviewedSource(false);
          return result;
        }
        if (result?.status === "updated" && trustReviewedSource) {
          trustSource(pendingReview.review.sourceKey);
        }
        removeCurrentReview();
        return result;
      } finally {
        confirmInFlightRef.current = false;
        setIsConfirmingReview(false);
      }
    }, [
      pendingReview,
      removeCurrentReview,
      trustReviewedSource,
      trustSource,
      updateRegistrySkill,
    ]);

  return {
    pendingReview,
    pendingReviewCount: pendingReviews.length,
    trustReviewedSource,
    setTrustReviewedSource,
    isConfirmingReview,
    enqueueReview,
    confirmReview,
    closeReview: () => {
      if (!confirmInFlightRef.current) removeCurrentReview();
    },
  };
}
