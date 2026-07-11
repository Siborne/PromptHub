import { ColumnResizer } from "../ui/ColumnResizer";
import { FolderModal, PrivateFolderUnlockModal } from "../folder";
import { TagManagerModal } from "../prompt/TagManagerModal";
import {
  SIDEBAR_PANEL_WIDTH_DEFAULT,
  SIDEBAR_PANEL_WIDTH_MAX,
  SIDEBAR_PANEL_WIDTH_MIN,
} from "../../stores/ui.store";
import type { SidebarController } from "./sidebar-view-types";

export function SidebarOverlays({
  controller,
}: {
  controller: SidebarController;
}) {
  return (
    <>
      <TagManagerModal
        isOpen={controller.tagManagerScope !== null}
        onClose={() => controller.setTagManagerScope(null)}
        resourceType={controller.tagManagerScope ?? "prompt"}
      />
      <FolderModal
        isOpen={controller.isFolderModalOpen}
        onClose={() => {
          controller.setIsFolderModalOpen(false);
          controller.setEditingFolder(null);
        }}
        folder={controller.editingFolder}
      />
      <SidebarUnlockDialog controller={controller} />
      <SidebarPanelResizer controller={controller} />
    </>
  );
}

function SidebarUnlockDialog({
  controller,
}: {
  controller: SidebarController;
}) {
  if (!controller.isPasswordModalOpen || !controller.passwordFolder)
    return null;
  const close = () => {
    controller.setIsPasswordModalOpen(false);
    controller.setPasswordFolder(null);
  };
  const unlock = () => {
    controller.unlockFolder(controller.passwordFolder!.id);
    controller.openPromptFolder(controller.passwordFolder!.id);
    close();
  };
  return (
    <PrivateFolderUnlockModal
      isOpen={controller.isPasswordModalOpen}
      folderName={controller.passwordFolder.name}
      onClose={close}
      onSuccess={unlock}
    />
  );
}

function SidebarPanelResizer({
  controller,
}: {
  controller: SidebarController;
}) {
  if (controller.layout !== "panel" || controller.isCollapsed) return null;
  return (
    <div className="absolute inset-y-0 right-0 z-10 flex">
      <ColumnResizer
        currentWidth={controller.sidebarPanelWidth}
        min={SIDEBAR_PANEL_WIDTH_MIN}
        max={SIDEBAR_PANEL_WIDTH_MAX}
        defaultWidth={SIDEBAR_PANEL_WIDTH_DEFAULT}
        onResize={controller.setSidebarPanelWidth}
        ariaLabel={controller.t("sidebar.resizeAria", "Resize folder sidebar")}
      />
    </div>
  );
}
