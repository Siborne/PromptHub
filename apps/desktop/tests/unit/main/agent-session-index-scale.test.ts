/**
 * @vitest-environment node
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AgentSessionIndexDB } from "@prompthub/db";
import Database from "../../../src/main/database/sqlite";
import { SCHEMA } from "../../../src/main/database/schema";

const SESSION_COUNT = 10_000;
const PAGE_SIZE = 200;

describe("AgentSessionIndexDB scale boundary", () => {
  let tempDir: string;
  let database: Database.Database;
  let index: AgentSessionIndexDB;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-agent-session-index-scale-"),
    );
    database = new Database(path.join(tempDir, "prompthub.db"));
    database.pragma("foreign_keys = ON");
    database.exec(SCHEMA);
    index = new AgentSessionIndexDB(database);
  });

  afterEach(() => {
    database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("commits and pages the 10,000-record hard limit without storing transcript bodies", () => {
    const source = index.registerSource({
      platformId: "claude",
      rootPath: "/Users/test/.claude/projects",
      adapterId: "claude-jsonl-v1",
      adapterVersion: "1",
      enabled: true,
    });
    const startedAt = Date.now();

    const committed = index.commitScan({
      sourceId: source.id,
      mode: "full",
      adapterVersion: "1",
      scanCursor: "scale-10000",
      scannedAt: 10_000,
      status: "ok",
      records: Array.from({ length: SESSION_COUNT }, (_, recordIndex) => ({
        externalId: `session-${String(recordIndex).padStart(5, "0")}`,
        title:
          recordIndex === SESSION_COUNT - 1
            ? "Unicode 大规模会话"
            : `Session ${recordIndex}`,
        projectPath: `/workspace/${recordIndex % 100}`,
        updatedAt: recordIndex,
        model: recordIndex % 2 === 0 ? "model-a" : "model-b",
        messageCount: recordIndex % 500,
        sourcePath: `/sessions/${recordIndex}.jsonl`,
        sourceMtimeMs: recordIndex,
        sourceSizeBytes: 1_024 + recordIndex,
        sourceDigest: `sha256:${String(recordIndex).padStart(64, "0")}`,
        sourceStatus: "present" as const,
      })),
    });

    expect(committed).toMatchObject({
      changedCount: SESSION_COUNT,
      source: {
        scanCursor: "scale-10000",
        lastStatus: "ok",
        lastScannedAt: 10_000,
      },
    });

    const seen = new Set<string>();
    for (let offset = 0; offset < SESSION_COUNT; offset += PAGE_SIZE) {
      const page = index.listSessions({
        sourceId: source.id,
        statuses: ["present"],
        limit: PAGE_SIZE,
        offset,
      });
      expect(page.items).toHaveLength(PAGE_SIZE);
      expect(page.total).toBe(SESSION_COUNT);
      expect(page.hasMore).toBe(offset + PAGE_SIZE < SESSION_COUNT);
      page.items.forEach((record) => seen.add(record.externalId));
    }
    expect(seen.size).toBe(SESSION_COUNT);
    expect(
      index.listSessions({
        sourceId: source.id,
        search: "大规模会话",
        limit: PAGE_SIZE,
        offset: 0,
      }).items,
    ).toEqual([
      expect.objectContaining({
        externalId: "session-09999",
        title: "Unicode 大规模会话",
      }),
    ]);

    const columns = database
      .prepare("PRAGMA table_info(agent_session_index)")
      .all() as Array<{ name: string }>;
    expect(columns.map((column) => column.name)).not.toEqual(
      expect.arrayContaining(["content", "body", "transcript"]),
    );
    expect(Date.now() - startedAt).toBeLessThan(30_000);
  }, 35_000);
});
