import { useEffect, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  ArrowUpIcon,
  BookOpenIcon,
  Columns2Icon,
  Loader2Icon,
  PencilLineIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { SkillCodeEditor } from "../skill/SkillCodeEditor";
import { SkillMarkdown } from "../skill/SkillMarkdown";

type RuleViewMode = "edit" | "preview" | "split";

interface RuleMarkdownWorkspaceProps {
  path: string;
  value: string;
  editable: boolean;
  isRewriting: boolean;
  onChange: (value: string) => void;
}

interface PreviewAnchor {
  line: number;
  top: number;
}

function readPreviewAnchors(
  preview: HTMLElement,
  lineCount: number,
): PreviewAnchor[] {
  const previewTop = preview.getBoundingClientRect().top;
  const maxTop = Math.max(0, preview.scrollHeight - preview.clientHeight);
  const byLine = new Map<number, number>();

  preview
    .querySelectorAll<HTMLElement>("[data-source-line]")
    .forEach((node) => {
      const line = Number(node.dataset.sourceLine);
      const top = Math.min(
        maxTop,
        Math.max(
          0,
          node.getBoundingClientRect().top - previewTop + preview.scrollTop,
        ),
      );
      const previousTop = byLine.get(line);
      if (previousTop === undefined || top < previousTop) byLine.set(line, top);
    });

  const anchors = [...byLine]
    .map(([line, top]) => ({ line, top }))
    .sort((left, right) => left.line - right.line);
  if (!anchors.length || anchors[0].line > 1) {
    anchors.unshift({ line: 1, top: 0 });
  }
  if (anchors.at(-1)?.top !== maxTop) {
    anchors.push({ line: lineCount + 1, top: maxTop });
  }
  return anchors;
}

function findAnchorPair(
  anchors: PreviewAnchor[],
  value: number,
  key: "line" | "top",
): [PreviewAnchor, PreviewAnchor] {
  let low = 0;
  let high = anchors.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (anchors[middle][key] <= value) low = middle;
    else high = middle - 1;
  }
  return [anchors[low], anchors[Math.min(low + 1, anchors.length - 1)]];
}

function interpolate(
  value: number,
  fromValue: number,
  toValue: number,
  fromResult: number,
  toResult: number,
) {
  if (fromValue === toValue) return fromResult;
  const ratio = (value - fromValue) / (toValue - fromValue);
  return fromResult + ratio * (toResult - fromResult);
}

function previewTopForLine(anchors: PreviewAnchor[], line: number) {
  const [from, to] = findAnchorPair(anchors, line, "line");
  return interpolate(line, from.line, to.line, from.top, to.top);
}

function sourceLineForPreviewTop(anchors: PreviewAnchor[], top: number) {
  const [from, to] = findAnchorPair(anchors, top, "top");
  return interpolate(top, from.top, to.top, from.line, to.line);
}

function editorTopLine(editor: EditorView) {
  const height = Math.max(
    0,
    editor.scrollDOM.scrollTop - editor.documentPadding.top,
  );
  return editor.state.doc.lineAt(editor.lineBlockAtHeight(height).from).number;
}

function setEditorTopLine(editor: EditorView, sourceLine: number) {
  const line = Math.min(
    editor.state.doc.lines,
    Math.max(1, Math.round(sourceLine)),
  );
  const block = editor.lineBlockAt(editor.state.doc.line(line).from);
  editor.scrollDOM.scrollTop = block.top + editor.documentPadding.top;
}

function bindSynchronizedVerticalScroll(
  editor: EditorView,
  preview: HTMLElement,
) {
  let scrollingSource: "editor" | "preview" | null = null;
  let releaseFrame: number | null = null;
  let anchors = readPreviewAnchors(preview, editor.state.doc.lines);

  const synchronize = (sourceName: "editor" | "preview") => {
    if (scrollingSource && scrollingSource !== sourceName) return;
    scrollingSource = sourceName;
    if (sourceName === "editor") {
      preview.scrollTop = previewTopForLine(anchors, editorTopLine(editor));
    } else {
      setEditorTopLine(
        editor,
        sourceLineForPreviewTop(anchors, preview.scrollTop),
      );
    }
    if (releaseFrame !== null) cancelAnimationFrame(releaseFrame);
    releaseFrame = requestAnimationFrame(() => {
      scrollingSource = null;
      releaseFrame = null;
    });
  };
  const handleEditorScroll = () => synchronize("editor");
  const handlePreviewScroll = () => synchronize("preview");
  const initialFrame = requestAnimationFrame(() => {
    anchors = readPreviewAnchors(preview, editor.state.doc.lines);
    synchronize("editor");
  });

  editor.scrollDOM.addEventListener("scroll", handleEditorScroll, {
    passive: true,
  });
  preview.addEventListener("scroll", handlePreviewScroll, { passive: true });

  return () => {
    editor.scrollDOM.removeEventListener("scroll", handleEditorScroll);
    preview.removeEventListener("scroll", handlePreviewScroll);
    cancelAnimationFrame(initialFrame);
    if (releaseFrame !== null) cancelAnimationFrame(releaseFrame);
  };
}

