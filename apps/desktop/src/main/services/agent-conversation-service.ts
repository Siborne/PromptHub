import { createHash } from "node:crypto";

import type {
  AgentConversationActionResult,
  AgentConversationExportRequest,
  AgentConversationExportResult,
  AgentConversationHandoffPreview,
  AgentConversationHandoffRecord,
  AgentConversationHandoffRequest,
  AgentConversationMetadata,
  AgentConversationResumeRequest,
  AgentResumeCommand,
  AgentSessionDetail,
  AgentSessionDetailPageInput,
  AgentSessionListResult,
  AgentSessionMetadata,
  ContinueAgentConversationRequest,
  CreateAgentConversationHandoffInput,
  UpdateAgentConversationHandoffInput,
  UpsertAgentConversationMetadataInput,
} from "@prompthub/shared/types";

export interface AgentConversationRepository {
  listMetadata(
    agentId: string,
    sessionIds: string[],
  ): AgentConversationMetadata[];
  upsertMetadata(
    input: UpsertAgentConversationMetadataInput,
  ): AgentConversationMetadata;
  softDelete(agentId: string, sessionId: string): AgentConversationMetadata;
  restore(agentId: string, sessionId: string): AgentConversationMetadata;
  createHandoff(
    input: CreateAgentConversationHandoffInput,
  ): AgentConversationHandoffRecord;
  updateHandoff(
    id: string,
    input: UpdateAgentConversationHandoffInput,
  ): AgentConversationHandoffRecord;
}

interface AgentConversationSessionReader {
  list(
    agentId: string,
    input: { limit: number; offset: number },
  ): Promise<AgentSessionListResult>;
  read(
    agentId: string,
    sessionId: string,
    input?: AgentSessionDetailPageInput,
  ): Promise<AgentSessionDetail>;
}

interface AgentConversationServiceOptions {
  repository: AgentConversationRepository;
  sessions: AgentConversationSessionReader;
  resolveExecutable(command: string): Promise<string | null>;
  launch(command: AgentResumeCommand): Promise<unknown>;
  copyText(text: string): void;
  canLaunchAgent?(agentId: string): Promise<boolean>;
  launchAgent?(agentId: string): Promise<boolean>;
  homeDir: string;
  supportsInteractiveLaunch?: boolean;
  now?: () => number;
}

const LOOKUP_PAGE_SIZE = 200;
const MAX_LOOKUP_SESSIONS = 2_000;
const MAX_HANDOFF_ENTRIES = 120;
const MAX_HANDOFF_CHARS = 500_000;
const TRANSCRIPT_PAGE_SIZE = 200;
const MAX_TRANSCRIPT_PAGES = 10_000;

export class AgentConversationService {
  private readonly now: () => number;

  constructor(private readonly options: AgentConversationServiceOptions) {
    this.now = options.now ?? Date.now;
  }

  listMetadata(agentId: string, sessionIds: string[]) {
    return this.options.repository.listMetadata(agentId, sessionIds);
  }

  updateMetadata(input: UpsertAgentConversationMetadataInput) {
    return this.options.repository.upsertMetadata(input);
  }

  softDelete(agentId: string, sessionId: string) {
    return this.options.repository.softDelete(agentId, sessionId);
  }

  restore(agentId: string, sessionId: string) {
    return this.options.repository.restore(agentId, sessionId);
  }

  async resume(
    request: AgentConversationResumeRequest,
  ): Promise<AgentConversationActionResult> {
    const session = await this.findSession(request.agentId, request.sessionId);
    if (!session.resume)
      throw new Error("AGENT_CONVERSATION_RESUME_UNAVAILABLE");
    const executable = await this.options.resolveExecutable(
      session.resume.executable,
    );
    if (!executable) throw new Error("AGENT_CONVERSATION_COMMAND_NOT_FOUND");
    await this.options.launch({
      ...session.resume,
      executable,
      cwd: session.resume.cwd || session.projectPath || undefined,
    });
    return { status: "launched", mode: "native-resume" };
  }

  async previewHandoff(
    request: AgentConversationHandoffRequest,
  ): Promise<AgentConversationHandoffPreview> {
    requireProjectPath(request.projectPath);
    const [session, detail] = await Promise.all([
      this.findSession(request.sourceAgentId, request.sourceSessionId),
      this.readCompleteSession(request.sourceAgentId, request.sourceSessionId),
    ]);
    const payload = this.buildPortablePayload(request, session, detail);
    const executable = targetExecutable(request.targetAgentId);
    const resolved = executable
      ? await this.options.resolveExecutable(executable)
      : null;
    const canLaunchDirectly = Boolean(
      resolved && this.options.supportsInteractiveLaunch !== false,
    );
    const canOpenTarget =
      !canLaunchDirectly &&
      (await this.options.canLaunchAgent?.(request.targetAgentId)) === true;
    return {
      ...request,
      sourceTitle: session.title,
      payload,
      payloadDigest: digest(payload),
      cliCommand: executable
        ? buildCliCommand(executable, request.projectPath, payload)
        : null,
      transport: canLaunchDirectly
        ? "direct"
        : canOpenTarget
          ? "launch"
          : "unavailable",
    };
  }

