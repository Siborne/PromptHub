import type {
  DragEvent as ReactDragEvent,
  MouseEvent as ReactMouseEvent,
  RefObject,
} from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  HashIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PageType } from "./useSidebarController";

export interface SidebarResourceTagOptions {
  activeTags: string[];
  clearTags: () => void;
  isSectionCollapsed: boolean;
  onManage?: () => void;
  setIsSectionCollapsed: (collapsed: boolean) => void;
  setShowAll: (show: boolean) => void;
  showAll: boolean;
  tags: string[];
  toggleTag: (tag: string) => void;
}

interface SidebarResourceTagsSectionProps extends SidebarResourceTagOptions {
  closeTagPopover: () => void;
  currentPage: PageType;
  handlePromptTagDragStart: (
    tag: string,
  ) => (event: ReactDragEvent<HTMLButtonElement>) => void;
  isCollapsed: boolean;
  isResizing: boolean;
  isTagPopoverOpen: boolean;
  isTagPopoverVisible: boolean;
  onNavigate: (page: PageType) => void;
  onResizeStart: (event: ReactMouseEvent) => void;
  openTagPopover: () => void;
  resourceTagsSectionHeight: number;
  tagButtonRef: RefObject<HTMLButtonElement>;
  tagPopoverPos: { top?: number; bottom?: number; left: number };
  tagPopoverRef: RefObject<HTMLDivElement>;
}

