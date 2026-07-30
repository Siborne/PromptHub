import type {
  AgentProviderActivationInput,
  AgentProviderActivationPlan,
  AgentProviderAdapterContext,
  AgentProviderApplyReceipt,
  AgentProviderComparableState,
  AgentProviderConnectionTestResult,
  AgentProviderImportPreview,
  AgentProviderModelTestResult,
  AgentProviderRollbackResult,
  AgentProviderVerification,
} from "@prompthub/shared";

export interface AgentProviderAdapter {
  readonly platformId: string;
  readonly version: string;
  testConnection?(
    context: AgentProviderAdapterContext,
    target: {
      profile: AgentProviderActivationInput["profile"];
      modelMappings: AgentProviderActivationInput["modelMappings"];
    },
  ): Promise<AgentProviderConnectionTestResult>;
  testModel?(
    context: AgentProviderAdapterContext,
    target: {
      profile: AgentProviderActivationInput["profile"];
      modelMappings: AgentProviderActivationInput["modelMappings"];
    },
    signal: AbortSignal,
  ): Promise<AgentProviderModelTestResult>;
  inspect(
    context: AgentProviderAdapterContext,
  ): Promise<AgentProviderComparableState>;
  importCurrent(
    context: AgentProviderAdapterContext,
  ): Promise<AgentProviderImportPreview>;
  planActivation(
    input: AgentProviderActivationInput,
  ): Promise<AgentProviderActivationPlan>;
  apply(
    context: AgentProviderAdapterContext,
    plan: AgentProviderActivationPlan,
    target: {
      profile: AgentProviderActivationInput["profile"];
      modelMappings: AgentProviderActivationInput["modelMappings"];
    },
  ): Promise<AgentProviderApplyReceipt>;
  verify(
    context: AgentProviderAdapterContext,
    plan: AgentProviderActivationPlan,
    receipt: AgentProviderApplyReceipt,
  ): Promise<AgentProviderVerification>;
  rollback(
    context: AgentProviderAdapterContext,
    receipt: AgentProviderApplyReceipt,
  ): Promise<AgentProviderRollbackResult>;
}

export interface AgentPlatformAdapters {
  provider?: AgentProviderAdapter;
}

function requireIdentifier(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

export class AgentAdapterRegistry {
  private readonly registrations = new Map<string, AgentPlatformAdapters>();

  register(platformId: string, adapters: AgentPlatformAdapters): void {
    const normalizedPlatformId = requireIdentifier(platformId, "platformId");
    if (this.registrations.has(normalizedPlatformId)) {
      throw new Error(
        `Agent platform ${normalizedPlatformId} is already registered`,
      );
    }
    if (
      adapters.provider &&
      adapters.provider.platformId !== normalizedPlatformId
    ) {
      throw new Error(
        `Provider adapter ${adapters.provider.platformId} does not match ${normalizedPlatformId}`,
      );
    }
    if (adapters.provider) {
      requireIdentifier(adapters.provider.version, "Provider adapter version");
    }
    this.registrations.set(normalizedPlatformId, { ...adapters });
  }

  get(platformId: string): AgentPlatformAdapters | null {
    return this.registrations.get(platformId) ?? null;
  }

  listPlatformIds(): string[] {
    return [...this.registrations.keys()].sort();
  }
}
