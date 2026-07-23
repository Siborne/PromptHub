import { beforeEach, describe, expect, it, vi } from "vitest";

const handleMock = vi.fn();
const scanPlatformSkillsMock = vi.fn().mockResolvedValue({
  platform: { id: "claude", name: "Claude Code" },
  skillsDir: "/agents/claude/skills",
  scannedSkills: [],
});
const uninstallPlatformSkillMock = vi.fn().mockResolvedValue(undefined);
const getSupportedPlatformsMock = vi.fn().mockReturnValue([]);
const getPlatformRootDirMock = vi.fn();

vi.mock("electron", () => ({
  ipcMain: {
    handle: handleMock,
  },
}));

vi.mock("../../../src/main/services/skill-installer", () => ({
  SkillInstaller: {
    detectInstalledPlatforms: vi.fn().mockResolvedValue([]),
    getSupportedPlatforms: getSupportedPlatformsMock,
    scanPlatformSkills: scanPlatformSkillsMock,
    uninstallPlatformSkill: uninstallPlatformSkillMock,
  },
}));

vi.mock("../../../src/main/services/skill-installer-utils", () => ({
  getPlatformRootDir: getPlatformRootDirMock,
}));

vi.mock("../../../src/main/services/skill-safety-scan", () => ({
  scanSkillSafety: vi.fn(),
}));

vi.mock("../../../src/main/ipc/skill/shared", () => ({
  ensureLocalRepoPathBySkillId: vi.fn(),
}));

type RegisteredHandlers = Record<string, (...args: unknown[]) => unknown>;

async function setupPlatformIpc() {
  vi.resetModules();
  handleMock.mockReset();
  scanPlatformSkillsMock.mockClear();
  uninstallPlatformSkillMock.mockClear();
  getSupportedPlatformsMock.mockReset().mockReturnValue([]);
  getPlatformRootDirMock.mockReset();

  const [{ registerSkillPlatformHandlers }, { IPC_CHANNELS }] =
    await Promise.all([
      import("../../../src/main/ipc/skill/platform-handlers"),
      import("@prompthub/shared/constants/ipc-channels"),
    ]);

  registerSkillPlatformHandlers({
    db: {
      getById: vi.fn(),
      update: vi.fn(),
    },
  } as never);

  const handlers = Object.fromEntries(
    handleMock.mock.calls.map(([channel, handler]) => [channel, handler]),
  ) as RegisteredHandlers;

  return { handlers, IPC_CHANNELS };
}

describe("skill platform IPC", () => {
  beforeEach(() => {
    handleMock.mockReset();
    scanPlatformSkillsMock.mockClear();
    uninstallPlatformSkillMock.mockClear();
    getSupportedPlatformsMock.mockReset().mockReturnValue([]);
    getPlatformRootDirMock.mockReset();
  });

  it("projects the resolved native root for renderer Agent management", async () => {
    const kimi = {
      id: "kimi",
      name: "Kimi Code",
      rootDir: {
        darwin: "~/.kimi-code",
        win32: "%USERPROFILE%\\.kimi-code",
        linux: "~/.kimi-code",
      },
      skillsRelativePath: "skills",
    };
    const { handlers, IPC_CHANNELS } = await setupPlatformIpc();
    getSupportedPlatformsMock.mockReturnValue([kimi]);
    getPlatformRootDirMock.mockReturnValue("/Users/test/.kimi-code");

    await expect(
      handlers[IPC_CHANNELS.SKILL_GET_SUPPORTED_PLATFORMS](),
    ).resolves.toEqual([
      { ...kimi, resolvedRootPath: "/Users/test/.kimi-code" },
    ]);
    expect(getPlatformRootDirMock).toHaveBeenCalledWith(kimi);
  });

  it("scans agent/platform skills through the unified platform scan handler", async () => {
    const { handlers, IPC_CHANNELS } = await setupPlatformIpc();

    await expect(
      handlers[IPC_CHANNELS.SKILL_SCAN_PLATFORM_SKILLS](null, "claude"),
    ).resolves.toEqual(
      expect.objectContaining({
        skillsDir: "/agents/claude/skills",
      }),
    );

    expect(scanPlatformSkillsMock).toHaveBeenCalledWith("claude");
  });

  it("rejects malformed platform scan and uninstall requests before service calls", async () => {
    const { handlers, IPC_CHANNELS } = await setupPlatformIpc();

    await expect(
      handlers[IPC_CHANNELS.SKILL_SCAN_PLATFORM_SKILLS](null, ""),
    ).rejects.toThrow(/non-empty platformId/);
    await expect(
      handlers[IPC_CHANNELS.SKILL_UNINSTALL_PLATFORM_SKILL](null, "claude", ""),
    ).rejects.toThrow(/non-empty platformSkillPath/);

    expect(scanPlatformSkillsMock).not.toHaveBeenCalled();
    expect(uninstallPlatformSkillMock).not.toHaveBeenCalled();
  });

  it("uninstalls an arbitrary scanned agent skill without requiring a DB skill id", async () => {
    const { handlers, IPC_CHANNELS } = await setupPlatformIpc();

    await expect(
      handlers[IPC_CHANNELS.SKILL_UNINSTALL_PLATFORM_SKILL](
        null,
        "claude",
        "/agents/claude/skills/copy-skill",
      ),
    ).resolves.toBeUndefined();

    expect(uninstallPlatformSkillMock).toHaveBeenCalledWith(
      "claude",
      "/agents/claude/skills/copy-skill",
    );
  });
});
