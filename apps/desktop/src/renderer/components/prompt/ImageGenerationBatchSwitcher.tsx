import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import type { GenerationBatchManifest } from "@prompthub/shared/types";
import { useTranslation } from "react-i18next";

interface ImageGenerationBatchSwitcherProps {
  batches: GenerationBatchManifest[];
  selectedBatch: GenerationBatchManifest;
  onSelectBatch: (id: string) => void;
}

function statusDotClass(status: GenerationBatchManifest["status"]): string {
  if (status === "succeeded") return "bg-emerald-500";
  if (status === "failed" || status === "partially_succeeded") {
    return "bg-destructive";
  }
  if (status === "running" || status === "queued" || status === "cancelling") {
    return "bg-primary";
  }
  return "bg-muted-foreground/40";
}

export function ImageGenerationBatchSwitcher({
  batches,
  selectedBatch,
  onSelectBatch,
}: ImageGenerationBatchSwitcherProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("generation.switchBatch")}
        title={selectedBatch.title}
        className="flex h-8 min-w-0 max-w-72 items-center gap-2 rounded-md border border-border px-2.5 text-sm hover:bg-muted"
      >
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(selectedBatch.status)}`}
          aria-hidden="true"
        />
        <span className="min-w-0 truncate font-medium">
          {selectedBatch.title}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {selectedBatch.counts.succeeded}/{selectedBatch.targetCount}
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("generation.switchBatch")}
          className="absolute left-0 top-full z-30 mt-1 max-h-72 w-72 overflow-y-auto rounded-md border border-border bg-popover py-1 shadow-lg"
        >
          {batches.map((batch) => (
            <li
              key={batch.id}
              role="option"
              aria-selected={batch.id === selectedBatch.id}
            >
              <button
                type="button"
                onClick={() => {
                  onSelectBatch(batch.id);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${statusDotClass(batch.status)}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{batch.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {batch.counts.succeeded}/{batch.targetCount}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
