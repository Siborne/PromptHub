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
    <section className="flex min-h-[36rem] flex-col overflow-hidden rounded-md border border-indigo-500/25 bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-indigo-500/25 bg-indigo-500/[0.07] px-5 py-5">
        <div className="flex min-w-0 items-start gap-4">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">
            <FileCogIcon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl font-semibold text-foreground">
                {t("agents.nativeConfigFiles", "Native config files")}
              </h2>
              <span className="rounded-md bg-indigo-500/15 px-2 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                {relativePaths.length}
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t(
                "agents.nativeConfigFilesDesc",
                "Configuration files declared for this Agent.",
              )}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-foreground/70">
              {agent.paths.root}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void window.electron?.openPath?.(agent.paths.root)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border/80 bg-card px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent"
        >
          <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
          {t("agents.openAgentFolder", "Open Agent folder")}
        </button>
      </header>
      <div className="min-h-[30rem] flex-1 overflow-hidden">
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
