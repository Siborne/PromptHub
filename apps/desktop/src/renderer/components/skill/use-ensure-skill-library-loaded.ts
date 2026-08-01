import { useEffect } from "react";

import { useSkillStore } from "../../stores/skill.store";

export function useEnsureSkillLibraryLoaded(enabled = true): void {
  const skillCount = useSkillStore((state) => state.skills.length);
  const isLoading = useSkillStore((state) => state.isLoading);
  const loadSkills = useSkillStore((state) => state.loadSkills);

  useEffect(() => {
    if (enabled && skillCount === 0 && !isLoading) {
      void loadSkills({ preferCache: true });
    }
  }, [enabled, isLoading, loadSkills, skillCount]);
}
