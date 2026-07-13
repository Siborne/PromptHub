import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { Skill, SkillUpdateSafetyReview } from "@prompthub/shared/types";
import type { RegistrySkillUpdateStatus } from "../../services/skill-store-update";
import { useSettingsStore } from "../../stores/settings.store";
import { useSkillStore } from "../../stores/skill.store";
import { useToast } from "../ui/Toast";
import { formatSkillPackageOperationError } from "./detail-utils";

type ToastKind = "success" | "warning" | "error" | "info";
interface PendingSafetyReview {
  review: SkillUpdateSafetyReview;
  overwriteLocalChanges: boolean;
}

const STATUS_TOASTS: Partial<
  Record<RegistrySkillUpdateStatus, [string, string, ToastKind]>
> = {
  "up-to-date": ["skill.sourceUpToDate", "Already up to date", "success"],
  "update-available": [
    "skill.sourceUpdateAvailable",
    "Update available",
    "info",
  ],
  "local-modified": [
    "skill.sourceUpdateLocalModified",
    "Local changes detected. Create a snapshot or review changes before updating.",
    "warning",
  ],
  conflict: [
    "skill.sourceUpdateConflict",
    "Source and local content both changed. Review versions before overwriting.",
    "warning",
  ],
  "baseline-missing": [
    "skill.sourceUpdateBaselineMissing",
    "Unable to reconcile history. Keep local changes as a baseline, reset from source, or detach the source binding.",
    "warning",
  ],
  "source-unavailable": [
    "skill.sourceUnavailable",
    "Source is unavailable. Check the source URL or try again later.",
    "error",
  ],
  "no-source": [
    "skill.sourceUpdateNoSource",
    "This Skill is local only.",
    "info",
  ],
};

function useSourceUpdateState(skillId?: string) {
  const [status, setStatus] = useState<RegistrySkillUpdateStatus | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingReview, setPendingReview] =
    useState<PendingSafetyReview | null>(null);
  const [trustReviewedSource, setTrustReviewedSource] = useState(false);
  const checkInFlightRef = useRef(false);
  const updateInFlightRef = useRef(false);
  useEffect(() => {
    setStatus(null);
    setPendingReview(null);
    setTrustReviewedSource(false);
  }, [skillId]);
  return {
    status,
    setStatus,
    isChecking,
    setIsChecking,
    isUpdating,
    setIsUpdating,
    pendingReview,
    setPendingReview,
    trustReviewedSource,
    setTrustReviewedSource,
    checkInFlightRef,
    updateInFlightRef,
  };
}

function useSourceUpdateDependencies() {
  return {
    loadSkills: useSkillStore((state) => state.loadSkills),
    getUpdateStatus: useSkillStore(
      (state) => state.getInstalledSkillSourceUpdateStatus,
    ),
    updateFromSource: useSkillStore(
      (state) => state.updateInstalledSkillFromSource,
    ),
    trustSource: useSettingsStore((state) => state.trustSkillUpdateSource),
  };
}

function createToastHelpers(
  t: TFunction,
  showToast: (message: string, type: ToastKind) => void,
) {
  return {
    showStatus(status: RegistrySkillUpdateStatus) {
      const config = STATUS_TOASTS[status] ?? [
        "skill.sourceUpdateUnavailable",
        "No source update target found",
        "error",
      ];
      showToast(t(config[0], config[1]), config[2]);
    },
    showError(error: unknown) {
      showToast(
        `${t("skill.updateFailed", "Update failed")}: ${formatSkillPackageOperationError(error, t)}`,
        "error",
      );
    },
    showSuccess() {
      showToast(
        t("skill.sourceUpdateSuccess", "Updated from source"),
        "success",
      );
    },
    showLinkedLocalBlocked() {
      showToast(
        t(
          "skill.linkedLocalUpdateBlocked",
          "This Skill is linked to an external folder. Convert it to a managed copy before updating from source, or update the external folder manually.",
        ),
        "warning",
      );
    },
  };
}

type SourceUpdateState = ReturnType<typeof useSourceUpdateState>;
type SourceUpdateDependencies = ReturnType<typeof useSourceUpdateDependencies>;
type ToastHelpers = ReturnType<typeof createToastHelpers>;

