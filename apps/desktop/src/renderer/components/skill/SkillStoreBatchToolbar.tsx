import type { TFunction } from "i18next";
import {
  CheckSquareIcon,
  DownloadIcon,
  Loader2Icon,
  PackagePlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

export type StoreBatchOperation = "install" | "update" | "remove";

interface SkillStoreBatchToolbarProps {
  areVisibleSkillsSelected: boolean;
  canInstall: boolean;
  canRemove: boolean;
  canSelectVisible: boolean;
  canUpdate: boolean;
  isBusy: boolean;
  onClear: () => void;
  onInstall: () => void;
  onRemove: () => void;
  onSelectVisible: () => void;
  onUpdate: () => void;
  runningOperation: StoreBatchOperation | null;
  selectedCount: number;
  selectVisibleLabel: string;
  t: TFunction;
}

function ToolbarIconButton({
  children,
  className,
  disabled,
  label,
  onClick,
}: {
  children: React.ReactNode;
  className: string;
  disabled: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function StoreOperationButtons(props: SkillStoreBatchToolbarProps) {
  const installLabel = props.t(
    "skill.batchStoreInstallSelected",
    "Install selected",
  );
  const updateLabel = props.t(
    "skill.batchStoreUpdateSelected",
    "Update selected",
  );
  const removeLabel = props.t(
    "skill.batchStoreRemoveSelected",
    "Remove selected from My Skills",
  );
  return (
    <>
      <ToolbarIconButton
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary disabled:opacity-40"
        disabled={props.isBusy || !props.canInstall}
        label={installLabel}
        onClick={props.onInstall}
      >
        {props.runningOperation === "install" ? (
          <Loader2Icon aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <PackagePlusIcon aria-hidden="true" className="h-4 w-4" />
        )}
      </ToolbarIconButton>
      <ToolbarIconButton
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-amber-500/10 hover:text-amber-500 disabled:opacity-40"
        disabled={props.isBusy || !props.canUpdate}
        label={updateLabel}
        onClick={props.onUpdate}
      >
        {props.runningOperation === "update" ? (
          <Loader2Icon aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <DownloadIcon aria-hidden="true" className="h-4 w-4" />
        )}
      </ToolbarIconButton>
      <ToolbarIconButton
        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
        disabled={props.isBusy || !props.canRemove}
        label={removeLabel}
        onClick={props.onRemove}
      >
        <Trash2Icon aria-hidden="true" className="h-4 w-4" />
      </ToolbarIconButton>
    </>
  );
}

function StoreSelectVisibleButton(props: SkillStoreBatchToolbarProps) {
  const selectClass = props.areVisibleSkillsSelected
    ? "bg-primary/10 text-primary hover:bg-primary/15"
    : "text-muted-foreground hover:bg-accent hover:text-foreground";
  return (
    <ToolbarIconButton
      className={`rounded-lg p-2 transition-colors disabled:opacity-40 ${selectClass}`}
      disabled={props.isBusy || !props.canSelectVisible}
      label={props.selectVisibleLabel}
      onClick={props.onSelectVisible}
    >
      <CheckSquareIcon aria-hidden="true" className="h-4 w-4" />
    </ToolbarIconButton>
  );
}

function StoreClearButton(props: SkillStoreBatchToolbarProps) {
  return (
    <ToolbarIconButton
      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
      disabled={props.isBusy || props.selectedCount === 0}
      label={props.t("common.deselectAll", "Deselect All")}
      onClick={props.onClear}
    >
      <XIcon aria-hidden="true" className="h-4 w-4" />
    </ToolbarIconButton>
  );
}

export function SkillStoreBatchToolbar(props: SkillStoreBatchToolbarProps) {
  return (
    <div className="shrink-0 border-t border-border app-wallpaper-panel-strong px-6 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-medium text-muted-foreground">
          {props.t("skill.selectedCount", "{{count}} selected", {
            count: props.selectedCount,
          })}
        </span>
        <div className="flex items-center gap-1.5">
          <StoreSelectVisibleButton {...props} />
          <StoreOperationButtons {...props} />
          <StoreClearButton {...props} />
        </div>
      </div>
    </div>
  );
}
