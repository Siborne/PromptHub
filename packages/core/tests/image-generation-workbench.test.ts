import { describe, expect, it } from "vitest";
import {
  classifyGenerationError,
  deriveGenerationBatchStatus,
  normalizeGenerationRequest,
  planGenerationAttempts,
  reduceGenerationCounts,
  resolveGenerationPrompt,
} from "../src/image-generation-workbench";

describe("image generation workbench policy", () => {
  it.each([0, -1, 1.5, 101, Number.NaN])(
    "rejects an invalid target count: %s",
    (targetCount) => {
      expect(() =>
        normalizeGenerationRequest({
          targetCount,
          model: { id: "model-1", provider: "openai", model: "gpt-image-1" },
          prompt: "A quiet architectural poster",
        }),
      ).toThrow(/target count/i);
    },
  );

  it("normalizes whitespace and caps provider request groups without changing total", () => {
    const request = normalizeGenerationRequest({
      targetCount: 10,
      model: { id: " model-1 ", provider: " openai ", model: " gpt-image-1 " },
      prompt: "  A quiet architectural poster  ",
    });

    expect(request.prompt).toBe("A quiet architectural poster");
    expect(request.model).toEqual({
      id: "model-1",
      provider: "openai",
      model: "gpt-image-1",
    });
    expect(planGenerationAttempts(10, 4)).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [8, 9],
    ]);
  });

  it.each([0, -2, 1.2, 101])(
    "rejects an invalid provider request limit: %s",
    (limit) => {
      expect(() => planGenerationAttempts(4, limit)).toThrow(/request limit/i);
    },
  );

  it("derives accurate mixed and terminal batch states", () => {
    expect(
      reduceGenerationCounts([
        "succeeded",
        "failed",
        "cancelled",
        "interrupted",
        "running",
        "pending",
      ]),
    ).toEqual({
      total: 6,
      pending: 1,
      running: 1,
      succeeded: 1,
      failed: 1,
      cancelled: 1,
      interrupted: 1,
    });
    expect(deriveGenerationBatchStatus(["pending"])).toBe("queued");
    expect(deriveGenerationBatchStatus(["running", "cancelled"])).toBe(
      "running",
    );
    expect(deriveGenerationBatchStatus(["succeeded", "failed"])).toBe(
      "partially_succeeded",
    );
    expect(deriveGenerationBatchStatus(["failed", "cancelled"])).toBe("failed");
    expect(deriveGenerationBatchStatus(["cancelled", "cancelled"])).toBe(
      "cancelled",
    );
    expect(deriveGenerationBatchStatus(["interrupted"])).toBe("interrupted");
    expect(deriveGenerationBatchStatus(["succeeded", "succeeded"])).toBe(
      "succeeded",
    );
  });

  it("classifies retryable provider failures without leaking raw payloads", () => {
    expect(
      classifyGenerationError({ status: 429, message: "quota-ish" }),
    ).toEqual({
      code: "rate_limited",
      retryable: true,
      httpStatus: 429,
      message: "quota-ish",
    });
    expect(
      classifyGenerationError({ status: 401, message: "bad key sk-secret" }),
    ).toEqual({
      code: "authentication_failed",
      retryable: false,
      httpStatus: 401,
      message: "Provider authentication failed",
    });
    expect(
      classifyGenerationError(new Error("socket timed out")),
    ).toMatchObject({
      code: "provider_timeout",
      retryable: true,
    });
    expect(
      classifyGenerationError({ status: 400, message: "x".repeat(2_000) })
        .message,
    ).toHaveLength(1_000);
  });

  it("resolves declared values and inline defaults without changing unknown placeholders", () => {
    expect(
      resolveGenerationPrompt(
        "A {{style}} poster for {{subject:PromptHub}} in {{unknown}}",
        { style: "Swiss" },
      ),
    ).toBe("A Swiss poster for PromptHub in {{unknown}}");
  });
});
