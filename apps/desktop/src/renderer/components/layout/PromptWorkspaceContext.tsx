import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { usePromptWorkspaceController } from "./usePromptWorkspaceController";

export type PromptWorkspaceController = ReturnType<
  typeof usePromptWorkspaceController
>;

const PromptWorkspaceContext = createContext<PromptWorkspaceController | null>(
  null,
);

export function PromptWorkspaceProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PromptWorkspaceController;
}) {
  return (
    <PromptWorkspaceContext.Provider value={value}>
      {children}
    </PromptWorkspaceContext.Provider>
  );
}

export function usePromptWorkspaceContext() {
  const context = useContext(PromptWorkspaceContext);
  if (!context) throw new Error("PromptWorkspaceContext is unavailable");
  return context;
}
