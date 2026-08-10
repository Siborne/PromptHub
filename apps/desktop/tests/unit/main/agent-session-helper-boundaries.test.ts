import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  boundedText,
  isRecord,
  normalizeRole,
  normalizeTimestamp,
  numberValue,
  stringValue,
} from "../../../src/main/services/agent-session-parser-utils";
import {
  resolveCherryStudioRoot,
  resolveCoPawRoots,
  resolveEnvironmentRoot,
  resolveHermesRoot,
  resolveKiloStorageRoot,
  resolveNanoClawRoots,
  resolveQwenRuntimeRoot,
  resolveReasonixStateRoot,
} from "../../../src/main/services/agent-session-roots";

const originalPlatform = process.platform;
const ENV_KEYS = [
  "APPDATA",
  "COPAW_WORKING_DIR",
  "HERMES_HOME",
  "LOCALAPPDATA",
  "QWEN_HOME",
  "QWEN_RUNTIME_DIR",
  "QWENPAW_WORKING_DIR",
  "REASONIX_HOME",
  "REASONIX_STATE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
] as const;
const originalEnvironment = new Map(
  ENV_KEYS.map((key) => [key, process.env[key]] as const),
);

function setPlatform(value: NodeJS.Platform): void {
  Object.defineProperty(process, "platform", { configurable: true, value });
}

beforeEach(() => {
  for (const key of ENV_KEYS) delete process.env[key];
  setPlatform(originalPlatform);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnvironment.get(key);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  setPlatform(originalPlatform);
});

