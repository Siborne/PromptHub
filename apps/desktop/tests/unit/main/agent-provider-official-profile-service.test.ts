import { describe, expect, it, vi } from "vitest";

import type {
  AgentProviderImportPreview,
  AgentProviderProfilePublic,
} from "@prompthub/shared";
import { createAgentProviderOfficialProfileService } from "../../../src/main/services/agent-provider-official-profile-service";

function currentPreview(
  platformId: "claude" | "codex",
  model: string | null = "current-model",
): AgentProviderImportPreview {
  return {
    state: {
      platformId,
      adapterVersion: "v1",
      nativeDigest: "native-digest",
      values: {},
    },
    profile: {
      platformId,
      name: "Current custom",
      providerKind: "custom-gateway",
      protocol: "openai-chat",
      endpoint: "https://gateway.example.com",
      config: {},
      secretRef: null,
      source: "native-import",
    },
    modelMappings: model
      ? [{ routeKey: "primary", modelId: model, parameters: {} }]
      : [],
    warnings: [],
  };
}

function publicProfile(
  platformId: string,
  overrides: Partial<AgentProviderProfilePublic> = {},
): AgentProviderProfilePublic {
  return {
    id: `${platformId}-official`,
    platformId,
    name: platformId === "claude" ? "Anthropic Official" : "OpenAI Official",
    providerKind: platformId === "claude" ? "anthropic" : "openai",
    protocol: "platform-native",
    endpoint: null,
    config: platformId === "codex" ? { providerId: "openai" } : {},
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 1,
    modelMappings: [
      {
        id: "mapping-1",
        providerProfileId: `${platformId}-official`,
        routeKey: "primary",
        modelId: "current-model",
        parameters: {},
      },
    ],
    secretState: "none",
    ...overrides,
  };
}

function harness(existing: AgentProviderProfilePublic[] = []) {
  const importCurrent = vi.fn(async ({ context }) =>
    currentPreview(context.platformId as "claude" | "codex"),
  );
  const listProfiles = vi.fn(async () => existing);
  const createProfile = vi.fn(async (request) =>
    publicProfile(request.profile.platformId),
  );
  const service = createAgentProviderOfficialProfileService({
    createProfile,
    importCurrent,
    listProfiles,
    resolveContext: (platformId) => ({
      agentId: platformId,
      platformId,
      rootPath: `/tmp/${platformId}`,
    }),
  });
  return { createProfile, importCurrent, listProfiles, service };
}

describe("Agent Provider official Profile service", () => {
  it.each([
    [
      "claude",
      {
        name: "Anthropic Official",
        providerKind: "anthropic",
        protocol: "platform-native",
        endpoint: null,
        config: {},
        source: "manual",
      },
    ],
    [
      "codex",
      {
        name: "OpenAI Official",
        providerKind: "openai",
        protocol: "platform-native",
        endpoint: null,
        config: { providerId: "openai" },
        source: "manual",
      },
    ],
  ] as const)(
    "creates a secret-free %s official Profile",
    async (platformId, profile) => {
      const { createProfile, service } = harness();

      await service.ensure(platformId);

      expect(createProfile).toHaveBeenCalledWith({
        profile: { platformId, ...profile },
        modelMappings: [
          { routeKey: "primary", modelId: "current-model", parameters: {} },
        ],
      });
      expect(JSON.stringify(createProfile.mock.calls)).not.toContain("secret");
    },
  );

  it("reuses an equivalent active official Profile", async () => {
    const existing = publicProfile("codex");
    const { createProfile, service } = harness([existing]);

    await expect(service.ensure("codex")).resolves.toBe(existing);
    expect(createProfile).not.toHaveBeenCalled();
  });

  it("fails closed for unsupported platforms and missing current models", async () => {
    const unsupported = harness();
    await expect(unsupported.service.ensure("opencode")).rejects.toThrow(
      "AGENT_PROVIDER_OFFICIAL_RESTORE_UNSUPPORTED",
    );
    expect(unsupported.importCurrent).not.toHaveBeenCalled();

    const missing = harness();
    missing.importCurrent.mockResolvedValueOnce(currentPreview("claude", null));
    await expect(missing.service.ensure("claude")).rejects.toThrow(
      "AGENT_PROVIDER_OFFICIAL_MODEL_REQUIRED",
    );
    expect(missing.createProfile).not.toHaveBeenCalled();
  });

  it("validates platform ids before resolving native paths", async () => {
    const { importCurrent, service } = harness();

    await expect(service.ensure("claude\u0000")).rejects.toThrow(
      "AGENT_PROVIDER_REQUEST_INVALID",
    );
    expect(importCurrent).not.toHaveBeenCalled();
  });
});
