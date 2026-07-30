import type { TFunction } from "i18next";
import type {
  RegistrySkill,
  SkillStoreSource,
  SkillUpdateSafetyReview,
} from "@prompthub/shared/types";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { SkillStoreDetail } from "./SkillStoreDetail";
import { SkillStoreSourceEditModal } from "./SkillStoreSourceEditModal";
import { SkillUpdateSafetyReviewDialog } from "./SkillUpdateSafetyReviewDialog";
import type { StoreBatchOperation } from "./SkillStoreBatchToolbar";
import { getRegistrySkillSelectionId } from "./skill-store-identifiers";

interface SafetyReviewOverlay {
  review: SkillUpdateSafetyReview | null;
  trustSource: boolean;
  isLoading: boolean;
  onTrustSourceChange: (trusted: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

interface EditableStoreSourcePayload {
  id: string;
  name: string;
  type: Extract<
    SkillStoreSource["type"],
    "marketplace-json" | "git-repo" | "local-dir"
  >;
  url: string;
  branch?: string;
  directory?: string;
}

interface SkillStoreOverlaysProps {
  t: TFunction;
  customStoreSources: SkillStoreSource[];
  editingCustomSourceId: string | null;
  loadingSourceId: string | null;
  onCloseSourceEdit: () => void;
  onDeleteSource: (sourceId: string) => void;
  onSaveSource: (source: EditableStoreSourcePayload) => Promise<void> | void;
  onToggleSource: (sourceId: string) => void;
  onRefreshSource: (sourceId: string) => void;
  pendingDeleteSource: SkillStoreSource | null;
  onCancelDeleteSource: () => void;
  onConfirmDeleteSource: (sourceId: string) => void;
  batchRemoveOpen: boolean;
  onCancelBatchRemove: () => void;
  onConfirmBatchRemove: () => void;
  selectedRemoveCount: number;
  batchUpdateOpen: boolean;
  isBatchBusy: boolean;
  onCancelBatchUpdate: () => void;
  onConfirmBatchUpdate: () => void;
  selectedUpdateTargets: RegistrySkill[];
  runningBatchOperation: StoreBatchOperation | null;
  installReview: SafetyReviewOverlay;
  updateReview: SafetyReviewOverlay;
  selectedDetailSkill: RegistrySkill | null;
  detailStoreLabel: string;
  detailStoreSourceId: string;
  detailStoreSourceType?: SkillStoreSource["type"];
  isDetailInstalled: boolean;
  isDetailInstalling: boolean;
  onDetailInstallPendingChange: (
    skill: RegistrySkill,
    pending: boolean,
  ) => void;
  onCloseDetail: () => void;
}

export function SkillStoreOverlays(props: SkillStoreOverlaysProps) {
  const editingSource =
    props.customStoreSources.find(
      (source) => source.id === props.editingCustomSourceId,
    ) ?? null;
  return (
    <>
      <SkillStoreSourceEditModal
        isOpen={props.editingCustomSourceId !== null}
        onClose={props.onCloseSourceEdit}
        onDelete={props.onDeleteSource}
        onSave={props.onSaveSource}
        onToggleEnabled={props.onToggleSource}
        onRefresh={props.onRefreshSource}
        refreshingSourceId={props.loadingSourceId}
        source={editingSource}
      />
      <ConfirmDialog
        isOpen={Boolean(props.pendingDeleteSource)}
        onClose={props.onCancelDeleteSource}
        onConfirm={() => {
          if (props.pendingDeleteSource) {
            props.onConfirmDeleteSource(props.pendingDeleteSource.id);
          }
        }}
        title={props.t("skill.deleteStoreSourceTitle", "Delete custom store")}
        message={props.t("skill.deleteStoreSourceMessage", {
          name: props.pendingDeleteSource?.name ?? "",
          defaultValue:
            'Delete custom store "{{name}}"? Installed Skills will stay in My Skills, but this source and its cached store entries will be removed.',
        })}
        confirmText={props.t("common.delete", "Delete")}
        cancelText={props.t("common.cancel", "Cancel")}
        variant="destructive"
      />
      <ConfirmDialog
        isOpen={props.batchRemoveOpen}
        onClose={props.onCancelBatchRemove}
        onConfirm={props.onConfirmBatchRemove}
        title={props.t("skill.batchStoreRemoveTitle", "Remove selected Skills")}
        message={props.t(
          "skill.batchStoreRemoveMessage",
          "Remove {{count}} selected imported Skills from My Skills? Remote store content will not be deleted.",
          { count: props.selectedRemoveCount },
        )}
        confirmText={props.t(
          "skill.batchStoreRemoveSelected",
          "Remove selected",
        )}
        cancelText={props.t("common.cancel", "Cancel")}
        variant="destructive"
        isLoading={props.runningBatchOperation === "remove"}
      />
      <ConfirmDialog
        isOpen={props.batchUpdateOpen}
        onClose={props.onCancelBatchUpdate}
        onConfirm={props.onConfirmBatchUpdate}
        title={props.t(
          "skill.batchStoreUpdateTitle",
          "Review selected updates",
        )}
        message={
          <div className="space-y-2 text-left">
            <p>
              {props.t(
                "skill.batchStoreUpdateMessage",
                "PromptHub will recheck and apply the selected updates after confirmation. Open an individual Skill to inspect its full line diff.",
              )}
            </p>
            <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
              {props.selectedUpdateTargets.map((target) => (
                <li
                  key={getRegistrySkillSelectionId(target)}
                  className="truncate"
                >
                  {target.name}
                </li>
              ))}
            </ul>
          </div>
        }
        confirmText={props.t(
          "skill.batchStoreUpdateSelected",
          "Update selected",
        )}
        cancelText={props.t("common.cancel", "Cancel")}
        isLoading={props.runningBatchOperation === "update"}
      />
      <SafetyReviewDialog
        operation="install"
        review={props.installReview}
        t={props.t}
      />
      <SafetyReviewDialog
        operation="update"
        review={props.updateReview}
        t={props.t}
      />
      {props.selectedDetailSkill ? (
        <SkillStoreDetail
          skill={props.selectedDetailSkill}
          isInstalled={props.isDetailInstalled}
          storeLabel={props.detailStoreLabel}
          storeSourceId={props.detailStoreSourceId}
          storeSourceType={props.detailStoreSourceType}
          isInstalling={props.isDetailInstalling}
          onInstallPendingChange={props.onDetailInstallPendingChange}
          onClose={props.onCloseDetail}
        />
      ) : null}
    </>
  );
}

function SafetyReviewDialog({
  operation,
  review,
  t,
}: {
  operation: "install" | "update";
  review: SafetyReviewOverlay;
  t: TFunction;
}) {
  return (
    <SkillUpdateSafetyReviewDialog
      operation={operation}
      review={review.review}
      trustSource={review.trustSource}
      isLoading={review.isLoading}
      t={t}
      onTrustSourceChange={review.onTrustSourceChange}
      onClose={review.onClose}
      onConfirm={review.onConfirm}
    />
  );
}
