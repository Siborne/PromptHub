import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadPromptVariableCache,
  savePromptVariableCache,
} from "../../../src/renderer/services/prompt-variable-cache";

describe("prompt variable cache", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("migrates legacy values into a bounded expiring cache", () => {
    localStorage.setItem("prompt_vars_prompt-1", JSON.stringify({ topic: "AI" }));
    expect(loadPromptVariableCache("prompt-1")).toEqual({ topic: "AI" });
    expect(JSON.parse(localStorage.getItem("prompt_vars_prompt-1")!)).toMatchObject({
      kind: "prompthub-prompt-variable-cache",
      version: 1,
      values: { topic: "AI" },
    });
  });

  it("expires stale entries and caps variables and values", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T00:00:00.000Z"));
    savePromptVariableCache(
      "prompt-2",
      Object.fromEntries(
        Array.from({ length: 80 }, (_, index) => [
          `variable-${index}`,
          "x".repeat(5000),
        ]),
      ),
    );
    const stored = JSON.parse(localStorage.getItem("prompt_vars_prompt-2")!);
    expect(Object.keys(stored.values)).toHaveLength(64);
    expect(Object.values(stored.values)[0]).toHaveLength(4096);

    vi.setSystemTime(new Date("2026-09-11T00:00:01.000Z"));
    expect(loadPromptVariableCache("prompt-2")).toEqual({});
    expect(localStorage.getItem("prompt_vars_prompt-2")).toBeNull();
  });

  it("rejects unsafe prompt identities instead of creating arbitrary keys", () => {
    expect(() => savePromptVariableCache("../prompt", { topic: "AI" })).toThrow(
      /prompt id/iu,
    );
    expect(localStorage.length).toBe(0);
  });
});
