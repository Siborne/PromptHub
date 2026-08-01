import { v4 as uuidv4 } from "uuid";

import type {
  AgentConversationHandoffRecord,
  AgentConversationMetadata,
  AgentConversationHandoffStatus,
  AgentConversationHandoffTransport,
  CreateAgentConversationHandoffInput,
  UpdateAgentConversationHandoffInput,
  UpsertAgentConversationMetadataInput,
} from "@prompthub/shared";
import Database from "./adapter";

interface MetadataRow {
  id: string;
  agent_id: string;
  session_id: string;
  title: string | null;
  project_id: string | null;
  project_path: string | null;
  tags_json: string;
  note: string | null;
  is_favorite: number;
  archived_at: number | null;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

interface HandoffRow {
  id: string;
  source_agent_id: string;
  source_session_id: string;
  target_agent_id: string;
  project_id: string | null;
  project_path: string | null;
  transport: AgentConversationHandoffTransport;
  payload_digest: string;
  status: AgentConversationHandoffStatus;
  target_session_id: string | null;
  error_code: string | null;
  created_at: number;
  updated_at: number;
}

const MAX_SESSION_BATCH = 200;
const MAX_TAGS = 64;
const MAX_TAG_LENGTH = 80;
const MAX_NOTE_LENGTH = 20_000;
const MAX_TITLE_LENGTH = 500;

function requiredText(value: string, field: string, max = 500): string {
  const normalized = value.trim();
  if (!normalized || normalized.includes("\0") || normalized.length > max) {
    throw new Error(`${field} is invalid`);
  }
  return normalized;
}

function optionalText(
  value: string | null | undefined,
  field: string,
  max: number,
): string | null {
  if (value === undefined || value === null || !value.trim()) return null;
  return requiredText(value, field, max);
}

function normalizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags) || tags.length > MAX_TAGS) {
    throw new Error("tags are invalid");
  }
  const normalized = tags.map((tag) =>
    requiredText(tag, "tags", MAX_TAG_LENGTH),
  );
  return [...new Set(normalized)];
}

function parseTags(value: string): string[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed) || parsed.some((tag) => typeof tag !== "string")) {
    throw new Error("Invalid conversation tags in database");
  }
  return parsed;
}

export class AgentConversationDB {
  constructor(private readonly db: Database.Database) {}

  listMetadata(
    agentIdValue: string,
    sessionIds: string[],
  ): AgentConversationMetadata[] {
    const agentId = requiredText(agentIdValue, "agentId", 100);
    if (
      !Array.isArray(sessionIds) ||
      sessionIds.length < 1 ||
      sessionIds.length > MAX_SESSION_BATCH
    ) {
      throw new Error("sessionIds are invalid");
    }
    const ids = sessionIds.map((id) => requiredText(id, "sessionId", 160));
    const placeholders = ids.map(() => "?").join(", ");
    const rows = this.db.all(
      `SELECT * FROM agent_conversation_metadata
       WHERE agent_id = ? AND session_id IN (${placeholders})
       ORDER BY updated_at DESC, id ASC`,
      agentId,
      ...ids,
    ) as MetadataRow[];
    return rows.map(metadataFromRow);
  }

  getMetadata(
    agentIdValue: string,
    sessionIdValue: string,
  ): AgentConversationMetadata | null {
    const row = this.db.get(
      `SELECT * FROM agent_conversation_metadata
       WHERE agent_id = ? AND session_id = ?`,
      requiredText(agentIdValue, "agentId", 100),
      requiredText(sessionIdValue, "sessionId", 160),
    ) as MetadataRow | undefined;
    return row ? metadataFromRow(row) : null;
  }

  upsertMetadata(
    input: UpsertAgentConversationMetadataInput,
  ): AgentConversationMetadata {
    const agentId = requiredText(input.agentId, "agentId", 100);
    const sessionId = requiredText(input.sessionId, "sessionId", 160);
    const existing = this.getMetadata(agentId, sessionId);
    const now = existing
      ? Math.max(Date.now(), existing.updatedAt + 1)
      : Date.now();
    const id = existing?.id ?? uuidv4();
    const archivedAt = input.archived
      ? (existing?.archivedAt ?? now)
      : input.archived === false
        ? null
        : (existing?.archivedAt ?? null);
    this.db.run(
      `INSERT INTO agent_conversation_metadata (
        id, agent_id, session_id, title, project_id, project_path, tags_json,
        note, is_favorite, archived_at, deleted_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(agent_id, session_id) DO UPDATE SET
        title = excluded.title,
        project_id = excluded.project_id,
        project_path = excluded.project_path,
        tags_json = excluded.tags_json,
        note = excluded.note,
        is_favorite = excluded.is_favorite,
        archived_at = excluded.archived_at,
        updated_at = excluded.updated_at`,
      id,
      agentId,
      sessionId,
      optionalText(input.title, "title", MAX_TITLE_LENGTH),
      optionalText(input.projectId, "projectId", 160),
      optionalText(input.projectPath, "projectPath", 4_096),
      JSON.stringify(normalizeTags(input.tags)),
      optionalText(input.note, "note", MAX_NOTE_LENGTH),
      input.favorite ? 1 : 0,
      archivedAt,
      existing?.deletedAt ?? null,
      existing?.createdAt ?? now,
      now,
    );
    return this.getRequiredMetadata(agentId, sessionId);
  }

