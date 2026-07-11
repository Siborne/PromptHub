import type { TFunction } from "i18next";
import type { SkillUpdateSafetyReview } from "@prompthub/shared/types";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { getSkillSafetyFindingTitle } from "./safety-i18n";

interface SkillUpdateSafetyReviewDialogProps {
  review: SkillUpdateSafetyReview | null;
  trustSource: boolean;
  isLoading: boolean;
  t: TFunction;
  onTrustSourceChange: (trusted: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export function SkillUpdateSafetyReviewDialog({
  review,
  trustSource,
  isLoading,
  t,
  onTrustSourceChange,
  onClose,
  onConfirm,
}: SkillUpdateSafetyReviewDialogProps) {
  return (
    <ConfirmDialog
      isOpen={Boolean(review)}
      onClose={onClose}
      onConfirm={onConfirm}
      isLoading={isLoading}
      variant="destructive"
      title={t("skill.updateSafetyReviewTitle", "Review Skill Update")}
      message={
        review ? (
          <div className="space-y-3 text-left">
            <p>{review.report.summary}</p>
            <ul className="space-y-1 text-sm">
              {review.report.findings.slice(0, 6).map((finding) => (
                <li key={`${finding.code}-${finding.filePath || ""}`}>
                  {getSkillSafetyFindingTitle(t, finding)}
                  {finding.filePath ? ` · ${finding.filePath}` : ""}
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={trustSource}
                onChange={(event) => onTrustSourceChange(event.target.checked)}
                className="mt-0.5 h-4 w-4 accent-primary"
              />
              <span>
                {t(
                  "skill.trustExactUpdateSource",
                  "Trust future high-risk updates from this exact Skill source",
                )}
              </span>
            </label>
            <p className="text-xs text-muted-foreground">
              {t(
                "skill.updateApprovalFingerprintHint",
                "Approval applies only to the reviewed package. Blocked findings and structural safety checks cannot be bypassed.",
              )}
            </p>
          </div>
        ) : (
          ""
        )
      }
      confirmText={t("skill.updateAnyway", "Update Anyway")}
      cancelText={t("common.cancel", "Cancel")}
    />
  );
}
