import { GlobeIcon, HashIcon, XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LocalImage } from "../ui/LocalImage";
import { resolvePromptMarkdownHref } from "../prompt/prompt-markdown-url";
import { usePromptWorkspaceDetailContext } from "./PromptWorkspaceDetailContext";

function PromptSourceValue({ source }: { source: string }) {
  const href = resolvePromptMarkdownHref(source);
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-primary hover:underline"
    >
      <span className="max-w-full truncate">{source}</span>
    </a>
  ) : (
    <span className="text-foreground/90">{source}</span>
  );
}

function PromptDetailImages() {
  const { t } = useTranslation();
  const detail = usePromptWorkspaceDetailContext();
  const images = detail.selectedPrompt?.images ?? [];
  if (images.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-3">
        {images.map((image, index) => (
          <div
            key={image}
            className="rounded-lg overflow-hidden border border-border shadow-sm"
          >
            <LocalImage
              src={image}
              alt={`image-${index}`}
              aria-label={t("prompt.previewReferenceImage", {
                index: index + 1,
              })}
              className="max-w-[160px] max-h-[160px] object-cover hover:scale-105 transition-transform duration-smooth cursor-pointer"
              fallbackClassName="w-[160px] h-[120px]"
              onClick={() => detail.setPreviewImage(image)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PromptDetailTag({ tag }: { tag: string }) {
  const { t } = useTranslation();
  const detail = usePromptWorkspaceDetailContext();
  const filtered = detail.filterTags.includes(tag);
  const removeLabel = `${t("prompt.removeTag", "Remove tag").replace(/\s*\{\{tag\}\}/g, "")}: ${tag}`;
  return (
    <span
      className={`inline-flex max-w-full items-center rounded-full text-xs font-medium transition-colors ${filtered ? "bg-primary text-white" : "bg-accent text-accent-foreground"}`}
    >
      <button
        type="button"
        onClick={() => detail.handleTagFilterClick(tag)}
        title={t("prompt.filterByTag", "Filter by tag")}
        className={`inline-flex min-w-0 items-center gap-1 rounded-l-full px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${filtered ? "hover:bg-primary/90" : "hover:bg-primary hover:text-white"}`}
      >
        <HashIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
        <span className="max-w-[11rem] truncate">{tag}</span>
      </button>
      <button
        type="button"
        onClick={() => void detail.handleDetailRemoveTag(tag)}
        title={removeLabel}
        aria-label={removeLabel}
        className={`inline-flex items-center justify-center rounded-r-full py-1.5 pl-1 pr-2 transition-colors focus-visible:outline-none focus-visible:ring-2 ${filtered ? "text-white/85 hover:bg-primary/90 hover:text-white focus-visible:ring-primary-foreground/30" : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/30"}`}
      >
        <XIcon aria-hidden="true" className="h-3 w-3" />
      </button>
    </span>
  );
}

function PromptDetailTags() {
  const { t } = useTranslation();
  const detail = usePromptWorkspaceDetailContext();
  const tags = detail.selectedPrompt?.tags ?? [];
  return (
    <div className="mb-4">
      <div
        data-testid="prompt-detail-tags-dropzone"
        onDragOver={detail.handleDetailTagDragOver}
        onDrop={detail.handleDetailTagDrop}
        onDragLeave={detail.handleDetailTagDragLeave}
        className={`flex min-h-[2.75rem] flex-wrap items-center gap-1.5 rounded-xl border py-1.5 pr-1.5 transition-[background-color,border-color,box-shadow] ${detail.isTagDropActive ? "border-primary/25 bg-primary/6 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]" : "border-transparent"}`}
      >
        {tags.map((tag) => (
          <PromptDetailTag key={tag} tag={tag} />
        ))}
        {tags.length === 0 ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs text-muted-foreground">
            <HashIcon className="h-3 w-3" />
            <span>
              {t(
                "prompt.emptyDetailTagsHint",
                "No tags yet. Edit this Prompt or drag tags from the sidebar.",
              )}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PromptDetailSourceAndNotes() {
  const { t } = useTranslation();
  const prompt = usePromptWorkspaceDetailContext().selectedPrompt!;
  return (
    <>
      {prompt.source ? (
        <div className="mb-4">
          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1.5">
            <GlobeIcon className="w-3.5 h-3.5" />
            {t("prompt.source")}
          </div>
          <div className="text-sm rounded-xl p-3 app-wallpaper-surface border border-border break-all">
            <PromptSourceValue source={prompt.source} />
          </div>
        </div>
      ) : null}
      {prompt.notes ? (
        <div className="mb-4">
          <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground mb-1.5">
            {t("prompt.notes")}
          </div>
          <div className="text-sm bg-yellow-500/6 border border-yellow-500/12 rounded-xl p-3 text-foreground/80 italic">
            {prompt.notes}
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PromptDetailSupplement() {
  return (
    <>
      <PromptDetailImages />
      <PromptDetailTags />
      <PromptDetailSourceAndNotes />
    </>
  );
}
