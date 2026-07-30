export const AGENT_ASSET_KINDS = ["skill", "mcp", "rule", "plugin"] as const;

export type AgentAssetKind = (typeof AGENT_ASSET_KINDS)[number];

export interface AgentAssetTargetState {
  id: string;
  kind: AgentAssetKind;
  platformId: string;
  label: string;
  state: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface AgentAssetActionInput {
  kind: AgentAssetKind;
  platformId: string;
  action: string;
  assetId: string;
  options: Record<string, unknown>;
}

export interface AgentAssetActionPlan {
  operationId: string;
  input: AgentAssetActionInput;
  status: "ready" | "blocked" | "unsupported";
  warnings: string[];
}

export interface AgentAssetActionResult {
  operationId: string;
  kind: AgentAssetKind;
  platformId: string;
  status: "applied" | "failed" | "cancelled";
  errorCode?: string;
}

export interface AgentAssetDomainAdapter {
  readonly kind: AgentAssetKind;
  listForTarget(platformId: string): Promise<AgentAssetTargetState[]>;
  planAction(input: AgentAssetActionInput): Promise<AgentAssetActionPlan>;
  applyAction(plan: AgentAssetActionPlan): Promise<AgentAssetActionResult>;
}

export interface AgentAssetDomainResult {
  kind: AgentAssetKind;
  status: "available" | "unsupported" | "failed";
  items: AgentAssetTargetState[];
  errorCode?: "asset-domain-list-failed" | "asset-domain-list-invalid";
}

export interface AgentAssetAggregate {
  platformId: string;
  total: number;
  domains: AgentAssetDomainResult[];
}

function requireIdentifier(value: string, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} is required`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function requireAssetKind(value: AgentAssetKind): AgentAssetKind {
  if (!AGENT_ASSET_KINDS.includes(value)) {
    throw new Error("Agent asset kind is invalid");
  }
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasSameStructuredValue(actual: unknown, expected: unknown): boolean {
  if (Object.is(actual, expected)) return true;
  if (Array.isArray(actual) || Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      Array.isArray(expected) &&
      actual.length === expected.length &&
      actual.every((value, index) =>
        hasSameStructuredValue(value, expected[index]),
      )
    );
  }
  if (!isPlainRecord(actual) || !isPlainRecord(expected)) return false;
  const actualKeys = Object.keys(actual).sort();
  const expectedKeys = Object.keys(expected).sort();
  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every(
      (key, index) =>
        key === expectedKeys[index] &&
        hasSameStructuredValue(actual[key], expected[key]),
    )
  );
}

function validateItems(
  kind: AgentAssetKind,
  platformId: string,
  items: AgentAssetTargetState[],
): boolean {
  const ids = new Set<string>();
  return items.every((item) => {
    const id = item.id.trim();
    const valid =
      id.length > 0 &&
      !ids.has(id) &&
      item.kind === kind &&
      item.platformId === platformId &&
      item.label.trim().length > 0 &&
      item.state.trim().length > 0;
    ids.add(id);
    return valid;
  });
}

function matchesInput(
  actual: AgentAssetActionInput,
  expected: AgentAssetActionInput,
): boolean {
  return (
    actual.kind === expected.kind &&
    actual.platformId === expected.platformId &&
    actual.action === expected.action &&
    actual.assetId === expected.assetId &&
    hasSameStructuredValue(actual.options, expected.options)
  );
}

export class AgentAssetAggregationService {
  private readonly adapters = new Map<
    AgentAssetKind,
    AgentAssetDomainAdapter
  >();

  constructor(adapters: AgentAssetDomainAdapter[]) {
    for (const adapter of adapters) {
      requireAssetKind(adapter.kind);
      if (this.adapters.has(adapter.kind)) {
        throw new Error(
          `Agent asset adapter ${adapter.kind} already registered`,
        );
      }
      this.adapters.set(adapter.kind, adapter);
    }
  }

  async listForTarget(platformId: string): Promise<AgentAssetAggregate> {
    const normalizedPlatformId = requireIdentifier(platformId, "platformId");
    const domains = await Promise.all(
      AGENT_ASSET_KINDS.map(async (kind): Promise<AgentAssetDomainResult> => {
        const adapter = this.adapters.get(kind);
        if (!adapter) return { kind, status: "unsupported", items: [] };

        let items: AgentAssetTargetState[];
        try {
          items = await adapter.listForTarget(normalizedPlatformId);
        } catch {
          return {
            kind,
            status: "failed",
            items: [],
            errorCode: "asset-domain-list-failed",
          };
        }
        if (
          !Array.isArray(items) ||
          !validateItems(kind, normalizedPlatformId, items)
        ) {
          return {
            kind,
            status: "failed",
            items: [],
            errorCode: "asset-domain-list-invalid",
          };
        }
        return { kind, status: "available", items };
      }),
    );

    return {
      platformId: normalizedPlatformId,
      total: domains.reduce((total, domain) => total + domain.items.length, 0),
      domains,
    };
  }

  async planAction(
    input: AgentAssetActionInput,
  ): Promise<AgentAssetActionPlan> {
    requireAssetKind(input.kind);
    requireIdentifier(input.platformId, "platformId");
    requireIdentifier(input.action, "action");
    requireIdentifier(input.assetId, "assetId");
    if (!isPlainRecord(input.options)) {
      throw new Error("Agent asset action options must be an object");
    }
    const adapter = this.adapters.get(input.kind);
    if (!adapter) {
      return {
        operationId: globalThis.crypto.randomUUID(),
        input: structuredClone(input),
        status: "unsupported",
        warnings: [],
      };
    }

    let plan: AgentAssetActionPlan;
    try {
      plan = await adapter.planAction(input);
    } catch {
      throw new Error(`Agent asset ${input.kind} action planning failed`);
    }
    requireIdentifier(plan.operationId, "operationId");
    if (
      !matchesInput(plan.input, input) ||
      !["ready", "blocked", "unsupported"].includes(plan.status) ||
      !Array.isArray(plan.warnings) ||
      plan.warnings.some((warning) => typeof warning !== "string")
    ) {
      throw new Error(
        `Agent asset ${input.kind} adapter returned cross-domain plan`,
      );
    }
    return plan;
  }

  async applyAction(
    plan: AgentAssetActionPlan,
  ): Promise<AgentAssetActionResult> {
    requireAssetKind(plan.input.kind);
    if (plan.status !== "ready") {
      throw new Error("Agent asset action plan is not ready");
    }
    const adapter = this.adapters.get(plan.input.kind);
    if (!adapter) {
      throw new Error(`Agent asset ${plan.input.kind} adapter is unavailable`);
    }

    let result: AgentAssetActionResult;
    try {
      result = await adapter.applyAction(plan);
    } catch {
      throw new Error(`Agent asset ${plan.input.kind} action failed`);
    }
    if (
      result.operationId !== plan.operationId ||
      result.kind !== plan.input.kind ||
      result.platformId !== plan.input.platformId ||
      !["applied", "failed", "cancelled"].includes(result.status)
    ) {
      throw new Error(
        `Agent asset ${plan.input.kind} adapter returned cross-domain result`,
      );
    }
    return result;
  }
}
