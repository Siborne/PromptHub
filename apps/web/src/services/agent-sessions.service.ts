import path from "node:path";

import type { AgentSessionIndexDB } from "@prompthub/db";
import type {
  AgentSessionDetail,
  AgentSessionIndexPublicState,
  AgentSessionIndexRecord,
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";

const MAX_PAGE_SIZE = 200;
const MAX_OFFSET = 10_000;
const MAX_SOURCES = 32;

function assertPage(limit: number, offset: number): void {
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error("AGENT_SESSION_LIMIT_INVALID");
  }
  if (!Number.isInteger(offset) || offset < 0 || offset > MAX_OFFSET) {
    throw new Error("AGENT_SESSION_OFFSET_INVALID");
  }
}

function toMetadata(record: AgentSessionIndexRecord): AgentSessionMetadata {
  return {
    id: record.id,
    title: record.title,
    projectLabel: record.projectPath ? path.basename(record.projectPath) : null,
    projectPath: record.projectPath,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    model: record.model,
    messageCount: record.messageCount,
    sourcePath: null,
    resume: null,
  };
}

/** Read-only, bounded session-index adapter for the self-hosted browser. */
export class WebAgentSessionsService {
  constructor(private readonly index: AgentSessionIndexDB) {}

  list(
    agentId: string,
    limit: number,
    offset: number,
    search?: string,
  ): AgentSessionListResult {
    assertPage(limit, offset);
    const records: AgentSessionIndexRecord[] = [];
    let total = 0;
    const fetchLimit = Math.min(offset + limit, MAX_PAGE_SIZE);
    for (const source of this.index
      .listSources({ platformId: agentId })
      .slice(0, MAX_SOURCES)) {
      const page = this.index.listSessions({
        sourceId: source.id,
        limit: fetchLimit,
        offset: 0,
        statuses: ["present"],
        ...(search ? { search } : {}),
      });
      records.push(...page.items);
      total += page.total;
    }
    records.sort(
      (left, right) =>
        (right.updatedAt ?? right.createdAt ?? 0) -
        (left.updatedAt ?? left.createdAt ?? 0),
    );
    return {
      agentId,
      adapter: "web-session-index-v1",
      sessions: records.slice(offset, offset + limit).map(toMetadata),
      total,
      hasMore: offset + limit < total,
    };
  }

  read(agentId: string, sessionId: string): AgentSessionDetail {
    const record = this.index.getSession(sessionId);
    const source = record ? this.index.getSource(record.sourceId) : null;
    if (!record || source?.platformId !== agentId) {
      throw new Error("AGENT_SESSION_NOT_FOUND");
    }
    return {
      agentId,
      adapter: "web-session-index-v1",
      sessionId,
      entries: record.redactedPreview
        ? [
            {
              id: "indexed-preview",
              role: "unknown",
              timestamp: record.updatedAt,
              text: record.redactedPreview,
            },
          ]
        : [],
      parseErrors: record.sourceStatus === "parse-error" ? 1 : 0,
      truncated: true,
      nextCursor: null,
    };
  }

  state(agentId: string): AgentSessionIndexPublicState {
    const sources = this.index.listSources({ platformId: agentId });
    const latest = sources.sort(
      (left, right) => (right.lastScannedAt ?? 0) - (left.lastScannedAt ?? 0),
    )[0];
    return {
      supported: false,
      enabled: sources.some((source) => source.enabled),
      lastStatus: latest?.lastStatus ?? null,
      lastScannedAt: latest?.lastScannedAt ?? null,
      lastErrorCode: latest?.lastErrorCode ?? null,
    };
  }
}
