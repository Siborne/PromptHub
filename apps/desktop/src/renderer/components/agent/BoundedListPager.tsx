import { useMemo, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface BoundedPage<T> {
  items: T[];
  pageIndex: number;
  pageCount: number;
  start: number;
  end: number;
  total: number;
  canPrevious: boolean;
  canNext: boolean;
  previous: () => void;
  next: () => void;
}

export function useBoundedPage<T>(
  items: T[],
  pageSize: number,
  resetToken: unknown,
): BoundedPage<T> {
  const normalizedPageSize = Math.max(1, Math.floor(pageSize));
  const [navigation, setNavigation] = useState({
    resetToken,
    pageIndex: 0,
  });
  const tokenChanged = !Object.is(navigation.resetToken, resetToken);
  const pageCount = Math.max(1, Math.ceil(items.length / normalizedPageSize));
  const currentPage = tokenChanged
    ? 0
    : Math.min(navigation.pageIndex, pageCount - 1);
  const start = currentPage * normalizedPageSize;
  const end = Math.min(start + normalizedPageSize, items.length);

  const pageItems = useMemo(() => items.slice(start, end), [end, items, start]);

  return {
    items: pageItems,
    pageIndex: currentPage,
    pageCount,
    start: items.length === 0 ? 0 : start + 1,
    end,
    total: items.length,
    canPrevious: currentPage > 0,
    canNext: currentPage + 1 < pageCount,
    previous: () =>
      setNavigation({
        resetToken,
        pageIndex: Math.max(0, currentPage - 1),
      }),
    next: () =>
      setNavigation({
        resetToken,
        pageIndex: Math.min(pageCount - 1, currentPage + 1),
      }),
  };
}

export function BoundedListPager<T>({ page }: { page: BoundedPage<T> }) {
  const { t } = useTranslation();
  if (page.pageCount <= 1) return null;

  const previousLabel = t("common.previous", "Previous");
  const nextLabel = t("common.next", "Next");

  return (
    <nav
      aria-label={`${page.start}-${page.end} / ${page.total}`}
      className="flex shrink-0 items-center justify-end gap-2 border-t border-border px-5 py-2"
    >
      <span
        role="status"
        aria-live="polite"
        className="mr-1 text-xs tabular-nums text-muted-foreground"
      >
        {page.start}-{page.end} / {page.total}
      </span>
      <button
        type="button"
        aria-label={previousLabel}
        title={previousLabel}
        disabled={!page.canPrevious}
        onClick={page.previous}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronLeftIcon aria-hidden="true" className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label={nextLabel}
        title={nextLabel}
        disabled={!page.canNext}
        onClick={page.next}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <ChevronRightIcon aria-hidden="true" className="h-4 w-4" />
      </button>
    </nav>
  );
}
