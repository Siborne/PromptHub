import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Kiro CLI read-only sessions", () => {
  let homeDir: string;
  let kiroRoot: string;
  let sessionsDir: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "prompthub-kiro-session-"),
    );
    kiroRoot = path.join(homeDir, "custom-kiro");
    sessionsDir = path.join(kiroRoot, "sessions", "cli");
    await fs.mkdir(sessionsDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  async function writeSession(options: {
    id: string;
    metadataId?: string;
    title: string;
    updatedAt: string;
    lines: Array<string | Record<string, unknown>>;
  }) {
    const metadataPath = path.join(sessionsDir, `${options.id}.json`);
    const transcriptPath = path.join(sessionsDir, `${options.id}.jsonl`);
    await fs.writeFile(
      metadataPath,
      JSON.stringify({
        session_id: options.metadataId ?? options.id,
        cwd: "/workspace/kiro-project",
        created_at: "2026-07-27T01:02:03.000Z",
        updated_at: options.updatedAt,
        title: options.title,
        session_state: { private_runtime_state: "must-not-leak" },
      }),
      "utf8",
    );
    await fs.writeFile(
      transcriptPath,
      `${options.lines
        .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
        .join("\n")}\n`,
      "utf8",
    );
    return { metadataPath, transcriptPath };
  }

  it("lists metadata and reads only visible prompt and assistant text", async () => {
    const session = await writeSession({
      id: "session-new",
      title: "Review the Kiro migration",
      updatedAt: "2026-07-28T02:03:04.000Z",
      lines: [
        {
          version: 1,
          kind: "Prompt",
          data: {
            content: [
              { kind: "text", data: "Review the Kiro migration" },
              { kind: "toolUse", data: "PRIVATE_PROMPT_TOOL_ARGUMENTS" },
            ],
          },
        },
        {
          version: 1,
          kind: "AssistantMessage",
          data: {
            content: [
              { kind: "thinking", data: "PRIVATE_CHAIN_OF_THOUGHT" },
              { kind: "text", data: "Add a rollback verification step." },
              { kind: "toolUse", data: "PRIVATE_TOOL_ARGUMENTS" },
            ],
          },
        },
        {
          version: 1,
          kind: "ToolResults",
          data: { content: [{ kind: "text", data: "PRIVATE_TOOL_RESULT" }] },
        },
        {
          version: 1,
          kind: "FutureRecord",
          data: { content: [{ kind: "text", data: "PRIVATE_FUTURE_PAYLOAD" }] },
        },
        "{not-json",
      ],
    });
    await writeSession({
      id: "session-old",
      title: "Older session",
      updatedAt: "2026-07-27T02:03:04.000Z",
      lines: [],
    });
    const metadataBefore = await fs.readFile(session.metadataPath, "utf8");
    const transcriptBefore = await fs.readFile(session.transcriptPath, "utf8");
    const realMetadataPath = await fs.realpath(session.metadataPath);
    const sessionSize =
      (await fs.stat(session.metadataPath)).size +
      (await fs.stat(session.transcriptPath)).size;
    const service = createAgentSessionService({
      homeDir,
      kiroRootDir: kiroRoot,
    });

    await expect(service.list("kiro", { limit: 1 })).resolves.toEqual({
      agentId: "kiro",
      adapter: "kiro-cli-session-v1",
      sessions: [
        {
          id: "session-new",
          title: "Review the Kiro migration",
          projectLabel: "kiro-project",
          projectPath: "/workspace/kiro-project",
          createdAt: Date.parse("2026-07-27T01:02:03.000Z"),
          updatedAt: Date.parse("2026-07-28T02:03:04.000Z"),
          model: null,
          messageCount: null,
          sizeBytes: sessionSize,
          nativeDeleteSupported: true,
          sourcePath: realMetadataPath,
          resume: null,
        },
      ],
      total: 2,
      hasMore: true,
    });
    await expect(
      service.list("kiro", { limit: 1, offset: 1 }),
    ).resolves.toMatchObject({
      sessions: [{ id: "session-old" }],
      total: 2,
      hasMore: false,
    });

    const detail = await service.read("kiro", "session-new");
    expect(detail).toEqual({
      agentId: "kiro",
      adapter: "kiro-cli-session-v1",
      sessionId: "session-new",
      entries: [
        {
          id: "0",
          role: "user",
          timestamp: null,
          text: "Review the Kiro migration",
        },
        {
          id: "1",
          role: "assistant",
          timestamp: null,
          text: "Add a rollback verification step.",
        },
      ],
      parseErrors: 1,
      truncated: false,
    });
    const serialized = JSON.stringify(detail);
    expect(serialized).not.toContain("PRIVATE_");
    await expect(fs.readFile(session.metadataPath, "utf8")).resolves.toBe(
      metadataBefore,
    );
    await expect(fs.readFile(session.transcriptPath, "utf8")).resolves.toBe(
      transcriptBefore,
    );
    await service.delete("kiro", "session-new");
    await expect(fs.access(session.metadataPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(fs.access(session.transcriptPath)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await expect(service.list("kiro", { limit: 20 })).resolves.toMatchObject({
      total: 1,
      sessions: [expect.objectContaining({ id: "session-old" })],
    });
  });

  it("skips mismatched, linked, and unsafe sessions while bounding text", async () => {
    await writeSession({
      id: "mismatched",
      metadataId: "different-id",
      title: "Mismatch",
      updatedAt: "2026-07-28T00:00:00.000Z",
      lines: [],
    });
    await writeSession({
      id: "invalid.name",
      title: "Invalid id",
      updatedAt: "2026-07-28T00:00:01.000Z",
      lines: [],
    });
    await writeSession({
      id: "bounded",
      title: "Bounded",
      updatedAt: "2026-07-28T00:00:02.000Z",
      lines: [
        {
          version: 1,
          kind: "Prompt",
          data: {
            content: [{ kind: "text", data: "x".repeat(70 * 1024) }],
          },
        },
        {
          version: 1,
          kind: "ToolResults",
          data: {
            content: [{ kind: "text", data: "private".repeat(384 * 1024) }],
          },
        },
      ],
    });
    const outside = path.join(homeDir, "outside.json");
    await fs.writeFile(outside, '{"session_id":"linked"}', "utf8");
    await fs.symlink(outside, path.join(sessionsDir, "linked.json"));

    const service = createAgentSessionService({
      homeDir,
      kiroRootDir: kiroRoot,
    });
    const list = await service.list("kiro", { limit: 20 });
    expect(list.sessions.map((entry) => entry.id)).toEqual(["bounded"]);

    const detail = await service.read("kiro", "bounded");
    expect(detail.truncated).toBe(true);
    expect(detail.entries).toHaveLength(1);
    expect(detail.entries[0]?.text).toHaveLength(64 * 1024);
    await expect(service.read("kiro", "../outside")).rejects.toThrow(
      "AGENT_SESSION_ID_INVALID",
    );
    await expect(service.read("kiro", "mismatched")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );
    await expect(service.read("kiro", "linked")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );
  });

  it("fails closed for damaged metadata and incomplete transcripts", async () => {
    const service = createAgentSessionService({
      homeDir,
      kiroRootDir: kiroRoot,
    });
    await expect(
      createAgentSessionService({
        homeDir,
        kiroRootDir: path.join(homeDir, "missing-kiro"),
      }).list("kiro", { limit: 20 }),
    ).resolves.toMatchObject({ sessions: [], total: 0, hasMore: false });

    const fallback = await writeSession({
      id: "fallback",
      title: "",
      updatedAt: "",
      lines: [
        { version: 1, kind: "Prompt", data: "not-an-object" },
        { version: 1, kind: "Prompt", data: { content: {} } },
        {
          version: 1,
          kind: "Prompt",
          data: {
            content: [
              null,
              { kind: "text", data: "" },
              { kind: "text", data: "Visible fallback" },
            ],
          },
        },
        {
          version: 1,
          kind: "AssistantMessage",
          data: { content: "not-an-array" },
        },
      ],
    });
    await fs.writeFile(
      fallback.metadataPath,
      JSON.stringify({ session_id: "fallback" }),
      "utf8",
    );
    const fallbackStat = await fs.stat(fallback.metadataPath);
    await fs.writeFile(path.join(sessionsDir, "invalid.json"), "{invalid");
    await fs.writeFile(path.join(sessionsDir, "scalar.json"), "[]");
    await fs.writeFile(
      path.join(sessionsDir, "oversized.json"),
      JSON.stringify({
        session_id: "oversized",
        padding: "x".repeat(256 * 1024),
      }),
    );
    await fs.writeFile(path.join(sessionsDir, "ignored.txt"), "ignored");

    const list = await service.list("kiro", { limit: 20 });
    expect(list.sessions).toEqual([
      {
        id: "fallback",
        title: "fallback",
        projectLabel: null,
        projectPath: null,
        createdAt: null,
        updatedAt: fallbackStat.mtimeMs,
        model: null,
        messageCount: null,
        sizeBytes: expect.any(Number),
        nativeDeleteSupported: true,
        sourcePath: await fs.realpath(fallback.metadataPath),
        resume: null,
      },
    ]);
    await expect(service.read("kiro", "fallback")).resolves.toMatchObject({
      entries: [{ role: "user", text: "Visible fallback" }],
      parseErrors: 0,
    });

    await fs.rm(fallback.transcriptPath);
    await expect(service.read("kiro", "fallback")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );

    const realpath = vi.spyOn(fs, "realpath").mockResolvedValue(null as never);
    await expect(service.list("kiro", { limit: 20 })).resolves.toMatchObject({
      sessions: [],
    });
    realpath.mockRestore();
  });

  it("honors absolute KIRO_HOME and rejects a relative environment root", async () => {
    const original = process.env.KIRO_HOME;
    try {
      await writeSession({
        id: "environment-root",
        title: "Environment root",
        updatedAt: "2026-07-28T03:00:00.000Z",
        lines: [],
      });
      process.env.KIRO_HOME = kiroRoot;
      await expect(
        createAgentSessionService({ homeDir }).list("kiro", { limit: 20 }),
      ).resolves.toMatchObject({
        sessions: [{ id: "environment-root" }],
      });

      process.env.KIRO_HOME = "relative/kiro";
      sessionsDir = path.join(homeDir, ".kiro", "sessions", "cli");
      await fs.mkdir(sessionsDir, { recursive: true });
      await writeSession({
        id: "fallback-root",
        title: "Fallback root",
        updatedAt: "2026-07-28T04:00:00.000Z",
        lines: [],
      });
      await expect(
        createAgentSessionService({ homeDir }).list("kiro", { limit: 20 }),
      ).resolves.toMatchObject({
        sessions: [{ id: "fallback-root" }],
      });
    } finally {
      if (original === undefined) delete process.env.KIRO_HOME;
      else process.env.KIRO_HOME = original;
    }
  });
});
