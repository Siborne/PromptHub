import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FolderIcon,
  FolderOpenIcon,
  Loader2Icon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import type { SkillProject } from "@prompthub/shared/types";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { normalizeProjectPathForComparison } from "../../services/project-skill-targets";

function inferProjectNameFromPath(rootPath: string): string {
  const normalized = rootPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}
function getExtraProjectScanPaths(
  rootPath: string,
  scanPaths: string[],
): string[] {
  const normalizedRoot = normalizeProjectPathForComparison(rootPath);
  return scanPaths.filter(
    (entry) => normalizeProjectPathForComparison(entry) !== normalizedRoot,
  );
}

interface ProjectFormModalProps {
  isOpen: boolean;
  project?: SkillProject | null;
  onClose: () => void;
  onSubmit: (input: {
    name: string;
    rootPath: string;
    scanPaths: string[];
  }) => boolean | Promise<boolean>;
}

export function ProjectFormModal({
  isOpen,
  project,
  onClose,
  onSubmit,
}: ProjectFormModalProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [rootPath, setRootPath] = useState("");
  const [scanPathInput, setScanPathInput] = useState("");
  const [scanPaths, setScanPaths] = useState<string[]>([]);
  const [isNameAutoDerived, setIsNameAutoDerived] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isOpenRef = useRef(isOpen);
  const formSessionRef = useRef(0);
  const saveInFlightRef = useRef(false);

  useEffect(() => {
    isOpenRef.current = isOpen;
    if (!isOpen) {
      return;
    }
    formSessionRef.current += 1;

    setName(project?.name ?? "");
    setRootPath(project?.rootPath ?? "");
    setScanPaths(
      project
        ? getExtraProjectScanPaths(project.rootPath, project.scanPaths ?? [])
        : [],
    );
    setScanPathInput("");
    setIsNameAutoDerived(!project);
    setError(null);
    setIsSaving(false);
    saveInFlightRef.current = false;
  }, [isOpen, project]);

  useEffect(() => {
    if (!isOpen || !isNameAutoDerived) {
      return;
    }

    const inferredName = inferProjectNameFromPath(rootPath);
    setName(inferredName);
  }, [isNameAutoDerived, isOpen, rootPath]);

  const addScanPath = (value?: string) => {
    const nextPath = (value ?? scanPathInput).trim();
    if (!nextPath) {
      return;
    }
    setScanPaths((prev) =>
      prev.includes(nextPath) ? prev : [...prev, nextPath],
    );
    setScanPathInput("");
  };

  const removeScanPath = (targetPath: string) => {
    setScanPaths((prev) => prev.filter((path) => path !== targetPath));
  };

  const handlePickFolder = async (target: "root" | "scan") => {
    const selectedPath = await window.electron?.selectFolder?.();
    if (!selectedPath) {
      return;
    }

    if (target === "root") {
      setRootPath(selectedPath);
      return;
    }

    addScanPath(selectedPath);
  };

  const handleSubmit = async () => {
    if (saveInFlightRef.current) {
      return;
    }

    if (!name.trim() || !rootPath.trim()) {
      setError(
        t(
          "skill.projectFormRequired",
          "Project name and root path are required.",
        ),
      );
      return;
    }

    saveInFlightRef.current = true;
    setIsSaving(true);
    const submitSession = formSessionRef.current;
    try {
      const didSave = await onSubmit({
        name: name.trim(),
        rootPath: rootPath.trim(),
        scanPaths,
      });
      if (
        didSave &&
        isOpenRef.current &&
        formSessionRef.current === submitSession
      ) {
        onClose();
      }
    } finally {
      if (isOpenRef.current && formSessionRef.current === submitSession) {
        saveInFlightRef.current = false;
        setIsSaving(false);
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        project
          ? t("skill.editProject", "Edit Project")
          : t("skill.addProject", "Add Project")
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t("skill.projectRootPath", "Project Root Path")}
          </label>
          <p className="text-xs text-muted-foreground">
            {t(
              "skill.projectRootPathFirstHint",
              "Choose the project root first. PromptHub can infer the project name and start scanning right away.",
            )}
          </p>
          <div
            data-testid="project-root-path-row"
            className="flex w-full items-start gap-2"
          >
            <div
              data-testid="project-root-path-input-shell"
              className="min-w-0 flex-1"
            >
              <Input
                aria-label={t("skill.projectRootPath", "Project Root Path")}
                value={rootPath}
                onChange={(event) => {
                  setRootPath(event.target.value);
                }}
                placeholder={t(
                  "skill.projectRootPathPlaceholder",
                  "/path/to/project",
                )}
              />
            </div>
            <button
              type="button"
              onClick={() => void handlePickFolder("root")}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border app-wallpaper-surface px-4 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
              {t("skill.browseFolder", "Browse")}
            </button>
          </div>
        </div>

        <Input
          label={t("skill.projectName", "Project Name")}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setIsNameAutoDerived(false);
          }}
          placeholder={t("skill.projectNamePlaceholder", "Workspace Project")}
          error={error ?? undefined}
        />

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t("skill.projectScanPaths", "Scan Paths")}
          </label>
          <div
            data-testid="project-scan-path-row"
            className="flex w-full items-start gap-2"
          >
            <div
              data-testid="project-scan-path-input-shell"
              className="min-w-0 flex-1"
            >
              <Input
                aria-label={t("skill.projectScanPaths", "Scan Paths")}
                value={scanPathInput}
                onChange={(event) => setScanPathInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addScanPath();
                  }
                }}
                placeholder={t(
                  "skill.projectScanPathPlaceholder",
                  "Optional extra directories to scan",
                )}
              />
            </div>
            <button
              type="button"
              onClick={() => addScanPath()}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border app-wallpaper-surface px-4 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <PlusIcon aria-hidden="true" className="h-4 w-4" />
              {t("common.add", "Add")}
            </button>
            <button
              type="button"
              onClick={() => void handlePickFolder("scan")}
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border app-wallpaper-surface px-4 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <FolderOpenIcon aria-hidden="true" className="h-4 w-4" />
              {t("skill.browseFolder", "Browse")}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              "skill.projectScanPathsHint",
              "PromptHub always scans the project root plus default skill folders like .claude/skills, .agents/skills, skills, and .gemini. Add extra scan paths here only if your project uses custom locations.",
            )}
          </p>
          <div className="space-y-2">
            {scanPaths.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                {t(
                  "skill.projectScanPathsEmpty",
                  "No extra scan paths configured yet. PromptHub will still scan the project root automatically.",
                )}
              </div>
            ) : (
              scanPaths.map((scanPath) => (
                <div
                  key={scanPath}
                  className="flex items-center gap-2 rounded-xl border border-border app-wallpaper-surface px-3 py-2"
                >
                  <FolderIcon className="h-4 w-4 text-primary" />
                  <span className="flex-1 truncate font-mono text-xs text-foreground">
                    {scanPath}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeScanPath(scanPath)}
                    className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                  >
                    <TrashIcon aria-hidden="true" className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border app-wallpaper-surface px-4 py-2 text-sm text-foreground transition-colors hover:bg-accent"
          >
            {t("common.cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <Loader2Icon
                aria-hidden="true"
                className="h-4 w-4 animate-spin"
              />
            ) : null}
            {project
              ? t("common.save", "Save")
              : t("skill.addProject", "Add Project")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
