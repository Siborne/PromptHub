import type { AgentSessionMetadata } from "@prompthub/shared/types";

export type AgentSessionSort = "newest" | "oldest" | "largest" | "smallest";

export function resolveSessionTitle(
  nativeTitle: string,
  sessionId: string,
  promptHubTitle?: string | null,
): string {
  return promptHubTitle?.trim() || nativeTitle.trim() || sessionId;
}

function effectiveTime(session: AgentSessionMetadata): number | null {
  const value = session.updatedAt ?? session.createdAt;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function compareKnownValues(
  left: number | null,
  right: number | null,
  direction: 1 | -1,
): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return (left - right) * direction;
}

export function sortAgentSessions(
  sessions: AgentSessionMetadata[],
  sort: AgentSessionSort,
): AgentSessionMetadata[] {
  return [...sessions].sort((left, right) => {
    const primary =
      sort === "newest" || sort === "oldest"
        ? compareKnownValues(
            effectiveTime(left),
            effectiveTime(right),
            sort === "newest" ? -1 : 1,
          )
        : compareKnownValues(
            typeof left.sizeBytes === "number" &&
              Number.isFinite(left.sizeBytes) &&
              left.sizeBytes >= 0
              ? left.sizeBytes
              : null,
            typeof right.sizeBytes === "number" &&
              Number.isFinite(right.sizeBytes) &&
              right.sizeBytes >= 0
              ? right.sizeBytes
              : null,
            sort === "largest" ? -1 : 1,
          );
    if (primary !== 0) return primary;
    const recency = compareKnownValues(
      effectiveTime(left),
      effectiveTime(right),
      -1,
    );
    return recency || left.id.localeCompare(right.id);
  });
}

export function formatSessionSize(
  bytes: number | null | undefined,
  locale?: string,
): string | null {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) {
    return null;
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const maximumFractionDigits = unit === 0 || value >= 100 ? 0 : 1;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)} ${units[unit]}`;
}
