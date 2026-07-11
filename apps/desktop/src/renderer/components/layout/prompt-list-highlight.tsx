import type { ReactNode } from "react";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function getHighlightTerms(searchQuery: string): string[] {
  const queryLower = (searchQuery || "").trim().toLowerCase().slice(0, 128);
  if (!queryLower) return [];

  const keywords = queryLower
    .split(/\s+/)
    .filter((keyword) => keyword.length > 0 && keyword.length <= 64);
  const compact = queryLower.replace(/\s+/g, "");
  const terms =
    compact && !keywords.includes(compact) ? [...keywords, compact] : keywords;

  return Array.from(new Set(terms))
    .filter((term) => term.length <= 64)
    .slice(0, 20)
    .sort((left, right) => right.length - left.length);
}

function renderHighlightPart(
  part: string,
  index: number,
  highlightClassName: string,
): ReactNode {
  if (!part) return null;
  if (index % 2 === 1) {
    return (
      <span key={index} className={highlightClassName}>
        {part}
      </span>
    );
  }
  return <span key={index}>{part}</span>;
}

export function renderHighlightedText(
  text: string,
  terms: string[],
  highlightClassName: string,
) {
  if (!text || terms.length === 0) return text;

  const pattern = terms.map(escapeRegExp).join("|");
  if (!pattern) return text;

  const parts = text.split(new RegExp(`(${pattern})`, "gi"));
  if (parts.length <= 1) return text;

  return parts.map((part, index) =>
    renderHighlightPart(part, index, highlightClassName),
  );
}
