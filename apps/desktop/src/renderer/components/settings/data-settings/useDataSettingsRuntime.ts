import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AUTO_SYNC_HISTORY_UPDATED_EVENT,
  readAutoSyncHistory,
  type AutoSyncHistoryEntry,
} from "../../../services/sync-history";
import { isWebRuntime } from "../../../runtime";
import { useToast } from "../../ui/Toast";
import type { RuntimePaths } from "./data-settings-controller-utils";
import { useAutoSyncPresentation } from "./useAutoSyncPresentation";

function useCacheStatus() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    void window.electron?.getCacheSize?.().then((result) => {
      setCacheSize(result.size);
    });
  }, []);

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await window.electron?.clearCache?.();
      const result = await window.electron?.getCacheSize?.();
      setCacheSize(result?.size ?? 0);
      showToast(t("settings.cacheClearedToast", "缓存已清除"), "success");
    } catch (error) {
      console.error("Failed to clear renderer cache:", error);
      showToast(
        t("settings.cacheClearFailed", "Failed to clear cache"),
        "error",
      );
    } finally {
      setClearingCache(false);
    }
  };

  return {
    cacheSize,
    setCacheSize,
    clearingCache,
    setClearingCache,
    handleClearCache,
  };
}

function useRuntimePaths(webRuntime: boolean) {
  const [runtimePaths, setRuntimePaths] = useState<RuntimePaths | null>(null);

  useEffect(() => {
    if (webRuntime) return;

    void window.electron?.getRuntimePaths?.().then((paths) => {
      if (paths) setRuntimePaths(paths);
    });
  }, [webRuntime]);

  return { runtimePaths, setRuntimePaths };
}

function useAutoSyncHistory(webRuntime: boolean) {
  const [autoSyncHistory, setAutoSyncHistory] = useState<
    AutoSyncHistoryEntry[]
  >([]);

  useEffect(() => {
    if (webRuntime) return;

    let mounted = true;
    const refreshHistory = () => {
      void readAutoSyncHistory().then((history) => {
        if (mounted) setAutoSyncHistory(history);
      });
    };

    refreshHistory();
    window.addEventListener(AUTO_SYNC_HISTORY_UPDATED_EVENT, refreshHistory);
    return () => {
      mounted = false;
      window.removeEventListener(
        AUTO_SYNC_HISTORY_UPDATED_EVENT,
        refreshHistory,
      );
    };
  }, [webRuntime]);

  return { autoSyncHistory, setAutoSyncHistory };
}

function useApplicationMetadata() {
  const [currentVersion, setCurrentVersion] = useState("");
  const [securityConfigured, setSecurityConfigured] = useState(false);

  useEffect(() => {
    void window.api?.security?.status().then((status) => {
      setSecurityConfigured(status.configured);
    });
    void window.electron?.updater?.getVersion?.().then((version) => {
      if (typeof version === "string") setCurrentVersion(version);
    });
  }, []);

  return {
    currentVersion,
    setCurrentVersion,
    securityConfigured,
    setSecurityConfigured,
  };
}

export function useDataSettingsRuntime() {
  const webRuntime = isWebRuntime();
  const cache = useCacheStatus();
  const runtimePaths = useRuntimePaths(webRuntime);
  const autoSyncHistory = useAutoSyncHistory(webRuntime);
  const metadata = useApplicationMetadata();
  const presentation = useAutoSyncPresentation();

  return {
    webRuntime,
    ...cache,
    ...runtimePaths,
    ...autoSyncHistory,
    ...metadata,
    ...presentation,
  };
}
