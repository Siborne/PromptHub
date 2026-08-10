import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createAgentSessionService } from "../../../src/main/services/agent-session-service";

const temporaryRoots: string[] = [];

async function createHome(): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "prompthub-cursor-session-"),
  );
  temporaryRoots.push(root);
  return root;
}

async function writeTranscript(
  cursorRoot: string,
  project: string,
  sessionId: string,
  lines: unknown[],
): Promise<string> {
  const directory = path.join(
    cursorRoot,
    "projects",
    project,
    "agent-transcripts",
    sessionId,
  );
  await fs.mkdir(directory, { recursive: true });
  const filePath = path.join(directory, `${sessionId}.jsonl`);
  await fs.writeFile(
    filePath,
    lines
      .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
      .join("\n"),
  );
  return filePath;
}

function message(role: string, text: string): Record<string, unknown> {
  return {
    role,
    message: { content: [{ type: "text", text }] },
  };
}

function cursorProjectKey(projectPath: string): string {
  const root = path.parse(projectPath).root;
  return path.relative(root, projectPath).split(path.sep).join("-");
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

describe("Cursor session adapter", () => {
  it("lists local agent transcripts and searches visible turn text", async () => {
    const homeDir = await createHome();
    const cursorRootDir = path.join(homeDir, ".cursor");
    const projectPath = path.join(homeDir, "Projects", "demo-app");
    await fs.mkdir(projectPath, { recursive: true });
    const projectKey = cursorProjectKey(projectPath);
    const sessionId = "11111111-1111-4111-8111-111111111111";
    await writeTranscript(cursorRootDir, projectKey, sessionId, [
      message("user", "Find this Cursor-only search phrase"),
      message("assistant", "The answer is in the transcript."),
      message("tool", "Do not expose this tool output"),
    ]);

    const service = createAgentSessionService({ homeDir, cursorRootDir });
    const page = await service.list("cursor", {
      limit: 20,
      search: "Cursor-only search phrase",
    });

    expect(page).toMatchObject({
      agentId: "cursor",
      adapter: "cursor-agent-transcript-v1",
      total: 1,
      hasMore: false,
    });
    expect(page.sessions[0]).toMatchObject({
      id: sessionId,
      projectLabel: "demo-app",
      projectPath,
      resume: {
        executable: "cursor-agent",
        args: ["--resume", sessionId],
        cwd: projectPath,
      },
    });
  });

  it("fails closed for ambiguous and symlink-only encoded projects", async () => {
    const homeDir = await createHome();
    const cursorRootDir = path.join(homeDir, ".cursor");
    const ambiguousA = path.join(homeDir, "ambiguous", "a-b", "c");
    const ambiguousB = path.join(homeDir, "ambiguous", "a", "b-c");
    await Promise.all([
      fs.mkdir(ambiguousA, { recursive: true }),
      fs.mkdir(ambiguousB, { recursive: true }),
    ]);
    const ambiguousKey = cursorProjectKey(ambiguousA);
    expect(cursorProjectKey(ambiguousB)).toBe(ambiguousKey);
    const ambiguousSession = "12121212-1212-4121-8121-121212121212";
    await writeTranscript(cursorRootDir, ambiguousKey, ambiguousSession, [
      message("user", "Ambiguous project"),
    ]);

    const externalHome = await createHome();
    const externalProject = path.join(externalHome, "linked-project");
    await fs.mkdir(externalProject, { recursive: true });
    const linkedProject = path.join(homeDir, "linked-project");
    await fs.symlink(
      externalProject,
      linkedProject,
      process.platform === "win32" ? "junction" : "dir",
    );
    const linkedKey = cursorProjectKey(linkedProject);
    const linkedSession = "13131313-1313-4131-8131-131313131313";
    await writeTranscript(cursorRootDir, linkedKey, linkedSession, [
      message("user", "Linked project"),
    ]);

    const service = createAgentSessionService({ homeDir, cursorRootDir });
    const page = await service.list("cursor", { limit: 20 });
    expect(page.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: ambiguousSession,
          projectLabel: "a-b-c",
          projectPath: null,
        }),
        expect.objectContaining({
          id: linkedSession,
          projectLabel: "linked-project",
          projectPath: null,
        }),
      ]),
    );
  });

  it("bounds project resolution and accepts the exact home project", async () => {
    const inaccessibleHome = await createHome();
    const inaccessibleRoot = path.join(inaccessibleHome, ".cursor");
    const inaccessibleProject = path.join(
      inaccessibleHome,
      "Projects",
      "demo-app",
    );
    await fs.mkdir(inaccessibleProject, { recursive: true });
    const inaccessibleSession = "14141414-1414-4141-8141-141414141414";
    await writeTranscript(
      inaccessibleRoot,
      cursorProjectKey(inaccessibleProject),
      inaccessibleSession,
      [message("user", "Inaccessible resolver")],
    );
    const realOpendir = fs.opendir.bind(fs);
    vi.spyOn(fs, "opendir").mockImplementation(async (directory, options) => {
      if (path.resolve(String(directory)) === path.resolve(inaccessibleHome)) {
        throw Object.assign(new Error("permission denied"), { code: "EACCES" });
      }
      return realOpendir(directory, options);
    });
    const inaccessibleService = createAgentSessionService({
      homeDir: inaccessibleHome,
      cursorRootDir: inaccessibleRoot,
    });
    await expect(
      inaccessibleService.list("cursor", { limit: 20 }),
    ).resolves.toMatchObject({
      sessions: [
        expect.objectContaining({
          projectLabel: "Projects-demo-app",
          projectPath: null,
        }),
      ],
    });
    vi.restoreAllMocks();

    const crowdedHome = await createHome();
    const crowdedRoot = path.join(crowdedHome, ".cursor");
    const crowdedProject = path.join(crowdedHome, "crowded-project");
    const crowdedSession = "15151515-1515-4151-8151-151515151515";
    await writeTranscript(
      crowdedRoot,
      cursorProjectKey(crowdedProject),
      crowdedSession,
      [message("user", "Crowded resolver")],
    );
    const crowdedHandle = {
      close: vi.fn().mockResolvedValue(undefined),
      async *[Symbol.asyncIterator]() {
        for (let index = 0; index <= 4_096; index += 1) {
          yield {
            name: `entry-${index}`,
            isDirectory: () => false,
            isSymbolicLink: () => false,
          };
        }
      },
    };
    vi.spyOn(fs, "opendir").mockResolvedValueOnce(crowdedHandle as never);
    const crowdedService = createAgentSessionService({
      homeDir: crowdedHome,
      cursorRootDir: crowdedRoot,
    });
    await expect(
      crowdedService.list("cursor", { limit: 20 }),
    ).resolves.toMatchObject({
      sessions: [
        expect.objectContaining({
          projectLabel: "crowded-project",
          projectPath: null,
        }),
      ],
    });
    vi.restoreAllMocks();

    const deepHome = await createHome();
    const deepRoot = path.join(deepHome, ".cursor");
    const deepProject = path.join(
      deepHome,
      ...Array.from({ length: 65 }, () => "a"),
    );
    await fs.mkdir(deepProject, { recursive: true });
    const deepSession = "16161616-1616-4161-8161-161616161616";
    await writeTranscript(
      deepRoot,
      cursorProjectKey(deepProject),
      deepSession,
      [message("user", "Deep resolver")],
    );
    const deepService = createAgentSessionService({
      homeDir: deepHome,
      cursorRootDir: deepRoot,
    });
    await expect(
      deepService.list("cursor", { limit: 20 }),
    ).resolves.toMatchObject({
      sessions: [expect.objectContaining({ projectPath: null })],
    });

    const homeProject = await createHome();
    const homeRoot = path.join(homeProject, ".cursor");
    const homeSession = "17171717-1717-4171-8171-171717171717";
    const homeKey = cursorProjectKey(homeProject);
    await writeTranscript(homeRoot, homeKey, homeSession, [
      message("user", "Home project"),
    ]);
    const trailingSession = "18181818-1818-4181-8181-181818181818";
    await writeTranscript(homeRoot, `${homeKey}-`, trailingSession, [
      message("user", "Trailing key"),
    ]);
    await fs.mkdir(
      path.join(homeRoot, "projects", "empty", "agent-transcripts"),
      { recursive: true },
    );
    const homeService = createAgentSessionService({
      homeDir: homeProject,
      cursorRootDir: homeRoot,
    });
    const homeSessions = await homeService.list("cursor", { limit: 20 });
    expect(homeSessions.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: homeSession,
          projectLabel: path.basename(homeProject),
          projectPath: homeProject,
        }),
        expect.objectContaining({
          id: trailingSession,
          projectLabel: `${homeKey}-`,
          projectPath: null,
        }),
      ]),
    );
  });

  it("reads bounded visible messages and hides tool records", async () => {
    const homeDir = await createHome();
    const cursorRootDir = path.join(homeDir, ".cursor");
    const sessionId = "22222222-2222-4222-8222-222222222222";
    const filePath = await writeTranscript(
      cursorRootDir,
      "project",
      sessionId,
      [
        message("user", "Visible request"),
        message("assistant", "Visible response"),
        message("system", "Hidden system prompt"),
        message("tool", "Hidden tool payload"),
        "{ malformed",
      ],
    );
    await fs.appendFile(filePath, `\n${"x".repeat(2 * 1024 * 1024)}`);

    const service = createAgentSessionService({ homeDir, cursorRootDir });
    const detail = await service.read("cursor", sessionId);

    expect(detail).toMatchObject({
      agentId: "cursor",
      adapter: "cursor-agent-transcript-v1",
      sessionId,
      parseErrors: 2,
      truncated: true,
    });
    expect(detail.entries.map((entry) => [entry.role, entry.text])).toEqual([
      ["user", "Visible request"],
      ["assistant", "Visible response"],
    ]);
    expect(detail.entries.join(" ")).not.toContain("Hidden");
  });

  it("skips symlinked transcript sources and does not create a missing root", async () => {
    const homeDir = await createHome();
    const cursorRootDir = path.join(homeDir, ".cursor");
    const external = path.join(homeDir, "outside.jsonl");
    await fs.writeFile(external, JSON.stringify(message("user", "outside")));
    const linkedProject = path.join(
      cursorRootDir,
      "projects",
      "linked-project",
    );
    await fs.mkdir(path.dirname(linkedProject), { recursive: true });
    await fs.symlink(path.dirname(external), linkedProject);

    const service = createAgentSessionService({ homeDir, cursorRootDir });
    await expect(service.list("cursor", { limit: 20 })).resolves.toMatchObject({
      sessions: [],
      total: 0,
    });

    const missingRoot = path.join(homeDir, "missing-cursor");
    const missingService = createAgentSessionService({
      homeDir,
      cursorRootDir: missingRoot,
    });
    await expect(
      missingService.list("cursor", { limit: 20 }),
    ).resolves.toMatchObject({
      sessions: [],
      total: 0,
    });
    await expect(fs.access(missingRoot)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("isolates missing, malformed, unsafe, and non-file transcript entries", async () => {
    const homeDir = await createHome();
    const cursorRootDir = path.join(homeDir, ".cursor");
    await fs.mkdir(cursorRootDir, { recursive: true });
    const service = createAgentSessionService({ homeDir, cursorRootDir });

    await expect(service.list("cursor", { limit: 20 })).resolves.toMatchObject({
      sessions: [],
      total: 0,
    });
    vi.spyOn(fs, "readdir").mockRejectedValueOnce(
      new Error("permission denied"),
    );
    await expect(service.list("cursor", { limit: 20 })).rejects.toThrow(
      "permission denied",
    );
    vi.restoreAllMocks();

    const projectRoot = path.join(cursorRootDir, "projects", "project");
    const transcriptRoot = path.join(projectRoot, "agent-transcripts");
    await fs.mkdir(transcriptRoot, { recursive: true });
    const assistantOnly = "33333333-3333-4333-8333-333333333333";
    const emptySession = "44444444-4444-4444-8444-444444444444";
    await writeTranscript(cursorRootDir, "project", assistantOnly, [
      { role: "assistant", content: "Flat assistant content" },
      { role: "user", message: { content: null } },
      { role: "unknown", message: { content: "hidden" } },
    ]);
    await writeTranscript(cursorRootDir, "project", emptySession, [
      message("tool", "not visible"),
    ]);

    const unsafe = path.join(transcriptRoot, "unsafe.id");
    await fs.mkdir(unsafe, { recursive: true });
    await fs.writeFile(path.join(unsafe, "unsafe.id.jsonl"), "{}");
    const nonFile = path.join(
      transcriptRoot,
      "55555555-5555-4555-8555-555555555555",
    );
    await fs.mkdir(nonFile, { recursive: true });
    await fs.mkdir(path.join(nonFile, `${path.basename(nonFile)}.jsonl`));
    const external = path.join(homeDir, "external-session.jsonl");
    await fs.writeFile(external, JSON.stringify(message("user", "outside")));
    const linkedSession = path.join(
      transcriptRoot,
      "66666666-6666-4666-8666-666666666666",
    );
    await fs.mkdir(linkedSession, { recursive: true });
    await fs.symlink(
      external,
      path.join(linkedSession, `${path.basename(linkedSession)}.jsonl`),
    );
    const linkedDirectory = path.join(
      transcriptRoot,
      "77777777-7777-4777-8777-777777777777",
    );
    await fs.symlink(path.dirname(external), linkedDirectory);

    const page = await service.list("cursor", { limit: 1 });
    expect(page.total).toBe(2);
    expect(page.hasMore).toBe(true);
    expect(page.sessions[0]).toMatchObject({
      id: expect.stringMatching(/^(3333|4444)/),
      title: expect.stringMatching(/^(3333|4444)/),
    });
    await expect(
      service.list("cursor", { limit: 20, search: "does-not-exist" }),
    ).resolves.toMatchObject({ sessions: [], total: 0, hasMore: false });

    const statRaceRoot = path.join(homeDir, "stat-race-cursor");
    await writeTranscript(statRaceRoot, "project", "stat-race", [
      message("user", "stat race"),
    ]);
    const statRaceService = createAgentSessionService({
      homeDir,
      cursorRootDir: statRaceRoot,
    });
    vi.spyOn(fs, "stat").mockResolvedValueOnce({
      isFile: () => false,
    } as never);
    await expect(
      statRaceService.list("cursor", { limit: 20 }),
    ).resolves.toMatchObject({ sessions: [], total: 0 });
  });

  it("uses id order for equal timestamps, tolerates metadata read races, and rejects unknown sessions", async () => {
    const homeDir = await createHome();
    const cursorRootDir = path.join(homeDir, ".cursor");
    const first = "88888888-8888-4888-8888-888888888888";
    const second = "99999999-9999-4999-8999-999999999999";
    const firstPath = await writeTranscript(cursorRootDir, "project", first, [
      message("user", "first"),
    ]);
    const secondPath = await writeTranscript(cursorRootDir, "project", second, [
      message("user", "second"),
    ]);
    const sameTime = new Date("2026-01-01T00:00:00.000Z");
    await fs.utimes(firstPath, sameTime, sameTime);
    await fs.utimes(secondPath, sameTime, sameTime);

    const service = createAgentSessionService({ homeDir, cursorRootDir });
    const page = await service.list("cursor", { limit: 20 });
    expect(page.sessions.map((session) => session.id)).toEqual([first, second]);

    vi.spyOn(fs, "open").mockRejectedValue(new Error("metadata race"));
    await expect(service.list("cursor", { limit: 20 })).resolves.toMatchObject({
      sessions: [],
      total: 2,
    });
    await expect(service.read("cursor", "missing-session")).rejects.toThrow(
      "AGENT_SESSION_NOT_FOUND",
    );
  });
});
