import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentSessionIndexDB } from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";
import { createAgentSessionIndexService } from "../../../src/main/services/agent-session-index-service";
import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Kilo session adapter", () => {
  let homeDir: string;
  let storageRoot: string;
  const sessionId = "ses_kilo123";
  const projectId = "project-1";

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-kilo-"));
    storageRoot = path.join(homeDir, "kilo-storage");
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeJson(
    relativePath: string,
    value: unknown,
  ): Promise<void> {
    const target = path.join(storageRoot, relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(value));
  }

  async function writeSession(): Promise<string> {
    const projectPath = path.join(homeDir, "Projects", "KiloProject");
    await writeJson(`session/${projectId}/${sessionId}.json`, {
      id: sessionId,
      projectID: projectId,
      directory: projectPath,
      title: "Refactor Kilo adapter",
      version: "1.0.0",
      time: { created: 1785427200000, updated: 1785427320000 },
    });
    await writeJson(`message/${sessionId}/msg_user.json`, {
      id: "msg_user",
      sessionID: sessionId,
      role: "user",
      modelID: "gpt-5.4",
      providerID: "openai",
      time: { created: 1785427210000 },
    });
    await writeJson(`part/msg_user/part_text.json`, {
      id: "part_text",
      messageID: "msg_user",
      sessionID: sessionId,
      type: "text",
      text: "Find the pagination regression",
    });
    await writeJson(`part/msg_user/part_tool.json`, {
      id: "part_tool",
      messageID: "msg_user",
      sessionID: sessionId,
      type: "tool",
      state: { input: "private tool payload" },
    });
    await writeJson(`message/${sessionId}/msg_assistant.json`, {
      id: "msg_assistant",
      sessionID: sessionId,
      role: "assistant",
      time: { created: 1785427220000 },
    });
    await writeJson(`part/msg_assistant/part_reasoning.json`, {
      id: "part_reasoning",
      messageID: "msg_assistant",
      sessionID: sessionId,
      type: "reasoning",
      text: "private chain of thought",
    });
    await writeJson(`part/msg_assistant/part_text.json`, {
      id: "part_answer",
      messageID: "msg_assistant",
      sessionID: sessionId,
      type: "text",
      text: "Use an opaque source-bound cursor.",
    });
    return projectPath;
  }

  it("lists, body-searches, cursor-pages and resumes visible Kilo messages", async () => {
    const projectPath = await writeSession();
    const sourcePath = path.join(
      storageRoot,
      "session",
      projectId,
      `${sessionId}.json`,
    );
    const resolvedSourcePath = await fs.realpath(sourcePath);
    const ownedFiles = [
      sourcePath,
      path.join(storageRoot, "message", sessionId, "msg_user.json"),
      path.join(storageRoot, "message", sessionId, "msg_assistant.json"),
      path.join(storageRoot, "part", "msg_user", "part_text.json"),
      path.join(storageRoot, "part", "msg_user", "part_tool.json"),
      path.join(storageRoot, "part", "msg_assistant", "part_reasoning.json"),
      path.join(storageRoot, "part", "msg_assistant", "part_text.json"),
    ];
    const expectedSize = (
      await Promise.all(ownedFiles.map((file) => fs.stat(file)))
    ).reduce((total, stat) => total + stat.size, 0);
    const service = createAgentSessionService({
      homeDir,
      kiloStorageRootDir: storageRoot,
    });

    await expect(
      service.list("kilo", { limit: 20, search: "opaque source-bound" }),
    ).resolves.toEqual({
      agentId: "kilo",
      adapter: "kilo-session-json-v1",
      sessions: [
        {
          id: sessionId,
          title: "Refactor Kilo adapter",
          projectLabel: "KiloProject",
          projectPath,
          createdAt: 1785427200000,
          updatedAt: 1785427320000,
          model: "gpt-5.4",
          messageCount: 2,
          sizeBytes: expectedSize,
          nativeDeleteSupported: true,
          sourcePath: resolvedSourcePath,
          resume: {
            executable: "kilo",
            args: ["--session", sessionId],
            cwd: projectPath,
          },
        },
      ],
      total: 1,
      hasMore: false,
    });

    const promptHubDatabase = new Database(path.join(homeDir, "prompthub.db"));
    promptHubDatabase.exec(SCHEMA);
    try {
      const indexed = createAgentSessionIndexService({
        index: new AgentSessionIndexDB(promptHubDatabase),
        reader: service,
      });
      await expect(
        indexed.list("kilo", {
          limit: 20,
          offset: 0,
          search: "opaque source-bound",
        }),
      ).resolves.toMatchObject({
        total: 0,
        sessions: [],
      });
    } finally {
      promptHubDatabase.close();
    }

    const first = await service.read("kilo", sessionId, { limit: 1 });
    expect(first).toMatchObject({
      entries: [{ role: "user", text: "Find the pagination regression" }],
      nextCursor: expect.any(String),
      truncated: false,
    });
    await expect(
      service.read("kilo", sessionId, {
        cursor: first.nextCursor!,
        limit: 1,
      }),
    ).resolves.toMatchObject({
      entries: [
        { role: "assistant", text: "Use an opaque source-bound cursor." },
      ],
      nextCursor: null,
      parseErrors: 0,
    });

    const all = await service.read("kilo", sessionId, { limit: 20 });
    expect(all.entries.map((entry) => entry.text).join("\n")).not.toContain(
      "private",
    );
    await service.delete("kilo", sessionId);
    await expect(fs.access(sourcePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(
      fs.access(path.join(storageRoot, "message", sessionId)),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.access(path.join(storageRoot, "part", "msg_user")),
    ).rejects.toMatchObject({ code: "ENOENT" });
    await expect(
      fs.access(path.join(storageRoot, "part", "msg_assistant")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("handles missing roots and rejects malformed, symlinked or unsafe sources", async () => {
    const service = createAgentSessionService({
      homeDir,
      kiloStorageRootDir: storageRoot,
    });
    await expect(service.list("kilo", { limit: 20 })).resolves.toMatchObject({
      sessions: [],
      total: 0,
    });

    await writeJson(`session/${projectId}/${sessionId}.json`, {
      id: "mismatched-id",
    });
    await expect(service.list("kilo", { limit: 20 })).resolves.toMatchObject({
      sessions: [],
      total: 0,
    });
    await expect(service.read("kilo", sessionId)).rejects.toThrow(
      "AGENT_SESSION_INVALID",
    );
    await expect(service.read("kilo", "../escape")).rejects.toThrow(
      "AGENT_SESSION_ID_INVALID",
    );

    const target = path.join(homeDir, "outside.json");
    await fs.writeFile(target, JSON.stringify({ id: "ses_outside" }));
    const linked = path.join(
      storageRoot,
      "session",
      projectId,
      "ses_link.json",
    );
    await fs.symlink(target, linked);
    await expect(service.list("kilo", { limit: 20 })).resolves.toMatchObject({
      sessions: [],
      total: 0,
    });
  });

  it("paginates beyond the legacy 2,000-session window", async () => {
    const directory = path.join(storageRoot, "session", projectId);
    await fs.mkdir(directory, { recursive: true });
    await Promise.all(
      Array.from({ length: 2_001 }, (_, index) => {
        const id = `ses_scale_${String(index).padStart(4, "0")}`;
        return fs.writeFile(
          path.join(directory, `${id}.json`),
          JSON.stringify({
            id,
            title: `Session ${index}`,
            time: { created: index, updated: index },
          }),
        );
      }),
    );
    const service = createAgentSessionService({
      homeDir,
      kiloStorageRootDir: storageRoot,
    });

    await expect(
      service.list("kilo", { limit: 1, offset: 2_000 }),
    ).resolves.toMatchObject({
      total: 2_001,
      hasMore: false,
      sessions: [expect.objectContaining({ id: "ses_scale_0000" })],
    });
  });
});
