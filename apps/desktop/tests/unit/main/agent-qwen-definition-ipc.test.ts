import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const getAgentConfigContextMock = vi.fn();
const listDefinitionsMock = vi.fn();
const resolvePathMock = vi.fn();
const openPathMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: { handle: handleMock },
  shell: { openPath: openPathMock },
}));

vi.mock("../../../src/main/services/agent-platform-context", () => ({
  getAgentConfigContext: getAgentConfigContextMock,
}));

vi.mock("../../../src/main/services/agent-qwen-definition-service", () => ({
  listQwenDefinitions: listDefinitionsMock,
  resolveQwenDefinitionPath: resolvePathMock,
}));

type Handler = (...args: unknown[]) => Promise<unknown>;

function database(settings: Record<string, unknown>) {
  return {
    prepare: vi.fn(() => ({
      get: vi.fn((key: string) =>
        key in settings ? { value: JSON.stringify(settings[key]) } : undefined,
      ),
    })),
  };
}

async function setup(db = database({})) {
  vi.resetModules();
  handleMock.mockReset();
  const [{ registerAgentQwenDefinitionIPC }, { IPC_CHANNELS }] =
    await Promise.all([
      import("../../../src/main/ipc/agent-qwen-definition.ipc"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
  registerAgentQwenDefinitionIPC(db as never);
  return {
    IPC_CHANNELS,
    handlers: Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>,
  };
}

describe("Qwen definition IPC", () => {
  beforeEach(() => {
    getAgentConfigContextMock.mockReset();
    listDefinitionsMock.mockReset();
    resolvePathMock.mockReset();
    openPathMock.mockReset();
    getAgentConfigContextMock.mockReturnValue({ rootPath: "/home/test/.qwen" });
    listDefinitionsMock.mockResolvedValue({
      agentId: "qwen",
      scope: "user",
      entries: [],
      truncated: false,
      visitedEntries: 0,
      readBytes: 0,
      skippedSymlinks: 0,
      skippedUnsafe: 0,
    });
    resolvePathMock.mockResolvedValue("/home/test/.qwen/commands/review.md");
    openPathMock.mockResolvedValue("");
  });

  it("resolves user definitions only from the canonical Qwen root", async () => {
    const { handlers, IPC_CHANNELS } = await setup();

    await handlers[IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
      agentId: "qwen",
      scope: "user",
    });

    expect(getAgentConfigContextMock).toHaveBeenCalledWith("qwen");
    expect(listDefinitionsMock).toHaveBeenCalledWith({
      rootPath: "/home/test/.qwen",
      scope: "user",
    });
  });

  it("resolves project roots by durable project id instead of renderer paths", async () => {
    const db = database({
      skillProjects: [
        {
          id: "project-1",
          name: "Workbench",
          rootPath: "/work/project",
          scanPaths: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const { handlers, IPC_CHANNELS } = await setup(db);

    await handlers[IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
      agentId: "qwen",
      scope: "project",
      projectId: "project-1",
    });

    expect(getAgentConfigContextMock).not.toHaveBeenCalled();
    expect(listDefinitionsMock).toHaveBeenCalledWith({
      rootPath: "/work/project",
      scope: "project",
    });
  });

  it("rejects unknown Agents, arbitrary fields and unknown projects before scanning", async () => {
    const { handlers, IPC_CHANNELS } = await setup(
      database({ skillProjects: [] }),
    );

    await expect(
      handlers[IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
        agentId: "codex",
        scope: "user",
      }),
    ).rejects.toThrow("AGENT_DEFINITION_REQUEST_INVALID");
    await expect(
      handlers[IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
        agentId: "qwen",
        scope: "project",
        projectId: "missing",
        rootPath: "/attacker",
      }),
    ).rejects.toThrow("AGENT_DEFINITION_REQUEST_INVALID");
    await expect(
      handlers[IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
        agentId: "qwen",
        scope: "project",
        projectId: "missing",
      }),
    ).rejects.toThrow("AGENT_DEFINITION_PROJECT_NOT_FOUND");
    expect(listDefinitionsMock).not.toHaveBeenCalled();
  });

  it("rejects malformed list and open requests at the IPC boundary", async () => {
    const { handlers, IPC_CHANNELS } = await setup();
    const listHandler = handlers[IPC_CHANNELS.AGENT_DEFINITIONS_LIST];
    const openHandler = handlers[IPC_CHANNELS.AGENT_DEFINITION_OPEN];

    for (const request of [
      null,
      [],
      { agentId: "qwen", scope: "user", projectId: "unexpected" },
      { agentId: "qwen", scope: "project", projectId: "" },
      { agentId: "qwen", scope: "project", projectId: "x".repeat(257) },
      { agentId: "qwen", scope: "project", projectId: "bad\nid" },
    ]) {
      await expect(listHandler(null, request)).rejects.toThrow(
        "AGENT_DEFINITION_REQUEST_INVALID",
      );
    }
    for (const request of [
      null,
      [],
      {
        agentId: "qwen",
        scope: "user",
        kind: "unknown",
        relativePath: "x.md",
      },
      {
        agentId: "qwen",
        scope: "user",
        kind: "command",
        relativePath: 1,
      },
      {
        agentId: "qwen",
        scope: "user",
        kind: "command",
        relativePath: "x.md",
        arbitrary: true,
      },
    ]) {
      await expect(openHandler(null, request)).rejects.toThrow(
        "AGENT_DEFINITION_REQUEST_INVALID",
      );
    }
  });

  it("fails closed when the project settings payload cannot be trusted", async () => {
    let context = await setup(database({}));
    await expect(
      context.handlers[context.IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
        agentId: "qwen",
        scope: "project",
        projectId: "project-1",
      }),
    ).rejects.toThrow("AGENT_DEFINITION_PROJECT_NOT_FOUND");

    const malformedDatabase = {
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ value: "{" })),
      })),
    };
    context = await setup(malformedDatabase as never);
    await expect(
      context.handlers[context.IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
        agentId: "qwen",
        scope: "project",
        projectId: "project-1",
      }),
    ).rejects.toThrow("AGENT_DEFINITION_PROJECT_NOT_FOUND");

    const objectDatabase = {
      prepare: vi.fn(() => ({
        get: vi.fn(() => ({ value: "{}" })),
      })),
    };
    context = await setup(objectDatabase as never);
    await expect(
      context.handlers[context.IPC_CHANNELS.AGENT_DEFINITIONS_LIST](null, {
        agentId: "qwen",
        scope: "project",
        projectId: "project-1",
      }),
    ).rejects.toThrow("AGENT_DEFINITION_PROJECT_NOT_FOUND");
  });

  it("revalidates the selected relative path in main before opening", async () => {
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_DEFINITION_OPEN](null, {
        agentId: "qwen",
        scope: "user",
        kind: "command",
        relativePath: "review.md",
      }),
    ).resolves.toEqual({ opened: true });

    expect(resolvePathMock).toHaveBeenCalledWith({
      rootPath: "/home/test/.qwen",
      scope: "user",
      kind: "command",
      relativePath: "review.md",
    });
    expect(openPathMock).toHaveBeenCalledWith(
      "/home/test/.qwen/commands/review.md",
    );
  });

  it("opens project definitions using the registered project id", async () => {
    const db = database({
      skillProjects: [
        {
          id: "project-1",
          name: "Workbench",
          rootPath: "/work/project",
          scanPaths: [],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });
    const { handlers, IPC_CHANNELS } = await setup(db);

    await handlers[IPC_CHANNELS.AGENT_DEFINITION_OPEN](null, {
      agentId: "qwen",
      scope: "project",
      projectId: "project-1",
      kind: "command",
      relativePath: "review.md",
    });

    expect(resolvePathMock).toHaveBeenCalledWith({
      rootPath: "/work/project",
      scope: "project",
      kind: "command",
      relativePath: "review.md",
    });
  });

  it("returns a stable failure when the OS refuses to open the file", async () => {
    openPathMock.mockResolvedValue("No application");
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_DEFINITION_OPEN](null, {
        agentId: "qwen",
        scope: "user",
        kind: "subagent",
        relativePath: "reviewer.md",
      }),
    ).rejects.toThrow("AGENT_DEFINITION_OPEN_FAILED");
  });
});
