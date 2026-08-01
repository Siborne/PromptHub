import { FolderOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SkillPlatform } from "@prompthub/shared/constants/platforms";
import type { AgentIdentityPreference } from "@prompthub/shared/types";

import {
  getAgentEditPathFields,
  type AgentEditPathField,
  type AgentEditPathValues,
} from "../../services/agent-edit-adapter";
import { CodexIdentityFields } from "./CodexIdentityFields";

export interface BuiltinAgentEditDraft extends AgentEditPathValues {
  rootPath: string;
  identity: AgentIdentityPreference;
}

interface BuiltinAgentEditorProps {
  platform?: SkillPlatform;
  isCustom?: boolean;
  value: BuiltinAgentEditDraft;
  onChange: (value: BuiltinAgentEditDraft) => void;
  onBrowseRoot?: () => void;
}

interface FieldCopy {
  labelKey: string;
  label: string;
  placeholderKey: string;
  placeholder: string;
}

const FIELD_COPY: Record<AgentEditPathField, FieldCopy> = {
  skillsPath: {
    labelKey: "settings.agentSkillsLabel",
    label: "Skills",
    placeholderKey: "settings.customAgentSkillsPathPlaceholder",
    placeholder: "skills relative path (optional)",
  },
  rulesPath: {
    labelKey: "settings.agentRulesLabel",
    label: "Rules",
    placeholderKey: "settings.customAgentRulesPathPlaceholder",
    placeholder: "rules file path (optional)",
  },
  mcpPath: {
    labelKey: "settings.agentMcpLabel",
    label: "MCP",
    placeholderKey: "settings.customAgentMcpPathPlaceholder",
    placeholder: "MCP config relative path",
  },
  pluginsPath: {
    labelKey: "settings.agentPluginsLabel",
    label: "Plugins",
    placeholderKey: "settings.customAgentPluginsPathPlaceholder",
    placeholder: "Plugin directory relative path",
  },
  agentsPath: {
    labelKey: "settings.agentAgentsLabel",
    label: "Agents",
    placeholderKey: "settings.customAgentAgentsPathPlaceholder",
    placeholder: "agents relative path",
  },
  commandsPath: {
    labelKey: "settings.agentCommandsLabel",
    label: "Commands",
    placeholderKey: "settings.customAgentCommandsPathPlaceholder",
    placeholder: "commands relative path",
  },
  configPaths: {
    labelKey: "settings.agentConfigLabel",
    label: "Config",
    placeholderKey: "settings.customAgentConfigPathsPlaceholder",
    placeholder: "config files, comma separated",
  },
};

function AgentPathInput({
  field,
  value,
  onChange,
}: {
  field: AgentEditPathField;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const copy = FIELD_COPY[field];

  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {t(copy.labelKey, copy.label)}
      </span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t(copy.placeholderKey, copy.placeholder)}
        className="h-9 w-full rounded-md bg-muted px-3 text-sm font-mono"
      />
    </label>
  );
}

function AgentRootInput({
  value,
  onChange,
  onBrowse,
}: {
  value: string;
  onChange: (value: string) => void;
  onBrowse?: () => void;
}) {
  const { t } = useTranslation();
  const browseLabel = t("skill.browseFolder", "Browse");

  return (
    <label className="grid gap-1">
      <span className="text-xs font-medium text-muted-foreground">
        {t("settings.agentRootPathLabel", "Root directory")}
      </span>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t(
            "settings.platformRootPathPlaceholder",
            "Leave empty to use the default root, e.g. ~/.trae-cn",
          )}
          className="h-9 min-w-0 flex-1 rounded-lg bg-muted px-3 text-sm placeholder:text-muted-foreground/50"
        />
        {onBrowse ? (
          <button
            type="button"
            onClick={onBrowse}
            title={browseLabel}
            aria-label={browseLabel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </label>
  );
}

export function BuiltinAgentEditor({
  platform,
  isCustom = false,
  value,
  onChange,
  onBrowseRoot,
}: BuiltinAgentEditorProps) {
  const update = <K extends keyof BuiltinAgentEditDraft>(
    key: K,
    nextValue: BuiltinAgentEditDraft[K],
  ) => onChange({ ...value, [key]: nextValue });
  const fields = getAgentEditPathFields({ platform, isCustom, values: value });

  return (
    <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
      {platform?.id === "codex" ? (
        <CodexIdentityFields
          value={value.identity}
          onChange={(identity) => update("identity", identity)}
        />
      ) : null}
      <AgentRootInput
        value={value.rootPath}
        onChange={(rootPath) => update("rootPath", rootPath)}
        onBrowse={onBrowseRoot}
      />
      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <AgentPathInput
            key={field}
            field={field}
            value={value[field]}
            onChange={(nextValue) => update(field, nextValue)}
          />
        ))}
      </div>
    </div>
  );
}
