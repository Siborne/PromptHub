import { ipcMain } from "electron";

import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import type {
  AgentConversationExportResult,
  AgentConversationHandoffRequest,
  AgentConversationResumeRequest,
  ContinueAgentConversationRequest,
  UpsertAgentConversationMetadataInput,
} from "@prompthub/shared/types";
import type { AgentConversationService } from "../services/agent-conversation-service";

interface AgentConversationIpcOptions {
  service: AgentConversationService;
  saveExport(result: AgentConversationExportResult): Promise<string | null>;
}

const DIGEST_PATTERN = /^sha256:[a-f0-9]{64}$/;
const PREVIEW_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function registerAgentConversationIPC(
  options: AgentConversationIpcOptions,
): void {
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_METADATA_LIST,
    async (_, value: unknown) =>
      invoke(async () => {
        const request = requireRecord(value);
        const sessionIds = requireStringArray(request.sessionIds, 200, 160);
        return options.service.listMetadata(
          requireText(request.agentId, 100),
          sessionIds,
        );
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_METADATA_UPDATE,
    async (_, value: unknown) =>
      invoke(async () => options.service.updateMetadata(metadataInput(value))),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_DELETE,
    async (_, value: unknown) =>
      invoke(async () => {
        const request = identityRequest(value);
        return options.service.softDelete(request.agentId, request.sessionId);
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_RESTORE,
    async (_, value: unknown) =>
      invoke(async () => {
        const request = identityRequest(value);
        return options.service.restore(request.agentId, request.sessionId);
      }),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_RESUME,
    async (_, value: unknown) =>
      invoke(async () => options.service.resume(identityRequest(value))),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_PREVIEW,
    async (_, value: unknown) =>
      invoke(async () => options.service.previewHandoff(handoffRequest(value))),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_HANDOFF_CONTINUE,
    async (_, value: unknown) =>
      invoke(async () =>
        options.service.continueInAgent(continueRequest(value)),
      ),
  );
  ipcMain.handle(
    IPC_CHANNELS.AGENT_CONVERSATION_EXPORT,
    async (_, value: unknown) =>
      invoke(async () => {
        const request = identityRequest(value);
        const record = requireRecord(value);
        if (record.format !== "json" && record.format !== "markdown") {
          throw invalidRequest();
        }
        const result = await options.service.exportConversation({
          ...request,
          format: record.format,
        });
        const filePath = await options.saveExport(result);
        return { canceled: filePath === null, filePath };
      }),
  );
}

function identityRequest(value: unknown): AgentConversationResumeRequest {
  const request = requireRecord(value);
  return {
    agentId: requireText(request.agentId, 100),
    sessionId: requireText(request.sessionId, 160),
  };
}

function metadataInput(value: unknown): UpsertAgentConversationMetadataInput {
  const request = requireRecord(value);
  if (request.favorite !== undefined && typeof request.favorite !== "boolean") {
    throw invalidRequest();
  }
  if (request.archived !== undefined && typeof request.archived !== "boolean") {
    throw invalidRequest();
  }
  return {
    ...identityRequest(value),
    title: optionalText(request.title, 500),
    projectId: optionalText(request.projectId, 160),
    projectPath: optionalText(request.projectPath, 4_096),
    tags: requireStringArray(request.tags, 64, 80, true),
    note: optionalText(request.note, 20_000),
    favorite:
      typeof request.favorite === "boolean" ? request.favorite : undefined,
    archived:
      typeof request.archived === "boolean" ? request.archived : undefined,
  };
}

function handoffRequest(value: unknown): AgentConversationHandoffRequest {
  const request = requireRecord(value);
  return {
    sourceAgentId: requireText(request.sourceAgentId, 100),
    sourceSessionId: requireText(request.sourceSessionId, 160),
    targetAgentId: requireText(request.targetAgentId, 100),
    projectId: optionalText(request.projectId, 160),
    projectPath: requireText(request.projectPath, 4_096),
  };
}

function continueRequest(value: unknown): ContinueAgentConversationRequest {
  const request = requireRecord(value);
  const base = handoffRequest(value);
  const payloadDigest = requireText(request.payloadDigest, 80);
  const confirmedPayloadDigest = requireText(
    request.confirmedPayloadDigest,
    80,
  );
  const previewToken = requireText(request.previewToken, 100);
  if (
    !DIGEST_PATTERN.test(payloadDigest) ||
    !DIGEST_PATTERN.test(confirmedPayloadDigest) ||
    !PREVIEW_TOKEN_PATTERN.test(previewToken) ||
    (request.transport !== "direct" &&
      request.transport !== "launch" &&
      request.transport !== "unavailable")
  ) {
    throw invalidRequest();
  }
  return {
    ...base,
    sourceTitle: requireText(request.sourceTitle, 500),
    previewToken,
    payload: requireText(request.payload, 500_000),
    payloadDigest,
    confirmedPayloadDigest,
    transport: request.transport,
    cliCommand:
      request.cliCommand === null
        ? null
        : requireText(request.cliCommand, 600_000),
  };
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidRequest();
  }
  return value as Record<string, unknown>;
}

function requireText(value: unknown, max: number): string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.includes("\0") ||
    value.length > max
  ) {
    throw invalidRequest();
  }
  return value.trim();
}

function optionalText(value: unknown, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || (typeof value === "string" && !value.trim())) {
    return null;
  }
  return requireText(value, max);
}

function requireStringArray(
  value: unknown,
  maxItems: number,
  maxLength: number,
  allowEmpty = false,
): string[] {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.length > maxItems
  ) {
    throw invalidRequest();
  }
  return value.map((item) => requireText(item, maxLength));
}

async function invoke<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Error &&
      /^(?:AGENT_|HANDOFF_)[A-Z0-9_]+$/.test(error.message)
    ) {
      throw error;
    }
    console.error("[agent-conversation] operation failed");
    throw new Error("AGENT_CONVERSATION_OPERATION_FAILED");
  }
}

function invalidRequest(): Error {
  return new Error("AGENT_CONVERSATION_REQUEST_INVALID");
}
