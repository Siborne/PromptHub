import type { TFunction } from "i18next";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import type { DeleteDistributionSummary } from "./skill-manager-utils";

export interface SkillDeleteConfirmation {
  distributionSummary: DeleteDistributionSummary;
  isOpen: boolean;
  removeCopyInstallations: boolean;
  skillIds: string[];
  skillNames: string[];
}

interface SkillDeleteConfirmDialogProps {
  confirmation: SkillDeleteConfirmation;
  copyHelpId: string;
  copyInputId: string;
  copyLabelId: string;
  onClose: () => void;
  onConfirm: () => void;
  onRemoveCopyInstallationsChange: (checked: boolean) => void;
  t: TFunction;
}

interface CopyRemovalOptionProps {
  confirmation: SkillDeleteConfirmation;
  copyHelpId: string;
  copyInputId: string;
  copyLabelId: string;
  onChange: (checked: boolean) => void;
  t: TFunction;
}

function CopyRemovalOption({
  confirmation,
  copyHelpId,
  copyInputId,
  copyLabelId,
  onChange,
  t,
}: CopyRemovalOptionProps) {
  if (!confirmation.distributionSummary.hasCopy) return null;
  return (
    <label
      htmlFor={copyInputId}
      className="flex items-start gap-2 rounded-xl border border-border bg-accent/30 p-3 text-xs"
    >
      <input
        id={copyInputId}
        type="checkbox"
        aria-labelledby={copyLabelId}
        aria-describedby={copyHelpId}
        className="mt-0.5 h-4 w-4 accent-primary"
        checked={confirmation.removeCopyInstallations}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span>
        <span id={copyLabelId} className="block font-medium text-foreground">
          {t(
            "skill.deleteCopyInstallationsLabel",
            "Also delete copied distributions",
          )}
        </span>
        <span id={copyHelpId} className="mt-1 block text-muted-foreground">
          {t(
            "skill.deleteCopyInstallationsHelp",
            "Leave unchecked to keep copied Agent or project folders as detached copies.",
          )}
        </span>
      </span>
    </label>
  );
}

function DeleteConfirmationMessage(props: CopyRemovalOptionProps) {
  const { confirmation, t } = props;
  const confirmationText =
    confirmation.skillNames.length === 1
      ? t("skill.confirmDeleteSingle", {
          name: confirmation.skillNames[0],
          defaultValue: `Are you sure you want to delete skill "${confirmation.skillNames[0]}"?`,
        })
      : t("skill.confirmDeleteMultiple", {
          count: confirmation.skillNames.length,
          defaultValue: `Are you sure you want to delete ${confirmation.skillNames.length} selected skills?`,
        });
  return (
    <div className="space-y-2">
      <p>{confirmationText}</p>
      <p className="text-xs text-muted-foreground/80">
        {confirmation.distributionSummary.hasDistribution
          ? t(
              "skill.deleteDistributedHint",
              "This removes the skill from PromptHub. Source files are preserved. Distributed symlinks will be removed because they point back to PromptHub.",
            )
          : t(
              "skill.deleteSourceOnlyHint",
              "Only removes this skill from the PromptHub library. Source files are preserved.",
            )}
      </p>
      {confirmation.distributionSummary.hasSymlink ? (
        <p className="text-xs text-destructive">
          {t(
            "skill.deleteSymlinkInstallationsHint",
            "Symlink distributions will be deleted directly.",
          )}
        </p>
      ) : null}
      <CopyRemovalOption {...props} />
    </div>
  );
}

export function SkillDeleteConfirmDialog({
  confirmation,
  copyHelpId,
  copyInputId,
  copyLabelId,
  onClose,
  onConfirm,
  onRemoveCopyInstallationsChange,
  t,
}: SkillDeleteConfirmDialogProps) {
  return (
    <ConfirmDialog
      isOpen={confirmation.isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      variant="destructive"
      title={t("skill.confirmDeleteTitle", "Confirm Delete")}
      message={
        <DeleteConfirmationMessage
          confirmation={confirmation}
          copyHelpId={copyHelpId}
          copyInputId={copyInputId}
          copyLabelId={copyLabelId}
          onChange={onRemoveCopyInstallationsChange}
          t={t}
        />
      }
      confirmText={t("common.delete", "Delete")}
      cancelText={t("common.cancel", "Cancel")}
    />
  );
}
