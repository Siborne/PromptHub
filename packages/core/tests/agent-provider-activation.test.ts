/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import type {
  AgentProviderActivationPlan,
  AgentProviderAdapterContext,
  AgentProviderApplyReceipt,
  AgentProviderComparableState,
  AgentProviderConnectionTestResult,
  AgentProviderImportPreview,
  AgentProviderModelMapping,
  AgentProviderModelTestResult,
  AgentProviderProfile,
  AgentProviderRollbackResult,
  AgentProviderSnapshot,
  AgentProviderVerification,
  CreateAgentProviderSnapshotInput,
} from "@prompthub/shared";
import {
  AgentAdapterRegistry,
  AgentProviderActivationService,
  type AgentProviderActivationRepository,
  type AgentProviderAdapter,
} from "@prompthub/core";

const context: AgentProviderAdapterContext = {
  agentId: "codex",
  platformId: "codex",
  rootPath: "/tmp/codex",
};

const profile: AgentProviderProfile = {
  id: "profile-1",
  platformId: "codex",
  name: "Work",
  providerKind: "openai-compatible",
  protocol: "responses",
  endpoint: "https://gateway.example.com/v1",
  config: { model: "gpt-5.4" },
  secretRef: "provider:profile-1",
  source: "manual",
  archived: false,
  createdAt: 1,
  updatedAt: 1,
};

const modelMappings: AgentProviderModelMapping[] = [
  {
    id: "mapping-primary",
    providerProfileId: "profile-1",
    routeKey: "primary",
    modelId: "gpt-5.4",
    parameters: {},
  },
];

function state(
  nativeDigest = "digest-current",
  model = "gpt-5.4",
): AgentProviderComparableState {
  return {
    platformId: "codex",
    adapterVersion: "1",
    nativeDigest,
    values: { model },
  };
}

function plan(
  overrides: Partial<AgentProviderActivationPlan> = {},
): AgentProviderActivationPlan {
  return {
    platformId: "codex",
    profileId: "profile-1",
    adapterVersion: "1",
    currentDigest: "digest-current",
    status: "apply",
    decisions: [
      {
        field: "model",
        status: "apply",
        current: "gpt-5.3",
        desired: "gpt-5.4",
      },
    ],
    canApply: true,
    requiresReview: false,
    blockedReasons: [],
    ...overrides,
  };
}

function receipt(): AgentProviderApplyReceipt {
  return {
    platformId: "codex",
    profileId: "profile-1",
    adapterVersion: "1",
    nativeDigestBefore: "digest-current",
    nativeDigestAfter: "digest-after",
    backupRef: "/tmp/backup",
    appliedAt: 10,
  };
}

function verification(
  overrides: Partial<AgentProviderVerification> = {},
): AgentProviderVerification {
  return {
    verified: true,
    nativeDigest: "digest-after",
    state: state("digest-after"),
    ...overrides,
  };
}

function rollback(
  overrides: Partial<AgentProviderRollbackResult> = {},
): AgentProviderRollbackResult {
  return {
    restored: true,
    nativeDigest: "digest-current",
    ...overrides,
  };
}

function importPreview(
  overrides: Partial<AgentProviderImportPreview> = {},
): AgentProviderImportPreview {
  return {
    state: state(),
    profile: {
      platformId: "codex",
      name: "Native",
      providerKind: "platform-native",
      protocol: "platform-native",
      endpoint: null,
      config: { adapter: "codex-model-v1" },
      secretRef: null,
      source: "native-import",
    },
    modelMappings: [
      {
        routeKey: "primary",
        modelId: "gpt-5.4",
        parameters: {},
      },
    ],
    warnings: [],
    ...overrides,
  };
}

function adapter(
  overrides: Partial<AgentProviderAdapter> = {},
): AgentProviderAdapter {
  return {
    platformId: "codex",
    version: "1",
    inspect: vi.fn().mockResolvedValue(state()),
    importCurrent: vi.fn(),
    planActivation: vi.fn().mockResolvedValue(plan()),
    apply: vi.fn().mockResolvedValue(receipt()),
    verify: vi.fn().mockResolvedValue(verification()),
    rollback: vi.fn().mockResolvedValue(rollback()),
    ...overrides,
  };
}

