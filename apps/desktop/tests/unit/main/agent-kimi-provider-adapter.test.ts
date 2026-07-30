/**
 * @vitest-environment node
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse as parseToml } from "smol-toml";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentProviderAdapterContext,
  AgentProviderModelMapping,
  AgentProviderProfile,
} from "@prompthub/shared";
import { createAgentKimiProviderAdapter } from "../../../src/main/services/agent-kimi-provider-adapter";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "kimi-provider-"));
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
  return { agentId: "kimi", platformId: "kimi", rootPath };
}

function profile(
  overrides: Partial<AgentProviderProfile> = {},
): AgentProviderProfile {
  return {
    id: "profile-kimi",
    platformId: "kimi",
    name: "Kimi direct API",
    providerKind: "kimi",
    protocol: "openai-chat",
    endpoint: "https://api.moonshot.ai/v1",
    config: { providerId: "prompthub-kimi" },
    secretRef: "agent-provider:profile-kimi",
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mappings(
  modelId = "work/kimi-k2",
  parameters: Record<string, unknown> = {
    upstreamModelId: "kimi-k2",
    maxContextSize: 131_072,
  },
): AgentProviderModelMapping[] {
  return [
    {
      id: "mapping-primary",
      providerProfileId: "profile-kimi",
      routeKey: "primary",
      modelId,
      parameters,
    },
  ];
}

function encryption(available = true) {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value: string) =>
      Buffer.from(`protected:${Buffer.from(value).toString("base64")}`),
    decryptString: (value: Buffer) =>
      Buffer.from(
        value.toString().replace(/^protected:/, ""),
        "base64",
      ).toString(),
  };
}

function successfulConnection(protocol: string) {
  return {
    protocol,
    endpointOrigin: "https://provider.example",
    model: "upstream-model",
    status: "ok" as const,
    startedAt: 1,
    finishedAt: 2,
    totalMs: 1,
    retryCount: 0,
    modelCount: 1,
    modelAvailable: true,
  };
}

function successfulModel(protocol: string) {
  return {
    protocol,
    endpointOrigin: "https://provider.example",
    model: "upstream-model",
    status: "ok" as const,
    startedAt: 1,
    finishedAt: 2,
    totalMs: 1,
    firstTokenMs: 1,
    retryCount: 0,
    inputTokens: 1,
    outputTokens: 1,
    outputPreview: "OK",
  };
}

function options(root: string, overrides: Record<string, unknown> = {}) {
  return {
    backupRoot: path.join(root, "backups"),
    backupEncryption: encryption(),
    secretStore: { read: vi.fn().mockResolvedValue("main-only-kimi-key") },
    ...overrides,
  };
}

function tomlRecord(raw: string): Record<string, unknown> {
  return parseToml(raw) as Record<string, unknown>;
}

describe("Kimi Code unified Provider Profile adapter", () => {
  it("imports direct provider metadata without exposing native credentials", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        'default_model = "work/kimi-k2"',
        'default_permission_mode = "manual"',
        "",
        "[providers.work]",
        'type = "kimi"',
        'base_url = "https://user:password@api.moonshot.ai/v1?token=hidden"',
        'api_key = "native-secret"',
        'keep_provider_field = "yes"',
        "",
        '[models."work/kimi-k2"]',
        'provider = "work"',
        'model = "kimi-k2"',
        "max_context_size = 131072",
        'display_name = "Kimi K2"',
        "",
      ].join("\n"),
    );
    const adapter = createAgentKimiProviderAdapter(options(root));

    const state = await adapter.inspect(context(root));
    expect(state.values).toMatchObject({
      providerId: "work",
      provider: "kimi",
      protocol: "openai-chat",
      endpoint: "https://api.moonshot.ai/v1",
      model: "work/kimi-k2",
      upstreamModel: "kimi-k2",
      maxContextSize: 131_072,
      credentialStatus: "configured",
      authOwnership: "native-inline",
    });
    expect(JSON.stringify(state)).not.toContain("native-secret");
    expect(JSON.stringify(state)).not.toContain("password");
    expect(JSON.stringify(state)).not.toContain("token=hidden");

    const imported = await adapter.importCurrent(context(root));
    expect(imported).toMatchObject({
      profile: {
        platformId: "kimi",
        providerKind: "kimi",
        protocol: "openai-chat",
        endpoint: "https://api.moonshot.ai/v1",
        config: { providerId: "work" },
        secretRef: null,
        source: "native-import",
      },
      modelMappings: [
        {
          routeKey: "primary",
          modelId: "work/kimi-k2",
          parameters: {
            upstreamModelId: "kimi-k2",
            maxContextSize: 131_072,
          },
        },
      ],
    });
    expect(imported.warnings).toEqual(
      expect.arrayContaining([
        "native-credential-not-imported",
        "native-formatting-may-change",
      ]),
    );
    expect(JSON.stringify(imported)).not.toContain("native-secret");
  });

  it("projects a direct provider and model while preserving unrelated semantic fields", async () => {
    const root = await temporaryRoot();
    const configPath = path.join(root, "config.toml");
    const original = [
      'default_model = "existing/model"',
      'default_permission_mode = "manual"',
      "telemetry = false",
      "",
      "[providers.existing]",
      'type = "openai"',
      'base_url = "https://existing.example/v1"',
      'api_key = "existing-secret"',
      "",
      '[models."existing/model"]',
      'provider = "existing"',
      'model = "existing-upstream"',
      "max_context_size = 32768",
      "",
      "[services.search]",
      'base_url = "https://search.example"',
      "",
      "[[hooks]]",
      'event = "PreToolUse"',
      'command = "check"',
      "",
    ].join("\n");
    await fs.writeFile(configPath, original);
    const validateNativeConfig = vi.fn();
    const adapter = createAgentKimiProviderAdapter(
      options(root, { validateNativeConfig }),
    );
    const input = {
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await adapter.inspect(context(root)),
    };

    const plan = await adapter.planActivation(input);
    expect(plan.canApply).toBe(true);
    const receipt = await adapter.apply(context(root), plan, {
      profile: input.profile,
      modelMappings: input.modelMappings,
    });
    expect(validateNativeConfig).toHaveBeenCalledWith(configPath);

    const savedRaw = await fs.readFile(configPath, "utf8");
    const saved = tomlRecord(savedRaw);
    expect(saved).toMatchObject({
      default_model: "work/kimi-k2",
      default_permission_mode: "manual",
      telemetry: false,
      providers: {
        existing: {
          type: "openai",
          base_url: "https://existing.example/v1",
          api_key: "existing-secret",
        },
        "prompthub-kimi": {
          type: "kimi",
          base_url: "https://api.moonshot.ai/v1",
          api_key: "main-only-kimi-key",
        },
      },
      models: {
        "existing/model": {
          provider: "existing",
          model: "existing-upstream",
          max_context_size: 32_768,
        },
        "work/kimi-k2": {
          provider: "prompthub-kimi",
          model: "kimi-k2",
          max_context_size: 131_072,
        },
      },
      services: { search: { base_url: "https://search.example" } },
      hooks: [{ event: "PreToolUse", command: "check" }],
    });
    expect(receipt.backupRef).toMatch(/\.enc$/);
    expect(await adapter.verify(context(root), plan, receipt)).toMatchObject({
      verified: true,
    });

    expect(await adapter.rollback(context(root), receipt)).toMatchObject({
      restored: true,
    });
    expect(await fs.readFile(configPath, "utf8")).toBe(original);
  });

  it.each([
    ["kimi", "openai-chat", "chat", "openai"],
    ["openai", "openai-chat", "chat", "openai"],
    ["openai_responses", "openai-responses", "responses", "openai"],
    ["anthropic", "anthropic-messages", "anthropic-messages", "anthropic"],
    ["google-genai", "google-generative-ai", "google-generative-ai", "google"],
  ])(
    "dispatches %s connection and streaming tests through the existing %s probe",
    async (providerKind, protocol, expectedProtocol, selectedProbe) => {
      const root = await temporaryRoot();
      const openAIConnection = vi
        .fn()
        .mockResolvedValue(successfulConnection(expectedProtocol));
      const openAIModel = vi
        .fn()
        .mockResolvedValue(successfulModel(expectedProtocol));
      const anthropicConnection = vi
        .fn()
        .mockResolvedValue(successfulConnection(expectedProtocol));
      const anthropicModel = vi
        .fn()
        .mockResolvedValue(successfulModel(expectedProtocol));
      const googleConnection = vi
        .fn()
        .mockResolvedValue(successfulConnection(expectedProtocol));
      const googleModel = vi
        .fn()
        .mockResolvedValue(successfulModel(expectedProtocol));
      const adapter = createAgentKimiProviderAdapter(
        options(root, {
          openAIConnection,
          openAIModel,
          anthropicConnection,
          anthropicModel,
          googleConnection,
          googleModel,
        }),
      );
      const target = {
        profile: profile({ providerKind, protocol }),
        modelMappings: mappings(),
      };

      await expect(
        adapter.testConnection!(context(root), target),
      ).resolves.toMatchObject({ status: "ok", platformId: "kimi" });
      await expect(
        adapter.testModel!(context(root), target, new AbortController().signal),
      ).resolves.toMatchObject({ status: "ok", platformId: "kimi" });

      const expectedConnection =
        selectedProbe === "openai"
          ? openAIConnection
          : selectedProbe === "anthropic"
            ? anthropicConnection
            : googleConnection;
      const expectedModel =
        selectedProbe === "openai"
          ? openAIModel
          : selectedProbe === "anthropic"
            ? anthropicModel
            : googleModel;
      expect(expectedConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: "main-only-kimi-key",
          model: "kimi-k2",
          protocol: expectedProtocol,
        }),
      );
      expect(expectedModel).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: "main-only-kimi-key",
          model: "kimi-k2",
          protocol: expectedProtocol,
        }),
      );
    },
  );

  it.each([
    [
      "managed OAuth",
      [
        'default_model = "managed/k3"',
        "[providers.managed]",
        'type = "kimi"',
        "[providers.managed.oauth]",
        'storage = "keyring"',
        'key = "secret-reference"',
        '[models."managed/k3"]',
        'provider = "managed"',
        'model = "k3"',
        "max_context_size = 1048576",
      ],
      "oauth",
    ],
    [
      "provider env",
      [
        'default_model = "managed/k3"',
        "[providers.managed]",
        'type = "kimi"',
        "[providers.managed.env]",
        'KIMI_API_KEY = "env-secret"',
        '[models."managed/k3"]',
        'provider = "managed"',
        'model = "k3"',
        "max_context_size = 1048576",
      ],
      "provider-env",
    ],
    [
      "custom headers",
      [
        'default_model = "managed/k3"',
        "[providers.managed]",
        'type = "openai"',
        "[providers.managed.custom_headers]",
        'Authorization = "Bearer header-secret"',
        '[models."managed/k3"]',
        'provider = "managed"',
        'model = "k3"',
        "max_context_size = 1048576",
      ],
      "custom-headers",
    ],
    [
      "Vertex ADC",
      [
        'default_model = "vertex/gemini"',
        "[providers.vertex]",
        'type = "vertexai"',
        "[providers.vertex.env]",
        'GOOGLE_CLOUD_PROJECT = "private-project"',
        'GOOGLE_CLOUD_LOCATION = "us-central1"',
        '[models."vertex/gemini"]',
        'provider = "vertex"',
        'model = "gemini-2.5-pro"',
        "max_context_size = 1048576",
      ],
      "vertex-adc",
    ],
  ])(
    "keeps %s credentials platform-owned and read-only",
    async (_name, lines, ownership) => {
      const root = await temporaryRoot();
      await fs.writeFile(
        path.join(root, "config.toml"),
        `${lines.join("\n")}\n`,
      );
      const adapter = createAgentKimiProviderAdapter(options(root));

      const imported = await adapter.importCurrent(context(root));
      expect(imported.profile).toMatchObject({
        protocol: "platform-native",
        secretRef: null,
        config: expect.objectContaining({
          providerId: ownership === "vertex-adc" ? "vertex" : "managed",
          nativeAuthOwnership: ownership,
        }),
      });
      expect(imported.warnings).toContain("native-provider-read-only");
      const serialized = JSON.stringify(imported);
      expect(serialized).not.toContain("secret-reference");
      expect(serialized).not.toContain("env-secret");
      expect(serialized).not.toContain("header-secret");
      expect(serialized).not.toContain("private-project");

      await expect(
        adapter.testConnection!(context(root), {
          profile: {
            ...profile(),
            ...imported.profile,
            id: "native-profile",
            archived: false,
            createdAt: 1,
            updatedAt: 1,
          },
          modelMappings: imported.modelMappings.map((mapping) => ({
            ...mapping,
            id: "native-mapping",
            providerProfileId: "native-profile",
          })),
        }),
      ).resolves.toMatchObject({ status: "unsupported" });
    },
  );

  it("allows a native profile only to select its existing provider/model entry", async () => {
    const root = await temporaryRoot();
    const configPath = path.join(root, "config.toml");
    await fs.writeFile(
      configPath,
      [
        'default_model = "other/model"',
        "[providers.managed]",
        'type = "kimi"',
        "[providers.managed.oauth]",
        'storage = "keyring"',
        'key = "opaque-key"',
        '[models."managed/k3"]',
        'provider = "managed"',
        'model = "k3"',
        "max_context_size = 1048576",
        "[providers.other]",
        'type = "openai"',
        'api_key = "other-secret"',
        '[models."other/model"]',
        'provider = "other"',
        'model = "other"',
        "max_context_size = 4096",
        "",
      ].join("\n"),
    );
    const adapter = createAgentKimiProviderAdapter(options(root));
    const nativeProfile = profile({
      providerKind: "kimi",
      protocol: "platform-native",
      endpoint: null,
      config: {
        providerId: "managed",
        nativeAuthOwnership: "oauth",
      },
      secretRef: null,
    });
    const nativeMappings = mappings("managed/k3", {
      upstreamModelId: "k3",
      maxContextSize: 1_048_576,
    });
    const plan = await adapter.planActivation({
      context: context(root),
      profile: nativeProfile,
      modelMappings: nativeMappings,
      baseline: await adapter.inspect(context(root)),
    });
    expect(plan.canApply).toBe(true);

    await adapter.apply(context(root), plan, {
      profile: nativeProfile,
      modelMappings: nativeMappings,
    });
    const saved = tomlRecord(await fs.readFile(configPath, "utf8"));
    expect(saved.default_model).toBe("managed/k3");
    expect(JSON.stringify(saved)).toContain("opaque-key");
    expect(JSON.stringify(saved)).toContain("other-secret");
  });

  it("fails closed for invalid metadata, missing secrets, and native provider collisions", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        'default_model = "managed/k3"',
        "[providers.managed]",
        'type = "kimi"',
        "[providers.managed.env]",
        'KIMI_API_KEY = "external-secret"',
        '[models."managed/k3"]',
        'provider = "managed"',
        'model = "k3"',
        "max_context_size = 1048576",
        "",
      ].join("\n"),
    );
    const missingSecret = createAgentKimiProviderAdapter(
      options(root, {
        secretStore: { read: vi.fn().mockResolvedValue(null) },
      }),
    );
    const invalidCases = [
      {
        profile: profile({ config: { providerId: "../escape" } }),
        modelMappings: mappings(),
        reason: "provider-id-invalid",
      },
      {
        profile: profile({ endpoint: "http://public.example/v1" }),
        modelMappings: mappings(),
        reason: "provider-endpoint-invalid",
      },
      {
        profile: profile(),
        modelMappings: mappings("alias", {
          upstreamModelId: "upstream",
          maxContextSize: 0,
        }),
        reason: "model-context-size-invalid",
      },
      {
        profile: profile({ config: { providerId: "managed" } }),
        modelMappings: mappings(),
        reason: "native-provider-auth-owned",
      },
    ];
    for (const candidate of invalidCases) {
      const plan = await missingSecret.planActivation({
        context: context(root),
        baseline: null,
        ...candidate,
      });
      expect(plan.canApply).toBe(false);
      expect(plan.blockedReasons).toContain(candidate.reason);
    }
    await expect(
      missingSecret.testConnection!(context(root), {
        profile: profile(),
        modelMappings: mappings(),
      }),
    ).resolves.toMatchObject({ status: "no-credentials" });
  });

  it("rejects malformed, oversized, symlinked, and concurrently changed config", async () => {
    const malformedRoot = await temporaryRoot();
    await fs.writeFile(path.join(malformedRoot, "config.toml"), "[broken");
    const malformed = createAgentKimiProviderAdapter(options(malformedRoot));
    await expect(malformed.inspect(context(malformedRoot))).rejects.toThrow(
      "AGENT_KIMI_PROVIDER_CONFIG_INVALID",
    );

    const oversizedRoot = await temporaryRoot();
    await fs.writeFile(
      path.join(oversizedRoot, "config.toml"),
      `# ${"x".repeat(2 * 1024 * 1024)}`,
    );
    const oversized = createAgentKimiProviderAdapter(options(oversizedRoot));
    await expect(oversized.inspect(context(oversizedRoot))).rejects.toThrow(
      "AGENT_KIMI_PROVIDER_CONFIG_INVALID",
    );

    const symlinkRoot = await temporaryRoot();
    const outside = path.join(await temporaryRoot(), "outside.toml");
    await fs.writeFile(outside, 'default_model = "outside"\n');
    await fs.symlink(outside, path.join(symlinkRoot, "config.toml"));
    const symlinked = createAgentKimiProviderAdapter(options(symlinkRoot));
    await expect(symlinked.inspect(context(symlinkRoot))).rejects.toThrow(
      "AGENT_KIMI_PROVIDER_CONFIG_INVALID",
    );

    const raceRoot = await temporaryRoot();
    const racePath = path.join(raceRoot, "config.toml");
    await fs.writeFile(racePath, 'default_model = "old"\n');
    const raced = createAgentKimiProviderAdapter(
      options(raceRoot, {
        hooks: {
          beforeWrite: () =>
            fs.writeFile(racePath, 'default_model = "external"\n'),
        },
      }),
    );
    const input = {
      context: context(raceRoot),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await raced.inspect(context(raceRoot)),
    };
    const plan = await raced.planActivation(input);
    await expect(
      raced.apply(context(raceRoot), plan, {
        profile: input.profile,
        modelMappings: input.modelMappings,
      }),
    ).rejects.toThrow("AGENT_KIMI_PROVIDER_CONCURRENT_CHANGE");
    expect(await fs.readFile(racePath, "utf8")).toContain("external");
  });

  it("restores exact bytes after native validation or semantic verification failure", async () => {
    for (const failure of ["validation", "verification"] as const) {
      const root = await temporaryRoot();
      const configPath = path.join(root, "config.toml");
      const original = [
        'default_model = "old/model"',
        "[providers.old]",
        'type = "openai"',
        'api_key = "old-secret"',
        '[models."old/model"]',
        'provider = "old"',
        'model = "old"',
        "max_context_size = 4096",
        "",
      ].join("\n");
      await fs.writeFile(configPath, original);
      const adapter = createAgentKimiProviderAdapter(
        options(root, {
          ...(failure === "validation"
            ? {
                validateNativeConfig: vi
                  .fn()
                  .mockRejectedValue(new Error("doctor failed")),
              }
            : {
                hooks: {
                  afterWrite: () =>
                    fs.writeFile(configPath, 'default_model = "tampered"\n'),
                },
              }),
        }),
      );
      const input = {
        context: context(root),
        profile: profile(),
        modelMappings: mappings(),
        baseline: await adapter.inspect(context(root)),
      };
      const plan = await adapter.planActivation(input);

      await expect(
        adapter.apply(context(root), plan, {
          profile: input.profile,
          modelMappings: input.modelMappings,
        }),
      ).rejects.toThrow("AGENT_KIMI_PROVIDER_WRITE_FAILED");
      expect(await fs.readFile(configPath, "utf8")).toBe(original);
    }
  });

  it("uses an encrypted null-file bundle so creation can be rolled back to absence", async () => {
    const root = await temporaryRoot();
    const adapter = createAgentKimiProviderAdapter(options(root));
    const input = {
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await adapter.inspect(context(root)),
    };
    const plan = await adapter.planActivation(input);
    const receipt = await adapter.apply(context(root), plan, {
      profile: input.profile,
      modelMappings: input.modelMappings,
    });
    expect(receipt.backupRef).toMatch(/\.enc$/);
    expect(await fs.stat(path.join(root, "config.toml"))).toBeTruthy();

    await expect(
      adapter.rollback(context(root), receipt),
    ).resolves.toMatchObject({ restored: true });
    await expect(fs.stat(path.join(root, "config.toml"))).rejects.toThrow();
  });
});
