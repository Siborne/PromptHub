import { describe, expect, it, vi } from "vitest";

import { configureE2ESecretStorage } from "../../../src/main/testing/e2e-secret-storage";

function storage(available: boolean) {
  return {
    isEncryptionAvailable: vi.fn(() => available),
    setUsePlainTextEncryption: vi.fn(),
  };
}

describe("E2E secret storage", () => {
  it("enables Electron's test fallback only for Linux E2E without a keyring", () => {
    const linuxE2E = storage(false);
    expect(
      configureE2ESecretStorage(linuxE2E, "linux", {
        PROMPTHUB_E2E: "1",
      }),
    ).toBe(true);
    expect(linuxE2E.setUsePlainTextEncryption).toHaveBeenCalledWith(true);

    for (const [platform, env, available] of [
      ["linux", {}, false],
      ["darwin", { PROMPTHUB_E2E: "1" }, false],
      ["win32", { PROMPTHUB_E2E: "1" }, false],
      ["linux", { PROMPTHUB_E2E: "1" }, true],
    ] as const) {
      const candidate = storage(available);
      expect(
        configureE2ESecretStorage(candidate, platform, env),
      ).toBe(false);
      expect(candidate.setUsePlainTextEncryption).not.toHaveBeenCalled();
    }
  });
});
