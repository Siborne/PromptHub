import { CheckIcon } from "lucide-react";
import type { TFunction } from "i18next";
import type { SkillPlatform } from "@prompthub/shared/constants/platforms";

import { getSkillDistributionTargetName } from "../../services/shared-skill-distribution-target";
import { PlatformIcon } from "../ui/PlatformIcon";

export function SkillPlatformTargetRow({
  isBatchInstalling,
  isInstalled,
  isSelected,
  onToggle,
  onUninstall,
  platform,
  t,
}: {
  isBatchInstalling: boolean;
  isInstalled: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onUninstall: () => void;
  platform: SkillPlatform;
  t: TFunction;
}) {
  const targetName = getSkillDistributionTargetName(platform, t);
  const toggle = () => {
    if (!isInstalled && !isBatchInstalling) onToggle();
  };

  return (
    <div
      role={isInstalled ? undefined : "button"}
      tabIndex={isInstalled || isBatchInstalling ? undefined : 0}
      aria-label={isInstalled ? undefined : targetName}
      aria-pressed={isInstalled ? undefined : isSelected}
      onClick={toggle}
      onKeyDown={(event) => {
        if (event.currentTarget !== event.target) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle();
      }}
      className={`flex items-center justify-between rounded-xl border p-3 transition-all ${
        isInstalled
          ? "cursor-default border-primary bg-primary/5"
          : isSelected
            ? "cursor-pointer border-primary bg-primary/10"
            : "cursor-pointer border-border bg-accent/30 hover:bg-accent/50"
      } ${isBatchInstalling && !isInstalled ? "cursor-wait opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          aria-hidden="true"
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center"
        >
          <PlatformIcon platformId={platform.id} size={28} />
        </div>
        <div>
          <h4 className="text-sm font-medium">{targetName}</h4>
          <p className="text-[10px] text-muted-foreground">
            {isInstalled
              ? t("skill.installed")
              : isSelected
                ? t("skill.selectedForInstall")
                : t("skill.clickToSelect")}
          </p>
        </div>
      </div>
      {isInstalled ? (
        <div className="flex items-center gap-2">
          <CheckIcon aria-hidden="true" className="h-4 w-4 text-primary" />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onUninstall();
            }}
            className="text-[10px] text-destructive hover:underline"
          >
            {t("skill.uninstall")}
          </button>
        </div>
      ) : (
        <div
          className={`flex h-5 w-5 items-center justify-center rounded border-2 transition-colors ${
            isSelected
              ? "border-primary bg-primary"
              : "border-muted-foreground/30"
          }`}
        >
          {isSelected ? (
            <CheckIcon aria-hidden="true" className="h-3 w-3 text-white" />
          ) : null}
        </div>
      )}
    </div>
  );
}
