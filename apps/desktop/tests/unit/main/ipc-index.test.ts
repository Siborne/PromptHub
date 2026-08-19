/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IPC_CHANNELS } from "@prompthub/shared/constants/ipc-channels";
import { ipcMain } from "electron";

const ipcMocks = vi.hoisted(() => {
  const registered = new Set<string>();
  return {
    registered,
    handle: vi.fn((channel: string) => {
      if (registered.has(channel)) {
        throw new Error(
          `Attempted to register a second handler for '${channel}'`,
        );
      }
      registered.add(channel);
    }),
    removeHandler: vi.fn((channel: string) => {
      registered.delete(channel);
    }),
  };
});

const registerPromptIPCMock = vi.fn();
const registerFolderIPCMock = vi.fn();
const registerSettingsIPCMock = vi.fn();
const registerImageIPCMock = vi.fn();
const registerRulesIPCMock = vi.fn();
const registerSkillIPCMock = vi.fn();
const registerAIIPCMock = vi.fn();
const registerSecurityIPCMock = vi.fn();
const registerBackupIPCMock = vi.fn();
const registerMcpIPCMock = vi.fn();
const registerPluginIPCMock = vi.fn();

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/prompthub-ipc-test"),
    getVersion: vi.fn(() => "0.5.9-test"),
    once: vi.fn(),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn(() => Buffer.from("encrypted")),
    decryptString: vi.fn(() => "token"),
  },
  ipcMain: {
    removeHandler: ipcMocks.removeHandler,
    handle: ipcMocks.handle,
  },
}));

vi.mock("../../../src/main/ipc/prompt.ipc", () => ({
  registerPromptIPC: registerPromptIPCMock,
}));
vi.mock("../../../src/main/ipc/folder.ipc", () => ({
  registerFolderIPC: registerFolderIPCMock,
}));
vi.mock("../../../src/main/ipc/settings.ipc", () => ({
  registerSettingsIPC: registerSettingsIPCMock,
}));
vi.mock("../../../src/main/ipc/image.ipc", () => ({
  registerImageIPC: registerImageIPCMock,
}));
vi.mock("../../../src/main/ipc/rules.ipc", () => ({
  registerRulesIPC: registerRulesIPCMock,
}));
vi.mock("../../../src/main/ipc/skill.ipc", () => ({
  registerSkillIPC: registerSkillIPCMock,
}));
vi.mock("../../../src/main/ipc/ai.ipc", () => ({
  registerAIIPC: registerAIIPCMock,
}));
vi.mock("../../../src/main/ipc/security.ipc", () => ({
  registerSecurityIPC: registerSecurityIPCMock,
}));
vi.mock("../../../src/main/ipc/backup.ipc", () => ({
  registerBackupIPC: registerBackupIPCMock,
}));
vi.mock("../../../src/main/ipc/mcp.ipc", () => ({
  registerMcpIPC: registerMcpIPCMock,
}));
vi.mock("../../../src/main/ipc/plugin.ipc", () => ({
  registerPluginIPC: registerPluginIPCMock,
}));

describe("ipc index registration order", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ipcMocks.registered.clear();
    registerPromptIPCMock.mockReset();
    registerSkillIPCMock.mockReset();
  });

  it("registers rules handlers before skill handlers", async () => {
    const { registerAllIPC } = await import("../../../src/main/ipc/index");

    registerAllIPC({} as never, vi.fn());

    const rulesOrder = registerRulesIPCMock.mock.invocationCallOrder[0];
    const skillOrder = registerSkillIPCMock.mock.invocationCallOrder[0];

    expect(rulesOrder).toBeLessThan(skillOrder);
  });

  it("rebinds handlers registered by both direct and nested domain modules", async () => {
    registerPromptIPCMock.mockImplementation(() => {
      ipcMain.handle(IPC_CHANNELS.PROMPT_GET_ALL_META, vi.fn());
    });
    registerSkillIPCMock.mockImplementation(() => {
      ipcMain.handle(IPC_CHANNELS.SKILL_SCAN_PLATFORM_SKILLS, vi.fn());
    });
    const { registerAllIPC } = await import("../../../src/main/ipc/index");

    registerAllIPC({} as never, vi.fn());
    expect(() => registerAllIPC({} as never, vi.fn())).not.toThrow();

    expect(ipcMocks.removeHandler).toHaveBeenCalledWith(
      IPC_CHANNELS.PROMPT_GET_ALL_META,
    );
    expect(ipcMocks.removeHandler).toHaveBeenCalledWith(
      IPC_CHANNELS.SKILL_SCAN_PLATFORM_SKILLS,
    );
    for (const channel of [
      IPC_CHANNELS.PROMPT_GET_ALL_META,
      IPC_CHANNELS.SKILL_SCAN_PLATFORM_SKILLS,
    ]) {
      expect(
        ipcMocks.handle.mock.calls.filter(
          ([registered]) => registered === channel,
        ),
      ).toHaveLength(2);
    }
  });

  it("removes handlers captured by a failed partial registration", async () => {
    registerPromptIPCMock.mockImplementationOnce(() => {
      ipcMain.handle(IPC_CHANNELS.PROMPT_GET_ALL_META, vi.fn());
      throw new Error("registration failed");
    });
    const { registerAllIPC } = await import("../../../src/main/ipc/index");

    expect(() => registerAllIPC({} as never, vi.fn())).toThrow(
      "registration failed",
    );
    expect(ipcMocks.registered.has(IPC_CHANNELS.PROMPT_GET_ALL_META)).toBe(
      false,
    );

    registerPromptIPCMock.mockImplementation(() => {
      ipcMain.handle(IPC_CHANNELS.PROMPT_GET_ALL_META, vi.fn());
    });
    expect(() => registerAllIPC({} as never, vi.fn())).not.toThrow();
  });
});
