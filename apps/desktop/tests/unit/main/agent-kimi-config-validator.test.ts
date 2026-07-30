/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveMock, runMock } = vi.hoisted(() => ({
  resolveMock: vi.fn(),
  runMock: vi.fn(),
}));

vi.mock("../../../src/main/services/native-command", () => ({
  createNativeCommandRunner: () => ({
    resolve: resolveMock,
    run: runMock,
  }),
}));

import { validateKimiConfigFile } from "../../../src/main/services/agent-kimi-config-validator";

describe("Kimi native config validator", () => {
  beforeEach(() => {
    resolveMock.mockReset();
    runMock.mockReset();
  });

  it("skips validation when the official Kimi CLI is unavailable", async () => {
    resolveMock.mockResolvedValue(null);

    await expect(validateKimiConfigFile("/tmp/config.toml")).resolves.toBe(
      undefined,
    );
    expect(resolveMock).toHaveBeenCalledWith("kimi");
    expect(runMock).not.toHaveBeenCalled();
  });

  it("runs the official bounded doctor command without a shell", async () => {
    resolveMock.mockResolvedValue("/usr/local/bin/kimi");
    runMock.mockResolvedValue({ stdout: "", stderr: "" });

    await validateKimiConfigFile("/safe/config.toml");

    expect(runMock).toHaveBeenCalledWith(
      "/usr/local/bin/kimi",
      ["doctor", "config", "/safe/config.toml"],
      { timeout: 15_000, maxBuffer: 64 * 1024 },
    );
  });
});