function ViewModeButton({
  isActive,
  label,
  onClick,
  children,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isActive}
      title={label}
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors ${
        isActive
          ? "bg-card text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-card/70 hover:text-foreground"
      }`}
    >
      {children}
      <span className="hidden xl:inline">{label}</span>
    </button>
  );
}

export function RuleMarkdownWorkspace({
  path,
  value,
  editable,
  isRewriting,
  onChange,
}: RuleMarkdownWorkspaceProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<RuleViewMode>("edit");
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const previewRef = useRef<HTMLElement | null>(null);
  const lineCount = value.split("\n").length;
  const charCount = value.length;

  const scrollPreviewToTop = () => {
    const preview = previewRef.current!;
    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    preview.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    setShowBackToTop(false);
  };

  useEffect(() => {
    const preview = previewRef.current;
    if (viewMode !== "split" || !editorView || !preview) {
      return;
    }
    return bindSynchronizedVerticalScroll(editorView, preview);
  }, [editorView, value, viewMode]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-card animate-in fade-in duration-base ease-enter">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-background px-4 py-2 text-xs">
        {isRewriting ? (
          <span className="flex items-center gap-1.5 text-primary">
            <Loader2Icon
              aria-hidden="true"
              className="h-3.5 w-3.5 animate-spin"
            />
            {t("rules.aiRewriteWorking", "Generating draft...")}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {t(
              "rules.draftEditMode",
              "Draft editor - not saved until you click Save",
            )}
          </span>
        )}

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>
              {t("rules.editorLineCount", "{{count}} lines", {
                count: lineCount,
              })}
            </span>
            <span className="text-border">·</span>
            <span>
              {t("rules.editorCharCount", "{{count}} chars", {
                count: charCount,
              })}
            </span>
          </div>

          <div
            role="group"
            aria-label={t("rules.viewModeLabel", "Rule view")}
            className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5"
          >
            <ViewModeButton
              isActive={viewMode === "edit"}
              label={t("rules.viewEdit", "Edit")}
              onClick={() => setViewMode("edit")}
            >
              <PencilLineIcon aria-hidden="true" className="h-3.5 w-3.5" />
            </ViewModeButton>
            <ViewModeButton
              isActive={viewMode === "preview"}
              label={t("rules.viewPreview", "Preview")}
              onClick={() => setViewMode("preview")}
            >
              <BookOpenIcon aria-hidden="true" className="h-3.5 w-3.5" />
            </ViewModeButton>
            <ViewModeButton
              isActive={viewMode === "split"}
              label={t("rules.viewSplit", "Split")}
              onClick={() => setViewMode("split")}
            >
              <Columns2Icon aria-hidden="true" className="h-3.5 w-3.5" />
            </ViewModeButton>
          </div>
        </div>
      </div>

      <div
        className={`min-h-0 flex-1 ${
          viewMode === "split" ? "grid grid-cols-2" : "flex"
        }`}
      >
        <div
          data-testid="rule-markdown-editor-pane"
          className={
            viewMode === "preview"
              ? "hidden"
              : viewMode === "split"
                ? "min-h-0 min-w-0 border-r border-border"
                : "min-h-0 min-w-0 flex-1"
          }
        >
          <SkillCodeEditor
            path={path}
            value={value}
            editable={editable}
            ariaLabel={t("rules.editorCanvas", "Rule Content")}
            testId="rule-markdown-editor"
            className={isRewriting ? "opacity-50" : ""}
            onReady={setEditorView}
            onChange={onChange}
          />
        </div>

        {viewMode !== "edit" ? (
          <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
            <section
              ref={previewRef}
              aria-label={t("rules.previewCanvas", "Markdown preview")}
              onScroll={(event) =>
                setShowBackToTop(event.currentTarget.scrollTop > 240)
              }
              className="h-full min-h-0 overflow-auto bg-background"
            >
              <div
                className={`prose prose-sm dark:prose-invert w-full max-w-none break-words text-foreground ${
                  viewMode === "preview" ? "mx-auto p-8 xl:max-w-4xl" : "p-5"
                }`}
              >
                {value.trim() ? (
                  <SkillMarkdown
                    content={value}
                    enableHighlight
                    trackSourceLines={viewMode === "split"}
                  />
                ) : (
                  <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                    {t("rules.previewEmpty", "Nothing to preview yet.")}
                  </div>
                )}
              </div>
            </section>
            {showBackToTop ? (
              <button
                type="button"
                aria-label={t("rules.backToTop", "Back to top")}
                title={t("rules.backToTop", "Back to top")}
                onClick={scrollPreviewToTop}
                className="absolute bottom-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground animate-in fade-in slide-in-from-bottom-1 duration-fast ease-enter"
              >
                <ArrowUpIcon aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
