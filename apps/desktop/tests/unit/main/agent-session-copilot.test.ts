import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { AgentSessionIndexDB } from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";
import { createAgentSessionIndexService } from "../../../src/main/services/agent-session-index-service";

const temporaryRoots: string[] = [];

async function createHome(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "prompthub-copilot-session-"),
  );
  temporaryRoots.push(root);
  return root;
}

async function writeCopilotStore(
  root: string,
  sessions: Array<{
    id: string;
    cwd: string;
    summary: string | null;
    createdAt: string;
    updatedAt: string;
    turns: Array<{
      user: string | null;
      assistant: string | null;
      timestamp: string;
    }>;
  }>,
): Promise<string> {
  await fs.mkdir(root, { recursive: true });
  const dbPath = path.join(root, "session-store.db");
  const database = new Database(dbPath);
  database.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      cwd TEXT,
      repository TEXT,
      host_type TEXT,
      branch TEXT,
      summary TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      turn_index INTEGER NOT NULL,
      user_message TEXT,
      assistant_response TEXT,
      timestamp TEXT NOT NULL
    );
  `);
  for (const session of sessions) {
    database
      .prepare(
        `INSERT INTO sessions
          (id, cwd, summary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.cwd,
        session.summary,
        session.createdAt,
        session.updatedAt,
      );
    session.turns.forEach((turn, turnIndex) => {
      database
        .prepare(
          `INSERT INTO turns
            (session_id, turn_index, user_message, assistant_response, timestamp)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(session.id, turnIndex, turn.user, turn.assistant, turn.timestamp);
    });
  }
  database.close();
  return dbPath;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("GitHub Copilot session adapter", () => {
  it("lists and reads the native read-only session store without exposing runtime tables", async () => {
    const homeDir = await createHome();
    const copilotRootDir = path.join(homeDir, ".copilot");
    const dbPath = await writeCopilotStore(copilotRootDir, [
      {
        id: "older-session",
        cwd: "/workspace/older",
        summary: "Older Copilot session",
        createdAt: "2026-07-28T08:00:00.000Z",
        updatedAt: "2026-07-28T08:02:00.000Z",
        turns: [
          {
            user: "Old question",
            assistant: "Old answer",
            timestamp: "2026-07-28T08:01:00.000Z",
          },
        ],
      },
      {
        id: "newer-session",
        cwd: "/workspace/current",
        summary: null,
        createdAt: "2026-07-29T08:00:00.000Z",
        updatedAt: "2026-07-29T08:02:00.000Z",
        turns: [
          {
            user: "Inspect Copilot history",
            assistant: "The session store is read-only.",
            timestamp: "2026-07-29T08:01:00.000Z",
          },
          {
            user: "Keep the database private",
            assistant: null,
            timestamp: "2026-07-29T08:02:00.000Z",
          },
        ],
      },
    ]);

    const service = createAgentSessionService({ homeDir, copilotRootDir });
    const list = await service.list("copilot", { limit: 1 });

    expect(list).toMatchObject({
      agentId: "copilot",
      adapter: "copilot-session-store-v1",
      total: 2,
      hasMore: true,
      sessions: [
        {
          id: "newer-session",
          title: "Inspect Copilot history",
          projectLabel: "current",
          projectPath: "/workspace/current",
          messageCount: 3,
          sourcePath: dbPath,
          resume: {
            executable: "copilot",
            args: ["--resume=newer-session"],
            cwd: "/workspace/current",
          },
        },
      ],
    });

    const detail = await service.read("copilot", "newer-session");
    expect(detail).toMatchObject({
      agentId: "copilot",
      adapter: "copilot-session-store-v1",
      sessionId: "newer-session",
      parseErrors: 0,
      truncated: false,
    });
    expect(detail.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "Inspect Copilot history"],
      ["assistant", "The session store is read-only."],
      ["user", "Keep the database private"],
    ]);

    await expect(
      service.list("copilot", { limit: 20, search: "private" }),
    ).resolves.toMatchObject({
      total: 1,
      sessions: [expect.objectContaining({ id: "newer-session" })],
    });

    const promptHubDatabase = new Database(path.join(homeDir, "prompthub.db"));
    promptHubDatabase.exec(SCHEMA);
    try {
      const sessionIndex = createAgentSessionIndexService({
        index: new AgentSessionIndexDB(promptHubDatabase),
        reader: service,
      });
      await expect(
        sessionIndex.list("copilot", { limit: 20, search: "private" }),
      ).resolves.toMatchObject({
        total: 1,
        sessions: [expect.objectContaining({ id: "newer-session" })],
      });
    } finally {
      promptHubDatabase.close();
    }
  });

  it("returns an explicit empty result when Copilot has no local store", async () => {
    const homeDir = await createHome();
    const service = createAgentSessionService({ homeDir });

    await expect(service.list("copilot", { limit: 20 })).resolves.toMatchObject(
      {
        agentId: "copilot",
        adapter: "copilot-session-store-v1",
        total: 0,
        sessions: [],
      },
    );
    await expect(service.read("copilot", "missing-session")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );
  });

  it("fails closed for a symlinked native store", async () => {
    const homeDir = await createHome();
    const copilotRootDir = path.join(homeDir, ".copilot");
    const outsideStore = path.join(homeDir, "outside-session-store.db");
    await fs.mkdir(copilotRootDir, { recursive: true });
    await fs.writeFile(outsideStore, "not a Copilot database");
    await fs.symlink(
      outsideStore,
      path.join(copilotRootDir, "session-store.db"),
    );

    const service = createAgentSessionService({ homeDir, copilotRootDir });
    await expect(service.list("copilot", { limit: 20 })).rejects.toThrow(
      "AGENT_SESSION_STORE_INVALID",
    );
  });

  it("marks oversized turn fields as truncated while keeping the read bounded", async () => {
    const homeDir = await createHome();
    const copilotRootDir = path.join(homeDir, ".copilot");
    await writeCopilotStore(copilotRootDir, [
      {
        id: "large-session",
        cwd: "/workspace/large",
        summary: "Large session",
        createdAt: "2026-07-30T08:00:00.000Z",
        updatedAt: "2026-07-30T08:02:00.000Z",
        turns: [
          {
            user: "x".repeat(17 * 1024),
            assistant: "bounded",
            timestamp: "2026-07-30T08:01:00.000Z",
          },
        ],
      },
    ]);

    const service = createAgentSessionService({ homeDir, copilotRootDir });
    const detail = await service.read("copilot", "large-session");

    expect(detail.truncated).toBe(true);
    expect(detail.entries[0]?.text).toHaveLength(16 * 1024);
    expect(detail.entries[1]?.text).toBe("bounded");
  });
});