function connectionResult(
  overrides: Partial<AgentProviderConnectionTestResult> = {},
): AgentProviderConnectionTestResult {
  return {
    platformId: "codex",
    profileId: "profile-1",
    protocol: "responses",
    endpointOrigin: "https://gateway.example.com",
    model: "gpt-5.4",
    status: "ok",
    startedAt: 10,
    finishedAt: 20,
    totalMs: 10,
    retryCount: 0,
    modelCount: 2,
    modelAvailable: true,
    ...overrides,
  };
}

function modelTestResult(
  overrides: Partial<AgentProviderModelTestResult> = {},
): AgentProviderModelTestResult {
  return {
    platformId: "codex",
    profileId: "profile-1",
    protocol: "responses",
    endpointOrigin: "https://gateway.example.com",
    model: "gpt-5.4",
    status: "ok",
    startedAt: 10,
    finishedAt: 30,
    totalMs: 20,
    firstTokenMs: 12,
    retryCount: 0,
    inputTokens: 8,
    outputTokens: 1,
    outputPreview: "OK",
    ...overrides,
  };
}

function snapshot(
  input: CreateAgentProviderSnapshotInput,
): AgentProviderSnapshot {
  return {
    id: `snapshot-${input.result}`,
    platformId: input.platformId,
    providerProfileId: input.providerProfileId ?? null,
    nativeDigest: input.nativeDigest,
    redactedSnapshot: input.redactedSnapshot,
    backupRef: input.backupRef ?? null,
    operation: input.operation,
    result: input.result,
    createdAt: 10,
  };
}

function repository(
  overrides: Partial<AgentProviderActivationRepository> = {},
): AgentProviderActivationRepository {
  return {
    getProfile: vi.fn().mockResolvedValue(profile),
    listModelMappings: vi.fn().mockResolvedValue(modelMappings),
    getBaseline: vi.fn().mockResolvedValue(state("digest-baseline", "gpt-5.2")),
    recordSnapshot: vi
      .fn()
      .mockImplementation(async (input) => snapshot(input)),
    ...overrides,
  };
}

function service(
  providerAdapter = adapter(),
  activationRepository = repository(),
): {
  service: AgentProviderActivationService;
  adapter: AgentProviderAdapter;
  repository: AgentProviderActivationRepository;
} {
  const registry = new AgentAdapterRegistry();
  registry.register("codex", { provider: providerAdapter });
  return {
    service: new AgentProviderActivationService(registry, activationRepository),
    adapter: providerAdapter,
    repository: activationRepository,
  };
}

