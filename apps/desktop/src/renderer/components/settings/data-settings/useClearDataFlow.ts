import { useState } from "react";
import { useTranslation } from "react-i18next";
import { clearDatabase } from "../../../services/database";
import { useToast } from "../../ui/Toast";

function useClearDataState() {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearPwd, setClearPwd] = useState("");
  const [clearLoading, setClearLoading] = useState(false);
  return {
    showClearConfirm,
    setShowClearConfirm,
    clearPwd,
    setClearPwd,
    clearLoading,
    setClearLoading,
  };
}

function useClearDataRequest(
  securityConfigured: boolean,
  openConfirm: () => void,
) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return async () => {
    if (securityConfigured) {
      openConfirm();
      return;
    }
    showToast(
      t(
        "settings.clearNeedPassword",
        "Clearing data is a high-risk operation, please set a master password in security settings first",
      ),
      "error",
    );
  };
}

function useClearDataConfirmation(state: ReturnType<typeof useClearDataState>) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  return async () => {
    if (!state.clearPwd) {
      showToast(
        t("settings.enterPassword", "Please enter master password"),
        "error",
      );
      return;
    }
    state.setClearLoading(true);
    try {
      const result = await window.api.security.unlock(state.clearPwd);
      if (!result.success) {
        showToast(t("settings.wrongPassword", "Wrong password"), "error");
        return;
      }
      await clearDatabase();
      showToast(t("toast.clearSuccess"), "success");
      state.setShowClearConfirm(false);
      state.setClearPwd("");
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error("Clear failed:", error);
      showToast(t("toast.clearFailed"), "error");
    } finally {
      state.setClearLoading(false);
    }
  };
}

export function useClearDataFlow(securityConfigured: boolean) {
  const state = useClearDataState();
  const handleClearData = useClearDataRequest(securityConfigured, () =>
    state.setShowClearConfirm(true),
  );
  const handleConfirmClear = useClearDataConfirmation(state);
  return { ...state, handleClearData, handleConfirmClear };
}
