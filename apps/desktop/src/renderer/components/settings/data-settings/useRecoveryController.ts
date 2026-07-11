import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RecoveryCandidate } from "@prompthub/shared/types";
import { useToast } from "../../ui/Toast";
import {
  getErrorMessage,
  loadManualRecoveryPaths,
  persistManualRecoveryPaths,
} from "./data-settings-controller-utils";

function useManualRecoveryPathState(webRuntime: boolean) {
  const [manualRecoveryPaths, setManualRecoveryPaths] = useState<string[]>([]);
  const [manualPathInputValue, setManualPathInputValue] = useState("");

  useEffect(() => {
    if (!webRuntime) setManualRecoveryPaths(loadManualRecoveryPaths());
  }, [webRuntime]);

  return {
    manualRecoveryPaths,
    setManualRecoveryPaths,
    manualPathInputValue,
    setManualPathInputValue,
  };
}

function useRecoveryPathMutation(setPaths: (paths: string[]) => void) {
  const updateManualRecoveryPaths = (paths: string[]) => {
    setPaths(paths);
    persistManualRecoveryPaths(paths);
  };
  const handleRemoveManualRecoveryPath = (
    paths: string[],
    targetPath: string,
  ) => {
    updateManualRecoveryPaths(paths.filter((entry) => entry !== targetPath));
  };
  return { updateManualRecoveryPaths, handleRemoveManualRecoveryPath };
}

function useDuplicatePathToast() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return () => {
    showToast(
      t(
        "settings.manualRecoveryPathExists",
        "This scan directory has already been added.",
      ),
      "error",
    );
  };
}

function addRecoveryPath(
  paths: string[],
  value: string,
  onDuplicate: () => void,
): string[] | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (paths.includes(normalized)) {
    onDuplicate();
    return null;
  }
  return [...paths, normalized];
}

function useRecoveryPathAddActions(
  paths: string[],
  inputValue: string,
  setInputValue: (value: string) => void,
  updatePaths: (paths: string[]) => void,
) {
  const showDuplicatePathError = useDuplicatePathToast();
  const handleAddManualRecoveryPath = async () => {
    const selected = await window.electron?.selectFolder?.();
    if (!selected) return;
    const nextPaths = addRecoveryPath(paths, selected, showDuplicatePathError);
    if (nextPaths) updatePaths(nextPaths);
  };
  const handleAddManualRecoveryPathFromInput = () => {
    const nextPaths = addRecoveryPath(
      paths,
      inputValue,
      showDuplicatePathError,
    );
    if (!nextPaths) return;
    updatePaths(nextPaths);
    setInputValue("");
  };
  return { handleAddManualRecoveryPath, handleAddManualRecoveryPathFromInput };
}

function useRecoveryScan(manualRecoveryPaths: string[]) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [scanningRecoverySources, setScanningRecoverySources] = useState(false);
  const [manualRecoveryCandidates, setManualRecoveryCandidates] = useState<
    RecoveryCandidate[]
  >([]);
  const [showRecoveryBrowser, setShowRecoveryBrowser] = useState(false);

  const handleScanRecoverySources = async () => {
    setScanningRecoverySources(true);
    try {
      const candidates =
        (await window.electron?.checkRecovery?.({
          extraPaths: manualRecoveryPaths,
          ignoreDismissMarker: true,
        })) ?? [];
      setManualRecoveryCandidates(candidates);
      if (candidates.length === 0) {
        showToast(
          t(
            "settings.recoveryScanEmpty",
            "No recoverable history was found in the scanned locations.",
          ),
          "error",
        );
        return;
      }
      setShowRecoveryBrowser(true);
    } catch (error) {
      console.error("Failed to scan recovery sources:", error);
      showToast(
        `${t("settings.recoveryScanFailed", "Failed to scan recovery sources")}: ${getErrorMessage(error)}`,
        "error",
      );
    } finally {
      setScanningRecoverySources(false);
    }
  };

  return {
    scanningRecoverySources,
    setScanningRecoverySources,
    manualRecoveryCandidates,
    setManualRecoveryCandidates,
    showRecoveryBrowser,
    setShowRecoveryBrowser,
    handleScanRecoverySources,
  };
}

export function useRecoveryController(webRuntime: boolean) {
  const pathState = useManualRecoveryPathState(webRuntime);
  const pathMutation = useRecoveryPathMutation(
    pathState.setManualRecoveryPaths,
  );
  const additions = useRecoveryPathAddActions(
    pathState.manualRecoveryPaths,
    pathState.manualPathInputValue,
    pathState.setManualPathInputValue,
    pathMutation.updateManualRecoveryPaths,
  );
  const scan = useRecoveryScan(pathState.manualRecoveryPaths);

  return {
    ...pathState,
    ...pathMutation,
    ...additions,
    ...scan,
    handleRemoveManualRecoveryPath: (targetPath: string) =>
      pathMutation.handleRemoveManualRecoveryPath(
        pathState.manualRecoveryPaths,
        targetPath,
      ),
  };
}