describe("AgentProviderActivationService", () => {
  it("tests a stored profile without inspecting or mutating native config", async () => {
    const providerAdapter = adapter({
      testConnection: vi.fn().mockResolvedValue(connectionResult()),
    });
    const activationRepository = repository();
    const target = service(providerAdapter, activationRepository);

    await expect(
      target.service.testConnection({
        context,
        profileId: "profile-1",
      }),
    ).resolves.toEqual(connectionResult());

    expect(providerAdapter.testConnection).toHaveBeenCalledWith(context, {
      profile,
      modelMappings,
    });
    expect(providerAdapter.inspect).not.toHaveBeenCalled();
    expect(providerAdapter.planActivation).not.toHaveBeenCalled();
    expect(providerAdapter.apply).not.toHaveBeenCalled();
    expect(activationRepository.recordSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed for unsupported, mismatched, and malformed connection results", async () => {
    await expect(
      service().service.testConnection({
        context,
        profileId: "profile-1",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_CONNECTION_TEST_UNSUPPORTED");

    for (const invalid of [
      connectionResult({ platformId: "claude" }),
      connectionResult({ profileId: "other" }),
      connectionResult({ status: "secret-token" as never }),
      connectionResult({ endpointOrigin: "https://user:secret@example.com" }),
      connectionResult({ endpointOrigin: "not a URL" }),
      connectionResult({ totalMs: Number.NaN }),
      connectionResult({ retryCount: -1 }),
      connectionResult({ modelCount: -1 }),
      connectionResult({ modelAvailable: "yes" as never }),
      connectionResult({ errorCode: "secret token" }),
    ]) {
      await expect(
        service(
          adapter({
            testConnection: vi.fn().mockResolvedValue(invalid),
          }),
        ).service.testConnection({
          context,
          profileId: "profile-1",
        }),
      ).rejects.toThrow("AGENT_PROVIDER_CONNECTION_TEST_INVALID");
    }
  });

  it("redacts adapter failures and rejects missing or cross-platform profiles", async () => {
    await expect(
      service(
        adapter({
          testConnection: vi
            .fn()
            .mockRejectedValue(new Error("top-secret-provider-key")),
        }),
      ).service.testConnection({
        context,
        profileId: "profile-1",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_CONNECTION_TEST_FAILED");

    await expect(
      service(
        adapter({ testConnection: vi.fn() }),
        repository({ getProfile: vi.fn().mockResolvedValue(null) }),
      ).service.testConnection({
        context,
        profileId: "profile-1",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_NOT_FOUND");
    await expect(
      service(
        adapter({ testConnection: vi.fn() }),
        repository({
          getProfile: vi.fn().mockResolvedValue({
            ...profile,
            platformId: "claude",
          }),
        }),
      ).service.testConnection({
        context,
        profileId: "profile-1",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_PLATFORM_MISMATCH");
  });

  it("runs a cancellable stored-profile model test without native mutation", async () => {
    const signal = new AbortController().signal;
    const providerAdapter = adapter({
      testModel: vi.fn().mockResolvedValue(modelTestResult()),
    });
    const activationRepository = repository();
    const target = service(providerAdapter, activationRepository);

    await expect(
      target.service.testModel({ context, profileId: "profile-1" }, signal),
    ).resolves.toEqual(modelTestResult());

    expect(providerAdapter.testModel).toHaveBeenCalledWith(
      context,
      { profile, modelMappings },
      signal,
    );
    expect(providerAdapter.inspect).not.toHaveBeenCalled();
    expect(providerAdapter.apply).not.toHaveBeenCalled();
    expect(activationRepository.recordSnapshot).not.toHaveBeenCalled();
  });

  it("fails closed for unsupported, mismatched, malformed, and failed model tests", async () => {
    const signal = new AbortController().signal;
    await expect(
      service().service.testModel({ context, profileId: "profile-1" }, signal),
    ).rejects.toThrow("AGENT_PROVIDER_MODEL_TEST_UNSUPPORTED");

    const invalidResults = [
      modelTestResult({ platformId: "claude" }),
      modelTestResult({ profileId: "other" }),
      modelTestResult({ status: "secret-token" as never }),
      modelTestResult({
        endpointOrigin: "https://user:secret@example.com",
      }),
      modelTestResult({ endpointOrigin: "not a URL" }),
      modelTestResult({ model: "x".repeat(513) }),
      modelTestResult({ startedAt: Number.NaN }),
      modelTestResult({ finishedAt: 9 }),
      modelTestResult({ totalMs: -1 }),
      modelTestResult({ firstTokenMs: 21 }),
      modelTestResult({ retryCount: 2 }),
      modelTestResult({ inputTokens: -1 }),
      modelTestResult({ outputTokens: 1.5 }),
      modelTestResult({ outputPreview: "x".repeat(257) }),
      modelTestResult({ outputPreview: "unsafe\u0001preview" }),
      modelTestResult({ errorCode: "secret token" }),
    ];
    for (const invalid of invalidResults) {
      await expect(
        service(
          adapter({
            testModel: vi.fn().mockResolvedValue(invalid),
          }),
        ).service.testModel({ context, profileId: "profile-1" }, signal),
      ).rejects.toThrow("AGENT_PROVIDER_MODEL_TEST_INVALID");
    }

    await expect(
      service(
        adapter({
          testModel: vi
            .fn()
            .mockRejectedValue(new Error("top-secret-provider-key")),
        }),
      ).service.testModel({ context, profileId: "profile-1" }, signal),
    ).rejects.toThrow("AGENT_PROVIDER_MODEL_TEST_FAILED");
    await expect(
      service(
        adapter({ testModel: vi.fn() }),
        repository({ getProfile: vi.fn().mockResolvedValue(null) }),
      ).service.testModel({ context, profileId: "profile-1" }, signal),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_NOT_FOUND");
    await expect(
      service(
        adapter({ testModel: vi.fn() }),
        repository({
          getProfile: vi.fn().mockResolvedValue({
            ...profile,
            platformId: "claude",
          }),
        }),
      ).service.testModel({ context, profileId: "profile-1" }, signal),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_PLATFORM_MISMATCH");
  });

  it("imports current native state through a redacted adapter preview", async () => {
    const providerAdapter = adapter({
      importCurrent: vi.fn().mockResolvedValue(importPreview()),
    });
    const harness = service(providerAdapter);

    await expect(harness.service.importCurrent({ context })).resolves.toEqual(
      importPreview(),
    );
    expect(providerAdapter.importCurrent).toHaveBeenCalledWith(context);

    for (const endpoint of [undefined, "https://provider.example.test"]) {
      const preview = importPreview({
        profile: { ...importPreview().profile, endpoint },
      });
      await expect(
        service(
          adapter({
            importCurrent: vi.fn().mockResolvedValue(preview),
          }),
        ).service.importCurrent({ context }),
      ).resolves.toEqual(preview);
    }
  });

  it("rejects unsafe or malformed native import previews", async () => {
    const invalidPreviews: AgentProviderImportPreview[] = [
      importPreview({ state: { ...state(), platformId: "claude" } }),
      importPreview({
        profile: { ...importPreview().profile, platformId: "claude" },
      }),
      importPreview({
        profile: {
          ...importPreview().profile,
          secretRef: "native-secret-ref",
        },
      }),
      importPreview({
        profile: {
          ...importPreview().profile,
          config: { apiKey: "secret-token" },
        },
      }),
      importPreview({ modelMappings: null as never }),
      importPreview({
        modelMappings: [{ routeKey: "", modelId: "gpt-5.4", parameters: {} }],
      }),
      importPreview({
        modelMappings: [{ routeKey: "primary", modelId: "", parameters: {} }],
      }),
      importPreview({
        modelMappings: [
          {
            routeKey: "primary",
            modelId: "gpt-5.4",
            parameters: { token: "secret-token" },
          },
        ],
      }),
      importPreview({ warnings: [1 as never] }),
    ];
    for (const preview of invalidPreviews) {
      await expect(
        service(
          adapter({
            importCurrent: vi.fn().mockResolvedValue(preview),
          }),
        ).service.importCurrent({ context }),
      ).rejects.toThrow("AGENT_PROVIDER_IMPORT_INVALID");
    }

    await expect(
      service(
        adapter({
          importCurrent: vi
            .fn()
            .mockRejectedValue(new Error("token=secret-token")),
        }),
      ).service.importCurrent({ context }),
    ).rejects.toThrow("AGENT_PROVIDER_IMPORT_FAILED");
    expect(
      JSON.stringify(
        await service(
          adapter({
            importCurrent: vi
              .fn()
              .mockRejectedValue(new Error("token=secret-token")),
          }),
        )
          .service.importCurrent({ context })
          .catch((error) => error.message),
      ),
    ).not.toContain("secret-token");
  });

  it("previews through the registered adapter with the stored baseline", async () => {
    const harness = service();

    await expect(
      harness.service.preview({ context, profileId: "profile-1" }),
    ).resolves.toEqual(plan());
    expect(harness.adapter.planActivation).toHaveBeenCalledWith({
      context,
      profile,
      modelMappings,
      baseline: state("digest-baseline", "gpt-5.2"),
    });
  });

  it("applies, verifies, and records a redacted verified snapshot", async () => {
    const harness = service();

    const result = await harness.service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });

    expect(result).toMatchObject({
      status: "verified",
      plan: plan(),
      verification: verification(),
    });
    expect(harness.adapter.apply).toHaveBeenCalledWith(context, plan(), {
      profile,
      modelMappings,
    });
    expect(harness.adapter.verify).toHaveBeenCalledWith(
      context,
      plan(),
      receipt(),
    );
    expect(harness.repository.recordSnapshot).toHaveBeenCalledWith({
      platformId: "codex",
      providerProfileId: "profile-1",
      nativeDigest: "digest-after",
      redactedSnapshot: {
        adapterVersion: "1",
        values: { model: "gpt-5.4" },
      },
      backupRef: "/tmp/backup",
      operation: "activate",
      result: "verified",
    });
  });

  it("rejects a stale preview before apply and releases the platform lock", async () => {
    const harness = service();
    await expect(
      harness.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "stale-digest",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_ACTIVATION_STALE");
    expect(harness.adapter.apply).not.toHaveBeenCalled();

    await expect(
      harness.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
      }),
    ).resolves.toMatchObject({ status: "verified" });
  });

  it("rolls back a failed verification and records the restored state", async () => {
    const providerAdapter = adapter({
      verify: vi.fn().mockResolvedValue(
        verification({
          verified: false,
          errorCode: "native-validation-failed",
        }),
      ),
    });
    const harness = service(providerAdapter);

    const result = await harness.service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });

    expect(result).toMatchObject({
      status: "rolled-back",
      rollback: rollback(),
      errorCode: "native-validation-failed",
    });
    expect(providerAdapter.rollback).toHaveBeenCalledWith(context, receipt());
    expect(harness.repository.recordSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        nativeDigest: "digest-current",
        result: "rolled-back",
      }),
    );
  });

  it("reports rollback failure without leaking adapter errors", async () => {
    const providerAdapter = adapter({
      verify: vi.fn().mockRejectedValue(new Error("Bearer secret-token")),
      rollback: vi.fn().mockRejectedValue(new Error("backup secret-token")),
    });
    const harness = service(providerAdapter);

    const result = await harness.service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });

    expect(result).toMatchObject({
      status: "failed",
      errorCode: "provider-rollback-failed",
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(harness.repository.recordSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        result: "failed",
        nativeDigest: "digest-after",
      }),
    );
  });

  it("fails safely when apply throws before producing a receipt", async () => {
    const providerAdapter = adapter({
      apply: vi.fn().mockRejectedValue(new Error("api-key=secret-token")),
    });
    const harness = service(providerAdapter);

    const result = await harness.service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });

    expect(result).toMatchObject({
      status: "failed",
      errorCode: "provider-apply-failed",
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
    expect(providerAdapter.rollback).not.toHaveBeenCalled();
  });

  it("rejects archived, cross-platform, unsupported, and malformed adapter boundaries", async () => {
    const cases: Array<{
      providerAdapter?: AgentProviderAdapter;
      activationRepository?: AgentProviderActivationRepository;
      expected: string;
    }> = [
      {
        activationRepository: repository({
          getProfile: vi.fn().mockResolvedValue({ ...profile, archived: true }),
        }),
        expected: "AGENT_PROVIDER_PROFILE_ARCHIVED",
      },
      {
        activationRepository: repository({
          getProfile: vi
            .fn()
            .mockResolvedValue({ ...profile, platformId: "claude" }),
        }),
        expected: "AGENT_PROVIDER_PROFILE_PLATFORM_MISMATCH",
      },
      {
        providerAdapter: adapter({
          planActivation: vi.fn().mockResolvedValue(
            plan({
              platformId: "claude",
            }),
          ),
        }),
        expected: "AGENT_PROVIDER_PLAN_INVALID",
      },
    ];

    for (const entry of cases) {
      const harness = service(
        entry.providerAdapter ?? adapter(),
        entry.activationRepository ?? repository(),
      );
      await expect(
        harness.service.preview({ context, profileId: "profile-1" }),
      ).rejects.toThrow(entry.expected);
    }

    const emptyRegistry = new AgentAdapterRegistry();
    emptyRegistry.register("codex", {});
    const unsupported = new AgentProviderActivationService(
      emptyRegistry,
      repository(),
    );
    await expect(
      unsupported.preview({ context, profileId: "profile-1" }),
    ).rejects.toThrow("AGENT_PROVIDER_ADAPTER_UNSUPPORTED");
    await expect(unsupported.importCurrent({ context })).rejects.toThrow(
      "AGENT_PROVIDER_ADAPTER_UNSUPPORTED",
    );
  });

  it("rejects blocked plans and concurrent activation for one platform", async () => {
    let releaseApply: (() => void) | null = null;
    const applyGate = new Promise<void>((resolve) => {
      releaseApply = resolve;
    });
    const providerAdapter = adapter({
      apply: vi.fn().mockImplementation(async () => {
        await applyGate;
        return receipt();
      }),
    });
    const harness = service(providerAdapter);
    const first = harness.service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });

    await vi.waitFor(() => expect(providerAdapter.apply).toHaveBeenCalled());
    await expect(
      harness.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_ACTIVATION_IN_PROGRESS");
    releaseApply?.();
    await expect(first).resolves.toMatchObject({ status: "verified" });

    vi.mocked(providerAdapter.planActivation).mockResolvedValue(
      plan({
        status: "blocked",
        canApply: false,
        blockedReasons: ["secret-required"],
      }),
    );
    await expect(
      harness.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_ACTIVATION_BLOCKED");
    expect(providerAdapter.apply).toHaveBeenCalledTimes(1);
  });

  it("requires explicit field resolutions before overwriting external state", async () => {
    const reviewedPlan = plan({
      status: "backfill",
      canApply: false,
      requiresReview: true,
      decisions: [
        {
          field: "model",
          status: "backfill",
          current: "gpt-5.3",
          desired: "gpt-5.4",
        },
      ],
    });
    const providerAdapter = adapter({
      planActivation: vi.fn().mockResolvedValue(reviewedPlan),
    });
    const harness = service(providerAdapter);

    await expect(
      harness.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
      }),
    ).rejects.toThrow("AGENT_PROVIDER_ACTIVATION_BLOCKED");

    const result = await harness.service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
      resolutions: [{ field: "model", action: "use-profile" }],
    });

    expect(result.status).toBe("verified");
    expect(providerAdapter.apply).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        status: "apply",
        canApply: true,
        requiresReview: false,
        decisions: [
          expect.objectContaining({ field: "model", status: "apply" }),
        ],
      }),
      { profile, modelMappings },
    );
    expect(reviewedPlan.decisions[0]?.status).toBe("backfill");
  });

  it("rejects invalid, duplicate, unnecessary, and incomplete resolutions", async () => {
    const reviewedPlan = plan({
      status: "conflict",
      canApply: false,
      requiresReview: true,
      decisions: [
        {
          field: "model",
          status: "conflict",
          baseline: "gpt-5.2",
          current: "gpt-5.3",
          desired: "gpt-5.4",
        },
        {
          field: "secondaryModel",
          status: "external-modified",
          baseline: "gpt-4.1",
          current: "gpt-4.2",
          desired: "gpt-4.1",
        },
      ],
    });
    const cases: Array<{ resolutions: unknown[]; expected: string }> = [
      {
        resolutions: [{ field: "", action: "use-profile" }],
        expected: "AGENT_PROVIDER_RESOLUTION_INVALID",
      },
      {
        resolutions: [{ field: "missing", action: "use-profile" }],
        expected: "AGENT_PROVIDER_RESOLUTION_INVALID",
      },
      {
        resolutions: [{ field: "model", action: "invalid" }],
        expected: "AGENT_PROVIDER_RESOLUTION_INVALID",
      },
      {
        resolutions: [
          { field: "model", action: "use-profile" },
          { field: "model", action: "preserve-current" },
        ],
        expected: "AGENT_PROVIDER_RESOLUTION_INVALID",
      },
      {
        resolutions: [{ field: "model", action: "use-profile" }],
        expected: "AGENT_PROVIDER_ACTIVATION_BLOCKED",
      },
    ];
    for (const { resolutions, expected } of cases) {
      const harness = service(
        adapter({ planActivation: vi.fn().mockResolvedValue(reviewedPlan) }),
      );
      await expect(
        harness.service.activate({
          context,
          profileId: "profile-1",
          expectedCurrentDigest: "digest-current",
          resolutions: resolutions as never,
        }),
      ).rejects.toThrow(expected);
      expect(harness.adapter.apply).not.toHaveBeenCalled();
    }

    await expect(
      service().service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
        resolutions: null as never,
      }),
    ).rejects.toThrow("AGENT_PROVIDER_RESOLUTION_INVALID");

    const unnecessary = service();
    await expect(
      unnecessary.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
        resolutions: [{ field: "model", action: "use-profile" }],
      }),
    ).rejects.toThrow("AGENT_PROVIDER_RESOLUTION_INVALID");
  });

  it("keeps the native value when review explicitly preserves current state", async () => {
    const harness = service(
      adapter({
        planActivation: vi.fn().mockResolvedValue(
          plan({
            status: "external-modified",
            canApply: false,
            requiresReview: true,
            decisions: [
              {
                field: "model",
                status: "external-modified",
                baseline: "gpt-5.4",
                current: "gpt-5.5",
                desired: "gpt-5.4",
              },
            ],
          }),
        ),
      }),
    );

    await expect(
      harness.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
        resolutions: [{ field: "model", action: "preserve-current" }],
      }),
    ).rejects.toThrow("AGENT_PROVIDER_ACTIVATION_NO_CHANGES");
    expect(harness.adapter.apply).not.toHaveBeenCalled();

    const emptyPlanHarness = service(
      adapter({
        planActivation: vi.fn().mockResolvedValue(
          plan({
            status: "preserve",
            decisions: [],
          }),
        ),
      }),
    );
    await expect(
      emptyPlanHarness.service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
        resolutions: [],
      }),
    ).rejects.toThrow("AGENT_PROVIDER_ACTIVATION_NO_CHANGES");
  });

  it("validates every context, profile, plan, and baseline boundary", async () => {
    const invalidContexts: AgentProviderAdapterContext[] = [
      { ...context, agentId: "" },
      { ...context, platformId: "" },
      { ...context, rootPath: "" },
    ];
    for (const invalidContext of invalidContexts) {
      await expect(
        service().service.preview({
          context: invalidContext,
          profileId: "profile-1",
        }),
      ).rejects.toThrow("AGENT_PROVIDER_CONTEXT_INVALID");
    }
    await expect(
      service().service.preview({ context, profileId: "" }),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_NOT_FOUND");
    await expect(
      service(
        adapter(),
        repository({ getProfile: vi.fn().mockResolvedValue(null) }),
      ).service.preview({ context, profileId: "missing" }),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_NOT_FOUND");
    const invalidMappings: AgentProviderModelMapping[][] = [
      null as never,
      [{ ...modelMappings[0], providerProfileId: "other" }],
      [{ ...modelMappings[0], routeKey: 1 as never }],
      [{ ...modelMappings[0], routeKey: " " }],
      [{ ...modelMappings[0], modelId: 1 as never }],
      [{ ...modelMappings[0], modelId: " " }],
    ];
    for (const mappings of invalidMappings) {
      await expect(
        service(
          adapter(),
          repository({
            listModelMappings: vi.fn().mockResolvedValue(mappings),
          }),
        ).service.preview({ context, profileId: "profile-1" }),
      ).rejects.toThrow("AGENT_PROVIDER_MODEL_MAPPINGS_INVALID");
    }
    await expect(
      service(
        adapter(),
        repository({
          getBaseline: vi
            .fn()
            .mockResolvedValue({ ...state(), platformId: "claude" }),
        }),
      ).service.preview({ context, profileId: "profile-1" }),
    ).rejects.toThrow("AGENT_PROVIDER_BASELINE_INVALID");
    await expect(
      service(
        adapter({
          planActivation: vi
            .fn()
            .mockRejectedValue(new Error("token=secret-token")),
        }),
      ).service.preview({ context, profileId: "profile-1" }),
    ).rejects.toThrow("AGENT_PROVIDER_PLAN_FAILED");

    const invalidPlans: AgentProviderActivationPlan[] = [
      { ...plan(), platformId: "claude" },
      { ...plan(), profileId: "other" },
      { ...plan(), adapterVersion: "2" },
      { ...plan(), currentDigest: 1 as never },
      { ...plan(), currentDigest: " " },
      { ...plan(), status: "invalid" as never },
      { ...plan(), canApply: "yes" as never },
      { ...plan(), requiresReview: "no" as never },
      { ...plan(), decisions: null as never },
      { ...plan(), decisions: [null as never] },
      {
        ...plan(),
        decisions: [{ field: 1 as never, status: "apply" }],
      },
      {
        ...plan(),
        decisions: [{ field: " ", status: "apply" }],
      },
      {
        ...plan(),
        decisions: [{ field: "model", status: "invalid" as never }],
      },
      { ...plan(), blockedReasons: null as never },
      { ...plan(), blockedReasons: [1 as never] },
    ];
    for (const invalidPlan of invalidPlans) {
      await expect(
        service(
          adapter({
            planActivation: vi.fn().mockResolvedValue(invalidPlan),
          }),
        ).service.preview({ context, profileId: "profile-1" }),
      ).rejects.toThrow("AGENT_PROVIDER_PLAN_INVALID");
    }
  });

  it("rejects every malformed apply receipt before verification", async () => {
    const invalidReceipts: AgentProviderApplyReceipt[] = [
      { ...receipt(), platformId: "claude" },
      { ...receipt(), profileId: "other" },
      { ...receipt(), adapterVersion: "2" },
      { ...receipt(), nativeDigestBefore: "other" },
      { ...receipt(), nativeDigestAfter: 1 as never },
      { ...receipt(), nativeDigestAfter: " " },
      { ...receipt(), backupRef: 1 as never },
      { ...receipt(), appliedAt: Number.NaN },
    ];
    for (const invalidReceipt of invalidReceipts) {
      const providerAdapter = adapter({
        apply: vi.fn().mockResolvedValue(invalidReceipt),
      });
      const result = await service(providerAdapter).service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
      });
      expect(result).toMatchObject({
        status: "failed",
        errorCode: "provider-apply-failed",
      });
      expect(providerAdapter.verify).not.toHaveBeenCalled();
    }
  });

  it("rolls back every malformed verification boundary", async () => {
    const invalidVerifications: AgentProviderVerification[] = [
      { ...verification(), verified: "yes" as never },
      { ...verification(), nativeDigest: 1 as never },
      { ...verification(), nativeDigest: " " },
      { ...verification(), state: null as never },
      {
        ...verification(),
        state: { ...state("digest-after"), platformId: "claude" },
      },
      {
        ...verification(),
        state: { ...state("digest-after"), adapterVersion: "2" },
      },
      {
        ...verification(),
        state: { ...state("different") },
      },
      { ...verification(), errorCode: 1 as never },
      { ...verification(), nativeDigest: "other", state: state("other") },
    ];
    for (const invalidVerification of invalidVerifications) {
      const providerAdapter = adapter({
        verify: vi.fn().mockResolvedValue(invalidVerification),
      });
      const result = await service(providerAdapter).service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
      });
      expect(result).toMatchObject({
        status: "rolled-back",
        errorCode: "provider-verification-failed",
      });
      expect(providerAdapter.rollback).toHaveBeenCalledOnce();
    }
  });

  it("fails closed for every malformed rollback boundary", async () => {
    const invalidRollbacks: AgentProviderRollbackResult[] = [
      { ...rollback(), restored: "yes" as never },
      { ...rollback(), nativeDigest: 1 as never },
      { ...rollback(), nativeDigest: " " },
      { ...rollback(), errorCode: 1 as never },
    ];
    for (const invalidRollback of invalidRollbacks) {
      const providerAdapter = adapter({
        verify: vi
          .fn()
          .mockResolvedValue(
            verification({ verified: false, errorCode: undefined }),
          ),
        rollback: vi.fn().mockResolvedValue(invalidRollback),
      });
      const result = await service(providerAdapter).service.activate({
        context,
        profileId: "profile-1",
        expectedCurrentDigest: "digest-current",
      });
      expect(result).toMatchObject({
        status: "failed",
        errorCode: "provider-rollback-failed",
      });
    }
  });

  it("rolls back verified native state when audit persistence fails", async () => {
    const activationRepository = repository();
    vi.mocked(activationRepository.recordSnapshot)
      .mockRejectedValueOnce(new Error("database secret-token"))
      .mockImplementationOnce(async (input) => snapshot(input));
    const result = await service(
      adapter(),
      activationRepository,
    ).service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });
    expect(result).toMatchObject({
      status: "rolled-back",
      errorCode: "provider-audit-write-failed",
    });
    expect(JSON.stringify(result)).not.toContain("secret-token");
  });

  it("uses generic audit errors when rollback or failure recording also fails", async () => {
    const alwaysFailingRepository = repository({
      recordSnapshot: vi
        .fn()
        .mockRejectedValue(new Error("database secret-token")),
    });
    const rollbackResult = await service(
      adapter({
        verify: vi.fn().mockRejectedValue(new Error("verify secret-token")),
      }),
      alwaysFailingRepository,
    ).service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });
    expect(rollbackResult).toMatchObject({
      status: "failed",
      errorCode: "provider-audit-write-failed",
    });

    const applyResult = await service(
      adapter({
        apply: vi.fn().mockRejectedValue(new Error("apply secret-token")),
      }),
      alwaysFailingRepository,
    ).service.activate({
      context,
      profileId: "profile-1",
      expectedCurrentDigest: "digest-current",
    });
    expect(applyResult).toMatchObject({
      status: "failed",
      errorCode: "provider-apply-failed",
    });
    expect(JSON.stringify([rollbackResult, applyResult])).not.toContain(
      "secret-token",
    );
  });
});
