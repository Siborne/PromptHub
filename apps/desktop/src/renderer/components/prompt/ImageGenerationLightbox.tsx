import { useEffect, useRef } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  ImageIcon,
  StarIcon,
  XIcon,
} from "lucide-react";
import type {
  GenerationBatchManifest,
  GenerationOutputRecord,
} from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";
import { resolveLocalGenerationImageSrc } from "../../utils/media-url";

interface ImageGenerationLightboxProps {
  batch: GenerationBatchManifest;
  output: GenerationOutputRecord;
  position: number;
  total: number;
  canAttach: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onCopyPrompt: () => void;
  onAttach: () => void;
}

const actionButtonClass =
  "flex h-9 w-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white";

export function ImageGenerationLightbox({
  batch,
  output,
  position,
  total,
  canAttach,
  onClose,
  onPrevious,
  onNext,
  onToggleFavorite,
  onDownload,
  onCopyPrompt,
  onAttach,
}: ImageGenerationLightboxProps) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "ArrowLeft") {
        onPrevious();
      } else if (event.key === "ArrowRight") {
        onNext();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrevious, onNext]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={batch.title}
      className="fixed inset-0 z-50"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div
        ref={contentRef}
        tabIndex={-1}
        className="relative z-10 flex h-full flex-col items-center justify-center gap-3 px-8 py-6 outline-none"
      >
        <div className="flex w-full max-w-4xl items-center justify-between gap-4 text-white">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{batch.title}</div>
            <div className="text-xs text-white/70">{`${position} / ${total}`}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("generation.closeLightbox")}
            className={actionButtonClass}
          >
            <XIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <img
          src={resolveLocalGenerationImageSrc(`${batch.id}/${output.fileName}`)}
          alt={t("generation.outputAlt", { index: output.slotIndex + 1 })}
          className="max-h-[80vh] min-h-0 max-w-full rounded-md object-contain"
        />
        <div className="flex items-center gap-1.5 rounded-md border border-white/15 bg-black/40 px-2 py-1.5">
          <button
            type="button"
            onClick={onPrevious}
            aria-label={t("generation.previousImage")}
            className={actionButtonClass}
          >
            <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label={t("generation.nextImage")}
            className={actionButtonClass}
          >
            <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-label={t("generation.favorite")}
            aria-pressed={output.favorite}
            className={actionButtonClass}
          >
            <StarIcon
              className={`h-4 w-4 ${output.favorite ? "fill-current text-amber-500" : ""}`}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            onClick={onDownload}
            aria-label={t("generation.download")}
            className={actionButtonClass}
          >
            <DownloadIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onCopyPrompt}
            aria-label={t("generation.copyPrompt")}
            className={actionButtonClass}
          >
            <CopyIcon className="h-4 w-4" aria-hidden="true" />
          </button>
          {canAttach && (
            <button
              type="button"
              onClick={onAttach}
              aria-label={t("prompt.addToPrompt")}
              className={actionButtonClass}
            >
              <ImageIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
