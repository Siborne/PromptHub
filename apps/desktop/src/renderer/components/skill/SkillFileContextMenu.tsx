import {
  FilePlusIcon,
  FolderPlusIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react";
import type { ContextMenuState } from "./skill-file-editor-utils";

export type SkillFileContextMenuAction =
  | { type: "delete" | "rename"; path: string }
  | { type: "new-file" | "new-folder"; parentPath: string | null };

interface SkillFileContextMenuProps {
  contextMenu: ContextMenuState | null;
  readOnly: boolean;
  labels: {
    delete: string;
    newFile: string;
    newFolder: string;
    rename: string;
  };
  onAction: (action: SkillFileContextMenuAction) => void;
}

function getParentPath(contextMenu: ContextMenuState): string | null {
  if (contextMenu.path && contextMenu.isDirectory) return contextMenu.path;
  return contextMenu.path?.split("/").slice(0, -1).join("/") || null;
}

export function SkillFileContextMenu({
  contextMenu,
  readOnly,
  labels,
  onAction,
}: SkillFileContextMenuProps) {
  if (!contextMenu || readOnly) return null;

  const path = contextMenu.path;
  return (
    <div
      className="skill-file-editor__context-menu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      {path && !contextMenu.isDirectory ? (
        <PathActions path={path} labels={labels} onAction={onAction} />
      ) : null}
      <button
        type="button"
        className="skill-file-editor__context-item"
        onClick={() =>
          onAction({
            type: "new-file",
            parentPath: getParentPath(contextMenu),
          })
        }
      >
        <FilePlusIcon aria-hidden="true" className="w-4 h-4" />
        {labels.newFile}
      </button>
      <button
        type="button"
        className="skill-file-editor__context-item"
        onClick={() =>
          onAction({
            type: "new-folder",
            parentPath: getParentPath(contextMenu),
          })
        }
      >
        <FolderPlusIcon aria-hidden="true" className="w-4 h-4" />
        {labels.newFolder}
      </button>
      {path && contextMenu.isDirectory ? (
        <PathActions path={path} labels={labels} onAction={onAction} />
      ) : null}
    </div>
  );
}

function PathActions({
  path,
  labels,
  onAction,
}: {
  path: string;
  labels: SkillFileContextMenuProps["labels"];
  onAction: (action: SkillFileContextMenuAction) => void;
}) {
  return (
    <>
      <button
        type="button"
        className="skill-file-editor__context-item"
        onClick={() => onAction({ type: "rename", path })}
      >
        <PencilIcon aria-hidden="true" className="w-4 h-4" />
        {labels.rename}
      </button>
      <button
        type="button"
        className="skill-file-editor__context-item skill-file-editor__context-item--danger"
        onClick={() => onAction({ type: "delete", path })}
      >
        <Trash2Icon aria-hidden="true" className="w-4 h-4" />
        {labels.delete}
      </button>
    </>
  );
}
