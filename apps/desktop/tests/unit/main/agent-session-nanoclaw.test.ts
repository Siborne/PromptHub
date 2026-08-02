import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import Database from "../../../src/main/database/sqlite";
import { createNanoClawSessionAdapter } from "../../../src/main/services/agent-session-nanoclaw";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("NanoClaw session adapter", () => {
  let homeDir: string;
  let installRoot: string;
  let sessionDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-nanoclaw-"));
    installRoot = path.join(homeDir, "nanoclaw");
    sessionDir = path.join(
      installRoot,
      "data",
      "v2-sessions",
      "agent-reviewer",
      "sess-20260801-abcd12",
    );
    await fs.mkdir(sessionDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  function writeStore(): void {
    const inbound = new Database(path.join(sessionDir, "inbound.db"));
    inbound.exec(`CREATE TABLE messages_in (
      id TEXT PRIMARY KEY, seq INTEGER UNIQUE, kind TEXT NOT NULL,
      timestamp TEXT NOT NULL, status TEXT, content TEXT NOT NULL
    )`);
    const inInsert = inbound.prepare(
      "INSERT INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, ?, ?, ?, ?)",
    );
    inInsert.run(
      "u1",
      2,
      "chat",
      "2026-08-01T10:00:00Z",
      "completed",
      JSON.stringify({ text: "Review the deployment plan", sender: "Ling" }),
    );
    inInsert.run(
      "task1",
      4,
      "task",
      "2026-08-01T10:01:00Z",
      "completed",
      JSON.stringify({ text: "private scheduled task" }),
    );
    inInsert.run(
      "u2",
      6,
      "chat-sdk",
      "2026-08-01T10:02:00Z",
      "completed",
      JSON.stringify({
        text: "Check the durable sequence",
        author: { userName: "Ling" },
      }),
    );
    inbound.close();

    const outbound = new Database(path.join(sessionDir, "outbound.db"));
    outbound.exec(`CREATE TABLE messages_out (
      id TEXT PRIMARY KEY, seq INTEGER UNIQUE, timestamp TEXT NOT NULL,
      kind TEXT NOT NULL, content TEXT NOT NULL
    )`);
    const outInsert = outbound.prepare(
      "INSERT INTO messages_out (id, seq, timestamp, kind, content) VALUES (?, ?, ?, ?, ?)",
    );
    outInsert.run(
      "a1",
      3,
      "2026-08-01T10:00:30Z",
      "chat",
      JSON.stringify({ markdown: "## Plan\nThe deployment is safe." }),
    );
    outInsert.run(
      "edit1",
      5,
      "2026-08-01T10:01:30Z",
      "chat",
      JSON.stringify({ operation: "edit", text: "private edit operation" }),
    );
    outInsert.run(
      "a2",
      7,
      "2026-08-01T10:02:30Z",
      "chat",
      JSON.stringify({ text: `Sequence is stable. ${"x".repeat(70_000)}` }),
    );
    outbound.close();
  }

  it("merges the current inbound and outbound databases by sequence", async () => {
    writeStore();
    const adapter = createNanoClawSessionAdapter([installRoot]);
    const result = await adapter.list(20, 0, "durable sequence");
    expect(result).toMatchObject({
      agentId: "nanoclaw",
      adapter: "nanoclaw-v2-sqlite",
      total: 1,
      hasMore: false,
      sessions: [
        {
          id: "sess-20260801-abcd12",
          title: "Review the deployment plan",
          projectLabel: "nanoclaw",
          projectPath: installRoot,
          messageCount: 4,
          resume: null,
        },
      ],
    });
    await expect(
      adapter.list(20, 0, "private edit operation"),
    ).resolves.toMatchObject({ total: 0 });
    await expect(
      adapter.list(20, 0, "private scheduled task"),
    ).resolves.toMatchObject({ total: 0 });

    const service = createAgentSessionService({
      homeDir,
      nanoclawRootDirs: [installRoot],
    });
    await expect(
      service.list("nanoclaw", { limit: 20 }),
    ).resolves.toMatchObject({
      total: 1,
      adapter: "nanoclaw-v2-sqlite",
    });
  });

  it("pages visible user and assistant messages without dropping large replies", async () => {
    writeStore();
    const adapter = createNanoClawSessionAdapter([installRoot]);
    const first = await adapter.read("sess-20260801-abcd12", { limit: 2 });
    expect(first.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "Review the deployment plan"],
      ["assistant", "## Plan\nThe deployment is safe."],
    ]);
    const second = await adapter.read("sess-20260801-abcd12", {
      cursor: first.nextCursor || undefined,
      limit: 2,
    });
    expect(second.entries.map((entry) => entry.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(second.entries[1].text.length).toBe(64 * 1024);
    expect(second.truncated).toBe(true);
    expect(second.nextCursor).toBeNull();
  });

  it("ignores malformed stores and symlinked session directories", async () => {
    await fs.writeFile(path.join(sessionDir, "inbound.db"), "not sqlite");
    await fs.writeFile(path.join(sessionDir, "outbound.db"), "not sqlite");
    const outside = path.join(homeDir, "outside-session");
    await fs.mkdir(outside);
    await fs.symlink(
      outside,
      path.join(
        installRoot,
        "data",
        "v2-sessions",
        "agent-reviewer",
        "linked-session",
      ),
    );
    const adapter = createNanoClawSessionAdapter([installRoot]);
    await expect(adapter.list(20, 0)).resolves.toMatchObject({
      total: 0,
      sessions: [],
    });
  });
});
