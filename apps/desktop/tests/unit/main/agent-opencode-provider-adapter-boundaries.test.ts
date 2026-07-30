/**
 * @vitest-environment node
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AgentProviderAdapterContext,
  AgentProviderModelMapping,
  AgentProviderProfile,
} from "@prompthub/shared";
import {
  createAgentOpenCodeProviderAdapter,
  resolveOpenCodeAuthPath,
} from "../../../src/main/services/agent-opencode-provider-adapter";

const roots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencode-boundary-"));
  roots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) =>
      fs.rm(root, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

function context(rootPath: string): AgentProviderAdapterContext {
  return { agentId: "opencode", platformId: "opencode", rootPath };
}

function profile(
  overrides: Partial<AgentProviderProfile> = {},
): AgentProviderProfile {
  return {
    id: "profile-opencode-boundary",
    platformId: "opencode",
    name: "OpenCode gateway",
    providerKind: "openai-compatible",
    protocol: "openai-chat",
    endpoint: "https://gateway.example/v1",
    config: {
      providerId: "gateway",
      package: "@ai-sdk/openai-compatible",
    },
    secretRef: "agent-provider:opencode-boundary",
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mappings(
  overrides: Partial<AgentProviderModelMapping>[] = [],
): AgentProviderModelMapping[] {
  return [
    {
      id: "primary",
      providerProfileId: "profile-opencode-boundary",
      routeKey: "primary",
      modelId: "gpt-main",
      parameters: {},
      ...overrides[0],
    },
    ...(overrides[1]
      ? [
          {
            id: "secondary",
            providerProfileId: "profile-opencode-boundary",
            routeKey: "secondary",
            modelId: "gpt-small",
            parameters: {},
            ...overrides[1],
          },
        ]
      : []),
  ];
}

function encryption() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString(),
  };
}

function adapter(root: string, overrides: Record<string, unknown> = {}) {
  return createAgentOpenCodeProviderAdapter({
    backupRoot: path.join(root, "backups"),
    backupEncryption: encryption(),
    authPath: path.join(root, "data", "opencode", "auth.json"),
    secretStore: { read: vi.fn().mockResolvedValue("main-only-key") },
    now: () => 100,
    ...overrides,
  });
}

async function plan(
  root: string,
  targetProfile = profile(),
  modelMappings = mappings(),
  candidate = adapter(root),
) {
  const baseline = await candidate.inspect(context(root));
  return candidate.planActivation({
    context: context(root),
    profile: targetProfile,
    modelMappings,
    baseline,
  });
}

describe("OpenCode Provider adapter boundaries", () => {
  it("resolves default process inputs and accepts a main-owned XDG auth path", async () => {
    expect(resolveOpenCodeAuthPath()).toMatch(/opencode[/\\]auth\.json$/);
    const root = await temporaryRoot();
    const previous = process.env.XDG_DATA_HOME;
    process.env.XDG_DATA_HOME = path.join(root, "xdg-data");
    try {
      const candidate = createAgentOpenCodeProviderAdapter({
        backupRoot: path.join(root, "backups"),
        backupEncryption: encryption(),
        secretStore: { read: vi.fn().mockResolvedValue("main-only-key") },
      });
      await expect(candidate.inspect(context(root))).resolves.toMatchObject({
        platformId: "opencode",
      });
    } finally {
      if (previous === undefined) delete process.env.XDG_DATA_HOME;
      else process.env.XDG_DATA_HOME = previous;
    }
  });

  it("uses the documented config precedence and defaults to JSONC", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "config.json"),
      '{"model":"fallback/one"}',
    );
    await fs.writeFile(
      path.join(root, "opencode.json"),
      '{"model":"json/two"}',
    );
    expect(await adapter(root).inspect(context(root))).toMatchObject({
      values: {
        providerId: "json",
        model: "two",
        configRelativePath: "opencode.json",
      },
    });

    await fs.writeFile(
      path.join(root, "opencode.jsonc"),
      '{"model":"jsonc/three"}',
    );
    expect(await adapter(root).inspect(context(root))).toMatchObject({
      values: {
        providerId: "jsonc",
        model: "three",
        configRelativePath: "opencode.jsonc",
      },
    });

    await Promise.all([
      fs.rm(path.join(root, "opencode.jsonc")),
      fs.rm(path.join(root, "opencode.json")),
      fs.rm(path.join(root, "config.json")),
    ]);
    expect(await adapter(root).inspect(context(root))).toMatchObject({
      values: { configRelativePath: "opencode.jsonc" },
    });
  });

  it("rejects malformed, oversized, and symbolic-link native files", async () => {
    const root = await temporaryRoot();
    const authPath = path.join(root, "data", "opencode", "auth.json");
    await fs.mkdir(path.dirname(authPath), { recursive: true });
    await fs.writeFile(path.join(root, "opencode.jsonc"), "{broken");
    await expect(adapter(root).inspect(context(root))).rejects.toThrow(
      "AGENT_OPENCODE_PROVIDER_CONFIG_INVALID",
    );

    await fs.writeFile(path.join(root, "opencode.jsonc"), "{}");
    await fs.writeFile(authPath, "[]");
    await expect(adapter(root).inspect(context(root))).rejects.toThrow(
      "AGENT_OPENCODE_PROVIDER_AUTH_INVALID",
    );

    await fs.writeFile(authPath, "{}");
    await fs.writeFile(
      path.join(root, "opencode.jsonc"),
      Buffer.alloc(3 * 1024 * 1024, 32),
    );
    await expect(adapter(root).inspect(context(root))).rejects.toThrow(
      "AGENT_OPENCODE_PROVIDER_CONFIG_INVALID",
    );

    await fs.rm(path.join(root, "opencode.jsonc"));
    const target = path.join(root, "real.json");
    await fs.writeFile(target, "{}");
    await fs.symlink(target, path.join(root, "opencode.jsonc"));
    await expect(adapter(root).inspect(context(root))).rejects.toThrow(
      "AGENT_OPENCODE_PROVIDER_CONFIG_INVALID",
    );
  });

  it("rejects invalid context and reports a platform mismatch without writing", async () => {
    const root = await temporaryRoot();
    await expect(
      adapter(root).inspect({
        agentId: "opencode",
        platformId: "opencode",
        rootPath: "../relative",
      }),
    ).rejects.toThrow("AGENT_OPENCODE_PROVIDER_CONTEXT_INVALID");

    const candidate = adapter(root);
    const result = await candidate.planActivation({
      context: context(root),
      profile: profile({ platformId: "codex" }),
      modelMappings: mappings(),
      baseline: null,
    });
    expect(result).toMatchObject({
      canApply: false,
      blockedReasons: ["provider-platform-mismatch"],
    });
  });

  it("recognizes the official Responses package in current native state", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "opencode.jsonc"),
      JSON.stringify({
        model: "responses/gpt-main",
        provider: {
          responses: {
            npm: "@ai-sdk/openai",
            options: { baseURL: "https://responses.example/v1" },
          },
        },
      }),
    );
    expect(await adapter(root).inspect(context(root))).toMatchObject({
      values: {
        providerId: "responses",
        package: "@ai-sdk/openai",
        protocol: "openai-responses",
      },
    });
  });

  it.each([
    ["provider-name-invalid", profile({ name: "" }), mappings()],
    [
      "provider-id-invalid",
      profile({
        config: {
          providerId: "../escape",
          package: "@ai-sdk/openai-compatible",
        },
      }),
      mappings(),
    ],
    [
      "provider-protocol-unsupported",
      profile({
        providerKind: "openai",
        protocol: "openai-chat",
        config: { providerId: "gateway", package: "@ai-sdk/openai" },
      }),
      mappings(),
    ],
    [
      "provider-endpoint-invalid",
      profile({ endpoint: "https://user:secret@gateway.example/v1?key=bad" }),
      mappings(),
    ],
    [
      "provider-endpoint-invalid",
      profile({ endpoint: "http://gateway.example/v1" }),
      mappings(),
    ],
    [
      "provider-endpoint-invalid",
      profile({ endpoint: "not a URL" }),
      mappings(),
    ],
    [
      "provider-config-unsupported",
      profile({
        config: {
          providerId: "gateway",
          package: "@ai-sdk/openai-compatible",
          headers: { authorization: "secret" },
        },
      }),
      mappings(),
    ],
    [
      "provider-model-mapping-invalid",
      profile(),
      mappings([{ parameters: { temperature: 1 } }]),
    ],
    [
      "provider-protocol-unsupported",
      profile({
        protocol: "platform-native",
        providerKind: "platform-native",
      }),
      mappings(),
    ],
    [
      "provider-id-invalid",
      profile({
        config: {
          providerId: 123,
          package: 123,
        },
      }),
      mappings(),
    ],
  ])(
    "blocks unsafe desired state: %s",
    async (reason, targetProfile, modelMappings) => {
      const root = await temporaryRoot();
      await expect(
        plan(root, targetProfile, modelMappings),
      ).resolves.toMatchObject({
        canApply: false,
        blockedReasons: expect.arrayContaining([reason]),
      });
    },
  );

  it("recognizes model-level authorization headers without exposing values", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "opencode.jsonc"),
      JSON.stringify({
        model: "gateway/gpt-main",
        provider: {
          gateway: {
            npm: "@ai-sdk/openai-compatible",
            options: { baseURL: "https://gateway.example/v1" },
            models: {
              "gpt-main": {
                options: {
                  headers: { aUtHoRiZaTiOn: "Bearer private-token" },
                },
              },
            },
          },
        },
      }),
    );
    const candidate = adapter(root);
    const inspected = await candidate.inspect(context(root));
    expect(inspected.values.authorizationHeaderConflict).toBe(true);
    expect(JSON.stringify(inspected)).not.toContain("private-token");
    await expect(
      candidate.planActivation({
        context: context(root),
        profile: profile(),
        modelMappings: mappings(),
        baseline: inspected,
      }),
    ).resolves.toMatchObject({
      blockedReasons: expect.arrayContaining([
        "native-authorization-header-conflict",
      ]),
    });
  });

  it("imports well-known and missing auth as read-only states", async () => {
    const root = await temporaryRoot();
    const authPath = path.join(root, "data", "opencode", "auth.json");
    await fs.mkdir(path.dirname(authPath), { recursive: true });
    await fs.writeFile(
      path.join(root, "opencode.json"),
      JSON.stringify({
        model: "custom/model",
        provider: { custom: { npm: "@ai-sdk/custom" } },
      }),
    );
    await fs.writeFile(
      authPath,
      JSON.stringify({
        custom: { type: "wellknown", key: "private", token: "private-token" },
      }),
    );
    const candidate = adapter(root);
    const imported = await candidate.importCurrent(context(root));
    expect(imported.profile.config).toMatchObject({
      providerId: "custom",
      nativeAuthOwnership: "wellknown",
    });
    expect(JSON.stringify(imported)).not.toContain("private-token");

    await fs.writeFile(authPath, "{}");
    const missing = await candidate.importCurrent(context(root));
    expect(missing.warnings).toContain("native-credential-missing");
  });

  it("rejects import when there is no complete native active model", async () => {
    const root = await temporaryRoot();
    await expect(adapter(root).importCurrent(context(root))).rejects.toThrow(
      "AGENT_OPENCODE_PROVIDER_IMPORT_UNAVAILABLE",
    );
  });

  it("removes legacy inline apiKey only for the selected managed provider", async () => {
    const root = await temporaryRoot();
    const authPath = path.join(root, "data", "opencode", "auth.json");
    await fs.mkdir(path.dirname(authPath), { recursive: true });
    await fs.writeFile(
      path.join(root, "opencode.jsonc"),
      `{
        "model": "gateway/old",
        "provider": {
          "gateway": {
            "npm": "@ai-sdk/openai-compatible",
            "options": {
              "baseUrl": "https://old.example/v1",
              "apiKey": "legacy-inline"
            }
          },
          "unrelated": {
            "options": { "apiKey": "preserve-unrelated" }
          }
        }
      }\n`,
    );
    await fs.writeFile(authPath, "{}");
    const candidate = adapter(root);
    const target = { profile: profile(), modelMappings: mappings() };
    const activation = await candidate.planActivation({
      context: context(root),
      ...target,
      baseline: await candidate.inspect(context(root)),
    });
    await candidate.apply(context(root), activation, target);
    const raw = await fs.readFile(path.join(root, "opencode.jsonc"), "utf8");
    expect(raw).not.toContain("legacy-inline");
    expect(raw).toContain("preserve-unrelated");
    expect(raw).not.toContain('"baseUrl"');
    expect(raw).toContain('"baseURL"');
  });

  it("detects an auth-file race before writing either file", async () => {
    const root = await temporaryRoot();
    const authPath = path.join(root, "data", "opencode", "auth.json");
    await fs.mkdir(path.dirname(authPath), { recursive: true });
    await fs.writeFile(path.join(root, "opencode.jsonc"), "{}\n");
    await fs.writeFile(authPath, "{}\n");
    const candidate = adapter(root, {
      hooks: {
        beforeWrite: async () => {
          await fs.writeFile(authPath, '{"external":true}\n');
        },
      },
    });
    const target = { profile: profile(), modelMappings: mappings() };
    const activation = await candidate.planActivation({
      context: context(root),
      ...target,
      baseline: await candidate.inspect(context(root)),
    });
    await expect(
      candidate.apply(context(root), activation, target),
    ).rejects.toThrow("AGENT_PROVIDER_PLAN_STALE");
    expect(await fs.readFile(path.join(root, "opencode.jsonc"), "utf8")).toBe(
      "{}\n",
    );
    expect(await fs.readFile(authPath, "utf8")).toBe('{"external":true}\n');
  });

  it("restores both files when post-write verification fails", async () => {
    const root = await temporaryRoot();
    const configPath = path.join(root, "opencode.jsonc");
    const authPath = path.join(root, "data", "opencode", "auth.json");
    await fs.mkdir(path.dirname(authPath), { recursive: true });
    await fs.writeFile(configPath, '{"keep":"config"}\n');
    await fs.writeFile(authPath, '{"keep":{"type":"api","key":"secret"}}\n');
    const candidate = adapter(root, {
      hooks: {
        afterWrite: async () => {
          await fs.writeFile(configPath, '{"model":"external/changed"}\n');
        },
      },
    });
    const target = { profile: profile(), modelMappings: mappings() };
    const activation = await candidate.planActivation({
      context: context(root),
      ...target,
      baseline: await candidate.inspect(context(root)),
    });
    await expect(
      candidate.apply(context(root), activation, target),
    ).rejects.toThrow("AGENT_OPENCODE_PROVIDER_VERIFICATION_FAILED");
    expect(await fs.readFile(configPath, "utf8")).toBe('{"keep":"config"}\n');
    expect(await fs.readFile(authPath, "utf8")).toBe(
      '{"keep":{"type":"api","key":"secret"}}\n',
    );
  });

  it("returns categorized no-credential results and forwards cancellation", async () => {
    const root = await temporaryRoot();
    const noSecret = adapter(root, {
      secretStore: { read: vi.fn().mockResolvedValue(null) },
    });
    const target = { profile: profile(), modelMappings: mappings() };
    await expect(
      noSecret.testConnection!(context(root), target),
    ).resolves.toMatchObject({
      platformId: "opencode",
      status: "no-credentials",
      totalMs: 0,
    });
    await expect(
      noSecret.testModel!(context(root), target, new AbortController().signal),
    ).resolves.toMatchObject({
      platformId: "opencode",
      status: "no-credentials",
      totalMs: 0,
    });
    const unsupported = adapter(root);
    await expect(
      unsupported.testConnection!(context(root), {
        profile: profile({
          protocol: "platform-native",
          providerKind: "platform-native",
          secretRef: null,
        }),
        modelMappings: [],
      }),
    ).resolves.toMatchObject({
      status: "unsupported",
      model: null,
    });

    const openAIModel = vi.fn().mockResolvedValue({
      protocol: "chat",
      endpointOrigin: "https://gateway.example",
      model: "gpt-main",
      status: "cancelled",
      startedAt: 1,
      finishedAt: 2,
      totalMs: 1,
      firstTokenMs: null,
      retryCount: 0,
      inputTokens: null,
      outputTokens: null,
      outputPreview: null,
    });
    const candidate = adapter(root, { openAIModel });
    const controller = new AbortController();
    controller.abort();
    await candidate.testModel!(context(root), target, controller.signal);
    expect(openAIModel).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it("classifies secret-store failures without leaking their cause", async () => {
    const root = await temporaryRoot();
    const candidate = adapter(root, {
      secretStore: {
        read: vi.fn().mockRejectedValue(new Error("secret backend detail")),
      },
    });
    const activation = await plan(root, profile(), mappings(), candidate);
    expect(activation.blockedReasons).toContain("provider-secret-unavailable");
    expect(JSON.stringify(activation)).not.toContain("backend detail");

    const noReference = await plan(
      root,
      profile({ secretRef: null }),
      mappings(),
      adapter(root),
    );
    expect(noReference.blockedReasons).toContain(
      "provider-credential-required",
    );
  });

  it("applies a fresh config without a secondary mapping", async () => {
    const root = await temporaryRoot();
    const candidate = adapter(root);
    const target = { profile: profile(), modelMappings: mappings() };
    const current = await candidate.inspect(context(root));
    const legacyPlan = await candidate.planActivation({
      context: context(root),
      ...target,
      baseline: {
        ...current,
        adapterVersion: "legacy-model-only-v1",
      },
    });
    expect(legacyPlan.requiresReview).toBe(true);
    const activation = await candidate.planActivation({
      context: context(root),
      ...target,
      baseline: current,
    });
    expect(activation.canApply).toBe(true);
    const receipt = await candidate.apply(context(root), activation, target);
    expect(receipt.appliedAt).toBe(100);
    const written = JSON.parse(
      await fs.readFile(path.join(root, "opencode.jsonc"), "utf8"),
    );
    expect(written.model).toBe("gateway/gpt-main");
    expect(written).not.toHaveProperty("small_model");
  });

  it("rejects an invalid target even when handed a previously valid plan", async () => {
    const root = await temporaryRoot();
    const candidate = adapter(root);
    const validTarget = { profile: profile(), modelMappings: mappings() };
    const activation = await candidate.planActivation({
      context: context(root),
      ...validTarget,
      baseline: await candidate.inspect(context(root)),
    });
    await expect(
      candidate.apply(context(root), activation, {
        profile: profile({ endpoint: null }),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_OPENCODE_PROVIDER_PROFILE_INVALID");
    await expect(
      candidate.apply(
        context(root),
        { ...activation, platformId: "codex" },
        validTarget,
      ),
    ).rejects.toThrow("AGENT_OPENCODE_PROVIDER_PLAN_INVALID");
  });

  it("reports verification and rollback digest mismatches", async () => {
    const root = await temporaryRoot();
    const candidate = adapter(root);
    const target = { profile: profile(), modelMappings: mappings() };
    const activation = await candidate.planActivation({
      context: context(root),
      ...target,
      baseline: await candidate.inspect(context(root)),
    });
    const receipt = await candidate.apply(context(root), activation, target);
    await expect(
      candidate.verify(context(root), activation, {
        ...receipt,
        nativeDigestAfter: "not-the-current-digest",
      }),
    ).resolves.toMatchObject({
      verified: false,
      errorCode: "provider-state-mismatch",
    });
    await expect(
      candidate.rollback(context(root), {
        ...receipt,
        nativeDigestBefore: "not-the-original-digest",
      }),
    ).resolves.toMatchObject({
      restored: false,
      errorCode: "provider-rollback-mismatch",
    });
  });

  it("rejects absent and malformed rollback bundles", async () => {
    const root = await temporaryRoot();
    const candidate = adapter(root);
    const baseReceipt = {
      platformId: "opencode",
      profileId: "profile-opencode-boundary",
      adapterVersion: "opencode-provider-profile-v1",
      nativeDigestBefore: "before",
      nativeDigestAfter: "after",
      backupRef: null,
      appliedAt: 1,
    };
    await expect(
      candidate.rollback(context(root), baseReceipt),
    ).resolves.toMatchObject({
      restored: false,
      errorCode: "provider-rollback-failed",
    });

    const backupDir = path.join(root, "backups", "opencode", "1");
    const backupRef = path.join(backupDir, "bad.enc");
    await fs.mkdir(backupDir, { recursive: true });
    for (const inner of ["{", JSON.stringify({ version: 2 })]) {
      await fs.writeFile(
        backupRef,
        JSON.stringify({
          version: 1,
          payload: Buffer.from(inner).toString("base64"),
        }),
      );
      await expect(
        candidate.rollback(context(root), { ...baseReceipt, backupRef }),
      ).resolves.toMatchObject({
        restored: false,
        errorCode: "provider-rollback-failed",
      });
    }
  });

  it("fails rollback safely when its encrypted bundle is invalid", async () => {
    const root = await temporaryRoot();
    const candidate = adapter(root);
    await expect(
      candidate.rollback(context(root), {
        platformId: "opencode",
        profileId: "profile-opencode-boundary",
        adapterVersion: "opencode-provider-profile-v1",
        nativeDigestBefore: "before",
        nativeDigestAfter: "after",
        backupRef: path.join(root, "backups", "missing.enc"),
        appliedAt: 1,
      }),
    ).resolves.toEqual({
      restored: false,
      nativeDigest: null,
      errorCode: "provider-rollback-failed",
    });
  });
});
