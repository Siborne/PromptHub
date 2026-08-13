/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from "vitest";

import type {
  AgentProviderAdapterContext,
  AgentProviderModelMapping,
  AgentProviderModelTestResult,
  AgentProviderProfile,
} from "@prompthub/shared";

import { createAgentCodexProviderAdapter } from "../../../src/main/services/agent-codex-provider-adapter";

const context: AgentProviderAdapterContext = {
  agentId: "codex",
  platformId: "codex",
  rootPath: "/tmp/codex-model-test",
};

function profile(
  overrides: Partial<AgentProviderProfile> = {},
): AgentProviderProfile {
  return {
    id: "profile-1",
    platformId: "codex",
    name: "Work Gateway",
    providerKind: "openai-compatible",
    protocol: "openai-responses",
    endpoint: "https://gateway.example.com/v1",
    config: { providerId: "work-gateway" },
    secretRef: "agent-provider:profile-1",
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mappings(model = "gpt-5.4"): AgentProviderModelMapping[] {
  return [
    {
      id: "mapping-primary",
      providerProfileId: "profile-1",
      routeKey: "primary",
      modelId: model,
      parameters: {},
    },
  ];
}

function modelResult(
  overrides: Partial<
    Omit<AgentProviderModelTestResult, "platformId" | "profileId">
  > = {},
): Omit<AgentProviderModelTestResult, "platformId" | "profileId"> {
  return {
    protocol: "responses",
    endpointOrigin: "https://gateway.example.com",
    model: "gpt-5.4",
    status: "ok",
    startedAt: 10,
    finishedAt: 20,
    totalMs: 10,
    firstTokenMs: 5,
    retryCount: 0,
    inputTokens: 8,
    outputTokens: 1,
    outputPreview: "OK",
    ...overrides,
  };
}

function adapterOptions(
  overrides: Record<string, unknown> = {},
): Parameters<typeof createAgentCodexProviderAdapter>[0] {
  return {
    backupRoot: "/tmp/codex-model-test-backups",
    backupEncryption: {
      isEncryptionAvailable: () => true,
      encryptString: (value: string) => Buffer.from(value),
      decryptString: (value: Buffer) => value.toString(),
    },
    secretStore: { read: vi.fn().mockResolvedValue("main-only-secret") },
    now: () => 25,
    ...overrides,
  };
}

describe("Codex Provider Profile streaming model test", () => {
  it("resolves a managed credential only in main and delegates without native mutation", async () => {
    const testModel = vi.fn().mockResolvedValue(modelResult());
    const secretStore = {
      read: vi.fn().mockResolvedValue("main-only-secret"),
    };
    const adapter = createAgentCodexProviderAdapter(
      adapterOptions({ secretStore, testModel }),
    );
    const signal = new AbortController().signal;

    await expect(
      adapter.testModel?.(
        context,
        { profile: profile(), modelMappings: mappings() },
        signal,
      ),
    ).resolves.toEqual({
      platformId: "codex",
      profileId: "profile-1",
      ...modelResult(),
    });

    expect(secretStore.read).toHaveBeenCalledWith("agent-provider:profile-1");
    expect(testModel).toHaveBeenCalledWith({
      endpoint: "https://gateway.example.com/v1",
      credential: "main-only-secret",
      model: "gpt-5.4",
      protocol: "responses",
      signal,
    });
    expect(JSON.stringify(testModel.mock.calls)).not.toContain("config.toml");
  });

  it("resolves an environment credential and preserves cancellation", async () => {
    const testModel = vi
      .fn()
      .mockResolvedValue(modelResult({ status: "cancelled" }));
    const adapter = createAgentCodexProviderAdapter(
      adapterOptions({
        env: { CODEX_WORK_KEY: "environment-secret" },
        secretStore: { read: vi.fn() },
        testModel,
      }),
    );
    const signal = new AbortController().signal;
    const envProfile = profile({
      config: { providerId: "work-gateway", envKey: "CODEX_WORK_KEY" },
      secretRef: null,
    });

    await expect(
      adapter.testModel?.(
        context,
        { profile: envProfile, modelMappings: mappings() },
        signal,
      ),
    ).resolves.toMatchObject({ status: "cancelled" });
    expect(testModel).toHaveBeenCalledWith(
      expect.objectContaining({
        credential: "environment-secret",
        signal,
      }),
    );
  });

  it("fails closed for unavailable credentials and invalid profiles", async () => {
    const testModel = vi.fn();
    const missingSecretAdapter = createAgentCodexProviderAdapter(
      adapterOptions({
        secretStore: { read: vi.fn().mockResolvedValue(null) },
        testModel,
      }),
    );
    await expect(
      missingSecretAdapter.testModel?.(
        context,
        { profile: profile(), modelMappings: mappings() },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({
      status: "no-credentials",
      totalMs: 0,
      outputPreview: null,
    });

    const invalidAdapter = createAgentCodexProviderAdapter(
      adapterOptions({ testModel }),
    );
    await expect(
      invalidAdapter.testModel?.(
        context,
        {
          profile: profile({ endpoint: "http://remote.example.com/v1" }),
          modelMappings: mappings(),
        },
        new AbortController().signal,
      ),
    ).resolves.toMatchObject({ status: "unsupported" });

    expect(testModel).not.toHaveBeenCalled();
  });

  it("delegates official profiles to the native Codex model probe", async () => {
    const testModel = vi.fn();
    const testNativeModel = vi.fn().mockResolvedValue(
      modelResult({
        protocol: "platform-native",
        endpointOrigin: null,
        model: "gpt-5.6-sol",
      }),
    );
    const adapter = createAgentCodexProviderAdapter(
      adapterOptions({ testModel, testNativeModel }),
    );
    const nativeProfile = profile({
      providerKind: "openai",
      protocol: "platform-native",
      endpoint: null,
      config: { providerId: "openai" },
      secretRef: null,
    });
    const signal = new AbortController().signal;

    await expect(
      adapter.testModel?.(
        context,
        { profile: nativeProfile, modelMappings: mappings("gpt-5.6-sol") },
        signal,
      ),
    ).resolves.toEqual({
      platformId: "codex",
      profileId: "profile-1",
      ...modelResult({
      protocol: "platform-native",
      endpointOrigin: null,
        model: "gpt-5.6-sol",
      }),
    });
    expect(testNativeModel).toHaveBeenCalledWith({
      codexHome: "/tmp/codex-model-test",
      model: "gpt-5.6-sol",
      signal,
    });
    expect(testModel).not.toHaveBeenCalled();
  });

  it("rejects a cross-platform profile before reading credentials", async () => {
    const secretStore = { read: vi.fn() };
    const adapter = createAgentCodexProviderAdapter(
      adapterOptions({ secretStore, testModel: vi.fn() }),
    );

    await expect(
      adapter.testModel?.(
        context,
        {
          profile: profile({ platformId: "claude" }),
          modelMappings: mappings(),
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow("AGENT_PROVIDER_PROFILE_PLATFORM_MISMATCH");
    expect(secretStore.read).not.toHaveBeenCalled();
  });
});
