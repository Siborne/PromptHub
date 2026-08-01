import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const readFileMock = vi.fn();
const writeFileMock = vi.fn();
const listConfigFilesMock = vi.fn();
const readConfigFileMock = vi.fn();
const writeConfigFileMock = vi.fn();
const getBuiltinAgentOverrideMock = vi.fn();
const getPlatformRootDirMock = vi.fn();
const inspectAgentModelConfigMock = vi.fn();
const updateAgentModelConfigMock = vi.fn();
const resolveNativeCommandMock = vi.fn();
const runNativeCommandMock = vi.fn();
const launchAgentPlatformMock = vi.fn();

vi.mock("electron", () => ({
  app: { getPath: vi.fn(() => "/tmp/prompthub") },
  ipcMain: { handle: handleMock },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((value: string) => Buffer.from(value)),
    decryptString: vi.fn((value: Buffer) => value.toString("utf8")),
  },
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

vi.mock("../../../src/main/services/agent-user-config-files", () => ({
  createAgentUserConfigFileService: vi.fn(() => ({
    list: listConfigFilesMock,
    read: readConfigFileMock,
    write: writeConfigFileMock,
  })),
}));

vi.mock("../../../src/main/services/agent-model-config", () => ({
  inspectAgentModelConfig: inspectAgentModelConfigMock,
  updateAgentModelConfig: updateAgentModelConfigMock,
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
    listConfigFilesMock.mockReset();
    readConfigFileMock.mockReset();
    writeConfigFileMock.mockReset();
    getBuiltinAgentOverrideMock.mockReset();
    getPlatformRootDirMock.mockReset();
    inspectAgentModelConfigMock.mockReset();
    updateAgentModelConfigMock.mockReset();
    resolveNativeCommandMock.mockReset();
    runNativeCommandMock.mockReset();
    launchAgentPlatformMock.mockReset();
    getPlatformRootDirMock.mockImplementation((platform: { id: string }) =>
      platform.id === "kimi" ? "/Users/test/.kimi-code" : "/Users/test/.codex",
    );
    listConfigFilesMock.mockImplementation(
      (context: { relativePaths: string[] }) =>
        Promise.resolve(
          context.relativePaths.map((relativePath) => ({
            path: relativePath,
            isDirectory: false,
            size: 0,
          })),
        ),
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
    readConfigFileMock.mockResolvedValue({
      path: "config.toml",
      isDirectory: false,
      content: 'model = "gpt-5"',
      revision: "before",
    });
    writeConfigFileMock.mockResolvedValue({
      path: "config.toml",
      isDirectory: false,
      content: 'model = "gpt-5.1"',
      revision: "after",
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
      "before",
    );

    expect(readConfigFileMock).toHaveBeenCalledWith(
      {
        agentId: "codex",
        rootPath: "/Users/test/.codex",
        relativePaths: ["config.toml"],
      },
      "config.toml",
    );
    expect(writeConfigFileMock).toHaveBeenCalledWith(
      {
        agentId: "codex",
        rootPath: "/Users/test/.codex",
        relativePaths: ["config.toml"],
      },
      "config.toml",
      'model = "gpt-5.1"',
      "before",
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

  it("rejects unknown Agents and malformed write payloads", async () => {
    const { handlers, IPC_CHANNELS } = await setup();

    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILES_LIST](null, "missing"),
    ).rejects.toThrow("Unknown Agent platform");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILES_LIST](null, ""),
    ).rejects.toThrow("non-empty agentId");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE](
        null,
        "codex",
        "config.toml",
        { model: "gpt-5" },
      ),
    ).rejects.toThrow("content must be a string");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CONFIG_FILE_WRITE](
        null,
        "codex",
        "config.toml",
        'model = "gpt-5"',
        42,
      ),
    ).rejects.toThrow("revision must be a string");
    expect(readConfigFileMock).not.toHaveBeenCalled();
    expect(writeConfigFileMock).not.toHaveBeenCalled();
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
});