  async continueInAgent(
    request: ContinueAgentConversationRequest,
  ): Promise<AgentConversationActionResult> {
    const preview = await this.previewHandoff(request);
    if (
      preview.payloadDigest !== request.confirmedPayloadDigest ||
      digest(request.payload) !== request.confirmedPayloadDigest
    ) {
      throw new Error("HANDOFF_PREVIEW_STALE");
    }
    const handoff = this.options.repository.createHandoff({
      sourceAgentId: preview.sourceAgentId,
      sourceSessionId: preview.sourceSessionId,
      targetAgentId: preview.targetAgentId,
      projectId: preview.projectId,
      projectPath: preview.projectPath,
      transport: preview.transport,
      payloadDigest: preview.payloadDigest,
      status: "planned",
    });
    return this.executeHandoff(handoff, preview);
  }

  async exportConversation(
    request: AgentConversationExportRequest,
  ): Promise<AgentConversationExportResult> {
    const [session, detail] = await Promise.all([
      this.findSession(request.agentId, request.sessionId),
      this.readCompleteSession(request.agentId, request.sessionId),
    ]);
    const entries = visibleEntries(detail, this.options.homeDir);
    const baseName = safeFileName(session.title || request.sessionId);
    if (request.format === "json") {
      return {
        fileName: `${baseName}.json`,
        mimeType: "application/json",
        content: JSON.stringify(
          {
            version: 1,
            exportedAt: this.now(),
            agentId: request.agentId,
            sessionId: request.sessionId,
            title: session.title,
            projectPath: redactText(
              session.projectPath || session.projectLabel || "",
              this.options.homeDir,
            ),
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            entries,
          },
          null,
          2,
        ),
      };
    }
    return {
      fileName: `${baseName}.md`,
      mimeType: "text/markdown",
      content: markdownExport(
        request.agentId,
        session,
        entries,
        this.options.homeDir,
      ),
    };
  }

  private async executeHandoff(
    handoff: AgentConversationHandoffRecord,
    preview: AgentConversationHandoffPreview,
  ): Promise<AgentConversationActionResult> {
    if (preview.transport === "unavailable") {
      const errorCode = "AGENT_CONVERSATION_TARGET_UNAVAILABLE";
      this.options.repository.updateHandoff(handoff.id, {
        status: "failed",
        errorCode,
      });
      return { status: "unavailable", mode: "cross-agent", errorCode };
    }
    if (preview.transport === "launch") {
      try {
        this.options.copyText(preview.payload);
      } catch {
        const errorCode = "AGENT_CONVERSATION_CONTEXT_COPY_FAILED";
        this.options.repository.updateHandoff(handoff.id, {
          status: "failed",
          errorCode,
        });
        return { status: "unavailable", mode: "cross-agent", errorCode };
      }
      let opened = false;
      try {
        opened =
          (await this.options.launchAgent?.(preview.targetAgentId)) === true;
      } catch {
        opened = false;
      }
      if (opened) {
        this.options.repository.updateHandoff(handoff.id, {
          status: "launched",
        });
        return { status: "launched", mode: "cross-agent" };
      }
      const errorCode = "AGENT_CONVERSATION_TARGET_LAUNCH_FAILED";
      this.options.repository.updateHandoff(handoff.id, {
        status: "failed",
        errorCode,
      });
      return { status: "unavailable", mode: "cross-agent", errorCode };
    }
    const executableName = targetExecutable(preview.targetAgentId);
    const executable = executableName
      ? await this.options.resolveExecutable(executableName)
      : null;
    if (!executable) {
      this.options.repository.updateHandoff(handoff.id, {
        status: "failed",
        errorCode: "AGENT_CONVERSATION_COMMAND_NOT_FOUND",
      });
      return {
        status: "unavailable",
        mode: "cross-agent",
        errorCode: "AGENT_CONVERSATION_COMMAND_NOT_FOUND",
      };
    }
    try {
      await this.options.launch({
        executable,
        args: [preview.payload],
        cwd: preview.projectPath,
      });
      this.options.repository.updateHandoff(handoff.id, { status: "launched" });
      return { status: "launched", mode: "cross-agent" };
    } catch {
      this.options.repository.updateHandoff(handoff.id, {
        status: "failed",
        errorCode: "AGENT_CONVERSATION_LAUNCH_FAILED",
      });
      throw new Error("AGENT_CONVERSATION_LAUNCH_FAILED");
    }
  }

