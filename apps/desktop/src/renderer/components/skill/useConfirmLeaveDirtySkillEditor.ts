import { useCallback } from "react";
import { useTranslation } from "react-i18next";

export function useConfirmLeaveDirtySkillEditor() {
  const { t } = useTranslation();

  return useCallback(() => {
    const hasUnsaved = (
      window as Window & { __PROMPTHUB_SKILL_EDITOR_DIRTY?: boolean }
    ).__PROMPTHUB_SKILL_EDITOR_DIRTY;
    return (
      !hasUnsaved ||
      window.confirm(
        t(
          "skill.unsavedChangesWarning",
          "You have unsaved changes. Discard and close?",
        ),
      )
    );
  }, [t]);
}
