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
import { createAgentGrokProviderAdapter } from "../../../src/main/services/agent-grok-provider-adapter";

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "grok-provider-"));
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
    name: "Team Grok gateway",
    providerKind: "openai-compatible",
    protocol: "openai-chat",
    endpoint: "https://provider.example/v1",
    config: {
      providerId: "team-grok",
      envKey: "TEAM_GROK_KEY",
    },
    secretRef: null,
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function mappings(
  modelId = "team-grok",
  parameters: Record<string, unknown> = {
    upstreamModelId: "grok-4",
    contextWindow: 131_072,
  },
): AgentProviderModelMapping[] {
  return [
    {
      id: "mapping-primary",
      providerProfileId: "profile-grok",
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

function successfulConnection() {
  return {
    protocol: "chat" as const,
    endpointOrigin: "https://provider.example",
    model: "grok-4",
    status: "ok" as const,
    startedAt: 1,
    finishedAt: 2,
    totalMs: 1,
    retryCount: 0,
    modelCount: 1,
    modelAvailable: true,
  };
}

function options(root: string, overrides: Record<string, unknown> = {}) {
  return {
    backupRoot: path.join(root, "backups"),
    backupEncryption: encryption(),
    environment: { TEAM_GROK_KEY: "main-only-secret" },
    openAIConnection: vi.fn().mockResolvedValue(successfulConnection()),
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

describe("Grok Build Provider Profile adapter", () => {
  it("imports the documented environment-owned model without exposing credentials", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        "[models]",
        'default = "team-grok"',
        "",
        "[model.team-grok]",
        'model = "grok-4"',
        'base_url = "https://user:password@provider.example/v1?token=hidden"',
        'name = "Team Grok"',
        'env_key = "TEAM_GROK_KEY"',
        'api_backend = "chat_completions"',
        "context_window = 131072",
        'keep_field = "yes"',
        "",
        "[ui]",
        'theme = "dark"',
      ].join("\n"),
    );
    const adapter = createAgentGrokProviderAdapter(options(root));

    const state = await adapter.inspect(context(root));
    expect(state.values).toMatchObject({
      providerId: "team-grok",
      provider: "openai-compatible",
      protocol: "openai-chat",
      endpoint: "https://provider.example/v1",
      model: "team-grok",
      upstreamModel: "grok-4",
      contextWindow: 131_072,
      envKey: "TEAM_GROK_KEY",
      authOwnership: "environment",
      credentialStatus: "configured",
    });
    expect(JSON.stringify(state)).not.toContain("password");
    expect(JSON.stringify(state)).not.toContain("token=hidden");
    expect(JSON.stringify(state)).not.toContain("main-only-secret");

    const imported = await adapter.importCurrent(context(root));
    expect(imported.profile).toMatchObject({
      platformId: "grok",
      providerKind: "openai-compatible",
      protocol: "openai-chat",
      endpoint: "https://provider.example/v1",
      config: { providerId: "team-grok", envKey: "TEAM_GROK_KEY" },
      secretRef: null,
      source: "native-import",
    });
    expect(imported.modelMappings).toEqual([
      {
        routeKey: "primary",
        modelId: "team-grok",
        parameters: {
          upstreamModelId: "grok-4",
          contextWindow: 131_072,
        },
      },
    ]);
    expect(JSON.stringify(imported)).not.toContain("main-only-secret");
  });

  it("activates an env-owned provider with encrypted backup and rollback", async () => {
    const root = await temporaryRoot();
    const configPath = path.join(root, "config.toml");
    const original = [
      "[models]",
      'default = "grok-build"',
      "",
      "[ui]",
      'theme = "dark"',
    ].join("\n");
    await fs.writeFile(configPath, original);
    const adapter = createAgentGrokProviderAdapter(options(root));
    const baseline = await adapter.inspect(context(root));

    const plan = await adapter.planActivation({
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline,
    });
    expect(plan.canApply).toBe(true);
    expect(plan.status).toBe("apply");

    const receipt = await adapter.apply(context(root), plan, {
      profile: profile(),
      modelMappings: mappings(),
    });
    expect(receipt.backupRef).toBeTruthy();
    const persistedBackup = await fs.readFile(receipt.backupRef!, "utf8");
    expect(persistedBackup).not.toContain(original);
    expect(persistedBackup).not.toContain("main-only-secret");

    const parsed = parseToml(await fs.readFile(configPath, "utf8")) as Record<
      string,
      any
    >;
    expect(parsed.models.default).toBe("team-grok");
    expect(parsed.model["team-grok"]).toMatchObject({
      model: "grok-4",
      base_url: "https://provider.example/v1",
      name: "Team Grok gateway",
      env_key: "TEAM_GROK_KEY",
      api_backend: "chat_completions",
      context_window: 131_072,
    });
    expect(parsed.model["team-grok"].api_key).toBeUndefined();
    expect(parsed.ui.theme).toBe("dark");

    expect((await adapter.verify(context(root), plan, receipt)).verified).toBe(
      true,
    );
    expect((await adapter.rollback(context(root), receipt)).restored).toBe(
      true,
    );
    expect(await fs.readFile(configPath, "utf8")).toBe(original);
  });

  it("keeps native and inline-secret authentication redacted and read-only", async () => {
    const root = await temporaryRoot();
    await fs.writeFile(
      path.join(root, "config.toml"),
      [
        "[models]",
        'default = "private-grok"',
        "",
        "[model.private-grok]",
        'model = "grok-4"',
        'base_url = "https://provider.example/v1"',
        'api_backend = "responses"',
        'api_key = "native-inline-secret"',
      ].join("\n"),
    );
    const adapter = createAgentGrokProviderAdapter(options(root));
    const imported = await adapter.importCurrent(context(root));

    expect(imported.profile.protocol).toBe("platform-native");
    expect(imported.warnings).toContain("native-provider-read-only");
    expect(JSON.stringify(imported)).not.toContain("native-inline-secret");

    const plan = await adapter.planActivation({
      context: context(root),
      profile: profile({
        config: { providerId: "private-grok", envKey: "TEAM_GROK_KEY" },
        protocol: "openai-responses",
      }),
      modelMappings: mappings("private-grok"),
      baseline: null,
    });
    expect(plan.canApply).toBe(false);
    expect(plan.blockedReasons).toContain("native-provider-auth-owned");

    const nativePlan = await adapter.planActivation({
      context: context(root),
      profile: imported.profile as AgentProviderProfile,
      modelMappings: imported.modelMappings.map((mapping, index) => ({
        ...mapping,
        id: `imported-${index}`,
        providerProfileId: "native",
      })),
      baseline: null,
    });
    expect(nativePlan.canApply).toBe(false);
    expect(nativePlan.blockedReasons).toContain("native-provider-read-only");
  });

  it("resolves env credentials only inside main-process probes", async () => {
    const root = await temporaryRoot();
    const openAIConnection = vi.fn().mockResolvedValue(successfulConnection());
    const adapter = createAgentGrokProviderAdapter(
      options(root, { openAIConnection }),
    );

    const result = await adapter.testConnection!(context(root), {
      profile: profile(),
      modelMappings: mappings(),
    });
    expect(result.status).toBe("ok");
    expect(openAIConnection).toHaveBeenCalledWith(
      expect.objectContaining({ credential: "main-only-secret" }),
    );
    expect(JSON.stringify(result)).not.toContain("main-only-secret");

    const missing = createAgentGrokProviderAdapter(
      options(root, { environment: {} }),
    );
    expect(
      (
        await missing.testConnection!(context(root), {
          profile: profile(),
          modelMappings: mappings(),
        })
      ).status,
    ).toBe("no-credentials");
  });

  it("rejects unsafe roots, malformed files, symlinks, and stale plans", async () => {
    const root = await temporaryRoot();
    const adapter = createAgentGrokProviderAdapter(options(root));
    await expect(
      adapter.inspect({ agentId: "grok", platformId: "grok", rootPath: "." }),
    ).rejects.toThrow("AGENT_GROK_PROVIDER_CONTEXT_INVALID");

    await fs.writeFile(path.join(root, "config.toml"), "[models");
    await expect(adapter.inspect(context(root))).rejects.toThrow(
      "AGENT_GROK_PROVIDER_CONFIG_INVALID",
    );

    await fs.rm(path.join(root, "config.toml"));
    const outside = path.join(root, "outside.toml");
    await fs.writeFile(outside, '[models]\ndefault = "grok-build"\n');
    await fs.symlink(outside, path.join(root, "config.toml"));
    await expect(adapter.inspect(context(root))).rejects.toThrow(
      "AGENT_GROK_PROVIDER_CONFIG_INVALID",
    );

    await fs.rm(path.join(root, "config.toml"));
    await fs.writeFile(
      path.join(root, "config.toml"),
      '[models]\ndefault = "grok-build"\n',
    );
    const plan = await adapter.planActivation({
      context: context(root),
      profile: profile(),
      modelMappings: mappings(),
      baseline: await adapter.inspect(context(root)),
    });
    await fs.appendFile(path.join(root, "config.toml"), "\n[ui]\ntheme='x'\n");
    await expect(
      adapter.apply(context(root), plan, {
        profile: profile(),
        modelMappings: mappings(),
      }),
    ).rejects.toThrow("AGENT_GROK_PROVIDER_PLAN_INVALID");
  });
});
