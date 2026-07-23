import { useTranslation } from "react-i18next";
import type { AgentIdentityPreference } from "@prompthub/shared/types";

import { CodexIdentityFields } from "./CodexIdentityFields";

export interface BuiltinAgentEditDraft {
  rootPath: string;
  skillsPath: string;
  mcpPath: string;
  pluginsPath: string;
  rulesPath: string;
  agentsPath: string;
  configPaths: string;
  identity: AgentIdentityPreference;
}

interface BuiltinAgentEditorProps {
  platformId: string;
  supportsPluginPackages: boolean;
  value: BuiltinAgentEditDraft;
  onChange: (value: BuiltinAgentEditDraft) => void;
}

export function BuiltinAgentEditor({
  platformId,
  supportsPluginPackages,
  value,
  onChange,
}: BuiltinAgentEditorProps) {
  const { t } = useTranslation();
  const update = <K extends keyof BuiltinAgentEditDraft>(
    key: K,
    nextValue: BuiltinAgentEditDraft[K],
  ) => onChange({ ...value, [key]: nextValue });

  const fields = [
    {
      key: "skillsPath" as const,
      label: t("settings.agentSkillsLabel", "Skills"),
      placeholder: t(
        "settings.customAgentSkillsPathPlaceholder",
        "skills relative path (optional)",
      ),
    },
    {
      key: "rulesPath" as const,
      label: t("settings.agentRulesLabel", "Rules"),
      placeholder: t(
        "settings.customAgentRulesPathPlaceholder",
        "rules file path (optional)",
      ),
    },
    {
      key: "mcpPath" as const,
      label: t("settings.agentMcpLabel", "MCP"),
      placeholder: t(
        "settings.customAgentMcpPathPlaceholder",
        "MCP config relative path",
      ),
    },
    {
      key: "agentsPath" as const,
      label: t("settings.agentAgentsLabel", "Agents"),
      placeholder: t(
        "settings.customAgentAgentsPathPlaceholder",
        "agents relative path",
      ),
    },
  ];

  return (
    <div className="grid gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
      {platformId === "codex" ? (
        <CodexIdentityFields
          value={value.identity}
          onChange={(identity) => update("identity", identity)}
        />
      ) : null}

      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings.agentRootPathLabel", "Root directory")}
        </span>
        <input
          type="text"
          value={value.rootPath}
          onChange={(event) => update("rootPath", event.target.value)}
          placeholder={t(
            "settings.platformRootPathPlaceholder",
            "Leave empty to use the default root, e.g. ~/.trae-cn",
          )}
          className="h-9 w-full rounded-lg bg-muted px-3 text-sm placeholder:text-muted-foreground/50"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        {fields.map((field) => (
          <label key={field.key} className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {field.label}
            </span>
            <input
              type="text"
              value={value[field.key]}
              onChange={(event) => update(field.key, event.target.value)}
              placeholder={field.placeholder}
              className="h-9 w-full rounded-md bg-muted px-3 text-sm font-mono"
            />
          </label>
        ))}

        {supportsPluginPackages ? (
          <label className="grid gap-1">
            <span className="text-xs font-medium text-muted-foreground">
              {t("settings.agentPluginsLabel", "Plugins")}
            </span>
            <input
              type="text"
              value={value.pluginsPath}
              onChange={(event) => update("pluginsPath", event.target.value)}
              placeholder={t(
                "settings.customAgentPluginsPathPlaceholder",
                "Plugin directory relative path",
              )}
              className="h-9 w-full rounded-md bg-muted px-3 text-sm font-mono"
            />
          </label>
        ) : null}
      </div>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("settings.agentConfigLabel", "Config")}
        </span>
        <input
          type="text"
          value={value.configPaths}
          onChange={(event) => update("configPaths", event.target.value)}
          placeholder={t(
            "settings.customAgentConfigPathsPlaceholder",
            "config files, comma separated",
          )}
          className="h-9 w-full rounded-md bg-muted px-3 text-sm font-mono"
        />
      </label>
    </div>
  );
}
