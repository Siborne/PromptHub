import { useRef, useState } from "react";
import type { Folder } from "@prompthub/shared/types";
import type { SidebarProps } from "./sidebar-controller-types";
import { useSidebarPromptController } from "./useSidebarPromptController";
import { useSidebarResizeController } from "./useSidebarResizeController";
import { useSidebarResourceController } from "./useSidebarResourceController";
import { useSidebarShellController } from "./useSidebarShellController";

export type {
  PageType,
  SidebarLayout,
  SidebarProps,
} from "./sidebar-controller-types";

function useSidebarDialogState() {
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [tagManagerScope, setTagManagerScope] = useState<
    "prompt" | "skill" | null
  >(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordFolder, setPasswordFolder] = useState<Folder | null>(null);
  return {
    isFolderModalOpen,
    setIsFolderModalOpen,
    tagManagerScope,
    setTagManagerScope,
    editingFolder,
    setEditingFolder,
    isPasswordModalOpen,
    setIsPasswordModalOpen,
    passwordFolder,
    setPasswordFolder,
  };
}

export function useSidebarController({
  currentPage,
  onNavigate,
  layout = "combined",
}: SidebarProps) {
  const prompt = useSidebarPromptController(currentPage, onNavigate);
  const dialogs = useSidebarDialogState();
  const shell = useSidebarShellController(
    currentPage,
    onNavigate,
    layout,
    prompt.closeTagPopover,
    prompt.promptViewMode,
  );
  const resources = useSidebarResourceController(
    currentPage,
    onNavigate,
    shell.activeModule,
    shell.runtimeCapabilities.skillLocalScan,
    shell.confirmLeaveDirtySkillEditor,
  );
  const resize = useSidebarResizeController({
    tagsSectionHeight: prompt.tagsSectionHeight,
    setTagsSectionHeight: prompt.setTagsSectionHeight,
    resourceTagsSectionHeight: resources.resourceTagsSectionHeight,
    setResourceTagsSectionHeight: resources.setResourceTagsSectionHeight,
  });
  const sidebarRef = useRef<HTMLElement>(null);
  return {
    currentPage,
    onNavigate,
    layout,
    sidebarRef,
    ...dialogs,
    ...prompt,
    ...resources,
    ...shell,
    ...resize,
  };
}
