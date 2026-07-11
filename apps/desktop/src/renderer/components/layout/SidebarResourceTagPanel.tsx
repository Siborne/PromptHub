import type { SidebarResourceTagOptions } from "./SidebarResourceTagsSection";
import { SidebarResourceTagsSection } from "./SidebarResourceTagsSection";
import type { SidebarController } from "./sidebar-view-types";

export function SidebarResourceTagPanel({
  controller,
  options,
}: {
  controller: SidebarController;
  options: SidebarResourceTagOptions;
}) {
  return (
    <SidebarResourceTagsSection
      {...options}
      closeTagPopover={controller.closeTagPopover}
      currentPage={controller.currentPage}
      handlePromptTagDragStart={controller.handlePromptTagDragStart}
      isCollapsed={controller.isCollapsed}
      isResizing={controller.isResizing}
      isTagPopoverOpen={controller.isTagPopoverOpen}
      isTagPopoverVisible={controller.isTagPopoverVisible}
      onNavigate={controller.onNavigate}
      onResizeStart={(event) => controller.handleResizeStart(event, "resource")}
      openTagPopover={controller.openTagPopover}
      resourceTagsSectionHeight={controller.resourceTagsSectionHeight}
      tagButtonRef={controller.tagButtonRef}
      tagPopoverPos={controller.tagPopoverPos}
      tagPopoverRef={controller.tagPopoverRef}
    />
  );
}
