import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

describe("Augment CLI conversation sessions", () => {
  let homeDir: string;
  let augmentRoot: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), "prompthub-augment-"));
    augmentRoot = path.join(homeDir, ".augment");
    await fs.mkdir(path.join(augmentRoot, "sessions"), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(homeDir, { recursive: true, force: true });
  });

  it("lists, searches, paginates and resumes native Auggie sessions", async () => {
    const sessionId = "aceb882d-a726-4660-a97d-c9a2cd2f9323";
    const projectPath = path.join(homeDir, "Projects", "PromptHub");
    const sourcePath = path.join(augmentRoot, "sessions", `${sessionId}.json`);
    await fs.writeFile(
      sourcePath,
      JSON.stringify({
        sessionId,
        created: "2026-03-06T02:10:53.108Z",
        modified: "2026-03-06T02:12:01.486Z",
        customTitle: "Review the release workflow",
        agentState: { modelId: "gpt-5.4", userEmail: "hidden@example.com" },
        chatHistory: [
          {
            exchange: {
              request_id: "request-1",
              request_message: "Review the project",
              response_text: "Add a rollback checkpoint.",
              request_nodes: [
                {
                  ide_state_node: {
                    workspace_folders: [
                      {
                        repository_root: projectPath,
                        folder_root: projectPath,
                      },
                    ],
                  },
                },
              ],
            },
            finishedAt: "2026-03-06T02:11:00.000Z",
          },
        ],
      }),
    );
    const service = createAgentSessionService({
      homeDir,
      augmentRootDir: augmentRoot,
    });

    await expect(
      service.list("augment", { limit: 20, search: "rollback" }),
    ).resolves.toEqual({
      agentId: "augment",
      adapter: "augment-session-json-v1",
      sessions: [
        {
          id: sessionId,
          title: "Review the release workflow",
          projectLabel: "PromptHub",
          projectPath,
          createdAt: Date.parse("2026-03-06T02:10:53.108Z"),
          updatedAt: Date.parse("2026-03-06T02:12:01.486Z"),
          model: "gpt-5.4",
          messageCount: 2,
          sourcePath,
          resume: {
            executable: "auggie",
            args: ["--resume", sessionId, "--workspace-root", projectPath],
            cwd: projectPath,
          },
        },
      ],
      total: 1,
      hasMore: false,
    });

    const first = await service.read("augment", sessionId, { limit: 1 });
    expect(first).toMatchObject({
      entries: [{ role: "user", text: "Review the project" }],
      nextCursor: expect.any(String),
      truncated: false,
    });
    await expect(
      service.read("augment", sessionId, {
        cursor: first.nextCursor!,
        limit: 1,
      }),
    ).resolves.toMatchObject({
      entries: [{ role: "assistant", text: "Add a rollback checkpoint." }],
      nextCursor: null,
    });
  });

  it("rejects malformed sessions and cursors without exposing private agent state", async () => {
    const sessionId = "11111111-1111-4111-8111-111111111111";
    await fs.writeFile(
      path.join(augmentRoot, "sessions", `${sessionId}.json`),
      JSON.stringify({ sessionId, chatHistory: "not-an-array" }),
    );
    await fs.writeFile(
      path.join(augmentRoot, "sessions", "invalid.json"),
      "{not-json",
    );
    const service = createAgentSessionService({
      homeDir,
      augmentRootDir: augmentRoot,
    });

    await expect(service.list("augment", { limit: 20 })).resolves.toMatchObject(
      {
        sessions: [],
        total: 0,
      },
    );
    await expect(
      service.read("augment", sessionId, { cursor: "invalid", limit: 20 }),
    ).rejects.toThrow("AGENT_SESSION_INVALID");
    await expect(service.read("augment", "../outside")).rejects.toThrow(
      "AGENT_SESSION_ID_INVALID",
    );
  });
});
