import { describe, expect, it } from "vitest";

import {
  formatSessionSize,
  resolveSessionTitle,
  sortAgentSessions,
} from "../../../src/renderer/components/agent/agent-session-display";
import type { AgentSessionMetadata } from "@prompthub/shared/types";

describe("formatSessionSize", () => {
  it("formats bounded byte units and rejects unavailable values", () => {
    expect(formatSessionSize(undefined, "en-US")).toBeNull();
    expect(formatSessionSize(null, "en-US")).toBeNull();
    expect(formatSessionSize(Number.NaN, "en-US")).toBeNull();
    expect(formatSessionSize(-1, "en-US")).toBeNull();
    expect(formatSessionSize(0, "en-US")).toBe("0 B");
    expect(formatSessionSize(1023, "en-US")).toBe("1,023 B");
    expect(formatSessionSize(1024, "en-US")).toBe("1 KB");
    expect(formatSessionSize(1536, "en-US")).toBe("1.5 KB");
    expect(formatSessionSize(100 * 1024, "en-US")).toBe("100 KB");
    expect(formatSessionSize(1024 ** 5, "en-US")).toBe("1,024 TB");
  });
});

describe("resolveSessionTitle", () => {
  it("prefers a PromptHub override, then the native title, then the session id", () => {
    expect(resolveSessionTitle("native", "session-1", " PromptHub name ")).toBe(
      "PromptHub name",
    );
    expect(resolveSessionTitle(" Native name ", "session-1", "  ")).toBe(
      "Native name",
    );
    expect(resolveSessionTitle("", "session-1", null)).toBe("session-1");
  });
});

describe("sortAgentSessions", () => {
  it("does not mutate input and keeps unavailable primary values last", () => {
    const base = {
      projectLabel: null,
      projectPath: null,
      createdAt: null,
      model: null,
      messageCount: null,
      sourcePath: null,
      resume: null,
    } satisfies Omit<
      AgentSessionMetadata,
      "id" | "title" | "updatedAt" | "sizeBytes"
    >;
    const sessions: AgentSessionMetadata[] = [
      { ...base, id: "unknown", title: "Unknown", updatedAt: null },
      {
        ...base,
        id: "older",
        title: "Older",
        updatedAt: 10,
        sizeBytes: 100,
      },
      {
        ...base,
        id: "newer",
        title: "Newer",
        updatedAt: 20,
        sizeBytes: 200,
      },
    ];

    expect(sortAgentSessions(sessions, "newest").map(({ id }) => id)).toEqual([
      "newer",
      "older",
      "unknown",
    ]);
    expect(sortAgentSessions(sessions, "oldest").map(({ id }) => id)).toEqual([
      "older",
      "newer",
      "unknown",
    ]);
    expect(sortAgentSessions(sessions, "smallest").map(({ id }) => id)).toEqual(
      ["older", "newer", "unknown"],
    );
    expect(sortAgentSessions(sessions, "largest").map(({ id }) => id)).toEqual([
      "newer",
      "older",
      "unknown",
    ]);
    expect(sessions.map(({ id }) => id)).toEqual(["unknown", "older", "newer"]);
  });

  it("uses recency and id as deterministic size tie-breakers", () => {
    const sessions = [
      {
        id: "b",
        title: "B",
        projectLabel: null,
        projectPath: null,
        createdAt: 20,
        updatedAt: null,
        model: null,
        messageCount: null,
        sizeBytes: 10,
        sourcePath: null,
        resume: null,
      },
      {
        id: "a",
        title: "A",
        projectLabel: null,
        projectPath: null,
        createdAt: 20,
        updatedAt: null,
        model: null,
        messageCount: null,
        sizeBytes: 10,
        sourcePath: null,
        resume: null,
      },
      {
        id: "invalid",
        title: "Invalid",
        projectLabel: null,
        projectPath: null,
        createdAt: 30,
        updatedAt: null,
        model: null,
        messageCount: null,
        sizeBytes: Number.POSITIVE_INFINITY,
        sourcePath: null,
        resume: null,
      },
    ] satisfies AgentSessionMetadata[];

    expect(sortAgentSessions(sessions, "largest").map(({ id }) => id)).toEqual([
      "a",
      "b",
      "invalid",
    ]);
    expect(
      sortAgentSessions(
        sessions.map((session) => ({
          ...session,
          createdAt: null,
          updatedAt: null,
        })),
        "newest",
      ).map(({ id }) => id),
    ).toEqual(["a", "b", "invalid"]);
  });
});
