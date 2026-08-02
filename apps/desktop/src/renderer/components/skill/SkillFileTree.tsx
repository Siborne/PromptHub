import { memo, type MouseEvent } from "react";
import type { TFunction } from "i18next";
import {
  ChevronRightIcon,
  ExternalLinkIcon,
  FileIcon,
  FilePlusIcon,
  FolderPlusIcon,
  Loader2Icon,
  Trash2Icon,
} from "lucide-react";

import { getSkillFileIconUrl } from "./skill-file-icons";
import type { ContextMenuState, TreeNode } from "./skill-file-editor-utils";

interface SkillFileTreeProps {
  canMutateStructure: boolean;
  expandedDirs: Set<string>;
  isLoading: boolean;
  modifiedFilePaths: Set<string>;
  noFilesLabel: string;
  onContextMenuChange: (state: ContextMenuState) => void;
  onCreateFile: () => void;
  onCreateFolder: () => void;
  onDeleteFile: (path: string) => void;
  onOpenInExplorer: () => void | Promise<void>;
  onRequestSelectFile: (path: string) => void;
  onToggleDir: (path: string) => void;
  selectedFile: string | null;
  showFileManagerActions: boolean;
  t: TFunction;
  tree: TreeNode[];
}

function FileTreeIcon({
  isDirectory,
  isOpen,
  name,
}: {
  isDirectory: boolean;
  isOpen: boolean;
  name: string;
}) {
  return (
    <img
      src={getSkillFileIconUrl(name, isDirectory, isOpen)}
      alt=""
      aria-hidden="true"
      className="skill-file-editor__tree-item-icon"
      draggable={false}
    />
  );
}

function openContextMenu(
  event: MouseEvent,
  node: Pick<TreeNode, "isDirectory" | "path">,
  onContextMenuChange: SkillFileTreeProps["onContextMenuChange"],
) {
  event.preventDefault();
  event.stopPropagation();
  onContextMenuChange({
    x: event.clientX,
    y: event.clientY,
    path: node.path,
    isDirectory: node.isDirectory,
  });
}

function SkillFileTreeNode({
  node,
  props,
}: {
  node: TreeNode;
  props: SkillFileTreeProps;
}) {
  const depthClass =
    node.depth <= 4 ? `skill-file-editor__tree-item--depth-${node.depth}` : "";
  if (node.isDirectory) {
    return <SkillFileDirectoryNode node={node} props={props} />;
  }
  return (
    <SkillFileLeafNode node={node} depthClass={depthClass} props={props} />
  );
}

function SkillFileDirectoryNode({
  node,
  props,
}: {
  node: TreeNode;
  props: SkillFileTreeProps;
}) {
  const isExpanded = props.expandedDirs.has(node.path);
  return (
    <div>
      <SkillFileDirectoryButton
        isExpanded={isExpanded}
        node={node}
        props={props}
      />
      {isExpanded
        ? node.children.map((child) => (
            <SkillFileTreeNode key={child.path} node={child} props={props} />
          ))
        : null}
    </div>
  );
}

function SkillFileDirectoryButton({
  isExpanded,
  node,
  props,
}: {
  isExpanded: boolean;
  node: TreeNode;
  props: SkillFileTreeProps;
}) {
  const depthClass =
    node.depth <= 4 ? `skill-file-editor__tree-item--depth-${node.depth}` : "";
  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      className={`skill-file-editor__tree-item skill-file-editor__tree-item--directory ${depthClass}`}
      onClick={() => props.onToggleDir(node.path)}
      onContextMenu={(event) => {
        if (props.canMutateStructure) {
          openContextMenu(event, node, props.onContextMenuChange);
        }
      }}
    >
      <ChevronRightIcon
        aria-hidden="true"
        className="skill-file-editor__tree-item-icon"
        style={{
          transform: isExpanded ? "rotate(90deg)" : "none",
          transition: "transform 0.15s",
        }}
      />
      <FileTreeIcon name={node.name} isDirectory={true} isOpen={isExpanded} />
      <span className="skill-file-editor__tree-item-name">{node.name}</span>
    </button>
  );
}