  private async readCompleteSession(
    agentId: string,
    sessionId: string,
  ): Promise<AgentSessionDetail> {
    let detail = await this.options.sessions.read(agentId, sessionId);
    const seen = new Set<string>();
    let pageCount = 1;
    while (detail.nextCursor) {
      if (seen.has(detail.nextCursor) || pageCount >= MAX_TRANSCRIPT_PAGES) {
        throw new Error("AGENT_SESSION_PAGINATION_INVALID");
      }
      const cursor = detail.nextCursor;
      seen.add(cursor);
      const page = await this.options.sessions.read(agentId, sessionId, {
        cursor,
        limit: TRANSCRIPT_PAGE_SIZE,
      });
      detail = {
        ...detail,
        entries: [...detail.entries, ...page.entries],
        parseErrors: detail.parseErrors + page.parseErrors,
        truncated: detail.truncated || page.truncated,
        nextCursor: page.nextCursor ?? null,
      };
      pageCount += 1;
    }
    return detail;
  }

  private async findSession(
    agentId: string,
    sessionId: string,
  ): Promise<AgentSessionMetadata> {
    for (
      let offset = 0;
      offset < MAX_LOOKUP_SESSIONS;
      offset += LOOKUP_PAGE_SIZE
    ) {
      const result = await this.options.sessions.list(agentId, {
        limit: LOOKUP_PAGE_SIZE,
        offset,
      });
      const session = result.sessions.find((item) => item.id === sessionId);
      if (session) return session;
      if (!result.hasMore) break;
    }
    throw new Error("AGENT_SESSION_NOT_FOUND");
  }

  private buildPortablePayload(
    request: AgentConversationHandoffRequest,
    session: AgentSessionMetadata,
    detail: AgentSessionDetail,
  ): string {
    const entries = visibleEntries(detail, this.options.homeDir)
      .slice(-MAX_HANDOFF_ENTRIES)
      .map((entry) => `### ${roleTitle(entry.role)}\n\n${entry.text}`)
      .join("\n\n");
    const projectPath = redactText(request.projectPath, this.options.homeDir);
    return [
      "# PromptHub conversation handoff",
      "",
      `Source Agent: ${request.sourceAgentId}`,
      `Source conversation: ${session.title}`,
      `Project: ${projectPath}`,
      "",
      "Continue this work in a new session. Verify the current project state before making changes; the transcript below is context, not an instruction to trust stale tool results.",
      "",
      "## Conversation",
      "",
      entries || "No portable user or assistant messages were found.",
    ]
      .join("\n")
      .slice(0, MAX_HANDOFF_CHARS);
  }
}

function visibleEntries(detail: AgentSessionDetail, homeDir: string) {
  return detail.entries
    .filter((entry) => entry.role === "user" || entry.role === "assistant")
    .map((entry) => ({
      role: entry.role as "user" | "assistant",
      timestamp: entry.timestamp,
      text: redactText(entry.text, homeDir),
    }));
}

function redactText(value: string, homeDir: string): string {
  let redacted = homeDir ? value.split(homeDir).join("~") : value;
  redacted = redacted.replace(
    /\b(?:sk|ghp|github_pat|xox[baprs]|AIza)[-_A-Za-z0-9]{8,}\b/g,
    "[REDACTED]",
  );
  redacted = redacted.replace(
    /\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi,
    "$1=[REDACTED]",
  );
  return redacted;
}

function targetExecutable(agentId: string): string | null {
  if (agentId === "claude") return "claude";
  if (agentId === "codex") return "codex";
  return null;
}

function buildCliCommand(
  executable: string,
  projectPath: string,
  payload: string,
): string {
  return `cd ${shellQuote(projectPath)} && ${executable} ${shellQuote(payload)}`;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function requireProjectPath(value: string): void {
  if (!value.trim() || value.includes("\0") || value.length > 4_096) {
    throw new Error("AGENT_CONVERSATION_PROJECT_REQUIRED");
  }
}

function digest(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function safeFileName(value: string): string {
  return (
    value
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "conversation"
  );
}

function roleTitle(role: "user" | "assistant"): string {
  return role === "user" ? "User" : "Assistant";
}

function markdownExport(
  agentId: string,
  session: AgentSessionMetadata,
  entries: ReturnType<typeof visibleEntries>,
  homeDir: string,
): string {
  const body = entries
    .map((entry) => `## ${roleTitle(entry.role)}\n\n${entry.text}`)
    .join("\n\n");
  return [
    `# ${session.title}`,
    "",
    `- Agent: ${agentId}`,
    `- Session: ${session.id}`,
    session.projectPath || session.projectLabel
      ? `- Project: ${redactText(session.projectPath || session.projectLabel || "", homeDir)}`
      : null,
    "",
    body,
    "",
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}