describe("Agent session parser helpers", () => {
  it("normalizes primitive values without accepting arrays or invalid numbers", () => {
    expect(isRecord({ value: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([])).toBe(false);
    expect(isRecord("value")).toBe(false);
    expect(stringValue(" value ")).toBe("value");
    expect(stringValue("  ")).toBeNull();
    expect(stringValue(1)).toBeNull();
    expect(numberValue(12)).toBe(12);
    expect(numberValue(Number.POSITIVE_INFINITY)).toBeNull();
    expect(numberValue("12")).toBeNull();
  });

  it("collects bounded visible text from known nested transcript shapes", () => {
    expect(
      boundedText({
        text: " first ",
        content: [{ message: "second" }, null, 3],
        result: { content: "third" },
      }),
    ).toBe("first\nsecond\nthird");
    expect(boundedText({ unrelated: "hidden" })).toBe("");
    expect(boundedText(undefined)).toBe("");
    expect(boundedText(" ")).toBe("");

    let tooDeep: unknown = "hidden";
    for (let index = 0; index < 8; index += 1) tooDeep = { text: tooDeep };
    expect(boundedText(tooDeep)).toBe("");
    expect(boundedText("x".repeat(70 * 1024))).toHaveLength(64 * 1024);
  });

  it("normalizes timestamps and every public transcript role", () => {
    expect(normalizeTimestamp(1_700_000_000)).toBe(1_700_000_000_000);
    expect(normalizeTimestamp(1_700_000_000_000)).toBe(1_700_000_000_000);
    expect(normalizeTimestamp("2026-08-10T00:00:00.000Z")).toBe(
      Date.parse("2026-08-10T00:00:00.000Z"),
    );
    expect(normalizeTimestamp("not-a-date")).toBeNull();
    expect(normalizeTimestamp(" ")).toBeNull();
    expect(normalizeTimestamp({})).toBeNull();

    for (const role of ["user", "assistant", "tool", "system"] as const) {
      expect(normalizeRole(` ${role.toUpperCase()} `)).toBe(role);
    }
    expect(normalizeRole("developer")).toBe("unknown");
    expect(normalizeRole(null)).toBe("unknown");
  });
});

describe("Agent session root helpers", () => {
  const homeDir = path.resolve("/tmp/prompthub-home");

  it("accepts only explicit absolute environment roots", () => {
    expect(resolveEnvironmentRoot(undefined, homeDir, ".agent")).toBe(
      path.join(homeDir, ".agent"),
    );
    expect(resolveEnvironmentRoot("  ", homeDir, ".agent")).toBe(
      path.join(homeDir, ".agent"),
    );
    expect(resolveEnvironmentRoot("bad\0path", homeDir, ".agent")).toBe(
      path.join(homeDir, ".agent"),
    );
    expect(resolveEnvironmentRoot("relative", homeDir, ".agent")).toBe(
      path.join(homeDir, ".agent"),
    );
    expect(resolveEnvironmentRoot("~/.custom", homeDir, ".agent")).toBe(
      path.join(homeDir, ".custom"),
    );
    expect(
      resolveEnvironmentRoot("/opt/agent/../state", homeDir, ".agent"),
    ).toBe(path.normalize("/opt/state"));
  });

  it("resolves Qwen precedence and rejects null-byte overrides", () => {
    expect(resolveQwenRuntimeRoot({ homeDir })).toBe(
      path.join(homeDir, ".qwen"),
    );
    process.env.QWEN_HOME = "/tmp/qwen-home";
    expect(resolveQwenRuntimeRoot({ homeDir })).toBe("/tmp/qwen-home");
    process.env.QWEN_RUNTIME_DIR = "~/.qwen-runtime";
    expect(resolveQwenRuntimeRoot({ homeDir })).toBe(
      path.join(homeDir, ".qwen-runtime"),
    );
    expect(
      resolveQwenRuntimeRoot({ homeDir, qwenRuntimeDir: "relative-qwen" }),
    ).toBe(path.resolve("relative-qwen"));
    expect(
      resolveQwenRuntimeRoot({ homeDir, qwenRuntimeDir: "bad\0path" }),
    ).toBe(path.join(homeDir, ".qwen"));
  });

  it("resolves platform-specific Cherry Studio and Hermes roots", () => {
    setPlatform("darwin");
    expect(resolveCherryStudioRoot(homeDir)).toBe(
      path.join(homeDir, "Library", "Application Support", "CherryStudio"),
    );

    setPlatform("win32");
    process.env.APPDATA = "/tmp/app-data";
    expect(resolveCherryStudioRoot(homeDir)).toBe("/tmp/app-data");
    process.env.LOCALAPPDATA = "/tmp/local-app-data";
    expect(resolveHermesRoot(homeDir)).toBe("/tmp/local-app-data/hermes");

    setPlatform("linux");
    process.env.XDG_CONFIG_HOME = "/tmp/xdg-config";
    expect(resolveCherryStudioRoot(homeDir)).toBe("/tmp/xdg-config");
    expect(resolveHermesRoot(homeDir)).toBe(path.join(homeDir, ".hermes"));
    process.env.HERMES_HOME = "~/.custom-hermes";
    expect(resolveHermesRoot(homeDir)).toBe(
      path.join(homeDir, ".custom-hermes"),
    );
    process.env.HERMES_HOME = "relative-hermes";
    expect(resolveHermesRoot(homeDir)).toBe(path.join(homeDir, ".hermes"));
  });

  it("resolves data, state, NanoClaw, and CoPaw roots with bounded fallbacks", () => {
    expect(resolveKiloStorageRoot(homeDir)).toBe(
      path.join(homeDir, ".local", "share", "kilo", "storage"),
    );
    process.env.XDG_DATA_HOME = "/tmp/xdg-data";
    expect(resolveKiloStorageRoot(homeDir)).toBe("/tmp/xdg-data/kilo/storage");

    expect(resolveReasonixStateRoot(homeDir)).toBe(
      path.join(homeDir, ".reasonix"),
    );
    process.env.REASONIX_HOME = "/tmp/reasonix-home";
    expect(resolveReasonixStateRoot(homeDir)).toBe("/tmp/reasonix-home");
    process.env.REASONIX_STATE_HOME = "/tmp/reasonix-state";
    expect(resolveReasonixStateRoot(homeDir)).toBe("/tmp/reasonix-state");

    expect(resolveNanoClawRoots(homeDir)).toEqual([
      path.join(homeDir, ".nanoclaw"),
      path.join(homeDir, "nanoclaw"),
      path.join(homeDir, "nanoclaw-v2"),
    ]);
    expect(resolveCoPawRoots(homeDir)).toEqual([
      path.join(homeDir, ".qwenpaw"),
      path.join(homeDir, ".copaw"),
    ]);
    process.env.COPAW_WORKING_DIR = "/tmp/copaw";
    expect(resolveCoPawRoots(homeDir)).toEqual(["/tmp/copaw"]);
    process.env.QWENPAW_WORKING_DIR = "/tmp/qwenpaw";
    expect(resolveCoPawRoots(homeDir)).toEqual(["/tmp/qwenpaw"]);
  });
});