function createCheckAction(
  selectedSkill: Skill | null,
  state: SourceUpdateState,
  dependencies: SourceUpdateDependencies,
  toast: ToastHelpers,
) {
  return async () => {
    if (!selectedSkill || state.checkInFlightRef.current) return;
    state.checkInFlightRef.current = true;
    state.setIsChecking(true);
    try {
      const result = await dependencies.getUpdateStatus(selectedSkill.id);
      state.setStatus(result?.status ?? null);
      toast.showStatus(result?.status ?? "source-unavailable");
    } catch (error) {
      console.error("Failed to check source updates:", error);
      toast.showError(error);
    } finally {
      state.checkInFlightRef.current = false;
      state.setIsChecking(false);
    }
  };
}

async function handleApplyResult(
  result: Awaited<ReturnType<SourceUpdateDependencies["updateFromSource"]>>,
  overwriteLocalChanges: boolean,
  state: SourceUpdateState,
  dependencies: SourceUpdateDependencies,
  toast: ToastHelpers,
) {
  if (!result) return toast.showStatus("source-unavailable");
  if (result.status === "safety-review-required") {
    state.setPendingReview({ review: result.review, overwriteLocalChanges });
    state.setTrustReviewedSource(false);
  } else if (result.status === "linked-local-blocked") {
    state.setStatus(result.check.status);
    toast.showLinkedLocalBlocked();
  } else if (result.status !== "updated") {
    state.setStatus(result.check.status);
    toast.showStatus(result.check.status);
  } else {
    state.setStatus("up-to-date");
    await dependencies.loadSkills();
    toast.showSuccess();
  }
}

function createApplyAction(
  selectedSkill: Skill | null,
  state: SourceUpdateState,
  dependencies: SourceUpdateDependencies,
  toast: ToastHelpers,
) {
  return async (overwriteLocalChanges = false) => {
    if (!selectedSkill || state.updateInFlightRef.current) return;
    state.updateInFlightRef.current = true;
    state.setIsUpdating(true);
    try {
      const result = overwriteLocalChanges
        ? await dependencies.updateFromSource(selectedSkill.id, {
            overwriteLocalChanges: true,
          })
        : await dependencies.updateFromSource(selectedSkill.id);
      await handleApplyResult(
        result,
        overwriteLocalChanges,
        state,
        dependencies,
        toast,
      );
    } catch (error) {
      console.error("Failed to update from source:", error);
      toast.showError(error);
    } finally {
      state.updateInFlightRef.current = false;
      state.setIsUpdating(false);
    }
  };
}

async function handleConfirmedResult(
  result: Awaited<ReturnType<SourceUpdateDependencies["updateFromSource"]>>,
  pending: PendingSafetyReview,
  state: SourceUpdateState,
  dependencies: SourceUpdateDependencies,
  toast: ToastHelpers,
) {
  if (result?.status === "safety-review-required") {
    state.setPendingReview({ ...pending, review: result.review });
  } else if (result?.status !== "updated") {
    state.setPendingReview(null);
    if (result) toast.showStatus(result.check.status);
  } else {
    if (state.trustReviewedSource)
      dependencies.trustSource(pending.review.sourceKey);
    state.setPendingReview(null);
    state.setStatus("up-to-date");
    await dependencies.loadSkills();
    toast.showSuccess();
  }
}

function createConfirmAction(
  selectedSkill: Skill | null,
  state: SourceUpdateState,
  dependencies: SourceUpdateDependencies,
  toast: ToastHelpers,
) {
  return async () => {
    if (!selectedSkill || !state.pendingReview) return;
    const pending = state.pendingReview;
    state.setIsUpdating(true);
    try {
      const result = await dependencies.updateFromSource(selectedSkill.id, {
        overwriteLocalChanges: pending.overwriteLocalChanges,
        approvedPackageFingerprint: pending.review.packageFingerprint,
      });
      await handleConfirmedResult(result, pending, state, dependencies, toast);
    } catch (error) {
      toast.showError(error);
    } finally {
      state.setIsUpdating(false);
    }
  };
}

export function useSkillSourceUpdate(selectedSkill: Skill | null) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const state = useSourceUpdateState(selectedSkill?.id);
  const dependencies = useSourceUpdateDependencies();
  const toast = createToastHelpers(t, showToast);
  return {
    status: state.status,
    isChecking: state.isChecking,
    isUpdating: state.isUpdating,
    pendingReview: state.pendingReview,
    trustReviewedSource: state.trustReviewedSource,
    setTrustReviewedSource: state.setTrustReviewedSource,
    check: createCheckAction(selectedSkill, state, dependencies, toast),
    apply: createApplyAction(selectedSkill, state, dependencies, toast),
    confirmReview: createConfirmAction(
      selectedSkill,
      state,
      dependencies,
      toast,
    ),
    closeReview: () => {
      if (!state.isUpdating) state.setPendingReview(null);
    },
  };
}
