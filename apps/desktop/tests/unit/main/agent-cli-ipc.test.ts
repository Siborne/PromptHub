import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const diagnoseAgentCliMock = vi.fn();
const resolveMock = vi.fn();
const runMock = vi.fn();

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
        name: "Codex",
        icon: "Terminal",
        rootDir: {
          darwin: "~/.codex",
          win32: "%USERPROFILE%\\.codex",
          linux: "~/.codex",
        },
        skillsRelativePath: "skills",
        configFiles: ["config.toml"],
        cli: {
          executableCandidates: ["codex"],
          versionArgs: ["--version"],
          evidence: "official-codex-cli",
        },
      },
    ]),
  },
}));

vi.mock("../../../src/main/services/native-command", () => ({
  createNativeCommandRunner: vi.fn(() => ({
    resolve: resolveMock,
    run: runMock,
  })),
}));

vi.mock("../../../src/main/services/agent-cli-diagnostic-service", () => ({
  diagnoseAgentCli: diagnoseAgentCliMock,
}));

type Handler = (...args: unknown[]) => Promise<unknown>;

describe("Agent CLI diagnostic IPC", () => {
  beforeEach(() => {
    handleMock.mockReset();
    diagnoseAgentCliMock.mockReset();
    resolveMock.mockReset();
    runMock.mockReset();
  });

  it("diagnoses only a known Agent using main-owned command dependencies", async () => {
    diagnoseAgentCliMock.mockResolvedValue({
      agentId: "codex",
      status: "installed",
      executablePath: "/usr/local/bin/codex",
      version: "codex-cli 0.137.0",
      installSource: "system",
      errorCode: null,
      checkedAt: 1_700_000_000_000,
    });
    const [{ registerAgentIPC }, { IPC_CHANNELS }] = await Promise.all([
      import("../../../src/main/ipc/agent.ipc"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);
    registerAgentIPC();
    const handlers = Object.fromEntries(
      handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
    ) as Record<string, Handler>;

    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_DIAGNOSE](null, "codex"),
    ).resolves.toMatchObject({
      agentId: "codex",
      status: "installed",
    });
    expect(diagnoseAgentCliMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "codex",
        cli: expect.objectContaining({
          executableCandidates: ["codex"],
        }),
      }),
      expect.objectContaining({
        now: expect.any(Function),
        resolve: resolveMock,
        run: runMock,
      }),
    );
    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_DIAGNOSE](null, "missing"),
    ).rejects.toThrow("Unknown Agent platform");
    await expect(
      handlers[IPC_CHANNELS.AGENT_CLI_DIAGNOSE](null, {
        command: "rm -rf /",
      }),
    ).rejects.toThrow("non-empty agentId");
  });
});
