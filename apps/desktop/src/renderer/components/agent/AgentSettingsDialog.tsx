import { useEffect, useMemo, useState } from "react";
import { RotateCcwIcon, SaveIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  getPlatformById,
  getPlatformRootTemplate,
} from "@prompthub/shared/constants/platforms";
import type {
  CustomAgentConfig,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import {
  DEFAULT_CODEX_IDENTITY,
  normalizeAgentIdentityPreferences,
} from "../../services/agent-identity";
import { getEffectiveBuiltinAgentConfig } from "../../services/agent-root-paths";
import { buildBuiltinAgentPathOverride } from "../../services/agent-edit-adapter";
import { getRendererPlatform } from "../../services/runtime-platform";
import { useSettingsStore } from "../../stores/settings.store";
import {
  BuiltinAgentEditor,
  type BuiltinAgentEditDraft,
} from "../settings/BuiltinAgentEditor";
import { ToggleSwitch } from "../settings/shared";
import { Modal } from "../ui/Modal";
import { useToast } from "../ui/Toast";

interface AgentSettingsDialogProps {
  agent: ManagedAgentSummary | null;
  isOpen: boolean;
  onClose: () => void;
}

const EMPTY_DRAFT: BuiltinAgentEditDraft = {
  rootPath: "",
  skillsPath: "",
  mcpPath: "",
  pluginsPath: "",
  rulesPath: "",
  agentsPath: "",
  commandsPath: "",
  configPaths: "",
  identity: DEFAULT_CODEX_IDENTITY,
};

function toDraft(
  config: {
    rootPath?: string;
    skillsRelativePath?: string;
    mcpRelativePath?: string;
    pluginsRelativePath?: string;
    rulesRelativePath?: string;
    agentsRelativePath?: string;
    commandsRelativePath?: string;
    configRelativePaths?: string[];
  },
  identity = DEFAULT_CODEX_IDENTITY,
): BuiltinAgentEditDraft {
  return {
    rootPath: config.rootPath || "",
    skillsPath: config.skillsRelativePath || "",
    mcpPath: config.mcpRelativePath || "",
    pluginsPath: config.pluginsRelativePath || "",
    rulesPath: config.rulesRelativePath || "",
    agentsPath: config.agentsRelativePath || "",
    commandsPath: config.commandsRelativePath || "",
    configPaths: (config.configRelativePaths || []).join(", "),
    identity,
  };
}

function parseConfigPaths(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getCustomDraft(agent: CustomAgentConfig): BuiltinAgentEditDraft {
  return toDraft(agent);
}

export function AgentSettingsDialog({
  agent,
  isOpen,
  onClose,
}: AgentSettingsDialogProps) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const builtinAgentOverrides = useSettingsStore(
    (state) => state.builtinAgentOverrides,
  );
  const agentIdentityPreferences = useSettingsStore(
    (state) => state.agentIdentityPreferences,
  );
  const customAgents = useSettingsStore((state) => state.customAgents);
  const updateBuiltinAgentOverride = useSettingsStore(
    (state) => state.updateBuiltinAgentOverride,
  );
  const setCodexIdentityPreference = useSettingsStore(
    (state) => state.setCodexIdentityPreference,
  );
  const updateCustomAgent = useSettingsStore(
    (state) => state.updateCustomAgent,
  );
  const [draft, setDraft] = useState<BuiltinAgentEditDraft>(EMPTY_DRAFT);
  const [customName, setCustomName] = useState("");
  const [customEnabled, setCustomEnabled] = useState(true);

  const platform = useMemo(
    () => (agent?.isCustom ? undefined : getPlatformById(agent?.id || "")),
    [agent?.id, agent?.isCustom],
  );
  const customAgent = useMemo(
    () => customAgents.find((item) => item.id === agent?.id),
    [agent?.id, customAgents],
  );
  useEffect(() => {
    if (!isOpen || !agent) return;

    if (agent.isCustom && customAgent) {
      setDraft(getCustomDraft(customAgent));
      setCustomName(customAgent.name);
      setCustomEnabled(customAgent.enabled !== false);
      return;
    }

    if (!platform) {
      setDraft({ ...EMPTY_DRAFT, rootPath: agent.paths.root });
      return;
    }

    const effectiveConfig = getEffectiveBuiltinAgentConfig(
      platform,
      agent.paths.root,
      builtinAgentOverrides[platform.id],
    );
    const identity =
      platform.id === "codex"
        ? normalizeAgentIdentityPreferences(agentIdentityPreferences).codex!
        : DEFAULT_CODEX_IDENTITY;
    setDraft(toDraft(effectiveConfig, identity));
  }, [
    agent,
    agentIdentityPreferences,
    builtinAgentOverrides,
    customAgent,
    isOpen,
    platform,
  ]);

  const resetDraft = () => {
    if (!agent) return;
    if (agent.isCustom && customAgent) {
      setDraft(getCustomDraft(customAgent));
      setCustomName(customAgent.name);
      setCustomEnabled(customAgent.enabled !== false);
      return;
    }
    if (!platform) return;

    const defaultRoot = getPlatformRootTemplate(
      platform,
      getRendererPlatform(),
    );
    setDraft(
      toDraft(
        getEffectiveBuiltinAgentConfig(platform, defaultRoot, undefined),
        DEFAULT_CODEX_IDENTITY,
      ),
    );
  };

  const save = () => {
    if (!agent) return;

    try {
      if (agent.isCustom) {
        updateCustomAgent(agent.id, {
          name: customName,
          rootPath: draft.rootPath,
          enabled: customEnabled,
          skillsRelativePath: draft.skillsPath,
          mcpRelativePath: draft.mcpPath,
          pluginsRelativePath: draft.pluginsPath,
          rulesRelativePath: draft.rulesPath,
          agentsRelativePath: draft.agentsPath,
          commandsRelativePath: draft.commandsPath,
          configRelativePaths: parseConfigPaths(draft.configPaths),
        });
      } else if (platform) {
        updateBuiltinAgentOverride(
          agent.id,
          buildBuiltinAgentPathOverride(platform, draft.rootPath, draft),
        );
        if (agent.id === "codex") {
          setCodexIdentityPreference(draft.identity);
        }
      }

      onClose();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : String(error),
        "error",
      );
    }
  };

  const browseRoot = async () => {
    const selectedPath = await window.electron?.selectFolder?.();
    if (selectedPath) {
      setDraft((current) => ({ ...current, rootPath: selectedPath }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("agents.editAgentTitle", { agent: agent?.name || "Agent" })}
      subtitle={t(
        "agents.editAgentDesc",
        "Update this Agent's root and asset paths without leaving the workspace.",
      )}
      size="xl"
    >
      <div className="space-y-5">
        {agent?.isCustom ? (
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                {t("settings.customAgentNameLabel", "Agent name")}
              </span>
              <input
                type="text"
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                className="h-10 w-full rounded-md bg-muted px-3 text-sm"
              />
            </label>
            <div className="flex h-10 items-center gap-3">
              <span className="text-sm font-medium text-foreground">
                {t("settings.platformEnabled", "Enabled")}
              </span>
              <ToggleSwitch
                checked={customEnabled}
                onChange={setCustomEnabled}
                ariaLabel={t("settings.platformEnabled", "Enabled")}
              />
            </div>
          </div>
        ) : null}

        {agent && (agent.isCustom ? customAgent : platform) ? (
          <BuiltinAgentEditor
            platform={platform}
            isCustom={agent.isCustom}
            value={draft}
            onChange={setDraft}
            onBrowseRoot={() => void browseRoot()}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(
              "agents.agentSettingsUnavailable",
              "This Agent does not expose editable path settings.",
            )}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <button
            type="button"
            onClick={resetDraft}
            disabled={!agent || (!agent.isCustom && !platform)}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcwIcon aria-hidden="true" className="h-4 w-4" />
            {t("common.reset", "Reset")}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <XIcon aria-hidden="true" className="h-4 w-4" />
              {t("common.cancel", "Cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!agent || (!agent.isCustom && !platform)}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SaveIcon aria-hidden="true" className="h-4 w-4" />
              {t("common.save", "Save")}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
