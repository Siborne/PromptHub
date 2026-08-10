/**
 * @vitest-environment node
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import Database from "../../../src/main/database/sqlite";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

const temporaryRoots: string[] = [];

async function createHome(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "prompthub-cline-session-"),
  );
  temporaryRoots.push(root);
  return root;
}

async function writeClineStore(root: string): Promise<string> {
  const sessionsRoot = path.join(root, "data", "sessions");
  await fs.mkdir(sessionsRoot, { recursive: true });
  const databasePath = path.join(sessionsRoot, "sessions.db");
  const database = new Database(databasePath);
  database.exec(`
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      cwd TEXT,
      title TEXT,
      model TEXT,
      created_at TEXT,
      updated_at TEXT,
      message_count INTEGER
    );
  `);
  database
    .prepare(
      `INSERT INTO sessions
        (id, cwd, title, model, created_at, updated_at, message_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      "new-session",
      "/workspace/current",
      "Native Cline session",
      "claude-sonnet-4-6",
      "2026-07-30T08:00:00.000Z",
      "2026-07-30T08:03:00.000Z",
      3,
    );
  database.close();

  await fs.writeFile(
    path.join(sessionsRoot, "new-session.json"),
    JSON.stringify({
      sessionId: "new-session",
      manifest: {
        cwd: "/workspace/current",
        title: "Native Cline session",
        modelId: "claude-sonnet-4-6",
        createdAt: "2026-07-30T08:00:00.000Z",
        updatedAt: "2026-07-30T08:03:00.000Z",
      },
      messages: [
        {
          id: "user-1",
          role: "user",
          content: [{ type: "text", text: "Inspect Cline history" }],
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: [
            { type: "text", text: "Private assistant phrase" },
            {
              type: "tool_use",
              input: { command: "cat private-file" },
            },
          ],
        },
        {
          id: "tool-1",
          role: "tool",
          content: [{ type: "text", text: "Do not expose tool output" }],
        },
      ],
    }),
  );
  return databasePath;
}

async function writeLegacyTask(root: string): Promise<string> {
  const taskRoot = path.join(root, "data", "tasks", "legacy-task");
  await fs.mkdir(taskRoot, { recursive: true });
  await fs.writeFile(
    path.join(taskRoot, "task_metadata.json"),
    JSON.stringify({
      taskId: "legacy-task",
      cwd: "/workspace/legacy",
      createdAt: "2026-07-29T07:00:00.000Z",
      lastModified: "2026-07-29T07:02:00.000Z",
      modelInfo: { id: "claude-3-7-sonnet" },
    }),
  );
  const historyPath = path.join(taskRoot, "api_conversation_history.json");
  await fs.writeFile(
    historyPath,
    JSON.stringify([
      { role: "user", content: "Legacy Cline prompt" },
      { role: "assistant", content: "Legacy Cline answer" },
      { role: "tool", content: "Legacy tool output" },
    ]),
  );
  return historyPath;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Cline session adapter", () => {
  it("honors an absolute CLINE_DATA_DIR without creating the default root", async () => {
    const homeDir = await createHome();
    const configuredRoot = path.join(homeDir, "configured-cline");
    await writeClineStore(configuredRoot);
    vi.stubEnv("CLINE_DATA_DIR", configuredRoot);

    const service = createAgentSessionService({ homeDir });
    await expect(
      service.list("cline", { limit: 10, offset: 0 }),
    ).resolves.toMatchObject({
      total: 1,
      sessions: [expect.objectContaining({ id: "new-session" })],
    });
    await expect(fs.lstat(path.join(homeDir, ".cline"))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("lists and reads native snapshots while searching visible turns", async () => {
    const homeDir = await createHome();
    const clineRootDir = path.join(homeDir, ".cline");
    const databasePath = await writeClineStore(clineRootDir);
    const service = createAgentSessionService({ homeDir, clineRootDir });

    const list = await service.list("cline", {
      limit: 10,
      offset: 0,
      search: "Private assistant phrase",
    });
    expect(list).toMatchObject({
      agentId: "cline",
      adapter: "cline-session-snapshot-v1",
      total: 1,
      hasMore: false,
      sessions: [
        {
          id: "new-session",
          title: "Native Cline session",
          projectLabel: "current",
          projectPath: "/workspace/current",
          model: "claude-sonnet-4-6",
          messageCount: 3,
          sourcePath: path.join(
            clineRootDir,
            "data",
            "sessions",
            "new-session.json",
          ),
          resume: {
            executable: "cline",
            args: ["--id", "new-session"],
            cwd: "/workspace/current",
          },
        },
      ],
    });

    const detail = await service.read("cline", "new-session");
    expect(detail).toMatchObject({
      agentId: "cline",
      adapter: "cline-session-snapshot-v1",
      sessionId: "new-session",
      truncated: false,
    });
    expect(detail.entries).toEqual([
      expect.objectContaining({
        id: "user-1",
        role: "user",
        text: "Inspect Cline history",
      }),
      expect.objectContaining({
        id: "assistant-1",
        role: "assistant",
        text: "Private assistant phrase",
      }),
    ]);
    expect(detail.entries.map((entry) => entry.text).join(" ")).not.toContain(
      "Do not expose tool output",
    );
    expect(detail.entries.map((entry) => entry.text).join(" ")).not.toContain(
      "private-file",
    );
    expect(await fs.stat(databasePath)).toBeTruthy();
    const snapshotPath = path.join(
      clineRootDir,
      "data",
      "sessions",
      "new-session.json",
    );
    await service.delete("cline", "new-session");
    await expect(fs.access(snapshotPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.access(databasePath)).resolves.toBeUndefined();
    const database = new Database(databasePath, { readOnly: true });
    try {
      expect(
        database.get("SELECT id FROM sessions WHERE id = ?", "new-session"),
      ).toBeNull();
    } finally {
      database.close();
    }
    await expect(service.list("cline", { limit: 10 })).resolves.toMatchObject({
      total: 0,
      sessions: [],
    });
  });

  it("falls back to legacy task histories and keeps malformed records bounded", async () => {
    const homeDir = await createHome();
    const clineRootDir = path.join(homeDir, ".cline");
    const historyPath = await writeLegacyTask(clineRootDir);
    const service = createAgentSessionService({ homeDir, clineRootDir });

    const list = await service.list("cline", { limit: 10, offset: 0 });
    expect(list.sessions).toEqual([
      expect.objectContaining({
        id: "legacy-task",
        title: "Legacy Cline prompt",
        projectLabel: "legacy",
        projectPath: "/workspace/legacy",
        model: "claude-3-7-sonnet",
        sourcePath: historyPath,
        resume: {
          executable: "cline",
          args: ["--id", "legacy-task"],
          cwd: "/workspace/legacy",
        },
      }),
    ]);

    await fs.writeFile(
      historyPath,
      JSON.stringify([
        { role: "user", content: "Legacy Cline prompt" },
        null,
        { role: "assistant", content: "Legacy Cline answer" },
      ]),
    );
    const detail = await service.read("cline", "legacy-task");
    expect(detail.entries).toEqual([
      expect.objectContaining({ role: "user", text: "Legacy Cline prompt" }),
      expect.objectContaining({
        role: "assistant",
        text: "Legacy Cline answer",
      }),
    ]);
    expect(detail.parseErrors).toBeGreaterThanOrEqual(1);
    await service.delete("cline", "legacy-task");
    await expect(
      fs.access(path.join(clineRootDir, "data", "tasks", "legacy-task")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not follow symlinked snapshots or create a missing Cline root", async () => {
    const homeDir = await createHome();
    const clineRootDir = path.join(homeDir, ".cline");
    const sessionsRoot = path.join(clineRootDir, "data", "sessions");
    await fs.mkdir(sessionsRoot, { recursive: true });
    const outside = path.join(homeDir, "outside.json");
    await fs.writeFile(
      outside,
      JSON.stringify({
        sessionId: "unsafe",
        messages: [{ role: "user", content: "unsafe" }],
      }),
    );
    await fs.symlink(outside, path.join(sessionsRoot, "unsafe.json"));

    const service = createAgentSessionService({ homeDir, clineRootDir });
    expect(await service.list("cline", { limit: 10, offset: 0 })).toMatchObject(
      {
        total: 0,
        sessions: [],
      },
    );

    const missingRoot = path.join(homeDir, ".missing-cline");
    const missingService = createAgentSessionService({
      homeDir,
      clineRootDir: missingRoot,
    });
    expect(
      await missingService.list("cline", { limit: 10, offset: 0 }),
    ).toMatchObject({
      total: 0,
      sessions: [],
    });
    await expect(fs.lstat(missingRoot)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("reads bounded external message artifacts only when they stay inside the Cline root", async () => {
    const homeDir = await createHome();
    const clineRootDir = path.join(homeDir, ".cline");
    const sessionsRoot = path.join(clineRootDir, "data", "sessions");
    await fs.mkdir(sessionsRoot, { recursive: true });
    const externalSessionPath = path.join(
      sessionsRoot,
      "external-session.json",
    );
    await fs.writeFile(
      externalSessionPath,
      JSON.stringify({
        sessionId: "external-session",
        manifest: {
          title: "External messages",
          messagesPath: "external-session-messages.json",
        },
      }),
    );
    const externalMessagesPath = path.join(
      sessionsRoot,
      "external-session-messages.json",
    );
    await fs.writeFile(
      externalMessagesPath,
      JSON.stringify({
        messages: [
          { role: "user", content: "External user message" },
          { role: "assistant", content: "External assistant message" },
        ],
      }),
    );
    await fs.writeFile(
      path.join(homeDir, "outside-messages.json"),
      JSON.stringify({ messages: [{ role: "user", content: "outside" }] }),
    );
    await fs.writeFile(
      path.join(sessionsRoot, "unsafe-messages.json"),
      JSON.stringify({
        sessionId: "unsafe-messages",
        messagesPath: "../../../outside-messages.json",
      }),
    );

    const service = createAgentSessionService({ homeDir, clineRootDir });
    const externalList = await service.list("cline", { limit: 20 });
    expect(
      externalList.sessions.find(
        (session) => session.id === "external-session",
      ),
    ).toMatchObject({
      sizeBytes:
        (await fs.stat(externalSessionPath)).size +
        (await fs.stat(externalMessagesPath)).size,
      nativeDeleteSupported: true,
    });
    await expect(
      service.read("cline", "external-session"),
    ).resolves.toMatchObject({
      entries: [
        expect.objectContaining({
          role: "user",
          text: "External user message",
        }),
        expect.objectContaining({
          role: "assistant",
          text: "External assistant message",
        }),
      ],
    });
    await expect(
      service.read("cline", "unsafe-messages"),
    ).resolves.toMatchObject({
      entries: [],
    });
    await service.delete("cline", "external-session");
    await expect(fs.access(externalSessionPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.access(externalMessagesPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});