  softDelete(agentId: string, sessionId: string): AgentConversationMetadata {
    return this.setDeletedAt(agentId, sessionId, Date.now());
  }

  restore(agentId: string, sessionId: string): AgentConversationMetadata {
    return this.setDeletedAt(agentId, sessionId, null);
  }

  createHandoff(
    input: CreateAgentConversationHandoffInput,
  ): AgentConversationHandoffRecord {
    const id = uuidv4();
    const now = Date.now();
    this.db.run(
      `INSERT INTO agent_conversation_handoffs (
        id, source_agent_id, source_session_id, target_agent_id, project_id,
        project_path, transport, payload_digest, status, target_session_id,
        error_code, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)`,
      id,
      requiredText(input.sourceAgentId, "sourceAgentId", 100),
      requiredText(input.sourceSessionId, "sourceSessionId", 160),
      requiredText(input.targetAgentId, "targetAgentId", 100),
      optionalText(input.projectId, "projectId", 160),
      optionalText(input.projectPath, "projectPath", 4_096),
      input.transport,
      requiredText(input.payloadDigest, "payloadDigest", 160),
      input.status,
      now,
      now,
    );
    return this.getRequiredHandoff(id);
  }

  updateHandoff(
    idValue: string,
    input: UpdateAgentConversationHandoffInput,
  ): AgentConversationHandoffRecord {
    const id = requiredText(idValue, "id", 160);
    const existing = this.getRequiredHandoff(id);
    const updatedAt = Math.max(Date.now(), existing.updatedAt + 1);
    this.db.run(
      `UPDATE agent_conversation_handoffs
       SET status = ?, target_session_id = ?, error_code = ?, updated_at = ?
       WHERE id = ?`,
      input.status,
      optionalText(input.targetSessionId, "targetSessionId", 160),
      optionalText(input.errorCode, "errorCode", 160),
      updatedAt,
      id,
    );
    return this.getRequiredHandoff(id);
  }

  private setDeletedAt(
    agentIdValue: string,
    sessionIdValue: string,
    deletedAt: number | null,
  ): AgentConversationMetadata {
    const agentId = requiredText(agentIdValue, "agentId", 100);
    const sessionId = requiredText(sessionIdValue, "sessionId", 160);
    const existing =
      this.getMetadata(agentId, sessionId) ??
      this.upsertMetadata({ agentId, sessionId, tags: [] });
    const updatedAt = Math.max(Date.now(), existing.updatedAt + 1);
    this.db.run(
      `UPDATE agent_conversation_metadata
       SET deleted_at = ?, updated_at = ?
       WHERE agent_id = ? AND session_id = ?`,
      deletedAt,
      updatedAt,
      agentId,
      sessionId,
    );
    return this.getRequiredMetadata(agentId, sessionId);
  }

  private getRequiredMetadata(
    agentId: string,
    sessionId: string,
  ): AgentConversationMetadata {
    const metadata = this.getMetadata(agentId, sessionId);
    if (!metadata) throw new Error("Conversation metadata not found");
    return metadata;
  }

  private getRequiredHandoff(id: string): AgentConversationHandoffRecord {
    const row = this.db.get(
      "SELECT * FROM agent_conversation_handoffs WHERE id = ?",
      id,
    ) as HandoffRow | undefined;
    if (!row) throw new Error("Conversation handoff not found");
    return handoffFromRow(row);
  }
}

function metadataFromRow(row: MetadataRow): AgentConversationMetadata {
  return {
    id: row.id,
    agentId: row.agent_id,
    sessionId: row.session_id,
    title: row.title,
    projectId: row.project_id,
    projectPath: row.project_path,
    tags: parseTags(row.tags_json),
    note: row.note,
    favorite: row.is_favorite === 1,
    archivedAt: row.archived_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function handoffFromRow(row: HandoffRow): AgentConversationHandoffRecord {
  return {
    id: row.id,
    sourceAgentId: row.source_agent_id,
    sourceSessionId: row.source_session_id,
    targetAgentId: row.target_agent_id,
    projectId: row.project_id,
    projectPath: row.project_path,
    transport: row.transport,
    payloadDigest: row.payload_digest,
    status: row.status,
    targetSessionId: row.target_session_id,
    errorCode: row.error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
