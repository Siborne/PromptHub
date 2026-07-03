import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { installCli } from "../../../src/main/services/cli-installer";

describe("cli-installer", () => {
  beforeEach(() => {
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
          command === "pnpm" &&
          Array.isArray(args) &&
          args.includes("add"),
      ),
    ).toBe(false);
  });
});
