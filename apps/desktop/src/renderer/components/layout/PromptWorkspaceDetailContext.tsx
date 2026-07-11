import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";
import type { PromptWorkspaceDetailPaneProps } from "./prompt-workspace-detail-types";

const PromptWorkspaceDetailContext =
  createContext<PromptWorkspaceDetailPaneProps | null>(null);

export function PromptWorkspaceDetailProvider({
  children,
  value,
}: PropsWithChildren<{ value: PromptWorkspaceDetailPaneProps }>) {
  return (
    <PromptWorkspaceDetailContext.Provider value={value}>
      {children}
    </PromptWorkspaceDetailContext.Provider>
  );
}

export function usePromptWorkspaceDetailContext() {
  const context = useContext(PromptWorkspaceDetailContext);
  if (!context)
    throw new Error("Prompt workspace detail context is unavailable");
  return context;
}
