import { useEffect, useRef } from "react";

import { useSkillStore } from "../../stores/skill.store";

export function useEnsureSkillLibraryLoaded(enabled = true): void {
  const skillCount = useSkillStore((state) => state.skills.length);
  const isLoading = useSkillStore((state) => state.isLoading);
  const loadSkills = useSkillStore((state) => state.loadSkills);
  const hasRequestedLoad = useRef(false);

  useEffect(() => {
    if (
      enabled &&
      skillCount === 0 &&
      !isLoading &&
      !hasRequestedLoad.current
    ) {
      hasRequestedLoad.current = true;
      void loadSkills({ preferCache: true });
    }
  }, [enabled, isLoading, loadSkills, skillCount]);
}
