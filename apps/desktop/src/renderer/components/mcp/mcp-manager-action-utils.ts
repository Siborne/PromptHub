import { useCallback } from "react";
import type { useToast } from "../ui/Toast";

export type McpErrorReporter = (error: unknown) => void;

export function getMcpErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function useMcpErrorReporter(
  showToast: ReturnType<typeof useToast>["showToast"],
) {
  return useCallback<McpErrorReporter>(
    (error) => showToast(getMcpErrorMessage(error), "error"),
    [showToast],
  );
}
