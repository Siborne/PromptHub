import { act, screen, waitFor } from "@testing-library/react";
import { expect, vi } from "vitest";

import type {
  AgentProviderActivationPlan,
  AgentProviderImportPreview,
  AgentProviderProfilePublic,
  ManagedAgentSummary,
} from "@prompthub/shared/types";
import { AgentProviderProfileWorkbench } from "../../../src/renderer/components/agent/AgentProviderProfileWorkbench";
import { useAgentProviderStore } from "../../../src/renderer/stores/agent-provider.store";
import { renderWithI18n } from "../../helpers/i18n";
import { installWindowMocks } from "../../helpers/window";

export function createAgent(id = "claude"): ManagedAgentSummary {
  return {
    id,
    name: id === "claude" ? "Claude Code" : id,
    icon: "Terminal",
    isCustom: false,
    isConfigured: true,
    isDetected: true,
    isPinned: false,
    status: "installed",
    paths: {
      root: `~/.${id}`,
      skills: `~/.${id}/skills`,
      configFiles: [`~/.${id}/settings.json`],
      configFileRelativePaths: ["settings.json"],
    },
    capabilities: {
      overview: { status: "supported" },
      provider: { status: "supported" },
      appearance: { status: "planned" },
      assets: { status: "supported" },
      configFiles: { status: "supported" },
      sessions: { status: "supported" },
      usage: { status: "planned" },
      maintenance: { status: "supported" },
    },
  };
}

export function profile(
  overrides: Partial<AgentProviderProfilePublic> = {},
): AgentProviderProfilePublic {
  return {
    id: "profile-1",
    platformId: "claude",
    name: "Claude production",
    providerKind: "anthropic",
    protocol: "platform-native",
    endpoint: null,
    config: {},
    source: "manual",
    archived: false,
    createdAt: 1,
    updatedAt: 2,
    secretState: "none",
    modelMappings: [
      {
        id: "mapping-1",
        providerProfileId: "profile-1",
        routeKey: "primary",
        modelId: "claude-sonnet-4",
        parameters: {},
      },
    ],
    ...overrides,
  };
}

export function importPreview(): AgentProviderImportPreview {
  return {
    state: {
      platformId: "claude",
      adapterVersion: "model-profile-v1",
      nativeDigest: "digest-current",
      values: {
        model: "claude-opus-4",
        provider: "anthropic",
        endpoint: null,
        emptyValue: "",
        options: { region: "global" },
        absent: undefined,
      },
    },
    profile: {
      platformId: "claude",
      name: "anthropic",
      providerKind: "anthropic",
      protocol: "platform-native",
      endpoint: null,
      config: {},
      secretRef: null,
      source: "native-import",
    },
    modelMappings: [
      {
        routeKey: "primary",
        modelId: "claude-opus-4",
        parameters: {},
      },
    ],
    warnings: ["native-formatting-may-change", "custom-native-warning"],
  };
}

export function activationPlan(
  overrides: Partial<AgentProviderActivationPlan> = {},
): AgentProviderActivationPlan {
  return {
    platformId: "claude",
    profileId: "profile-1",
    adapterVersion: "model-profile-v1",
    currentDigest: "digest-current",
    status: "conflict",
    decisions: [
      {
        field: "model",
        status: "conflict",
        baseline: "claude-haiku-4",
        current: "claude-opus-4",
        desired: "claude-sonnet-4",
      },
    ],
    canApply: false,
    requiresReview: true,
    blockedReasons: [],
    ...overrides,
  };
}

export function resetProviderWorkbenchTestState(): void {
  installWindowMocks();
  useAgentProviderStore.setState({
    platformId: null,
    profiles: [],
    selectedProfileId: null,
    importPreview: null,
    activationPlan: null,
    activationResult: null,
    connectionResult: null,
    currentState: null,
    busyAction: null,
    errorCode: null,
  });
}

export async function renderWorkbench(agent = createAgent()) {
  const listProfiles = vi.mocked(window.api.agent.listProviderProfiles);
  const implementation = listProfiles.getMockImplementation();
  if (!implementation) {
    throw new Error("listProviderProfiles mock implementation is required");
  }
  let releaseResponse: (() => void) | undefined;
  let responseReady: (() => void) | undefined;
  let responseFinished: (() => void) | undefined;
  const releaseGate = new Promise<void>((resolve) => {
    releaseResponse = resolve;
  });
  const ready = new Promise<void>((resolve) => {
    responseReady = resolve;
  });
  const finished = new Promise<void>((resolve) => {
    responseFinished = resolve;
  });
  listProfiles.mockImplementationOnce(async (...args) => {
    let result: Awaited<ReturnType<typeof implementation>> | undefined;
    let failure: unknown;
    try {
      result = await implementation(...args);
    } catch (error) {
      failure = error;
    }
    responseReady?.();
    await releaseGate;
    responseFinished?.();
    if (failure) throw failure;
    return result ?? [];
  });

  const previewMigration = vi.mocked(window.api.agent.previewProviderMigration);
  const previewImplementation = previewMigration.getMockImplementation();
  let releaseMigration: (() => void) | undefined;
  let migrationReady: (() => void) | undefined;
  let migrationFinished: (() => void) | undefined;
  const migrationReleaseGate = new Promise<void>((resolve) => {
    releaseMigration = resolve;
  });
  const migrationReadyGate = new Promise<void>((resolve) => {
    migrationReady = resolve;
  });
  const migrationFinishedGate = new Promise<void>((resolve) => {
    migrationFinished = resolve;
  });
  if (agent.id === "codex" && previewImplementation) {
    previewMigration.mockImplementationOnce(async (...args) => {
      const result = await previewImplementation(...args);
      migrationReady?.();
      await migrationReleaseGate;
      migrationFinished?.();
      return result;
    });
  }

  const view = await renderWithI18n(
    <AgentProviderProfileWorkbench agent={agent} />,
  );
  await ready;
  await act(async () => {
    releaseResponse?.();
    await finished;
    await Promise.resolve();
  });
  await screen.findByRole("navigation", { name: "Provider profiles" });
  await waitFor(() =>
    expect(useAgentProviderStore.getState().busyAction).toBeNull(),
  );
  if (agent.id === "codex") {
    await migrationReadyGate;
    await act(async () => {
      releaseMigration?.();
      await migrationFinishedGate;
    });
    expect(window.api.agent.previewProviderMigration).toHaveBeenCalledWith(
      "codex",
    );
  }
  return view;
}
