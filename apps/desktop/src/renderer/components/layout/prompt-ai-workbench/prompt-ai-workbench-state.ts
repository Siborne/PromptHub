import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AITestResult } from "../../../services/ai";

export interface PromptAiTestState {
  isTestingAI: boolean;
  isComparingModels: boolean;
  aiResponse: string | null;
  aiThinking: string | null;
  isAiResponseImage: boolean;
  compareResults: AITestResult[] | null;
  compareError: string | null;
}

type PromptStatePatch =
  | Partial<PromptAiTestState>
  | ((state: PromptAiTestState) => Partial<PromptAiTestState>);

const EMPTY_PROMPT_AI_STATE: PromptAiTestState = {
  isTestingAI: false,
  isComparingModels: false,
  aiResponse: null,
  aiThinking: null,
  isAiResponseImage: false,
  compareResults: null,
  compareError: null,
};

function getPromptAiState(
  states: Record<string, PromptAiTestState>,
  promptId: string,
) {
  return states[promptId] ?? EMPTY_PROMPT_AI_STATE;
}

function applyPromptStatePatch(
  state: PromptAiTestState,
  patch: PromptStatePatch,
) {
  return {
    ...state,
    ...(typeof patch === "function" ? patch(state) : patch),
  };
}

function createPromptStateUpdater(
  setStates: Dispatch<SetStateAction<Record<string, PromptAiTestState>>>,
) {
  return (promptId: string, patch: PromptStatePatch) => {
    setStates((states) => ({
      ...states,
      [promptId]: applyPromptStatePatch(
        getPromptAiState(states, promptId),
        patch,
      ),
    }));
  };
}

function createFlagSetters(
  selectedId: string | null,
  updateState: (promptId: string, patch: PromptStatePatch) => void,
) {
  const setFlag = (
    field: "isTestingAI" | "isComparingModels",
    value: boolean,
  ) => {
    if (selectedId) updateState(selectedId, { [field]: value });
  };
  return {
    setIsTestingAI: (value: boolean) => setFlag("isTestingAI", value),
    setIsComparingModels: (value: boolean) =>
      setFlag("isComparingModels", value),
  };
}

type TextValue = string | null | ((previous: string | null) => string | null);

function createTextSetter(
  selectedId: string | null,
  field: "aiResponse" | "aiThinking",
  updateState: (promptId: string, patch: PromptStatePatch) => void,
) {
  return (value: TextValue) => {
    if (!selectedId) return;
    updateState(selectedId, (state) => ({
      [field]: typeof value === "function" ? value(state[field]) : value,
    }));
  };
}

function createResponseSetters(
  selectedId: string | null,
  updateState: (promptId: string, patch: PromptStatePatch) => void,
) {
  return {
    setAiResponse: createTextSetter(selectedId, "aiResponse", updateState),
    setAiThinking: createTextSetter(selectedId, "aiThinking", updateState),
    setIsAiResponseImage: (value: boolean) => {
      if (selectedId) updateState(selectedId, { isAiResponseImage: value });
    },
  };
}

function createCompareSetters(
  selectedId: string | null,
  updateState: (promptId: string, patch: PromptStatePatch) => void,
) {
  return {
    setCompareResults: (
      value:
        | AITestResult[]
        | null
        | ((previous: AITestResult[] | null) => AITestResult[] | null),
    ) => {
      if (!selectedId) return;
      updateState(selectedId, (state) => ({
        compareResults:
          typeof value === "function" ? value(state.compareResults) : value,
      }));
    },
    setCompareError: (value: string | null) => {
      if (selectedId) updateState(selectedId, { compareError: value });
    },
  };
}

export function usePromptAiTestState(selectedId: string | null) {
  const [states, setStates] = useState<Record<string, PromptAiTestState>>({});
  const updateState = createPromptStateUpdater(setStates);
  const currentState = selectedId ? getPromptAiState(states, selectedId) : null;
  return {
    currentState,
    flags: createFlagSetters(selectedId, updateState),
    response: createResponseSetters(selectedId, updateState),
    comparison: createCompareSetters(selectedId, updateState),
  };
}
