/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import {
  AgentAdapterRegistry,
  reconcileAgentProviderState,
} from "@prompthub/core";
import type {
  AgentProviderAdapter,
  AgentProviderComparableState,
} from "@prompthub/core";

function state(
  values: AgentProviderComparableState["values"],
  digest = "sha256:current",
): AgentProviderComparableState {
  return {
    platformId: "codex",
    adapterVersion: "1",
    nativeDigest: digest,
    values,
  };
}

function providerAdapter(
  platformId = "codex",
  version = "1",
): AgentProviderAdapter {
  return {
    platformId,
    version,
    inspect: vi.fn(),
    importCurrent: vi.fn(),
    planActivation: vi.fn(),
    apply: vi.fn(),
    verify: vi.fn(),
    rollback: vi.fn(),
  };
}

describe("AgentAdapterRegistry", () => {
  it("registers optional capabilities without inventing missing adapters", () => {
    const registry = new AgentAdapterRegistry();
    const provider = providerAdapter();

    registry.register("codex", { provider });
    registry.register("cursor", {});

    expect(registry.get("codex")).toEqual({ provider });
    expect(registry.get("cursor")).toEqual({});
    expect(registry.get("missing")).toBeNull();
    expect(registry.listPlatformIds()).toEqual(["codex", "cursor"]);
  });

  it("rejects duplicate registrations, mismatched ids, and invalid versions", () => {
    const registry = new AgentAdapterRegistry();
    registry.register("codex", { provider: providerAdapter() });

    expect(() =>
      registry.register("codex", { provider: providerAdapter() }),
    ).toThrow("already registered");
    expect(() =>
      new AgentAdapterRegistry().register("codex", {
        provider: providerAdapter("claude"),
      }),
    ).toThrow("does not match");
    expect(() =>
      new AgentAdapterRegistry().register("codex", {
        provider: providerAdapter("codex", " "),
      }),
    ).toThrow("version is required");
  });
});

describe("reconcileAgentProviderState", () => {
  it("classifies unchanged, apply, external modification, and conflict fields", () => {
    const plan = reconcileAgentProviderState({
      profileId: "profile-1",
      baseline: state({
        model: "gpt-5",
        endpoint: "https://old.example",
        reasoning: "medium",
        timeout: 30,
      }),
      current: state(
        {
          model: "gpt-5",
          endpoint: "https://external.example",
          reasoning: "high",
          timeout: 30,
        },
        "sha256:latest",
      ),
      desired: {
        platformId: "codex",
        values: {
          model: "gpt-5.1",
          endpoint: "https://old.example",
          reasoning: "low",
        },
      },
      supportedKeys: ["model", "endpoint", "reasoning"],
    });

    expect(plan.status).toBe("conflict");
    expect(plan.canApply).toBe(false);
    expect(plan.requiresReview).toBe(true);
    expect(plan.currentDigest).toBe("sha256:latest");
    expect(plan.decisions).toEqual([
      expect.objectContaining({
        field: "endpoint",
        status: "external-modified",
      }),
      expect.objectContaining({ field: "model", status: "apply" }),
      expect.objectContaining({ field: "reasoning", status: "conflict" }),
      expect.objectContaining({ field: "timeout", status: "preserve" }),
    ]);
  });

  it("uses backfill without a baseline and marks unsupported desired keys", () => {
    const plan = reconcileAgentProviderState({
      profileId: "profile-1",
      baseline: null,
      current: state({ model: "native-model", endpoint: null }),
      desired: {
        platformId: "codex",
        values: {
          model: "desired-model",
          endpoint: null,
          customHeader: "not-supported",
        },
      },
      supportedKeys: ["model", "endpoint"],
    });

    expect(plan.status).toBe("unsupported");
    expect(plan.canApply).toBe(false);
    expect(plan.requiresReview).toBe(true);
    expect(plan.decisions).toEqual([
      expect.objectContaining({
        field: "customHeader",
        status: "unsupported",
      }),
      expect.objectContaining({ field: "endpoint", status: "preserve" }),
      expect.objectContaining({ field: "model", status: "backfill" }),
    ]);
  });

  it("returns an applicable plan when current still matches the baseline", () => {
    const baseline = state({ model: "gpt-5", nested: { effort: "medium" } });
    const plan = reconcileAgentProviderState({
      profileId: "profile-1",
      baseline,
      current: structuredClone(baseline),
      desired: {
        platformId: "codex",
        values: { model: "gpt-5.1", nested: { effort: "high" } },
      },
      supportedKeys: ["model", "nested"],
    });

    expect(plan.status).toBe("apply");
    expect(plan.canApply).toBe(true);
    expect(plan.requiresReview).toBe(false);
    expect(
      plan.decisions.every((decision) => decision.status === "apply"),
    ).toBe(true);
  });

  it("emits stable overall states without mutating reconciliation input", () => {
    const cases = [
      {
        baseline: state({ model: "same" }),
        current: state({ model: "same" }),
        desired: {
          platformId: "codex",
          values: { model: "same" },
        },
        expected: "preserve",
      },
      {
        baseline: null,
        current: state({ model: "native" }),
        desired: {
          platformId: "codex",
          values: { model: "desired" },
        },
        expected: "backfill",
      },
      {
        baseline: null,
        current: state({}),
        desired: {
          platformId: "codex",
          values: { model: "desired" },
        },
        expected: "apply",
      },
      {
        baseline: state({ model: "baseline" }),
        current: state({ model: "external" }),
        desired: {
          platformId: "codex",
          values: { model: "baseline" },
        },
        expected: "external-modified",
      },
    ] as const;

    for (const testCase of cases) {
      const input = {
        profileId: "profile-1",
        baseline: testCase.baseline,
        current: testCase.current,
        desired: testCase.desired,
        supportedKeys: ["model"],
      };
      const before = structuredClone(input);

      expect(reconcileAgentProviderState(input).status).toBe(testCase.expected);
      expect(input).toEqual(before);
    }

    expect(
      reconcileAgentProviderState({
        profileId: "profile-1",
        baseline: null,
        current: state({}),
        desired: { platformId: "codex", values: {} },
        supportedKeys: [],
      }),
    ).toMatchObject({
      status: "preserve",
      canApply: true,
      requiresReview: false,
      decisions: [],
    });
  });

  it("blocks before comparison and rejects cross-platform state", () => {
    const blocked = reconcileAgentProviderState({
      profileId: "profile-1",
      baseline: null,
      current: state({}),
      desired: { platformId: "codex", values: {} },
      supportedKeys: [],
      blockedReasons: ["missing-secret", "config-not-writable"],
    });
    expect(blocked).toMatchObject({
      status: "blocked",
      canApply: false,
      requiresReview: true,
      blockedReasons: ["missing-secret", "config-not-writable"],
    });

    expect(() =>
      reconcileAgentProviderState({
        profileId: "profile-1",
        baseline: null,
        current: state({}),
        desired: { platformId: "claude", values: {} },
        supportedKeys: [],
      }),
    ).toThrow("platform ids must match");

    expect(() =>
      reconcileAgentProviderState({
        profileId: "profile-1",
        baseline: state({}),
        current: {
          ...state({}),
          platformId: "claude",
        },
        desired: { platformId: "claude", values: {} },
        supportedKeys: [],
      }),
    ).toThrow("platform ids must match");
  });
});
