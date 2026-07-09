import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getVersion: () => "0.5.9-beta.2",
  },
}));

vi.mock("node:child_process", () => ({
  default: {
    execFile: execFileMock,
  },
  execFile: execFileMock,
}));

import {
  getCliStatus,
  installCli,
} from "../../../src/main/services/cli-installer";

const originalPlatform = process.platform;

function mockPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", {
    value: platform,
    configurable: true,
  });
}

describe("cli-installer", () => {
  beforeEach(() => {
    mockPlatform(originalPlatform);
    execFileMock.mockReset();
    execFileMock.mockImplementation(
      (
        _command: string,
        _args: string[],
        _options: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        callback(new Error("command not found"), "", "");
      },
    );
  });

  afterEach(() => {
    mockPlatform(originalPlatform);
  });

  it("does not run the install command when the requested package manager is not on PATH", async () => {
    const result = await installCli("pnpm");

    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        method: "pnpm",
        error: "CLI_PACKAGE_MANAGER_NOT_FOUND",
      }),
    );
    expect(
      execFileMock.mock.calls.some(
        ([command, args]) =>
          command === "pnpm" && Array.isArray(args) && args.includes("add"),
      ),
    ).toBe(false);
  });

  it("includes manual install commands even when no package manager is detected", async () => {
    const status = await getCliStatus();

    expect(status.packageManager).toBeNull();
    expect(status.installCommand).toBeNull();
    expect(status.manualInstallCommands).toEqual({
      pnpm: "pnpm add -g https://github.com/legeling/PromptHub/releases/download/v0.5.9-beta.2/prompthub-cli-0.5.9-beta.2.tgz",
      npm: "npm install -g https://github.com/legeling/PromptHub/releases/download/v0.5.9-beta.2/prompthub-cli-0.5.9-beta.2.tgz",
    });
  });

  it("detects pnpm from the user's login shell when the app PATH is incomplete", async () => {
    execFileMock.mockImplementation(
      (
        command: string,
        args: string[],
        _options: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        if (
          command === "pnpm" ||
          command === "npm" ||
          command === "prompthub"
        ) {
          callback(new Error("command not found"), "", "");
          return;
        }
        if (args.join(" ") === "-lc command -v pnpm") {
          callback(null, "/Users/demo/.local/share/pnpm/pnpm\n", "");
          return;
        }
        if (command === "/Users/demo/.local/share/pnpm/pnpm") {
          callback(null, "9.15.0\n", "");
          return;
        }
        callback(new Error("command not found"), "", "");
      },
    );

    const status = await getCliStatus();

    expect(status.packageManager).toBe("pnpm");
    expect(status.packageManagerVersion).toBe("9.15.0");
    expect(status.packageManagerPath).toBe(
      "/Users/demo/.local/share/pnpm/pnpm",
    );
    expect(status.packageManagerPathSource).toBe("login-shell");
  });

  it("detects the Windows CLI from a custom npm prefix when the app PATH is incomplete", async () => {
    mockPlatform("win32");
    execFileMock.mockImplementation(
      (
        command: string,
        args: string[],
        _options: unknown,
        callback: (error: Error | null, stdout: string, stderr: string) => void,
      ) => {
        if (command === "prompthub" || command === "pnpm") {
          callback(new Error("command not found"), "", "");
          return;
        }
        if (command === "where.exe" && args[0] === "prompthub") {
          callback(new Error("INFO: Could not find files"), "", "");
          return;
        }
        if (command === "npm" && args.join(" ") === "--version") {
          callback(null, "10.8.2\n", "");
          return;
        }
        if (command === "npm" && args.join(" ") === "config get prefix") {
          callback(null, "D:\\npm-global\n", "");
          return;
        }
        if (command === "D:\\npm-global\\prompthub.cmd") {
          callback(null, "0.5.8-beta.3\n", "");
          return;
        }
        callback(new Error("command not found"), "", "");
      },
    );

    const status = await getCliStatus();

    expect(status.installed).toBe(true);
    expect(status.version).toBe("0.5.8-beta.3");
  });
});
