import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

const temporaryRoots: string[] = [];

async function createHome(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "prompthub-major-agent-session-"),
  );
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("major Agent session adapters", () => {
  it("lists active and archived Codex sessions once and renders only visible messages", async () => {
    const homeDir = await createHome();
    const codexRootDir = path.join(homeDir, ".codex");
    const currentDir = path.join(codexRootDir, "sessions", "2026", "07", "22");
    const archiveDir = path.join(codexRootDir, "archived_sessions");
    const sessionId = "019f87f5-7cf6-7151-a7d2-226039ceda11";
    const currentPath = path.join(
      currentDir,
      `rollout-current-${sessionId}.jsonl`,
    );
    await fs.mkdir(currentDir, { recursive: true });
    await fs.mkdir(archiveDir, { recursive: true });
    const transcript = [
      JSON.stringify({
        timestamp: "2026-07-22T03:54:00.000Z",
        type: "session_meta",
        payload: {
          id: sessionId,
          cwd: "/workspace/current",
          timestamp: "2026-07-22T03:54:00.000Z",
        },
      }),
      JSON.stringify({
        timestamp: "2026-07-22T03:54:01.000Z",
        type: "response_item",
        payload: {
          type: "message",
          role: "developer",
          content: [{ type: "input_text", text: "Hidden instructions" }],
        },
      }),
      JSON.stringify({
        timestamp: "2026-07-22T03:54:02.000Z",
        type: "event_msg",
        payload: { type: "user_message", message: "Fix the Codex history" },
      }),
      "{ malformed",
      JSON.stringify({
        timestamp: "2026-07-22T03:54:03.000Z",
        type: "event_msg",
        payload: { type: "agent_message", message: "History is visible." },
      }),
      JSON.stringify({
        timestamp: "2026-07-22T03:54:04.000Z",
        type: "response_item",
        payload: { type: "custom_tool_call", name: "exec" },
      }),
    ].join("\n");
    await fs.writeFile(currentPath, `${transcript}\n${"{}\n".repeat(700_000)}`);
    await fs.writeFile(
      path.join(archiveDir, `rollout-duplicate-${sessionId}.jsonl`),
      transcript,
    );
    const archivedId = "019f1111-1111-7111-a111-111111111111";
    await fs.writeFile(
      path.join(archiveDir, `rollout-old-${archivedId}.jsonl`),
      [
        JSON.stringify({
          type: "session_meta",
          timestamp: "2026-07-20T01:00:00.000Z",
          payload: { id: archivedId, cwd: "/workspace/old" },
        }),
        JSON.stringify({
          type: "event_msg",
          timestamp: "2026-07-20T01:00:01.000Z",
          payload: { type: "user_message", message: "Old session" },
        }),
      ].join("\n"),
    );

    const service = createAgentSessionService({ homeDir, codexRootDir });
    const list = await service.list("codex", { limit: 1 });

    expect(list).toMatchObject({
      agentId: "codex",
      adapter: "codex-rollout-jsonl-v1",
      total: 2,
      hasMore: true,
      sessions: [
        expect.objectContaining({
          id: sessionId,
          title: "Fix the Codex history",
          projectPath: "/workspace/current",
          resume: {
            executable: "codex",
            args: ["resume", sessionId],
            cwd: "/workspace/current",
          },
        }),
      ],
    });

    const detail = await service.read("codex", sessionId);
    expect(detail).toMatchObject({
      adapter: "codex-rollout-jsonl-v1",
      parseErrors: 1,
      truncated: true,
    });
    expect(detail.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "Fix the Codex history"],
      ["assistant", "History is visible."],
    ]);
  });

  it("reads bounded Grok Build summary and chat history without runtime artifacts", async () => {
    const homeDir = await createHome();
    const grokRootDir = path.join(homeDir, ".grok");
    const projectPath = "/workspace/grok-project";
    const sessionId = "019f82d7-9a58-75c2-a390-ef5ed6f38971";
    const sessionDir = path.join(
      grokRootDir,
      "sessions",
      encodeURIComponent(projectPath),
      sessionId,
    );
    await fs.mkdir(path.join(sessionDir, "terminal"), { recursive: true });
    await fs.writeFile(
      path.join(sessionDir, "summary.json"),
      JSON.stringify({
        generated_title: "Review Grok session support",
        created_at: "2026-07-21T04:03:15.754Z",
        updated_at: "2026-07-21T04:45:46.152Z",
        current_model_id: "grok-4.5",
        num_chat_messages: 3,
      }),
    );
    await fs.writeFile(
      path.join(sessionDir, "chat_history.jsonl"),
      [
        JSON.stringify({ type: "system", content: "Hidden system prompt" }),
        JSON.stringify({
          type: "user",
          content: [{ type: "text", text: "Review Grok session support" }],
        }),
        "{ malformed",
        JSON.stringify({
          type: "assistant",
          content: "The format is bounded.",
        }),
        JSON.stringify({ type: "tool_result", content: "Hidden tool output" }),
      ].join("\n"),
    );
    await fs.writeFile(path.join(sessionDir, "terminal", "call.log"), "secret");

    const service = createAgentSessionService({ homeDir, grokRootDir });
    const list = await service.list("grok", { limit: 20 });

    expect(list.sessions).toEqual([
      expect.objectContaining({
        id: sessionId,
        title: "Review Grok session support",
        projectPath,
        model: "grok-4.5",
        messageCount: 3,
        resume: {
          executable: "grok",
          args: ["--resume", sessionId],
          cwd: projectPath,
        },
      }),
    ]);
    const detail = await service.read("grok", sessionId);
    expect(detail.parseErrors).toBe(1);
    expect(detail.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "Review Grok session support"],
      ["assistant", "The format is bounded."],
    ]);
  });

  it("reads OpenClaw indexed transcripts and rejects paths outside its root", async () => {
    const homeDir = await createHome();
    const openclawRootDir = path.join(homeDir, ".openclaw");
    const sessionsDir = path.join(
      openclawRootDir,
      "agents",
      "main",
      "sessions",
    );
    const sessionId = "e6226a20-a6e1-443e-8140-32ed60390454";
    const transcriptPath = path.join(sessionsDir, `${sessionId}.jsonl`);
    await fs.mkdir(sessionsDir, { recursive: true });
    await fs.writeFile(
      transcriptPath,
      [
        JSON.stringify({
          type: "session",
          id: sessionId,
          cwd: "/workspace/openclaw",
          timestamp: "2026-07-19T01:00:00.000Z",
        }),
        JSON.stringify({
          type: "message",
          id: "message-1",
          timestamp: "2026-07-19T01:00:01.000Z",
          message: { role: "user", content: "Inspect OpenClaw history" },
        }),
        "{ malformed",
        JSON.stringify({
          type: "message",
          id: "message-2",
          timestamp: "2026-07-19T01:00:02.000Z",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "The transcript is local." }],
          },
        }),
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(sessionsDir, "sessions.json"),
      JSON.stringify({
        "agent:main:main": {
          sessionId,
          sessionFile: transcriptPath,
          updatedAt: 1784422802000,
          model: "moonshotai/Kimi-K2.5",
        },
        "agent:main:escaped": {
          sessionId: "escaped-session",
          sessionFile: path.join(homeDir, "outside.jsonl"),
          updatedAt: 1784422803000,
        },
      }),
    );

    const service = createAgentSessionService({ homeDir, openclawRootDir });
    const list = await service.list("openclaw", { limit: 20 });

    expect(list).toMatchObject({
      adapter: "openclaw-session-store-v1",
      total: 1,
      hasMore: false,
    });
    expect(list.sessions[0]).toMatchObject({
      id: sessionId,
      title: "Inspect OpenClaw history",
      projectPath: "/workspace/openclaw",
      model: "moonshotai/Kimi-K2.5",
    });
    const detail = await service.read("openclaw", sessionId);
    expect(detail.parseErrors).toBe(1);
    expect(detail.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "Inspect OpenClaw history"],
      ["assistant", "The transcript is local."],
    ]);
    await expect(service.read("openclaw", "escaped-session")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );
  });
});
