import { useCallback, useState } from "react";
import { FileCogIcon, FolderOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ManagedAgentSummary } from "@prompthub/shared/types";
import { isWebRuntime } from "../../runtime";
import { SkillFileEditor } from "../skill/SkillFileEditor";

export function AgentConfigFilesPanel({
  agent,
}: {
  agent: ManagedAgentSummary;
}) {
  const { t } = useTranslation();
  const webRuntime = isWebRuntime();
  const relativePaths = agent.paths.configFileRelativePaths;
  const [fileCount, setFileCount] = useState(relativePaths.length);
  const listFiles = useCallback(async () => {
    const files = await window.api.agent.listConfigFiles(agent.id);
    setFileCount(files.filter((file) => !file.isDirectory).length);
    return files;
  }, [agent.id]);

  if (!agent.isDetected) {
    return (
      <section className="flex h-full items-center justify-center bg-background px-6 text-sm text-muted-foreground">
        {t("agents.noConfigFiles", "No verified config files are available.")}
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <FileCogIcon
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <h2 className="text-sm font-semibold text-foreground">
          {t("agents.nativeConfigFiles", "Native config files")}
        </h2>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {fileCount}
        </span>
        <span className="hidden min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground lg:block">
          {agent.paths.root}
        </span>
        {!webRuntime ? (
          <button
            type="button"
            onClick={() => void window.electron?.openPath?.(agent.paths.root)}
            className="ml-auto inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
            {t("agents.openAgentFolder", "Open Agent folder")}
          </button>
        ) : null}
      </div>
      <div
        data-testid="agent-config-files-workbench"
        className="min-h-0 flex-1 overflow-hidden bg-background"
      >
        <SkillFileEditor
          skillId={`agent:${agent.id}`}
          localPath={agent.paths.root}
          fileSource={{
            key: `agent-config:${agent.id}`,
            listFiles,
            readFile: (relativePath) =>
              window.api.agent.readConfigFile(agent.id, relativePath),
            writeFile: (relativePath, content, expectedRevision) =>
              window.api.agent.writeConfigFile(
                agent.id,
                relativePath,
                content,
                expectedRevision,
              ),
            openInFileManager: async () => {
              await window.electron?.openPath?.(agent.paths.root);
            },
          }}
          skillName={agent.name}
          isOpen
          mode="inline"
          initialFilePath={relativePaths[0]}
          allowStructuralMutations={false}
          showFileManagerActions={!webRuntime}
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
