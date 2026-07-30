/**
 * @vitest-environment node
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { parse as parseJsonc } from "jsonc-parser";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentProviderAdapterContext,
  AgentProviderModelMapping,
  AgentProviderProfile,
} from "@prompthub/shared";
import { createAgentQwenProviderAdapter } from "../../../src/main/services/agent-qwen-provider-adapter";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "qwen-provider-"));
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
  return { agentId: "qwen", platformId: "qwen", rootPath };
}

function profile(
  overrides: Partial<AgentProviderProfile> = {},
): AgentProviderProfile {
  return {
    id: "profile-qwen",
    platformId: "qwen",
    name: "Qwen direct API",
    providerKind: "openai",
    protocol: "openai-chat",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    config: {
      providerId: "openai",
      envKey: "DASHSCOPE_API_KEY",
    },
    secretRef: "agent-provider:profile-qwen",
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mappings(modelId = "qwen3.6-plus"): AgentProviderModelMapping[] {
  return [
    {
      id: "mapping-qwen",
      providerProfileId: "profile-qwen",
      routeKey: "primary",
      modelId,
      parameters: {},
    },
  ];
}

function encryption() {
  return {
    isEncryptionAvailable: () => true,
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
    model: "qwen-model",
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
    model: "qwen-model",
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
    secretStore: { read: vi.fn().mockResolvedValue("main-only-qwen-key") },
    ...overrides,
  };
}

function settings(raw: string): Record<string, unknown> {
  return parseJsonc(raw) as Record<string, unknown>;
}

describe("Qwen Code unified Provider Profile adapter", () => {
  it("imports the current bare-array provider model without exposing credentials", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "settings.json"),
      `{
        "$version": 4,
        "modelProviders": {
          "openai": [{
            "id": "qwen3.6-plus",
            "name": "Qwen 3.6 Plus",
            "envKey": "DASHSCOPE_API_KEY",
            "baseUrl": "https://user:password@dashscope.aliyuncs.com/compatible-mode/v1?token=hidden",
            "description": "keep"
          }]
        },
        "env": {
          "DASHSCOPE_API_KEY": "settings-secret",
          "OTHER": "visible-only-in-native"
        },
        "security": {
          "auth": {
            "selectedType": "openai",
            "apiKey": "deprecated-secret",
            "baseUrl": "https://deprecated.example?key=secret"
          }
        },
        "model": { "name": "qwen3.6-plus" }
      }\n`,
    );
    await fs.writeFile(
      path.join(root, ".env"),
      'DASHSCOPE_API_KEY="dotenv-secret"\n',
    );
    const adapter = createAgentQwenProviderAdapter(options(root));

    const state = await adapter.inspect(context(root));
    expect(state.values).toMatchObject({
      providerId: "openai",
      provider: "openai",
      protocol: "openai-chat",
      endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen3.6-plus",
      envKey: "DASHSCOPE_API_KEY",
      authOwnership: "native-inline",
      credentialStatus: "configured",
    });
    const serializedState = JSON.stringify(state);
    expect(serializedState).not.toContain("settings-secret");
    expect(serializedState).not.toContain("dotenv-secret");
    expect(serializedState).not.toContain("deprecated-secret");
    expect(serializedState).not.toContain("password");
    expect(serializedState).not.toContain("token=hidden");

    const imported = await adapter.importCurrent(context(root));
    expect(imported).toMatchObject({
      profile: {
        platformId: "qwen",
        providerKind: "openai",
        protocol: "openai-chat",
        endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1",
        config: {
          providerId: "openai",
          envKey: "DASHSCOPE_API_KEY",
        },
        secretRef: null,
        source: "native-import",
      },
      modelMappings: [
        {
          routeKey: "primary",
          modelId: "qwen3.6-plus",
          parameters: {},
        },
      ],
    });
    expect(imported.warnings).toEqual(
      expect.arrayContaining([
        "native-credential-not-imported",
        "deprecated-native-auth-fields",
      ]),
    );
    const serializedImport = JSON.stringify(imported);
    expect(serializedImport).not.toContain("settings-secret");
    expect(serializedImport).not.toContain("dotenv-secret");
    expect(serializedImport).not.toContain("deprecated-secret");
  });

  it("projects a direct provider to settings plus dotenv and preserves unrelated data", async () => {
    const root = await temporaryRoot();
    const settingsPath = path.join(root, "settings.json");
    const envPath = path.join(root, ".env");
    const originalSettings = `{
      // keep this user preference
      "$version": 4,
      "ui": { "theme": "GitHub" },
      "modelProviders": {
        "openai": [
          {
            "id": "existing",
            "envKey": "EXISTING_KEY",
            "baseUrl": "https://existing.example/v1",
            "description": "keep existing"
          }
        ],
        "anthropic": [{
          "id": "claude-existing",
          "envKey": "ANTHROPIC_API_KEY",
          "generationConfig": { "customHeaders": { "X-Secret": "hidden" } }
        }]
      },
      "env": {
        "DASHSCOPE_API_KEY": "old-settings-secret",
        "KEEP_IN_SETTINGS": "keep"
      },
      "security": { "auth": { "selectedType": "anthropic" } },
      "model": { "name": "claude-existing" },
      "mcpServers": { "local": { "command": "node" } }
    }\n`;
    const originalEnv =
      'DASHSCOPE_API_KEY="old-dotenv-secret"\nKEEP_DOTENV="keep"\n';
    await fs.writeFile(settingsPath, originalSettings);
    await fs.writeFile(envPath, originalEnv);
    const adapter = createAgentQwenProviderAdapter(options(root));
    const target = { profile: profile(), modelMappings: mappings() };
    const plan = await adapter.planActivation({
      context: context(root),
      ...target,
      baseline: await adapter.inspect(context(root)),
    });

    expect(plan.canApply).toBe(true);
    const receipt = await adapter.apply(context(root), plan, target);
    const savedRaw = await fs.readFile(settingsPath, "utf8");
    const saved = settings(savedRaw);
    expect(saved).toMatchObject({
      $version: 4,
      ui: { theme: "GitHub" },
      modelProviders: {
        openai: [
          {
            id: "existing",
            envKey: "EXISTING_KEY",
            baseUrl: "https://existing.example/v1",
            description: "keep existing",
          },
          {
            id: "qwen3.6-plus",
            envKey: "DASHSCOPE_API_KEY",
            baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
          },
        ],
        anthropic: [
          {
            id: "claude-existing",
            envKey: "ANTHROPIC_API_KEY",
            generationConfig: {
              customHeaders: { "X-Secret": "hidden" },
            },
          },
        ],
      },
      env: { KEEP_IN_SETTINGS: "keep" },
      security: { auth: { selectedType: "openai" } },
      model: { name: "qwen3.6-plus" },
      mcpServers: { local: { command: "node" } },
    });
    expect(savedRaw).toContain("// keep this user preference");
    const savedEnv = await fs.readFile(envPath, "utf8");
    expect(savedEnv).toContain('DASHSCOPE_API_KEY="main-only-qwen-key"');
    expect(savedEnv).toContain('KEEP_DOTENV="keep"');
    expect(savedEnv).not.toContain("old-dotenv-secret");
    expect(receipt.backupRef).toMatch(/\.enc$/);
    await expect(
      adapter.verify(context(root), plan, receipt),
    ).resolves.toMatchObject({ verified: true });

    await expect(
      adapter.rollback(context(root), receipt),
    ).resolves.toMatchObject({ restored: true });
    expect(await fs.readFile(settingsPath, "utf8")).toBe(originalSettings);
    expect(await fs.readFile(envPath, "utf8")).toBe(originalEnv);
  });

  it("maps a custom provider id to its official protocol", async () => {
    const root = await temporaryRoot();
    const adapter = createAgentQwenProviderAdapter(options(root));
    const target = {
      profile: profile({
        providerKind: "anthropic",
        protocol: "anthropic-messages",
        endpoint: "https://anthropic-gateway.example/v1",
        config: {
          providerId: "team-anthropic",
          envKey: "TEAM_ANTHROPIC_KEY",
        },
      }),
      modelMappings: mappings("claude-sonnet"),
    };
    const plan = await adapter.planActivation({
      context: context(root),
      ...target,
      baseline: await adapter.inspect(context(root)),
    });
    await adapter.apply(context(root), plan, target);

    expect(
      settings(await fs.readFile(path.join(root, "settings.json"), "utf8")),
    ).toMatchObject({
      providerProtocol: { "team-anthropic": "anthropic" },
      security: { auth: { selectedType: "team-anthropic" } },
      model: { name: "claude-sonnet" },
      modelProviders: {
        "team-anthropic": [
          {
            id: "claude-sonnet",
            envKey: "TEAM_ANTHROPIC_KEY",
            baseUrl: "https://anthropic-gateway.example/v1",
          },
        ],
      },
    });
  });

  it.each([
    ["openai", "openai-chat", "chat", "openai"],
    ["anthropic", "anthropic-messages", "anthropic-messages", "anthropic"],
    ["gemini", "google-generative-ai", "google-generative-ai", "google"],
  ])(
    "dispatches %s connection and streaming tests through the existing probe",
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
      const adapter = createAgentQwenProviderAdapter(
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
        profile: profile({
          providerKind,
          protocol,
          config: {
            providerId: providerKind,
            envKey: `${providerKind.toUpperCase()}_KEY`,
          },
        }),
        modelMappings: mappings(),
      };

      await expect(
        adapter.testConnection!(context(root), target),
      ).resolves.toMatchObject({ status: "ok", platformId: "qwen" });
      await expect(
        adapter.testModel!(context(root), target, new AbortController().signal),
      ).resolves.toMatchObject({ status: "ok", platformId: "qwen" });

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
          credential: "main-only-qwen-key",
          model: "qwen3.6-plus",
          protocol: expectedProtocol,
        }),
      );
      expect(expectedModel).toHaveBeenCalledWith(
        expect.objectContaining({
          credential: "main-only-qwen-key",
          model: "qwen3.6-plus",
          protocol: expectedProtocol,
        }),
      );
    },
  );

  it.each([
    ["Vertex ADC", "vertex-ai", "vertex-adc", "GOOGLE_APPLICATION_CREDENTIALS"],
    ["legacy Qwen OAuth", "qwen-oauth", "oauth", ""],
    [
      "automatic Coding Plan",
      "openai",
      "coding-plan",
      "BAILIAN_CODING_PLAN_API_KEY",
    ],
  ])(
    "keeps %s authentication platform-owned and read-only",
    async (_name, providerId, ownership, envKey) => {
      const root = await temporaryRoot();
      const modelId =
        providerId === "qwen-oauth" ? "qwen-oauth-model" : "model";
      await fs.writeFile(
        path.join(root, "settings.json"),
        JSON.stringify(
          {
            $version: 4,
            modelProviders:
              providerId === "qwen-oauth"
                ? {}
                : {
                    [providerId]: [
                      {
                        id: modelId,
                        ...(envKey ? { envKey } : {}),
                        ...(providerId === "vertex-ai"
                          ? { baseUrl: "https://vertex.example" }
                          : {
                              baseUrl:
                                "https://coding.dashscope.aliyuncs.com/v1",
                            }),
                      },
                    ],
                  },
            env: envKey ? { [envKey]: "native-secret" } : {},
            security: { auth: { selectedType: providerId } },
            model: { name: modelId },
          },
          null,
          2,
        ),
      );
      const adapter = createAgentQwenProviderAdapter(options(root));
      const imported = await adapter.importCurrent(context(root));
      expect(imported.profile).toMatchObject({
        protocol: "platform-native",
        secretRef: null,
        config: expect.objectContaining({
          providerId,
          nativeAuthOwnership: ownership,
        }),
      });
      expect(imported.warnings).toContain("native-provider-read-only");
      expect(JSON.stringify(imported)).not.toContain("native-secret");
      await expect(
        adapter.testConnection!(context(root), {
          profile: {
            ...profile(),
            ...imported.profile,
            id: "native-qwen",
            archived: false,
            createdAt: 1,
            updatedAt: 1,
          },
          modelMappings: imported.modelMappings.map((mapping) => ({
            ...mapping,
            id: "native-qwen-mapping",
            providerProfileId: "native-qwen",
          })),
        }),
      ).resolves.toMatchObject({ status: "unsupported" });
    },
  );

  it("fails closed for malformed profiles, unsafe files, races, and partial writes", async () => {
    const root = await temporaryRoot();
    const invalidAdapter = createAgentQwenProviderAdapter(
      options(root, {
        secretStore: { read: vi.fn().mockResolvedValue(null) },
      }),
    );
    const invalidCases = [
      {
        candidateProfile: profile({ config: { providerId: "../escape" } }),
        reason: "provider-id-invalid",
      },
      {
        candidateProfile: profile({
          config: { providerId: "openai", envKey: "BAD-KEY" },
        }),
        reason: "provider-env-key-invalid",
      },
      {
        candidateProfile: profile({ endpoint: "http://public.example/v1" }),
        reason: "provider-endpoint-invalid",
      },
      {
        candidateProfile: profile({ protocol: "anthropic-messages" }),
        reason: "provider-protocol-unsupported",
      },
    ];
    for (const candidate of invalidCases) {
      const plan = await invalidAdapter.planActivation({
        context: context(root),
        profile: candidate.candidateProfile,
        modelMappings: mappings(),
        baseline: null,
      });
      expect(plan.canApply).toBe(false);
      expect(plan.blockedReasons).toContain(candidate.reason);
    }

    const malformedRoot = await temporaryRoot();
    await fs.writeFile(path.join(malformedRoot, "settings.json"), "{broken");
    await expect(
      createAgentQwenProviderAdapter(options(malformedRoot)).inspect(
        context(malformedRoot),
      ),
    ).rejects.toThrow("AGENT_QWEN_PROVIDER_CONFIG_INVALID");

    const oversizedRoot = await temporaryRoot();
    await fs.writeFile(
      path.join(oversizedRoot, "settings.json"),
      `{"padding":"${"x".repeat(2 * 1024 * 1024)}"}`,
    );
    await expect(
      createAgentQwenProviderAdapter(options(oversizedRoot)).inspect(
        context(oversizedRoot),
      ),
    ).rejects.toThrow("AGENT_QWEN_PROVIDER_CONFIG_INVALID");

    const symlinkRoot = await temporaryRoot();
    const outside = path.join(await temporaryRoot(), "outside.json");
    await fs.writeFile(outside, "{}");
    await fs.symlink(outside, path.join(symlinkRoot, "settings.json"));
    await expect(
      createAgentQwenProviderAdapter(options(symlinkRoot)).inspect(
        context(symlinkRoot),
      ),
    ).rejects.toThrow("AGENT_QWEN_PROVIDER_CONFIG_INVALID");

    for (const failure of ["race", "partial-write"] as const) {
      const failureRoot = await temporaryRoot();
      const settingsPath = path.join(failureRoot, "settings.json");
      const envPath = path.join(failureRoot, ".env");
      const originalSettings = '{"$version":4,"keep":true}\n';
      const originalEnv = 'KEEP="yes"\n';
      await fs.writeFile(settingsPath, originalSettings);
      await fs.writeFile(envPath, originalEnv);
      const adapter = createAgentQwenProviderAdapter(
        options(failureRoot, {
          hooks:
            failure === "race"
              ? {
                  beforeWrite: () =>
                    fs.writeFile(settingsPath, '{"external":true}\n'),
                }
              : {
                  afterSettingsWrite: () => {
                    throw new Error("simulated second-file failure");
                  },
                },
        }),
      );
      const target = { profile: profile(), modelMappings: mappings() };
      const plan = await adapter.planActivation({
        context: context(failureRoot),
        ...target,
        baseline: await adapter.inspect(context(failureRoot)),
      });
      await expect(
        adapter.apply(context(failureRoot), plan, target),
      ).rejects.toThrow(
        failure === "race"
          ? "AGENT_QWEN_PROVIDER_CONCURRENT_CHANGE"
          : "AGENT_QWEN_PROVIDER_WRITE_FAILED",
      );
      expect(await fs.readFile(settingsPath, "utf8")).toBe(
        failure === "race" ? '{"external":true}\n' : originalSettings,
      );
      expect(await fs.readFile(envPath, "utf8")).toBe(originalEnv);
    }
  });
});
