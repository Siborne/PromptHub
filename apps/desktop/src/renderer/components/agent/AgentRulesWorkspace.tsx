import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  AlertCircleIcon,
  FilePlus2Icon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  ManagedAgentSummary,
  RuleFileDescriptor,
} from "@prompthub/shared/types";
import { useRulesStore } from "../../stores/rules.store";
import { RulesManager } from "../rules/RulesManager";

function normalizeRulePath(filePath: string | undefined): string {
  const normalized = (filePath ?? "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/+$/, "");

  return /^[a-zA-Z]:\//.test(normalized) || normalized.startsWith("//")
    ? normalized.toLowerCase()
    : normalized;
}

function findAgentRule(
  agent: ManagedAgentSummary,
  files: RuleFileDescriptor[],
): RuleFileDescriptor | null {
  const expectedPath = normalizeRulePath(agent.paths.rules);
  const globalFiles = files.filter((file) => !file.id.startsWith("project:"));
  const pathMatch = expectedPath
    ? globalFiles.find((file) => normalizeRulePath(file.path) === expectedPath)
    : undefined;

  if (pathMatch) {
    return pathMatch;
  }

  const expectedPlatformId = agent.isCustom ? `custom:${agent.id}` : agent.id;
  return (
    globalFiles.find((file) => file.platformId === expectedPlatformId) ?? null
  );
}

interface AgentRuleSyncInput {
  currentFileId?: string;
  error: string | null;
  hasLoadedFiles: boolean;
  isLoading: boolean;
  loadFiles: ReturnType<typeof useRulesStore.getState>["loadFiles"];
  rulePath: string;
  selectedRuleId: string | null;
  selectionKey: string;
  selectRule: ReturnType<typeof useRulesStore.getState>["selectRule"];
  targetRule: RuleFileDescriptor | null;
}

function useAgentRuleRetry(
  input: Pick<
    AgentRuleSyncInput,
    "loadFiles" | "selectRule" | "selectionKey" | "targetRule"
  >,
  forcedScanAttemptRef: MutableRefObject<string | null>,
): () => void {
  const { loadFiles, selectRule, selectionKey, targetRule } = input;
  return useCallback(() => {
    if (targetRule?.exists) {
      void selectRule(targetRule.id);
      return;
    }
    forcedScanAttemptRef.current = selectionKey;
    void loadFiles({ force: true });
  }, [forcedScanAttemptRef, loadFiles, selectRule, selectionKey, targetRule]);
}

function useAgentRuleSynchronization(input: AgentRuleSyncInput): () => void {
  const {
    currentFileId,
    error,
    hasLoadedFiles,
    isLoading,
    loadFiles,
    rulePath,
    selectedRuleId,
    selectionKey,
    selectRule,
    targetRule,
  } = input;
  const initialLoadAttemptRef = useRef<string | null>(null);
  const forcedScanAttemptRef = useRef<string | null>(null);
  const retry = useAgentRuleRetry(input, forcedScanAttemptRef);

  useEffect(() => {
    if (!rulePath) return;
    if (!hasLoadedFiles) {
      if (initialLoadAttemptRef.current === selectionKey) return;
      initialLoadAttemptRef.current = selectionKey;
      void loadFiles();
      return;
    }
    if (!targetRule) {
      if (forcedScanAttemptRef.current === selectionKey) return;
      forcedScanAttemptRef.current = selectionKey;
      void loadFiles({ force: true });
      return;
    }
    if (!targetRule.exists) return;
    const selectionPending =
      selectedRuleId === targetRule.id && (isLoading || Boolean(error));
    if (currentFileId !== targetRule.id && !selectionPending) {
      void selectRule(targetRule.id);
    }
  }, [
    currentFileId,
    error,
    hasLoadedFiles,
    isLoading,
    loadFiles,
    rulePath,
    selectedRuleId,
    selectionKey,
    selectRule,
    targetRule,
  ]);

  return retry;
}

function useAgentRuleWorkspaceState(agent: ManagedAgentSummary) {
  const availableFiles = useRulesStore((state) => state.availableFiles);
  const selectedRuleId = useRulesStore((state) => state.selectedRuleId);
  const currentFile = useRulesStore((state) => state.currentFile);
  const hasLoadedFiles = useRulesStore((state) => state.hasLoadedFiles);
  const isLoading = useRulesStore((state) => state.isLoading);
  const error = useRulesStore((state) => state.error);
  const isSaving = useRulesStore((state) => state.isSaving);
  const loadFiles = useRulesStore((state) => state.loadFiles);
  const selectRule = useRulesStore((state) => state.selectRule);
  const createRule = useRulesStore((state) => state.createRule);
  const rulePath = normalizeRulePath(agent.paths.rules);
  const selectionKey = `${agent.id}\u0000${rulePath}`;
  const targetRule = useMemo(
    () => findAgentRule(agent, availableFiles),
    [agent, availableFiles],
  );
  const retry = useAgentRuleSynchronization({
    currentFileId: currentFile?.id,
    error,
    hasLoadedFiles,
    isLoading,
    loadFiles,
    rulePath,
    selectedRuleId,
    selectionKey,
    selectRule,
    targetRule,
  });
  return {
    createRule,
    error,
    isLoading: isLoading || !hasLoadedFiles,
    isSaving,
    isTargetReady:
      Boolean(targetRule?.exists) && currentFile?.id === targetRule?.id,
    missingRule: targetRule?.exists === false ? targetRule : null,
    retry,
    rulePath,
  };
}

function AgentRuleCreatePrompt({
  agentName,
  error,
  isCreating,
  onCreate,
  rule,
}: {
  agentName: string;
  error: string | null;
  isCreating: boolean;
  onCreate: () => void;
  rule: RuleFileDescriptor;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-96 flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
        <FilePlus2Icon aria-hidden="true" className="h-5 w-5" />
      </div>
      <h2 className="text-base font-semibold text-foreground">
        {t("agents.createRuleFileTitle", "Create {{fileName}}?", {
          fileName: rule.name,
        })}
      </h2>
      <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {t(
          "agents.createRuleFileDescription",
          "{{agentName}} does not have this rules file yet. Create it at the declared location?",
          { agentName },
        )}
      </p>
      <code className="mt-3 max-w-xl break-all rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
        {rule.path}
      </code>
      {error ? (
        <p className="mt-3 text-sm text-destructive">
          {t(
            "agents.createRuleFileFailed",
            "The rules file could not be created. Try again.",
          )}
        </p>
      ) : null}
      <button
        type="button"
        onClick={onCreate}
        disabled={isCreating}
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isCreating ? (
          <Loader2Icon aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <FilePlus2Icon aria-hidden="true" className="h-4 w-4" />
        )}
        {isCreating
          ? t("agents.creatingRuleFile", "Creating {{fileName}}...", {
              fileName: rule.name,
            })
          : t("agents.createRuleFile", "Create {{fileName}}", {
              fileName: rule.name,
            })}
      </button>
    </div>
  );
}