function SkillFileLeafNode({
  depthClass,
  node,
  props,
}: {
  depthClass: string;
  node: TreeNode;
  props: SkillFileTreeProps;
}) {
  const isActive = props.selectedFile === node.path;
  return (
    <div
      className="skill-file-editor__tree-file-row"
      onContextMenu={(event) => {
        if (props.canMutateStructure) {
          openContextMenu(event, node, props.onContextMenuChange);
        }
      }}
    >
      <button
        type="button"
        className={`skill-file-editor__tree-item ${depthClass} ${
          isActive ? "skill-file-editor__tree-item--active" : ""
        }`}
        onClick={() => props.onRequestSelectFile(node.path)}
      >
        <FileTreeIcon name={node.name} isDirectory={false} isOpen={false} />
        <span className="skill-file-editor__tree-item-name">{node.name}</span>
        {props.modifiedFilePaths.has(node.path) ? (
          <span className="skill-file-editor__tree-item-dot" />
        ) : null}
      </button>
      {props.canMutateStructure ? (
        <button
          type="button"
          className="skill-file-editor__tree-item-delete"
          onClick={() => props.onDeleteFile(node.path)}
          title={props.t("skill.deleteFile", "Delete File")}
          aria-label={props.t("skill.deleteFile", "Delete File")}
        >
          <Trash2Icon
            aria-hidden="true"
            style={{ width: "0.75rem", height: "0.75rem" }}
          />
        </button>
      ) : null}
    </div>
  );
}

function SkillFileTreeView(props: SkillFileTreeProps) {
  return (
    <div className="skill-file-editor__tree">
      <SkillFileTreeHeader {...props} />
      <SkillFileTreeList {...props} />
      {props.showFileManagerActions ? (
        <div className="skill-file-editor__tree-footer">
          <button
            type="button"
            className="skill-file-editor__open-explorer-btn"
            onClick={() => void props.onOpenInExplorer()}
          >
            <ExternalLinkIcon
              aria-hidden="true"
              style={{ width: "0.75rem", height: "0.75rem" }}
            />
            {props.t("skill.openInExplorer", "Open in File Manager")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SkillFileTreeHeader(props: SkillFileTreeProps) {
  return (
    <div className="skill-file-editor__tree-header">
      <span className="skill-file-editor__tree-title">
        {props.t("skill.fileEditor", "Files")}
      </span>
      {props.canMutateStructure ? (
        <div className="skill-file-editor__tree-actions">
          <button
            type="button"
            className="skill-file-editor__tree-btn"
            onClick={props.onCreateFile}
            title={props.t("skill.newFile", "New File")}
          >
            <FilePlusIcon
              aria-hidden="true"
              style={{ width: "0.875rem", height: "0.875rem" }}
            />
          </button>
          <button
            type="button"
            className="skill-file-editor__tree-btn"
            onClick={props.onCreateFolder}
            title={props.t("skill.newFolder", "New Folder")}
          >
            <FolderPlusIcon
              aria-hidden="true"
              style={{ width: "0.875rem", height: "0.875rem" }}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}

function SkillFileTreeList(props: SkillFileTreeProps) {
  return (
    <div
      className="skill-file-editor__tree-list"
      onContextMenu={(event) => {
        if (!props.canMutateStructure || event.target !== event.currentTarget) {
          return;
        }
        openContextMenu(
          event,
          { path: null, isDirectory: true },
          props.onContextMenuChange,
        );
      }}
    >
      {props.isLoading ? (
        <div className="skill-file-editor__loading">
          <Loader2Icon style={{ width: "1rem", height: "1rem" }} />
        </div>
      ) : props.tree.length === 0 ? (
        <div className="skill-file-editor__tree-empty">
          <FileIcon
            style={{ width: "1.5rem", height: "1.5rem", opacity: 0.4 }}
          />
          <span>{props.noFilesLabel}</span>
        </div>
      ) : (
        props.tree.map((node) => (
          <SkillFileTreeNode key={node.path} node={node} props={props} />
        ))
      )}
    </div>
  );
}

export const SkillFileTree = memo(SkillFileTreeView);
