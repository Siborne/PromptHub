import { FlaskConicalIcon, Loader2Icon, WifiIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentProviderConnectionTestResult,
  AgentProviderModelTestResult,
} from "@prompthub/shared/types";
import { Button } from "../ui";
import { AgentProviderDetailSection } from "./AgentProviderWorkbenchLayout";

export function AgentProviderConnectionCheck({
  busy,
  testing,
  modelTesting,
  connectionResult,
  modelTestResult,
  onTestConnection,
  onTestModel,
  onCancelModelTest,
}: {
  busy: boolean;
  testing: boolean;
  modelTesting: boolean;
  connectionResult: AgentProviderConnectionTestResult | null;
  modelTestResult: AgentProviderModelTestResult | null;
  onTestConnection: () => void;
  onTestModel: () => void;
  onCancelModelTest: () => void;
}) {
  const { t } = useTranslation();
  const modelStatusKey =
    modelTestResult?.protocol === "platform-native" &&
    modelTestResult.errorCode?.startsWith("codex-")
      ? `agents.providerProfiles.modelTest.nativeStatus.${modelTestResult.status}`
      : modelTestResult
        ? `agents.providerProfiles.modelTest.status.${modelTestResult.status}`
        : null;
  return (
    <AgentProviderDetailSection className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">
            {t("agents.providerProfiles.connection.title")}
          </h3>
          {connectionResult ? (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span
                className={
                  connectionResult.status === "ok"
                    ? "font-medium text-emerald-600 dark:text-emerald-400"
                    : "font-medium text-amber-600 dark:text-amber-400"
                }
              >
                {t(
                  `agents.providerProfiles.connection.status.${connectionResult.status}`,
                )}
              </span>
              {connectionResult.modelCount !== null ? (
                <span>
                  {t("agents.providerProfiles.connection.modelsAvailable", {
                    count: connectionResult.modelCount,
                  })}
                </span>
              ) : null}
              <span>
                {t("agents.providerProfiles.connection.latency", {
                  ms: connectionResult.totalMs,
                })}
              </span>
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("agents.providerProfiles.connection.hint")}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={onTestConnection}
            disabled={busy}
          >
            {testing ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <WifiIcon className="h-3.5 w-3.5" />
            )}
            {testing
              ? t("agents.providerProfiles.connection.testing")
              : t("agents.providerProfiles.connection.test")}
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={modelTesting ? onCancelModelTest : onTestModel}
            disabled={modelTesting ? false : busy}
          >
            {modelTesting ? (
              <XIcon className="h-3.5 w-3.5" />
            ) : (
              <FlaskConicalIcon className="h-3.5 w-3.5" />
            )}
            {modelTesting
              ? t("agents.providerProfiles.modelTest.cancel")
              : t("agents.providerProfiles.modelTest.test")}
          </Button>
        </div>
      </div>
      {modelTestResult ? (
        <div
          role="status"
          className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className={
                modelTestResult.status === "ok"
                  ? "font-medium text-emerald-600 dark:text-emerald-400"
                  : "font-medium text-amber-600 dark:text-amber-400"
              }
            >
              {modelStatusKey ? t(modelStatusKey) : null}
            </span>
            {modelTestResult.firstTokenMs !== null ? (
              <span className="text-muted-foreground">
                {t("agents.providerProfiles.modelTest.firstToken", {
                  ms: modelTestResult.firstTokenMs,
                })}
              </span>
            ) : null}
            <span className="text-muted-foreground">
              {t("agents.providerProfiles.modelTest.total", {
                ms: modelTestResult.totalMs,
              })}
            </span>
            {modelTestResult.retryCount > 0 ? (
              <span className="text-muted-foreground">
                {t("agents.providerProfiles.modelTest.retries", {
                  count: modelTestResult.retryCount,
                })}
              </span>
            ) : null}
          </div>
          {modelTestResult.outputPreview ? (
            <div className="mt-2">
              <span className="text-muted-foreground">
                {t("agents.providerProfiles.modelTest.preview")}
              </span>
              <code className="mt-1 block whitespace-pre-wrap break-words rounded bg-background px-2 py-1.5 text-foreground">
                {modelTestResult.outputPreview}
              </code>
            </div>
          ) : null}
        </div>
      ) : null}
    </AgentProviderDetailSection>
  );
}
