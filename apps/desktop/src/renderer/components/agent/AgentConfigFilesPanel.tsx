import { FileCogIcon, FolderOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { SkillFileEditor } from "../skill/SkillFileEditor";

export function AgentConfigFilesPanel({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const relativePaths = agent.paths.configFileRelativePaths;

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <FileCogIcon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <h2 className="text-sm font-semibold text-foreground">
          {t("agents.nativeConfigFiles", "Native config files")}
        </h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {relativePaths.length}
        </span>
        <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground lg:block">
          {agent.paths.root}
        </span>
        <button
          type="button"
          onClick={() => void window.electron?.openPath?.(agent.paths.root)}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
        >
          <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
          {t("agents.openAgentFolder", "Open Agent folder")}
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <SkillFileEditor
          skillId={`agent:${agent.id}`}
          localPath={agent.paths.root}
          fileSource={{
            key: `agent-config:${agent.id}`,
            listFiles: () => window.api.agent.listConfigFiles(agent.id),
            readFile: (relativePath) =>
              window.api.agent.readConfigFile(agent.id, relativePath),
            writeFile: (relativePath, content) =>
              window.api.agent.writeConfigFile(agent.id, relativePath, content),
            openInFileManager: async () => {
              await window.electron?.openPath?.(agent.paths.root);
            },
          }}
          skillName={agent.name}
          isOpen
          mode="inline"
          visibleFilePaths={relativePaths}
          initialFilePath={relativePaths[0]}
          includeMissingVisibleFiles
          allowStructuralMutations={false}
          surfaceLabels={{
            noFiles: t(
              "agents.noConfigFiles",
              "No verified config files are available.",
            ),
          }}
        />
      </div>
    </section>
  );
}
