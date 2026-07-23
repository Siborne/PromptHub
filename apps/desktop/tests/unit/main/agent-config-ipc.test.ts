import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const readFileMock = vi.fn();
const writeFileMock = vi.fn();
const getBuiltinAgentOverrideMock = vi.fn();
const getPlatformRootDirMock = vi.fn();
const inspectAgentModelConfigMock = vi.fn();
const updateAgentModelConfigMock = vi.fn();
const listSessionsMock = vi.fn();
const readSessionMock = vi.fn();
const createSessionServiceMock = vi.fn(() => ({
  list: listSessionsMock,
  read: readSessionMock,
}));
const resolveNativeCommandMock = vi.fn();
const runNativeCommandMock = vi.fn();
const launchAgentPlatformMock = vi.fn();

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/prompthub") },
  ipcMain: { handle: handleMock },
  shell: { openPath: vi.fn() },
}));

vi.mock("../../../src/main/services/skill-installer", () => ({
  SkillInstaller: {
    getSupportedPlatforms: vi.fn(() => [
      {
        id: "codex",
        name: "Codex CLI",
        icon: "Terminal",
        rootDir: {
          darwin: "~/.codex",
          win32: "%USERPROFILE%\\.codex",
          linux: "~/.codex",
        },
        skillsRelativePath: "skills",
        configFiles: ["config.toml"],
        launchPaths: { darwin: ["/Applications/Codex.app"] },
      },
      {
        id: "kimi",
        name: "Kimi Code",
        icon: "Sparkles",
        rootDir: {
          darwin: "~/.kimi-code",
          win32: "%USERPROFILE%\\.kimi-code",
          linux: "~/.kimi-code",
        },
        skillsRelativePath: "skills",
        configFiles: ["config.toml", "tui.toml", "mcp.json"],
      },
    ]),
    readLocalRepoFileByPath: readFileMock,
    writeLocalRepoFileByPath: writeFileMock,
  },
}));

vi.mock("../../../src/main/services/skill-installer-utils", () => ({
  getBuiltinAgentOverride: getBuiltinAgentOverrideMock,
  getPlatformRootDir: getPlatformRootDirMock,
}));

vi.mock("../../../src/main/services/agent-model-config", () => ({
  inspectAgentModelConfig: inspectAgentModelConfigMock,
  updateAgentModelConfig: updateAgentModelConfigMock,
}));

vi.mock("../../../src/main/services/agent-session-service", () => ({
  createAgentSessionService: createSessionServiceMock,
}));

vi.mock("../../../src/main/services/native-command", () => ({
  createNativeCommandRunner: vi.fn(() => ({
    resolve: resolveNativeCommandMock,
    run: runNativeCommandMock,
  })),
}));

vi.mock("../../../src/main/services/agent-launch-service", () => ({
  launchAgentPlatform: launchAgentPlatformMock,
}));

type Handler = (...args: unknown[]) => Promise<unknown>;

async function setup() {
  vi.resetModules();
  handleMock.mockReset();
  const [{ registerAgentIPC }, { IPC_CHANNELS }] = await Promise.all([
    import("../../../src/main/ipc/agent.ipc"),
    import("@prompthub/shared/constants/ipc-channels"),
  ]);
  registerAgentIPC();
  return {
    IPC_CHANNELS,
    handlers: Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>,
  };
}