function AgentRuleLoading() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-48 flex-1 items-center justify-center gap-2 px-6 text-sm text-muted-foreground">
      <Loader2Icon aria-hidden="true" className="h-4 w-4 animate-spin" />
      {t("common.loading", "Loading...")}
    </div>
  );
}

function AgentRuleStatus({
  error,
  onRetry,
}: {
  error: string | null;
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      {error ? (
        <AlertCircleIcon
          aria-hidden="true"
          className="h-6 w-6 text-destructive"
        />
      ) : null}
      <p
        className={`max-w-md text-sm leading-6 ${
          error ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        {error
          ? t("agents.assetLoadFailed", "Asset inventory could not be loaded.")
          : t(
              "agents.noRulesDetected",
              "No rules file was detected for this Agent.",
            )}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <RefreshCwIcon aria-hidden="true" className="h-4 w-4" />
        {t("common.retry", "Retry")}
      </button>
    </div>
  );
}

export function AgentRulesWorkspace({ agent }: { agent: ManagedAgentSummary }) {
  const { t } = useTranslation();
  const state = useAgentRuleWorkspaceState(agent);
  if (!state.rulePath) {
    return (
      <div className="flex min-h-48 flex-1 items-center justify-center px-6 text-sm text-muted-foreground">
        {t("agents.notAvailable", "Not available")}
      </div>
    );
  }
  if (state.isLoading) return <AgentRuleLoading />;
  if (state.missingRule) {
    return (
      <AgentRuleCreatePrompt
        agentName={agent.name}
        error={state.error}
        isCreating={state.isSaving}
        onCreate={() => {
          void state.createRule(state.missingRule.id).catch(() => undefined);
        }}
        rule={state.missingRule}
      />
    );
  }
  if (state.isTargetReady) return <RulesManager />;
  return <AgentRuleStatus error={state.error} onRetry={state.retry} />;
}
