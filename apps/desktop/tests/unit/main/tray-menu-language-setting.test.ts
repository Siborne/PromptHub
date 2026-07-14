/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import { readLanguageSetting } from "../../../src/main/settings/language-setting";

function createDatabase(value: string | undefined, error?: Error) {
  return {
    prepare: vi.fn(() => ({
      get: vi.fn(() => {
        if (error) throw error;
        return value === undefined ? undefined : { value };
      }),
    })),
  };
}

describe("readLanguageSetting", () => {
  it.each([
    ['"en"', "en"],
    ['"zh"', "zh"],
    ['"zh-TW"', "zh-TW"],
    ['"ja"', "ja"],
    ['"fr"', "fr"],
    ['"de"', "de"],
    ['"es"', "es"],
    ["en", "en"],
  ] as const)("reads supported value %s", (stored, expected) => {
    expect(readLanguageSetting(createDatabase(stored) as never)).toBe(expected);
  });

  it.each([undefined, '"pt"', "null", "{}", "not-json"])(
    "rejects missing or malformed value %s",
    (stored) => {
      expect(readLanguageSetting(createDatabase(stored) as never)).toBeNull();
    },
  );

  it("logs the stack-bearing database error and returns null", () => {
    const error = new Error("database unavailable");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(
      readLanguageSetting(createDatabase(undefined, error) as never),
    ).toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to read language setting:",
      error,
    );
  });
});