describe("Agent config file IPC", () => {
  beforeEach(() => {
    readFileMock.mockReset();
    writeFileMock.mockReset();
    getBuiltinAgentOverrideMock.mockReset();
    getPlatformRootDirMock.mockReset();
    inspectAgentModelConfigMock.mockReset();
    updateAgentModelConfigMock.mockReset();
    listSessionsMock.mockReset();
    readSessionMock.mockReset();
    createSessionServiceMock.mockClear();
    resolveNativeCommandMock.mockReset();
    runNativeCommandMock.mockReset();
    launchAgentPlatformMock.mockReset();
    getPlatformRootDirMock.mockImplementation((platform: { id: string }) =>
      platform.id === "kimi" ? "/Users/test/.kimi-code" : "/Users/test/.codex",
    );
  });

  it("launches only a known Agent through its platform allowlist", async () => {
    launchAgentPlatformMock.mockResolvedValue({ success: true });
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_LAUNCH](null, "codex"),
    ).resolves.toEqual({ success: true });
    expect(launchAgentPlatformMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: "codex" }),
      expect.objectContaining({ platform: process.platform }),
    );
    await expect(
      handlers[IPC_CHANNELS.AGENT_LAUNCH](null, "missing"),
    ).resolves.toEqual({ success: false, errorCode: "unsupported" });
  });

  it("lists, reads and writes only declared native config files", async () => {
    readFileMock.mockResolvedValue({
      path: "config.toml",
      isDirectory: false,
      content: 'model = "gpt-5"',
    });
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILES_LIST](null, "codex"),
    ).resolves.toEqual([{ path: "config.toml", isDirectory: false, size: 0 }]);
    await handlers[IPC_CHANNELS.AGENT_CONFIG_FILE_READ](
      null,
      "codex",
      "config.toml",
    );
    await handlers[IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE](
      null,
      "codex",
      "config.toml",
      'model = "gpt-5.1"',
    );

    expect(readFileMock).toHaveBeenCalledWith(
      "/Users/test/.codex",
      "config.toml",
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      "/Users/test/.codex",
      "config.toml",
      'model = "gpt-5.1"',
    );
  });

  it("honors normalized user overrides without exposing undeclared siblings", async () => {
    getBuiltinAgentOverrideMock.mockReturnValue({
      configRelativePaths: [
        " profiles\\work.config.toml ",
        "profiles/work.config.toml",
      ],
    });
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILES_LIST](null, "codex"),
    ).resolves.toEqual([
      {
        path: "profiles/work.config.toml",
        isDirectory: false,
        size: 0,
      },
    ]);
  });

  it("rejects unknown Agents, non-allowlisted paths and non-text writes", async () => {
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILES_LIST](null, "missing"),
    ).rejects.toThrow("Unknown Agent platform");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILES_LIST](null, ""),
    ).rejects.toThrow("non-empty agentId");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILE_READ](null, "codex", "auth.json"),
    ).rejects.toThrow("not allowlisted");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILE_READ](
        null,
        "codex",
        "../auth.json",
      ),
    ).rejects.toThrow("not allowlisted");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE](
        null,
        "codex",
        "config.toml",
        { model: "gpt-5" },
      ),
    ).rejects.toThrow("content must be a string");
    expect(readFileMock).not.toHaveBeenCalled();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("reads and updates only non-secret model settings through the validated Agent root", async () => {
    inspectAgentModelConfigMock.mockResolvedValue({
      agentId: "codex",
      model: "gpt-5.1",
    });
    updateAgentModelConfigMock.mockResolvedValue({
      agentId: "codex",
      model: "gpt-5.2",
      backupPath: "/tmp/prompthub/agent-config-backups/codex/config.toml",
    });
    const { handlers, IPC_CHANNELS } = await setup();

    await handlers[IPC_CHANNELS.AGENT_MODEL_CONFIG_GET](null, "codex");
    await handlers[IPC_CHANNELS.AGENT_MODEL_CONFIG_SET](null, {
      agentId: "codex",
      model: "gpt-5.2",
    });

    expect(inspectAgentModelConfigMock).toHaveBeenCalledWith({
      agentId: "codex",
      rootPath: "/Users/test/.codex",
    });
    expect(updateAgentModelConfigMock).toHaveBeenCalledWith(
      {
        agentId: "codex",
        rootPath: "/Users/test/.codex",
        model: "gpt-5.2",
        secondaryModel: undefined,
      },
      { backupRoot: "/tmp/prompthub/agent-config-backups" },
    );
  });

  it("rejects malformed model updates before touching native configuration", async () => {
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_MODEL_CONFIG_SET](null, null),
    ).rejects.toThrow("object payload");
    await expect(
      handlers[IPC_CHANNELS.AGENT_MODEL_CONFIG_SET](null, {
        agentId: "codex",
        model: 5,
      }),
    ).rejects.toThrow("agentId and model strings");
    await expect(
      handlers[IPC_CHANNELS.AGENT_MODEL_CONFIG_SET](null, {
        agentId: "codex",
        model: "gpt-5",
        secondaryModel: {},
      }),
    ).rejects.toThrow("secondaryModel");
    expect(updateAgentModelConfigMock).not.toHaveBeenCalled();
  });

  it("runs Kimi's native doctor against the written config when available", async () => {
    resolveNativeCommandMock.mockResolvedValue("/usr/local/bin/kimi");
    runNativeCommandMock.mockResolvedValue({ stdout: "", stderr: "" });
    updateAgentModelConfigMock.mockImplementation(async (_context, options) => {
      await options.validateNativeConfig(
        "kimi",
        "/Users/test/.kimi-code/config.toml",
      );
      return { agentId: "kimi", model: "kimi-code/kimi-for-coding" };
    });
    const { handlers, IPC_CHANNELS } = await setup();

    await handlers[IPC_CHANNELS.AGENT_MODEL_CONFIG_SET](null, {
      agentId: "kimi",
      model: "kimi-code/kimi-for-coding",
    });

    expect(runNativeCommandMock).toHaveBeenCalledWith(
      "/usr/local/bin/kimi",
      ["doctor", "config", "/Users/test/.kimi-code/config.toml"],
      { timeout: 15_000, maxBuffer: 64 * 1024 },
    );
  });

  it("validates and delegates bounded session list and read requests", async () => {
    listSessionsMock.mockResolvedValue({ sessions: [] });
    readSessionMock.mockResolvedValue({ entries: [] });
    const { handlers, IPC_CHANNELS } = await setup();

    await handlers[IPC_CHANNELS.AGENT_SESSIONS_LIST](null, "codex", 50, 100);
    await handlers[IPC_CHANNELS.AGENT_SESSION_READ](null, "codex", "session-1");

    expect(createSessionServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        codexRootDir: "/Users/test/.codex",
      }),
    );
    expect(listSessionsMock).toHaveBeenCalledWith("codex", {
      limit: 50,
      offset: 100,
    });
    expect(readSessionMock).toHaveBeenCalledWith("codex", "session-1");
    await expect(
      handlers[IPC_CHANNELS.AGENT_SESSIONS_LIST](null, "codex", "100"),
    ).rejects.toThrow("numeric limit");
    await expect(
      handlers[IPC_CHANNELS.AGENT_SESSIONS_LIST](null, "codex", 50, -1),
    ).rejects.toThrow("numeric offset");
    await expect(
      handlers[IPC_CHANNELS.AGENT_SESSION_READ](null, "codex", null),
    ).rejects.toThrow("sessionId strings");
  });

  it("binds Kimi session reads to its resolved generation root", async () => {
    listSessionsMock.mockResolvedValue({ sessions: [] });
    const { handlers, IPC_CHANNELS } = await setup();

    await handlers[IPC_CHANNELS.AGENT_SESSIONS_LIST](null, "kimi", 20);

    expect(createSessionServiceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kimiRootDir: "/Users/test/.kimi-code",
      }),
    );
  });
});
