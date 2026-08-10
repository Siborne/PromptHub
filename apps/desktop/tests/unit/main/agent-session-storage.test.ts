import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentSessionListResult,
  AgentSessionMetadata,
} from "@prompthub/shared/types";
import {
  assertSessionId,
  assertSessionListLimit,
  assertSessionListOffset,
  enrichSessionResult,
  nativeSessionTargets,
  removeSessionTargets,
  supportsNativeSessionDelete,
} from "../../../src/main/services/agent-session-storage";

const roots: string[] = [];

function session(
  sourcePath: string | null,
  overrides: Partial<AgentSessionMetadata> = {},
): AgentSessionMetadata {
  return {
    id: "session-1",
    title: "Session",
    projectLabel: null,
    projectPath: null,
    createdAt: null,
    updatedAt: null,
    model: null,
    messageCount: null,
    sourcePath,
    resume: null,
    ...overrides,
  };
}

function result(metadata: AgentSessionMetadata): AgentSessionListResult {
  return {
    agentId: "test",
    adapter: "test-v1",
    sessions: [metadata],
    total: 1,
    hasMore: false,
  };
}

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "session-storage-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Agent session storage lifecycle", () => {
  it("validates bounded public inputs and the complete delete registry", () => {
    expect(() => assertSessionListLimit(1)).not.toThrow();
    expect(() => assertSessionListLimit(0)).toThrow(
      "AGENT_SESSION_LIMIT_INVALID",
    );
    expect(() => assertSessionListLimit(201)).toThrow(
      "AGENT_SESSION_LIMIT_INVALID",
    );
    expect(() => assertSessionListOffset(0, 1)).not.toThrow();
    expect(() => assertSessionListOffset(-1, 1)).toThrow(
      "AGENT_SESSION_OFFSET_INVALID",
    );
    expect(() => assertSessionId("safe_session-1")).not.toThrow();
    expect(() => assertSessionId("../unsafe")).toThrow(
      "AGENT_SESSION_ID_INVALID",
    );
    expect(supportsNativeSessionDelete("claude")).toBe(true);
    expect(supportsNativeSessionDelete("unknown-agent")).toBe(false);
  });

  it("derives known multi-file and directory ownership without renderer paths", async () => {
    const root = await temporaryRoot();
    const kiloSource = path.join(root, "session", "project", "session-1.json");
    const messageDir = path.join(root, "message", "session-1");
    await fs.mkdir(path.dirname(kiloSource), { recursive: true });
    await fs.mkdir(messageDir, { recursive: true });
    await fs.writeFile(kiloSource, "{}");
    await fs.writeFile(path.join(messageDir, "message-1.json"), "{}");
    await fs.writeFile(path.join(messageDir, "ignore.txt"), "ignore");

    await expect(
      nativeSessionTargets("kilo", session(kiloSource)),
    ).resolves.toEqual([
      kiloSource,
      messageDir,
      path.join(root, "part", "message-1"),
    ]);
    await expect(
      nativeSessionTargets("reasonix", session(path.join(root, "one.jsonl"))),
    ).resolves.toEqual([
      path.join(root, "one.jsonl"),
      path.join(root, "one.events.jsonl"),
      path.join(root, "one.jsonl.meta"),
    ]);
    await expect(nativeSessionTargets("kilo", session(null))).resolves.toEqual(
      [],
    );
  });

  it("rejects unbounded Kilo companion inventories", async () => {
    const entries = Array.from({ length: 50_001 }, (_, index) => ({
      name: `${index}.json`,
      isFile: () => true,
      isSymbolicLink: () => false,
    }));
    vi.spyOn(fs, "readdir").mockResolvedValueOnce(entries as never);
    await expect(
      nativeSessionTargets(
        "kilo",
        session("/tmp/storage/session/project/session-1.json"),
      ),
    ).rejects.toThrow("AGENT_SESSION_SCAN_LIMIT");
  });

  it("requires a truthful size and preserves supplied logical database bytes", async () => {
    await expect(
      enrichSessionResult(
        "augment",
        result(session("/missing/session.json")),
        true,
      ),
    ).rejects.toThrow("AGENT_SESSION_SIZE_UNAVAILABLE");
    await expect(
      enrichSessionResult(
        "copilot",
        result(session(null, { sizeBytes: 19 })),
        true,
      ),
    ).resolves.toMatchObject({
      sessions: [{ sizeBytes: 19, nativeDeleteSupported: true }],
    });
    await expect(
      enrichSessionResult("copilot", result(session(null)), true),
    ).rejects.toThrow("AGENT_SESSION_SIZE_UNAVAILABLE");
    vi.spyOn(fs, "lstat").mockResolvedValueOnce({
      isSymbolicLink: () => false,
      isFile: () => false,
      isDirectory: () => false,
    } as never);
    await expect(
      enrichSessionResult("augment", result(session("/dev/session")), true),
    ).rejects.toThrow("AGENT_SESSION_SIZE_UNAVAILABLE");
  });

  it("bounds directory measurement and counts contained links without following them", async () => {
    const root = await temporaryRoot();
    const sessionDir = path.join(root, "session-1");
    const transcript = path.join(sessionDir, "transcript.jsonl");
    const outside = path.join(root, "outside.txt");
    await fs.mkdir(sessionDir);
    await fs.writeFile(transcript, "transcript");
    await fs.writeFile(outside, "outside");
    await fs.symlink(outside, path.join(sessionDir, "outside-link"));
    const projected = await enrichSessionResult(
      "grok",
      result(session(transcript)),
      true,
    );
    expect(projected.sessions[0].sizeBytes).toBeGreaterThan(
      (await fs.stat(transcript)).size,
    );

    const entries = Array.from({ length: 50_001 }, (_, index) => ({
      name: String(index),
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => false,
    }));
    vi.spyOn(fs, "readdir").mockResolvedValueOnce(entries as never);
    await expect(
      enrichSessionResult("augment", result(session(sessionDir)), true),
    ).rejects.toThrow("AGENT_SESSION_SIZE_UNAVAILABLE");
  });

  it("handles Cline companion metadata failures and absolute contained paths", async () => {
    const root = await temporaryRoot();
    const sessionsRoot = path.join(root, "data", "sessions");
    await fs.mkdir(sessionsRoot, { recursive: true });
    const malformed = path.join(sessionsRoot, "session-1.json");
    await fs.writeFile(malformed, "{bad-json");
    await expect(
      nativeSessionTargets("cline", session(malformed)),
    ).resolves.toEqual([
      malformed,
      path.join(root, "data", "tasks", "session-1"),
    ]);
    await fs.writeFile(malformed, "[]");
    await expect(
      nativeSessionTargets("cline", session(malformed)),
    ).resolves.toEqual([
      malformed,
      path.join(root, "data", "tasks", "session-1"),
    ]);

    const messages = path.join(sessionsRoot, "session-1-messages.json");
    await fs.writeFile(messages, "[]");
    await fs.writeFile(malformed, JSON.stringify({ messagesPath: messages }));
    await expect(
      nativeSessionTargets("cline", session(malformed)),
    ).resolves.toContain(await fs.realpath(messages));

    const shared = path.join(sessionsRoot, "messages.json");
    await fs.writeFile(shared, "[]");
    await fs.writeFile(malformed, JSON.stringify({ messagesPath: shared }));
    await expect(
      nativeSessionTargets("cline", session(malformed)),
    ).resolves.not.toContain(shared);

    const missingMessages = path.join(sessionsRoot, "session-1-missing.json");
    await fs.writeFile(
      malformed,
      JSON.stringify({ messagesPath: missingMessages }),
    );
    await expect(
      nativeSessionTargets("cline", session(malformed)),
    ).resolves.not.toContain(missingMessages);

    await fs.writeFile(malformed, " ".repeat(256 * 1024 + 1));
    await expect(
      nativeSessionTargets("cline", session(malformed)),
    ).resolves.not.toContain(messages);
    await fs.rm(malformed);
    await fs.mkdir(malformed);
    await expect(
      nativeSessionTargets("cline", session(malformed)),
    ).resolves.not.toContain(messages);
  });

  it("validates every target before deleting files or directories", async () => {
    const root = await temporaryRoot();
    const kept = path.join(root, "kept.json");
    const outsideRoot = await temporaryRoot();
    const outside = path.join(outsideRoot, "outside.json");
    const link = path.join(root, "linked.json");
    await fs.writeFile(kept, "kept");
    await fs.writeFile(outside, "outside");
    await fs.symlink(outside, link);

    await expect(removeSessionTargets([kept, link], [root])).rejects.toThrow(
      "AGENT_SESSION_DELETE_TARGET_INVALID",
    );
    await expect(fs.readFile(kept, "utf8")).resolves.toBe("kept");
    await expect(removeSessionTargets([outside], [root])).rejects.toThrow(
      "AGENT_SESSION_DELETE_TARGET_INVALID",
    );
    await expect(
      removeSessionTargets(["relative.json"], [root]),
    ).rejects.toThrow("AGENT_SESSION_DELETE_TARGET_INVALID");
    await expect(
      removeSessionTargets([path.join(root, "missing.json")], [root]),
    ).rejects.toThrow("AGENT_SESSION_NOT_FOUND");
    await expect(
      removeSessionTargets([kept], [path.join(root, "missing-root")]),
    ).rejects.toThrow("AGENT_SESSION_DELETE_TARGET_INVALID");

    const directory = path.join(root, "owned");
    await fs.mkdir(directory);
    await fs.writeFile(path.join(directory, "content.json"), "content");
    await removeSessionTargets([directory], [root]);
    await expect(fs.access(directory)).rejects.toMatchObject({
      code: "ENOENT",
    });
    await removeSessionTargets(
      [kept, path.join(root, "optional.json")],
      [root],
    );
    await expect(fs.access(kept)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
