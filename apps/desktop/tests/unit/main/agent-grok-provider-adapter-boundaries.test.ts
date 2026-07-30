/**
 * @vitest-environment node
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentProviderAdapterContext,
  AgentProviderApplyReceipt,
  AgentProviderModelMapping,
  AgentProviderProfile,
} from "@prompthub/shared";
import { createAgentGrokProviderAdapter } from "../../../src/main/services/agent-grok-provider-adapter";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "grok-boundary-"));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => fs.rm(root, { recursive: true, force: true })),
  );
});

function context(rootPath: string): AgentProviderAdapterContext {
  return { agentId: "grok", platformId: "grok", rootPath };
}

function profile(
  overrides: Partial<AgentProviderProfile> = {},
): AgentProviderProfile {
  return {
    id: "profile-grok",
    platformId: "grok",
    name: "Team Grok",
    providerKind: "openai-compatible",
    protocol: "openai-chat",
    endpoint: "https://provider.example/v1",
    config: { providerId: "team-grok", envKey: "TEAM_GROK_KEY" },
    secretRef: null,
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mappings(
  overrides: Partial<AgentProviderModelMapping> = {},
): AgentProviderModelMapping[] {
  return [
    {
      id: "mapping-primary",
      providerProfileId: "profile-grok",
      routeKey: "primary",
      modelId: "team-grok",
      parameters: {
        upstreamModelId: "grok-4",
        contextWindow: 131_072,
      },
      ...overrides,
    },
  ];
}

function encryption(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value: string) => Buffer.from(`safe:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^safe:/, ""),
  };
}

function options(root: string, overrides: Record<string, unknown> = {}) {
  return {
    backupRoot: path.join(root, "backups"),
    backupEncryption: encryption(),
    environment: { TEAM_GROK_KEY: "main-only-secret" },
    openAIConnection: vi.fn().mockResolvedValue({
      protocol: "chat",
      endpointOrigin: "https://provider.example",
      model: "grok-4",
      status: "ok",
      startedAt: 1,
      finishedAt: 2,
      totalMs: 1,
      retryCount: 0,
      modelCount: 1,
      modelAvailable: true,
    }),
    openAIModel: vi.fn().mockResolvedValue({
      protocol: "chat",
      endpointOrigin: "https://provider.example",
      model: "grok-4",
      status: "ok",
      startedAt: 1,
      finishedAt: 2,
      totalMs: 1,
      firstTokenMs: 1,
      retryCount: 0,
      inputTokens: 1,
      outputTokens: 1,
      outputPreview: "OK",
    }),
    ...overrides,
  };
}

async function writeNative(root: string, alias = "grok-build"): Promise<void> {
  await fs.writeFile(
    path.join(root, "config.toml"),
    `[models]\ndefault = "${alias}"\n`,
  );
}

async function plan(
  root: string,
  overrides: {
    profile?: AgentProviderProfile;
    mappings?: AgentProviderModelMapping[];
  } = {},
) {
  const adapter = createAgentGrokProviderAdapter(options(root));
  return adapter.planActivation({
    context: context(root),
    profile: overrides.profile ?? profile(),
    modelMappings: overrides.mappings ?? mappings(),
    baseline: await adapter.inspect(context(root)),
  });
}

describe("Grok Build Provider adapter boundaries", () => {
  it("supports all three documented direct protocol mappings", async () => {
    for (const [providerKind, protocol, backend] of [
      ["openai-compatible", "openai-chat", "chat_completions"],
      ["openai-responses", "openai-responses", "responses"],
      ["anthropic", "anthropic-messages", "messages"],
    ] as const) {
      const root = await temporaryRoot();
      await writeNative(root);
      const adapter = createAgentGrokProviderAdapter(options(root));
      const candidate = profile({ providerKind, protocol });
      const activation = await adapter.planActivation({
        context: context(root),
        profile: candidate,
        modelMappings: mappings(),
        baseline: await adapter.inspect(context(root)),
      });
      const receipt = await adapter.apply(context(root), activation, {
        profile: candidate,
        modelMappings: mappings(),
      });
      expect(
        await fs.readFile(path.join(root, "config.toml"), "utf8"),
      ).toContain(`api_backend = "${backend}"`);
      expect(
        (await adapter.verify(context(root), activation, receipt)).verified,
      ).toBe(true);
    }
  });

  it("collects validation failures without writing native state", async () => {
    const root = await temporaryRoot();
    await writeNative(root);
    const invalid = await plan(root, {
      profile: profile({
        name: "",
        protocol: "unknown",
        endpoint: "http://public.example/?secret=x",
        config: {
          providerId: "../bad",
          envKey: "1BAD",
          unexpected: true,
        },
        secretRef: "agent-provider:must-not-project",
      }),
      mappings: [
        ...mappings({
          modelId: "",
          parameters: {
            upstreamModelId: "",
            contextWindow: 0,
            extra: true,
          },
        }),
        {
          ...mappings()[0],
          id: "duplicate",
        },
      ],
    });

    expect(invalid.canApply).toBe(false);
    expect(invalid.blockedReasons).toEqual(
      expect.arrayContaining([
        "provider-name-invalid",
        "provider-id-invalid",
        "primary-model-required",
        "upstream-model-required",
        "model-parameters-unsupported",
        "provider-config-unsupported",
        "provider-secret-unsupported",
        "provider-protocol-unsupported",
        "provider-endpoint-invalid",
        "provider-env-key-invalid",
      ]),
    );
    expect(await fs.readFile(path.join(root, "config.toml"), "utf8")).toBe(
      '[models]\ndefault = "grok-build"\n',
    );
  });

  it("allows selecting a built-in alias without taking over native auth", async () => {
    const root = await temporaryRoot();
    await writeNative(root, "grok-build");
    const adapter = createAgentGrokProviderAdapter(options(root));
    const nativeProfile = profile({
      name: "Grok Build",
      providerKind: "grok",
      protocol: "platform-native",
      endpoint: null,
      config: {
        providerId: "grok-fast",
        nativeAuthOwnership: "platform-session",
      },
    });
    const nativeMappings = mappings({
      modelId: "grok-fast",
      parameters: { upstreamModelId: "grok-fast" },
    });
    const activation = await adapter.planActivation({
      context: context(root),
      profile: nativeProfile,
      modelMappings: nativeMappings,
      baseline: await adapter.inspect(context(root)),
    });
    expect(activation.canApply).toBe(true);
    const receipt = await adapter.apply(context(root), activation, {
      profile: nativeProfile,
      modelMappings: nativeMappings,
    });
    expect((await adapter.inspect(context(root))).values.credentialStatus).toBe(
      "platform-managed",
    );
    expect(
      await fs.readFile(path.join(root, "config.toml"), "utf8"),
    ).not.toContain("api_key");
    expect(
      (
        await adapter.testConnection!(context(root), {
          profile: nativeProfile,
          modelMappings: nativeMappings,
        })
      ).status,
    ).toBe("unsupported");
    expect(
      (
        await adapter.testModel!(
          context(root),
          { profile: nativeProfile, modelMappings: nativeMappings },
          new AbortController().signal,
        )
      ).status,
    ).toBe("unsupported");
    expect((await adapter.rollback(context(root), receipt)).restored).toBe(
      true,
    );
  });

  it("redacts sensitive headers and missing native configuration", async () => {
    const root = await temporaryRoot();
    const adapter = createAgentGrokProviderAdapter(options(root));
    await expect(adapter.importCurrent(context(root))).rejects.toThrow(
      "AGENT_GROK_PROVIDER_IMPORT_UNAVAILABLE",
    );

    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        "[models]",
        'default = "header-owned"',
        "",
        "[model.header-owned]",
        'model = "grok-4"',
        'base_url = "https://provider.example/v1"',
        'api_backend = "messages"',
        "",
        "[model.header-owned.extra_headers]",
        'Authorization = "Bearer native-header-secret"',
      ].join("\n"),
    );
    const imported = await adapter.importCurrent(context(root));
    expect(imported.profile.protocol).toBe("platform-native");
    expect(imported.warnings).toContain("native-provider-read-only");
    expect(JSON.stringify(imported)).not.toContain("native-header-secret");

    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        "[models]",
        'default = "session-owned"',
        "",
        "[model.session-owned]",
        'model = "grok-4"',
        'base_url = "https://provider.example/v1"',
        'name = "  "',
      ].join("\n"),
    );
    const sessionOwned = await adapter.importCurrent(context(root));
    expect(sessionOwned.profile).toMatchObject({
      name: "session-owned",
      protocol: "platform-native",
      config: {
        providerId: "session-owned",
        nativeAuthOwnership: "platform-session",
      },
    });
  });

  it("rejects malformed endpoint and profile field variants", async () => {
    const root = await temporaryRoot();
    await writeNative(root);
    for (const candidate of [
      profile({ endpoint: "http://public.example" }),
      profile({ endpoint: "::not-a-url::" }),
      profile({ config: { envKey: "TEAM_GROK_KEY" } }),
      profile({
        config: { providerId: "team-grok", envKey: "TEAM_GROK_KEY" },
      }),
    ]) {
      const adapter = createAgentGrokProviderAdapter(options(root));
      const candidateMappings =
        candidate.config.providerId === undefined
          ? mappings()
          : mappings({
              parameters: {
                upstreamModelId: "grok-4",
                contextWindow: 0,
              },
            });
      const activation = await adapter.planActivation({
        context: context(root),
        profile: candidate,
        modelMappings: candidateMappings,
        baseline: await adapter.inspect(context(root)),
      });
      expect(activation.canApply).toBe(false);
    }
  });

  it("covers model probes, platform mismatch, and missing credentials", async () => {
    const root = await temporaryRoot();
    await writeNative(root);
    const openAIModel = vi.fn().mockResolvedValue({
      protocol: "chat",
      endpointOrigin: "https://provider.example",
      model: "grok-4",
      status: "ok",
      startedAt: 1,
      finishedAt: 2,
      totalMs: 1,
      firstTokenMs: 1,
      retryCount: 0,
      inputTokens: 1,
      outputTokens: 1,
      outputPreview: "OK",
    });
    const adapter = createAgentGrokProviderAdapter(
      options(root, { openAIModel }),
    );
    const result = await adapter.testModel!(
      context(root),
      { profile: profile(), modelMappings: mappings() },
      new AbortController().signal,
    );
    expect(result.status).toBe("ok");
    expect(openAIModel).toHaveBeenCalledWith(
      expect.objectContaining({ credential: "main-only-secret" }),
    );

    const missing = createAgentGrokProviderAdapter(
      options(root, { environment: {} }),
    );
    expect(
      (
        await missing.testModel!(
          context(root),
          { profile: profile(), modelMappings: mappings() },
          new AbortController().signal,
        )
      ).status,
    ).toBe("no-credentials");
    expect(
      (
        await adapter.testConnection!(context(root), {
          profile: profile({ endpoint: null }),
          modelMappings: [],
        })
      ).status,
    ).toBe("no-credentials");
    expect(
      (
        await adapter.testModel!(
          context(root),
          { profile: profile({ endpoint: null }), modelMappings: [] },
          new AbortController().signal,
        )
      ).status,
    ).toBe("no-credentials");
    await expect(
      adapter.testModel!(
        context(root),
        {
          profile: profile({ platformId: "codex" }),
          modelMappings: mappings(),
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_PLATFORM_MISMATCH");
    await expect(
      adapter.testConnection!(context(root), {
        profile: profile({ platformId: "codex" }),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_PLATFORM_MISMATCH");

    const mismatch = await adapter.planActivation({
      context: context(root),
      profile: profile({ platformId: "codex" }),
      modelMappings: mappings(),
      baseline: null,
    });
    expect(mismatch.blockedReasons).toContain("provider-platform-mismatch");
  });

  it("restores the original after concurrent and post-write failures", async () => {
    const concurrentRoot = await temporaryRoot();
    await writeNative(concurrentRoot);
    const concurrent = createAgentGrokProviderAdapter(
      options(concurrentRoot, {
        hooks: {
          beforeWrite: async () => {
            await fs.appendFile(
              path.join(concurrentRoot, "config.toml"),
              '\n[ui]\ntheme = "external"\n',
            );
          },
        },
      }),
    );
    const concurrentPlan = await concurrent.planActivation({
      context: context(concurrentRoot),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await concurrent.inspect(context(concurrentRoot)),
    });
    await expect(
      concurrent.apply(context(concurrentRoot), concurrentPlan, {
        profile: profile(),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_GROK_PROVIDER_CONCURRENT_CHANGE");

    const failedRoot = await temporaryRoot();
    await writeNative(failedRoot);
    const original = await fs.readFile(
      path.join(failedRoot, "config.toml"),
      "utf8",
    );
    const failed = createAgentGrokProviderAdapter(
      options(failedRoot, {
        hooks: {
          afterWrite: async () => {
            throw new Error("simulated");
          },
        },
      }),
    );
    const failedPlan = await failed.planActivation({
      context: context(failedRoot),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await failed.inspect(context(failedRoot)),
    });
    await expect(
      failed.apply(context(failedRoot), failedPlan, {
        profile: profile(),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_GROK_PROVIDER_WRITE_FAILED");
    expect(
      await fs.readFile(path.join(failedRoot, "config.toml"), "utf8"),
    ).toBe(original);
  });

  it("fails closed when backup encryption or rollback evidence is invalid", async () => {
    const root = await temporaryRoot();
    await writeNative(root);
    const unavailable = createAgentGrokProviderAdapter(
      options(root, { backupEncryption: encryption(false) }),
    );
    const activation = await unavailable.planActivation({
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await unavailable.inspect(context(root)),
    });
    await expect(
      unavailable.apply(context(root), activation, {
        profile: profile(),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_CONFIG_BACKUP_ENCRYPTION_UNAVAILABLE");

    const invalidReceipt: AgentProviderApplyReceipt = {
      platformId: "grok",
      profileId: "profile-grok",
      adapterVersion: "grok-provider-profile-v1",
      nativeDigestBefore: "before",
      nativeDigestAfter: "after",
      backupRef: path.join(root, "outside.enc"),
      appliedAt: 1,
    };
    expect(
      (await unavailable.rollback(context(root), invalidReceipt)).restored,
    ).toBe(false);
    expect(
      (
        await unavailable.verify(
          context(root),
          { ...activation, decisions: [] },
          invalidReceipt,
        )
      ).verified,
    ).toBe(false);
  });

  it("rejects target tampering, failed verification, and rollback mismatch", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        "[models]",
        'default = "grok-build"',
        "",
        "[model.team-grok]",
        'model = "old-model"',
        'base_url = "https://old.example/v1"',
        'env_key = "OLD_KEY"',
      ].join("\n"),
    );
    const adapter = createAgentGrokProviderAdapter(options(root));
    const activation = await adapter.planActivation({
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await adapter.inspect(context(root)),
    });
    const tampered = {
      ...activation,
      decisions: activation.decisions.map((decision) =>
        decision.field === "model"
          ? { ...decision, desired: "tampered" }
          : decision,
      ),
    };
    await expect(
      adapter.apply(context(root), tampered, {
        profile: profile(),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_GROK_PROVIDER_PLAN_INVALID");
    await expect(
      adapter.apply(context(root), activation, {
        profile: profile({ endpoint: null }),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_GROK_PROVIDER_PROFILE_INVALID");

    const failing = createAgentGrokProviderAdapter(
      options(root, {
        hooks: {
          afterWrite: async () => {
            await fs.writeFile(
              path.join(root, "config.toml"),
              '[models]\ndefault = "different"\n',
            );
          },
        },
      }),
    );
    const failingPlan = await failing.planActivation({
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await failing.inspect(context(root)),
    });
    await expect(
      failing.apply(context(root), failingPlan, {
        profile: profile(),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_GROK_PROVIDER_WRITE_FAILED");

    const applied = await adapter.planActivation({
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await adapter.inspect(context(root)),
    });
    const receipt = await adapter.apply(context(root), applied, {
      profile: profile(),
      modelMappings: mappings(),
    });
    const mismatch = await adapter.rollback(context(root), {
      ...receipt,
      nativeDigestBefore: "wrong-before",
    });
    expect(mismatch).toMatchObject({
      restored: false,
      errorCode: "provider-rollback-mismatch",
    });
  });

  it("removes a newly created config when rolling back", async () => {
    const root = await temporaryRoot();
    const adapter = createAgentGrokProviderAdapter(options(root));
    const activation = await adapter.planActivation({
      context: context(root),
      profile: profile(),
      modelMappings: mappings({ parameters: { upstreamModelId: "grok-4" } }),
      baseline: await adapter.inspect(context(root)),
    });
    const receipt = await adapter.apply(context(root), activation, {
      profile: profile(),
      modelMappings: mappings({ parameters: { upstreamModelId: "grok-4" } }),
    });
    expect(receipt.backupRef).toBeNull();
    expect((await adapter.rollback(context(root), receipt)).restored).toBe(
      true,
    );
    await expect(fs.stat(path.join(root, "config.toml"))).rejects.toThrow();
  });

  it("uses the main process environment by default", async () => {
    const root = await temporaryRoot();
    await writeNative(root);
    const previous = process.env.TEAM_GROK_KEY;
    process.env.TEAM_GROK_KEY = "process-only-secret";
    try {
      const openAIConnection = vi.fn().mockResolvedValue({
        protocol: "chat",
        endpointOrigin: "https://provider.example",
        model: "grok-4",
        status: "ok",
        startedAt: 1,
        finishedAt: 2,
        totalMs: 1,
        retryCount: 0,
        modelCount: 1,
        modelAvailable: true,
      });
      const adapter = createAgentGrokProviderAdapter({
        backupRoot: path.join(root, "backups"),
        backupEncryption: encryption(),
        openAIConnection,
      });
      await adapter.testConnection!(context(root), {
        profile: profile(),
        modelMappings: mappings(),
      });
      expect(openAIConnection).toHaveBeenCalledWith(
        expect.objectContaining({ credential: "process-only-secret" }),
      );
    } finally {
      if (previous === undefined) {
        delete process.env.TEAM_GROK_KEY;
      } else {
        process.env.TEAM_GROK_KEY = previous;
      }
    }
  });
});
