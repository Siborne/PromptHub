import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

interface SkillFileMutationDialogsProps {
  deletePath: string | null;
  input: string;
  isNewFileOpen: boolean;
  isNewFolderOpen: boolean;
  renamePath: string | null;
  onCloseDelete: () => void;
  onCloseNewFile: () => void;
  onCloseNewFolder: () => void;
  onCloseRename: () => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDelete: () => void;
  onInputChange: (value: string) => void;
  onRename: () => void;
}

function SimpleDialog({
  isOpen,
  title,
  children,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  if (!isOpen) return null;
  return createPortal(
    <div className="skill-file-editor__dialog-overlay">
      <div
        data-testid="skill-file-editor-dialog-backdrop"
        role="presentation"
        aria-hidden="true"
        className="skill-file-editor__dialog-backdrop"
        onClick={onClose}
      />
      <div className="skill-file-editor__dialog">
        <h3>{title}</h3>
        {children}
      </div>
    </div>,
    document.body,
  );
}

function DialogActions({
  destructive = false,
  disabled = false,
  onCancel,
  onConfirm,
}: {
  destructive?: boolean;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="skill-file-editor__dialog-actions">
      <button
        type="button"
        className="skill-file-editor__dialog-btn skill-file-editor__dialog-btn--cancel"
        onClick={onCancel}
      >
        {t("common.cancel", "Cancel")}
      </button>
      <button
        type="button"
        className={`skill-file-editor__dialog-btn skill-file-editor__dialog-btn--${
          destructive ? "destructive" : "primary"
        }`}
        onClick={onConfirm}
        disabled={disabled}
      >
        {destructive
          ? t("common.delete", "Delete")
          : t("common.confirm", "Confirm")}
      </button>
    </div>
  );
}

export function SkillFileMutationDialogs({
  deletePath,
  input,
  isNewFileOpen,
  isNewFolderOpen,
  renamePath,
  onCloseDelete,
  onCloseNewFile,
  onCloseNewFolder,
  onCloseRename,
  onCreateFile,
  onCreateFolder,
  onDelete,
  onInputChange,
  onRename,
}: SkillFileMutationDialogsProps) {
  const { t } = useTranslation();
  return (
    <>
      <SimpleDialog
        isOpen={isNewFileOpen}
        title={t("skill.newFile", "New File")}
        onClose={onCloseNewFile}
      >
        <input
          type="text"
          className="skill-file-editor__dialog-input"
          aria-label={t("skill.enterFileName", "Enter file name")}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCreateFile();
            if (event.key === "Escape") onCloseNewFile();
          }}
          placeholder={t("skill.enterFileName", "Enter file name")}
          autoFocus
        />
        <p className="skill-file-editor__dialog-hint">
          e.g. helpers/utils.py, README.md
        </p>
        <DialogActions
          disabled={!input.trim()}
          onCancel={onCloseNewFile}
          onConfirm={onCreateFile}
        />
      </SimpleDialog>

      <SimpleDialog
        isOpen={isNewFolderOpen}
        title={t("skill.newFolder", "New Folder")}
        onClose={onCloseNewFolder}
      >
        <input
          type="text"
          className="skill-file-editor__dialog-input"
          aria-label={t("skill.enterFolderName", "Enter folder name")}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onCreateFolder();
            if (event.key === "Escape") onCloseNewFolder();
          }}
          placeholder={t("skill.enterFolderName", "Enter folder name")}
          autoFocus
        />
        <DialogActions
          disabled={!input.trim()}
          onCancel={onCloseNewFolder}
          onConfirm={onCreateFolder}
        />
      </SimpleDialog>

      <SimpleDialog
        isOpen={Boolean(deletePath)}
        title={t("common.delete", "Delete")}
        onClose={onCloseDelete}
      >
        <p
          style={{
            fontSize: "0.85rem",
            color: "hsl(var(--muted-foreground))",
            marginBottom: "0.5rem",
          }}
        >
          {t(
            "skill.deletePathConfirm",
            "Are you sure you want to delete this file or folder? This action cannot be undone.",
          )}
        </p>
        <p
          style={{
            fontSize: "0.8rem",
            fontFamily: "monospace",
            background: "hsl(var(--muted) / 0.5)",
            padding: "0.375rem 0.5rem",
            borderRadius: "0.375rem",
          }}
        >
          {deletePath}
        </p>
        <DialogActions
          destructive
          onCancel={onCloseDelete}
          onConfirm={onDelete}
        />
      </SimpleDialog>

      <SimpleDialog
        isOpen={Boolean(renamePath)}
        title={t("folder.rename", "重命名")}
        onClose={onCloseRename}
      >
        <input
          type="text"
          className="skill-file-editor__dialog-input"
          aria-label={t("folder.rename", "重命名")}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onRename();
            if (event.key === "Escape") onCloseRename();
          }}
          placeholder={t("skill.enterFileName", "Enter file name")}
          autoFocus
        />
        <DialogActions
          disabled={!input.trim()}
          onCancel={onCloseRename}
          onConfirm={onRename}
        />
      </SimpleDialog>
    </>
  );
}
