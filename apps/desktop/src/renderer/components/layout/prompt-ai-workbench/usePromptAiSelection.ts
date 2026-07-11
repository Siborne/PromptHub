import { useEffect, useState } from "react";
import type { AIModelConfig } from "../../../stores/settings.store";

export function usePromptAiSelection(
  selectedId: string | null,
  compareModels: AIModelConfig[],
) {
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [isAiTestVariableModalOpen, setIsAiTestVariableModalOpen] =
    useState(false);
  const [isCompareVariableModalOpen, setIsCompareVariableModalOpen] =
    useState(false);

  useEffect(() => {
    setSelectedModelIds((previousIds) =>
      previousIds.length === 0 ? previousIds : [],
    );
  }, [selectedId]);

  useEffect(() => {
    setSelectedModelIds((previousIds) => {
      const nextIds = previousIds.filter((id) =>
        compareModels.some((model) => model.id === id),
      );
      return nextIds.length === previousIds.length ? previousIds : nextIds;
    });
  }, [compareModels]);

  return {
    selectedModelIds,
    setSelectedModelIds,
    isAiTestVariableModalOpen,
    setIsAiTestVariableModalOpen,
    isCompareVariableModalOpen,
    setIsCompareVariableModalOpen,
  };
}