export function SidebarResourceTagsSection({
  activeTags,
  clearTags,
  closeTagPopover,
  currentPage,
  handlePromptTagDragStart,
  isCollapsed,
  isResizing,
  isSectionCollapsed,
  isTagPopoverOpen,
  isTagPopoverVisible,
  onManage,
  onNavigate,
  onResizeStart,
  openTagPopover,
  resourceTagsSectionHeight,
  setIsSectionCollapsed,
  setShowAll,
  showAll,
  tagButtonRef,
  tagPopoverPos,
  tagPopoverRef,
  tags,
  toggleTag,
}: SidebarResourceTagsSectionProps) {
  const { t } = useTranslation();

  return (
    <>
      {!isCollapsed && !isSectionCollapsed ? (
        <div
          className={`h-1 cursor-ns-resize hover:bg-primary/40 transition-colors z-30 shrink-0 mx-2 rounded-full ${isResizing ? "bg-primary/60" : "bg-transparent"}`}
          onMouseDown={onResizeStart}
        />
      ) : null}

      <div
        className={`sidebar-tag-section shrink-0 flex flex-col overflow-hidden app-wallpaper-panel ${isCollapsed ? "items-center" : ""}`}
        style={{
          height:
            isCollapsed || isSectionCollapsed
              ? "auto"
              : `${resourceTagsSectionHeight}px`,
        }}
      >
        {!isCollapsed ? (
          <div className="flex items-center justify-between px-6 py-2 border-t border-sidebar-border/50 shrink-0">
            <button
              type="button"
              onClick={() => setIsSectionCollapsed(!isSectionCollapsed)}
              aria-expanded={!isSectionCollapsed}
              className="flex items-center gap-1 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider hover:text-sidebar-foreground/80 transition-colors"
            >
              {isSectionCollapsed ? (
                <ChevronUpIcon className="w-3 h-3" aria-hidden="true" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" aria-hidden="true" />
              )}
              {t("nav.tags")}
            </button>
            {!isSectionCollapsed ? (
              <div className="flex items-center gap-2">
                {onManage ? (
                  <button
                    type="button"
                    onClick={onManage}
                    className="text-sidebar-foreground/50 hover:text-sidebar-foreground/80 transition-colors"
                    title={t("common.edit", "Edit")}
                    aria-label={t("common.edit", "Edit")}
                  >
                    <SettingsIcon className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ) : null}
                {activeTags.length > 0 ? (
                  <button
                    type="button"
                    onClick={clearTags}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("common.clear", "清空")}
                  </button>
                ) : null}
                {tags.length > 8 ? (
                  <button
                    type="button"
                    onClick={() => setShowAll(!showAll)}
                    className="text-xs text-primary hover:underline"
                  >
                    {showAll
                      ? t("common.collapse")
                      : `${t("common.showAll")} ${tags.length}`}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {!isCollapsed ? (
          !isSectionCollapsed ? (
            <div className="flex-1 overflow-y-auto px-6 pb-4 scrollbar-hide animate-in fade-in slide-in-from-bottom-2 duration-smooth">
              <div className="flex flex-wrap gap-1.5 pt-1">
                {(showAll ? tags : tags.slice(0, 8)).map((tag, index) => (
                  <button
                    type="button"
                    key={tag}
                    draggable
                    onDragStart={handlePromptTagDragStart(tag)}
                    onClick={() => {
                      toggleTag(tag);
                      if (currentPage !== "home") onNavigate("home");
                    }}
                    style={{
                      animationDelay: `${index * 30}ms`,
                      animationFillMode: "both",
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-base animate-in fade-in slide-in-from-left-1 ${
                      activeTags.includes(tag) && currentPage === "home"
                        ? "bg-primary text-white"
                        : "bg-sidebar-accent text-sidebar-foreground/70 hover:bg-primary hover:text-white"
                    }`}
                  >
                    <HashIcon className="w-3 h-3" aria-hidden="true" />
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ) : null
        ) : (
          <div className="pt-2 border-t border-sidebar-border/50 flex flex-col items-center gap-2 pb-2">
            <button
              type="button"
              ref={tagButtonRef}
              onClick={() => {
                if (isTagPopoverOpen) {
                  closeTagPopover();
                } else {
                  openTagPopover();
                  if (currentPage !== "home") onNavigate("home");
                }
              }}
              title={t("nav.tags")}
              aria-expanded={isTagPopoverOpen}
              className={`w-10 h-10 flex flex-col items-center justify-center rounded-lg transition-colors duration-base ${
                activeTags.length > 0 && currentPage === "home"
                  ? "bg-primary text-white"
                  : "bg-sidebar-accent text-sidebar-foreground/70 hover:bg-primary hover:text-white"
              }`}
            >
              <HashIcon className="w-4 h-4" aria-hidden="true" />
              <span className="text-[10px] leading-none mt-0.5">
                {activeTags.length > 0
                  ? activeTags.length
                  : t("nav.tags").slice(0, 2)}
              </span>
            </button>
          </div>
        )}
      </div>

      {isTagPopoverOpen ? (
        <div
          ref={tagPopoverRef}
          className={`fixed z-[9999] transition-all duration-quick ${
            tagPopoverPos.bottom !== undefined
              ? "origin-bottom-left"
              : "origin-top-left"
          } ${isTagPopoverVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-1"}`}
          style={{
            top: tagPopoverPos.top,
            bottom: tagPopoverPos.bottom,
            left: tagPopoverPos.left,
            width: 320,
            maxHeight: "min(420px, calc(100vh - 24px))",
          }}
        >
          <div className="app-wallpaper-panel-strong border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="text-sm font-medium text-foreground">
                {t("nav.tags")}
              </div>
              <div className="flex items-center gap-2">
                {activeTags.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearTags();
                      if (currentPage !== "home") onNavigate("home");
                    }}
                    className="text-xs text-primary hover:underline"
                  >
                    {t("common.clear", "清空")}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={closeTagPopover}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label={t("common.close", "Close")}
                >
                  <XIcon className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => {
                  const active =
                    activeTags.includes(tag) && currentPage === "home";
                  return (
                    <button
                      type="button"
                      key={tag}
                      draggable
                      onDragStart={handlePromptTagDragStart(tag)}
                      onClick={() => {
                        toggleTag(tag);
                        if (currentPage !== "home") onNavigate("home");
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        active
                          ? "bg-primary text-white"
                          : "app-wallpaper-surface text-foreground/80 hover:bg-primary hover:text-white"
                      }`}
                    >
                      <HashIcon className="w-4 h-4" aria-hidden="true" />
                      <span className="truncate max-w-[14rem]">{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
