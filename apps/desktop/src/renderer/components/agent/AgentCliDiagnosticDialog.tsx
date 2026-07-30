import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleHelpIcon,
  RefreshCwIcon,
  TerminalIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  AgentCliDiagnostic,
  AgentCliLifecyclePlan,
  AgentCliLifecycleResult,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { AgentCliUpdateReview } from "./AgentCliUpdateReview";
import { Modal } from "../ui/Modal";
import { Spinner } from "../ui/Spinner";

interface AgentCliDiagnosticDialogProps {
  agent: ManagedAgentSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

type DiagnosticState =
  | { kind: "idle" | "loading" }
  | { kind: "ready"; result: AgentCliDiagnostic }
  | { kind: "failed" };

type UpdateState =
  | { kind: "idle" | "planning" | "failed" }
  | { kind: "review"; plan: AgentCliLifecyclePlan }
  | { kind: "applying"; plan: AgentCliLifecyclePlan }
  | { kind: "result"; result: AgentCliLifecycleResult };

function statusIcon(status: AgentCliDiagnostic["status"]) {
  if (status === "installed") {
    return <CheckCircle2Icon className="h-5 w-5 text-emerald-500" />;
  }
  if (status === "unhealthy") {
    return <AlertTriangleIcon className="h-5 w-5 text-amber-500" />;
  }
  return <CircleHelpIcon className="h-5 w-5 text-muted-foreground" />;
}

export function AgentCliDiagnosticDialog({
  agent,
  isOpen,
  onClose,
}: AgentCliDiagnosticDialogProps) {
  const { t } = useTranslation();
  const requestId = useRef(0);
  const [state, setState] = useState<DiagnosticState>({ kind: "idle" });
  const [updateState, setUpdateState] = useState<UpdateState>({
    kind: "idle",
  });

  const runDiagnostic = useCallback(async (target: ManagedAgentSummary) => {
    const currentRequest = ++requestId.current;
    setState({ kind: "loading" });
    setUpdateState({ kind: "idle" });
    if (target.isCustom) {
      setState({
        kind: "ready",
        result: {
          agentId: target.id,
          status: "unsupported",
          executablePath: null,
          version: null,
          installSource: null,
          errorCode: "unsupported",
          checkedAt: Date.now(),
          canUpdate: false,
        },
      });
      return;
    }
    try {
      const result = await window.api.agent.diagnoseCli(target.id);
      if (currentRequest === requestId.current) {
        setState({ kind: "ready", result });
      }
    } catch {
      if (currentRequest === requestId.current) {
        setState({ kind: "failed" });
      }
    }
  }, []);

  const planUpdate = useCallback(async (target: ManagedAgentSummary) => {
    const currentRequest = ++requestId.current;
    setUpdateState({ kind: "planning" });
    try {
      const plan = await window.api.agent.planCliUpdate(target.id);
      if (currentRequest === requestId.current) {
        setUpdateState({ kind: "review", plan });
      }
    } catch {
      if (currentRequest === requestId.current) {
        setUpdateState({ kind: "failed" });
      }
    }
  }, []);

  const applyUpdate = useCallback(async (plan: AgentCliLifecyclePlan) => {
    const currentRequest = ++requestId.current;
    setUpdateState({ kind: "applying", plan });
    try {
      const result = await window.api.agent.applyCliUpdate(plan.id);
      if (currentRequest === requestId.current) {
        setUpdateState({ kind: "result", result });
      }
    } catch {
      if (currentRequest === requestId.current) {
        setUpdateState({
          kind: "result",
          result: {
            agentId: plan.agentId,
            operation: "update",
            status: "failed",
            previousVersion: plan.currentVersion,
            currentVersion: null,
            errorCode: "update-failed",
          },
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !agent) {
      requestId.current += 1;
      setState({ kind: "idle" });
      setUpdateState({ kind: "idle" });
      return;
    }
    void runDiagnostic(agent);
  }, [agent, isOpen, runDiagnostic]);

  const result = state.kind === "ready" ? state.result : null;
  const statusText = result
    ? t(`agents.cliDiagnostics.status.${result.status}`, result.status)
    : "";
  const errorText = result?.errorCode
    ? t(
        `agents.cliDiagnostics.errors.${result.errorCode}`,
        t(
          "agents.cliDiagnostics.failure",
          "CLI diagnostics could not be completed.",
        ),
      )
    : null;
  const reviewingUpdate =
    updateState.kind === "review" ||
    updateState.kind === "applying" ||
    updateState.kind === "result";
  const updatePlan =
    updateState.kind === "review" || updateState.kind === "applying"
      ? updateState.plan
      : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        reviewingUpdate
          ? t("agents.cliDiagnostics.update.title", "Review CLI update")
          : t("agents.cliDiagnostics.title", "CLI diagnostics")
      }
      subtitle={agent?.name}
      size="lg"
      headerActions={
        agent && !reviewingUpdate ? (
          <button
            type="button"
            onClick={() => void runDiagnostic(agent)}
            disabled={state.kind === "loading"}
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCwIcon
              aria-hidden="true"
              className={`h-4 w-4 ${state.kind === "loading" ? "animate-spin" : ""}`}
            />
            {t("agents.cliDiagnostics.runAgain", "Run again")}
          </button>
        ) : undefined
      }
    >
      {reviewingUpdate ? (
        <AgentCliUpdateReview
          plan={updatePlan}
          result={updateState.kind === "result" ? updateState.result : null}
          isApplying={updateState.kind === "applying"}
          onApply={() => {
            if (updatePlan) void applyUpdate(updatePlan);
          }}
          onBack={() => setUpdateState({ kind: "idle" })}
        />
      ) : null}

      {!reviewingUpdate &&
      (state.kind === "loading" || state.kind === "idle") ? (
        <div
          role="status"
          className="flex min-h-52 flex-col items-center justify-center gap-3 text-sm text-muted-foreground"
        >
          <Spinner size="lg" />
          {t("agents.cliDiagnostics.checking", "Checking the local CLI...")}
        </div>
      ) : null}

      {!reviewingUpdate && state.kind === "failed" ? (
        <div className="flex min-h-52 flex-col items-center justify-center gap-3 text-center">
          <AlertTriangleIcon className="h-8 w-8 text-amber-500" />
          <p className="text-sm font-medium text-foreground">
            {t(
              "agents.cliDiagnostics.failure",
              "CLI diagnostics could not be completed.",
            )}
          </p>
        </div>
      ) : null}

      {!reviewingUpdate && result ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 border-b border-border pb-4">
            {statusIcon(result.status)}
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{statusText}</p>
              {errorText ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {errorText}
                </p>
              ) : null}
            </div>
          </div>

          {result.status !== "unsupported" ? (
            <dl className="divide-y divide-border border-y border-border">
              <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t("agents.cliDiagnostics.version", "Version")}
                </dt>
                <dd className="break-words font-mono text-sm text-foreground">
                  {result.version ||
                    t("agents.cliDiagnostics.unknown", "Unknown")}
                </dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t("agents.cliDiagnostics.executable", "Executable")}
                </dt>
                <dd className="break-all font-mono text-sm text-foreground">
                  {result.executablePath ||
                    t("agents.cliDiagnostics.notFound", "Not found")}
                </dd>
              </div>
              <div className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-4">
                <dt className="text-xs font-semibold text-muted-foreground">
                  {t("agents.cliDiagnostics.source", "Install source")}
                </dt>
                <dd className="flex items-center gap-2 text-sm text-foreground">
                  <TerminalIcon
                    aria-hidden="true"
                    className="h-4 w-4 text-muted-foreground"
                  />
                  {result.installSource
                    ? t(
                        `agents.cliDiagnostics.sources.${result.installSource}`,
                        result.installSource,
                      )
                    : t("agents.cliDiagnostics.unknown", "Unknown")}
                </dd>
              </div>
            </dl>
          ) : null}

          {result.canUpdate && result.status === "installed" ? (
            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <p className="text-xs leading-5 text-muted-foreground">
                {t(
                  "agents.cliDiagnostics.update.available",
                  "A verified update workflow is available for this CLI.",
                )}
              </p>
              <button
                type="button"
                onClick={() => agent && void planUpdate(agent)}
                disabled={updateState.kind === "planning"}
                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {updateState.kind === "planning" ? (
                  <Spinner size="sm" />
                ) : (
                  <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
                )}
                {t("agents.cliDiagnostics.update.review", "Review update")}
              </button>
            </div>
          ) : (
            <p className="text-xs leading-5 text-muted-foreground">
              {t(
                "agents.cliDiagnostics.readOnlyNotice",
                "This check is read-only. PromptHub does not install or update the Agent CLI in this step.",
              )}
            </p>
          )}

          {updateState.kind === "failed" ? (
            <p role="alert" className="text-sm text-destructive">
              {t(
                "agents.cliDiagnostics.update.planFailed",
                "The CLI update could not be prepared.",
              )}
            </p>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
