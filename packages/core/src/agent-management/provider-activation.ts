import type {
  AgentProviderActivationExecutionResult,
  AgentProviderActivationPlan,
  AgentProviderAdapterContext,
  AgentProviderApplyReceipt,
  AgentProviderComparableState,
  AgentProviderConnectionTestResult,
  AgentProviderConnectionTestStatus,
  AgentProviderFieldDecisionStatus,
  AgentProviderFieldResolution,
  AgentProviderImportPreview,
  AgentProviderModelMapping,
  AgentProviderModelTestResult,
  AgentProviderModelTestStatus,
  AgentProviderProfile,
  AgentProviderRollbackResult,
  AgentProviderSnapshot,
  AgentProviderVerification,
  CreateAgentProviderSnapshotInput,
} from "@prompthub/shared";
import { assertAgentProviderPublicConfig } from "@prompthub/shared/utils/agent-provider-config";

import type { AgentProviderAdapter } from "./adapter-registry";
import { AgentAdapterRegistry } from "./adapter-registry";

export interface AgentProviderActivationRepository {
  getProfile(
    profileId: string,
  ): AgentProviderProfile | null | Promise<AgentProviderProfile | null>;
  listModelMappings(
    profileId: string,
  ): AgentProviderModelMapping[] | Promise<AgentProviderModelMapping[]>;
  getBaseline(
    platformId: string,
  ):
    | AgentProviderComparableState
    | null
    | Promise<AgentProviderComparableState | null>;
  recordSnapshot(
    input: CreateAgentProviderSnapshotInput,
  ): AgentProviderSnapshot | Promise<AgentProviderSnapshot>;
}

export interface AgentProviderPreviewInput {
  context: AgentProviderAdapterContext;
  profileId: string;
}

export interface AgentProviderImportInput {
  context: AgentProviderAdapterContext;
}

export interface AgentProviderActivateInput extends AgentProviderPreviewInput {
  expectedCurrentDigest: string;
  resolutions?: AgentProviderFieldResolution[];
}

interface ActivationBoundary {
  adapter: AgentProviderAdapter;
  baseline: AgentProviderComparableState | null;
  modelMappings: AgentProviderModelMapping[];
  profile: AgentProviderProfile;
}

const PLAN_STATUSES = new Set([
  "apply",
  "preserve",
  "backfill",
  "external-modified",
  "conflict",
  "unsupported",
  "blocked",
]);
const CONNECTION_TEST_STATUSES: ReadonlySet<AgentProviderConnectionTestStatus> =
  new Set([
    "ok",
    "model-not-found",
    "no-credentials",
    "invalid-endpoint",
    "blocked-address",
    "auth-error",
    "http-error",
    "protocol-error",
    "network-error",
    "timeout",
    "response-too-large",
    "unsupported",
  ]);
const MODEL_TEST_STATUSES: ReadonlySet<AgentProviderModelTestStatus> = new Set([
  "ok",
  "cancelled",
  "no-credentials",
  "invalid-endpoint",
  "blocked-address",
  "auth-error",
  "model-not-found",
  "quota-error",
  "rate-limited",
  "http-error",
  "protocol-error",
  "network-error",
  "connect-timeout",
  "first-token-timeout",
  "total-timeout",
  "response-too-large",
  "unsupported",
]);
const REVIEW_STATUSES: ReadonlySet<AgentProviderFieldDecisionStatus> = new Set([
  "backfill",
  "external-modified",
  "conflict",
]);
const STATUS_PRIORITY: AgentProviderFieldDecisionStatus[] = [
  "blocked",
  "conflict",
  "unsupported",
  "external-modified",
  "backfill",
  "apply",
  "preserve",
];

function requireText(value: string, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(code);
  return value.trim();
}

function validateContext(context: AgentProviderAdapterContext): void {
  requireText(context.agentId, "AGENT_PROVIDER_CONTEXT_INVALID");
  requireText(context.platformId, "AGENT_PROVIDER_CONTEXT_INVALID");
  requireText(context.rootPath, "AGENT_PROVIDER_CONTEXT_INVALID");
}

function validatePlan(
  plan: AgentProviderActivationPlan,
  boundary: ActivationBoundary,
): void {
  const valid =
    plan.platformId === boundary.profile.platformId &&
    plan.profileId === boundary.profile.id &&
    plan.adapterVersion === boundary.adapter.version &&
    typeof plan.currentDigest === "string" &&
    plan.currentDigest.trim().length > 0 &&
    PLAN_STATUSES.has(plan.status) &&
    typeof plan.canApply === "boolean" &&
    typeof plan.requiresReview === "boolean" &&
    Array.isArray(plan.decisions) &&
    plan.decisions.every(
      (decision) =>
        typeof decision?.field === "string" &&
        decision.field.trim().length > 0 &&
        PLAN_STATUSES.has(decision.status),
    ) &&
    Array.isArray(plan.blockedReasons) &&
    plan.blockedReasons.every((reason) => typeof reason === "string");
  if (!valid) throw new Error("AGENT_PROVIDER_PLAN_INVALID");
}

function validateReceipt(
  receipt: AgentProviderApplyReceipt,
  plan: AgentProviderActivationPlan,
): void {
  const valid =
    receipt.platformId === plan.platformId &&
    receipt.profileId === plan.profileId &&
    receipt.adapterVersion === plan.adapterVersion &&
    receipt.nativeDigestBefore === plan.currentDigest &&
    typeof receipt.nativeDigestAfter === "string" &&
    receipt.nativeDigestAfter.trim().length > 0 &&
    (receipt.backupRef === null || typeof receipt.backupRef === "string") &&
    Number.isFinite(receipt.appliedAt);
  if (!valid) throw new Error("AGENT_PROVIDER_APPLY_RECEIPT_INVALID");
}

function validateVerification(
  verification: AgentProviderVerification,
  receipt: AgentProviderApplyReceipt,
): void {
  const valid =
    typeof verification.verified === "boolean" &&
    typeof verification.nativeDigest === "string" &&
    verification.nativeDigest.trim().length > 0 &&
    verification.state?.platformId === receipt.platformId &&
    verification.state.adapterVersion === receipt.adapterVersion &&
    verification.state.nativeDigest === verification.nativeDigest &&
    (verification.errorCode === undefined ||
      typeof verification.errorCode === "string");
  if (!valid) throw new Error("AGENT_PROVIDER_VERIFICATION_INVALID");
  if (
    verification.verified &&
    verification.nativeDigest !== receipt.nativeDigestAfter
  ) {
    throw new Error("AGENT_PROVIDER_VERIFICATION_INVALID");
  }
}

function validateRollback(
  result: AgentProviderRollbackResult,
): AgentProviderRollbackResult {
  const valid =
    typeof result.restored === "boolean" &&
    (result.nativeDigest === null ||
      (typeof result.nativeDigest === "string" &&
        result.nativeDigest.trim().length > 0)) &&
    (result.errorCode === undefined || typeof result.errorCode === "string");
  if (!valid) throw new Error("AGENT_PROVIDER_ROLLBACK_INVALID");
  return result;
}

function structuralSnapshot(
  plan: AgentProviderActivationPlan,
): Record<string, unknown> {
  return {
    adapterVersion: plan.adapterVersion,
    decisions: plan.decisions.map(({ field, status }) => ({ field, status })),
  };
}

function resolvePlan(
  plan: AgentProviderActivationPlan,
  resolutions: AgentProviderFieldResolution[] | undefined,
): AgentProviderActivationPlan {
  if (resolutions === undefined) return plan;
  if (!Array.isArray(resolutions)) {
    throw new Error("AGENT_PROVIDER_RESOLUTION_INVALID");
  }
  const byField = new Map<string, AgentProviderFieldResolution>();
  for (const resolution of resolutions) {
    const valid =
      resolution !== null &&
      typeof resolution === "object" &&
      typeof resolution.field === "string" &&
      resolution.field.trim().length > 0 &&
      (resolution.action === "preserve-current" ||
        resolution.action === "use-profile");
    if (!valid) throw new Error("AGENT_PROVIDER_RESOLUTION_INVALID");
    const field = resolution.field.trim();
    const decision = plan.decisions.find(
      (candidate) => candidate.field === field,
    );
    if (
      byField.has(field) ||
      !decision ||
      !REVIEW_STATUSES.has(decision.status)
    ) {
      throw new Error("AGENT_PROVIDER_RESOLUTION_INVALID");
    }
    byField.set(field, { field, action: resolution.action });
  }
  const decisions = plan.decisions.map((decision) => {
    const resolution = byField.get(decision.field);
    if (!resolution) return { ...decision };
    return {
      ...decision,
      status:
        resolution.action === "use-profile"
          ? ("apply" as const)
          : ("preserve" as const),
    };
  });
  const status =
    STATUS_PRIORITY.find((candidate) =>
      decisions.some((decision) => decision.status === candidate),
    ) ?? "preserve";
  const canApply =
    plan.blockedReasons.length === 0 &&
    decisions.every(
      (decision) =>
        decision.status === "apply" || decision.status === "preserve",
    );
  return {
    ...plan,
    status,
    decisions,
    canApply,
    requiresReview: !canApply,
  };
}

function validateImportPreview(
  preview: AgentProviderImportPreview,
  context: AgentProviderAdapterContext,
  adapter: AgentProviderAdapter,
): void {
  let publicValuesValid = false;
  try {
    assertAgentProviderPublicConfig(preview?.state?.values);
    assertAgentProviderPublicConfig(preview?.profile?.config);
    for (const mapping of preview?.modelMappings ?? []) {
      assertAgentProviderPublicConfig(mapping.parameters);
    }
    publicValuesValid = true;
  } catch {
    publicValuesValid = false;
  }
  const valid =
    preview !== null &&
    typeof preview === "object" &&
    preview.state?.platformId === context.platformId &&
    preview.state.adapterVersion === adapter.version &&
    typeof preview.state.nativeDigest === "string" &&
    preview.state.nativeDigest.trim().length > 0 &&
    preview.profile?.platformId === context.platformId &&
    typeof preview.profile.name === "string" &&
    preview.profile.name.trim().length > 0 &&
    typeof preview.profile.providerKind === "string" &&
    preview.profile.providerKind.trim().length > 0 &&
    typeof preview.profile.protocol === "string" &&
    preview.profile.protocol.trim().length > 0 &&
    (preview.profile.endpoint === null ||
      preview.profile.endpoint === undefined ||
      typeof preview.profile.endpoint === "string") &&
    (preview.profile.secretRef === null ||
      preview.profile.secretRef === undefined) &&
    preview.profile.source === "native-import" &&
    Array.isArray(preview.modelMappings) &&
    preview.modelMappings.every(
      (mapping) =>
        typeof mapping?.routeKey === "string" &&
        mapping.routeKey.trim().length > 0 &&
        typeof mapping.modelId === "string" &&
        mapping.modelId.trim().length > 0,
    ) &&
    Array.isArray(preview.warnings) &&
    preview.warnings.every((warning) => typeof warning === "string") &&
    publicValuesValid;
  if (!valid) throw new Error("AGENT_PROVIDER_IMPORT_INVALID");
}

function validateConnectionResult(
  result: AgentProviderConnectionTestResult,
  boundary: ActivationBoundary,
): AgentProviderConnectionTestResult {
  let endpointValid = result?.endpointOrigin === null;
  if (typeof result?.endpointOrigin === "string") {
    try {
      const endpoint = new URL(result.endpointOrigin);
      endpointValid =
        endpoint.origin === result.endpointOrigin &&
        !endpoint.username &&
        !endpoint.password &&
        !endpoint.search &&
        !endpoint.hash;
    } catch {
      endpointValid = false;
    }
  }
  const valid =
    result !== null &&
    typeof result === "object" &&
    result.platformId === boundary.profile.platformId &&
    result.profileId === boundary.profile.id &&
    typeof result.protocol === "string" &&
    result.protocol.trim().length > 0 &&
    endpointValid &&
    (result.model === null ||
      (typeof result.model === "string" && result.model.length <= 512)) &&
    CONNECTION_TEST_STATUSES.has(result.status) &&
    Number.isFinite(result.startedAt) &&
    Number.isFinite(result.finishedAt) &&
    result.finishedAt >= result.startedAt &&
    Number.isFinite(result.totalMs) &&
    result.totalMs >= 0 &&
    Number.isInteger(result.retryCount) &&
    result.retryCount >= 0 &&
    (result.modelCount === null ||
      (Number.isInteger(result.modelCount) && result.modelCount >= 0)) &&
    (result.modelAvailable === null ||
      typeof result.modelAvailable === "boolean") &&
    (result.errorCode === undefined ||
      (typeof result.errorCode === "string" &&
        /^[a-z0-9][a-z0-9-]{0,63}$/.test(result.errorCode)));
  if (!valid) throw new Error("AGENT_PROVIDER_CONNECTION_TEST_INVALID");
  return structuredClone(result);
}

function validateModelTestResult(
  result: AgentProviderModelTestResult,
  boundary: ActivationBoundary,
): AgentProviderModelTestResult {
  let endpointValid = result?.endpointOrigin === null;
  if (typeof result?.endpointOrigin === "string") {
    try {
      const endpoint = new URL(result.endpointOrigin);
      endpointValid =
        endpoint.origin === result.endpointOrigin &&
        !endpoint.username &&
        !endpoint.password &&
        !endpoint.search &&
        !endpoint.hash;
    } catch {
      endpointValid = false;
    }
  }
  const tokenCountValid = (value: number | null) =>
    value === null || (Number.isInteger(value) && value >= 0);
  const previewValid =
    result?.outputPreview === null ||
    (typeof result?.outputPreview === "string" &&
      result.outputPreview.length <= 256 &&
      !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(
        result.outputPreview,
      ));
  const valid =
    result !== null &&
    typeof result === "object" &&
    result.platformId === boundary.profile.platformId &&
    result.profileId === boundary.profile.id &&
    typeof result.protocol === "string" &&
    result.protocol.trim().length > 0 &&
    endpointValid &&
    (result.model === null ||
      (typeof result.model === "string" && result.model.length <= 512)) &&
    MODEL_TEST_STATUSES.has(result.status) &&
    Number.isFinite(result.startedAt) &&
    Number.isFinite(result.finishedAt) &&
    result.finishedAt >= result.startedAt &&
    Number.isFinite(result.totalMs) &&
    result.totalMs >= 0 &&
    (result.firstTokenMs === null ||
      (Number.isFinite(result.firstTokenMs) &&
        result.firstTokenMs >= 0 &&
        result.firstTokenMs <= result.totalMs)) &&
    Number.isInteger(result.retryCount) &&
    result.retryCount >= 0 &&
    result.retryCount <= 1 &&
    tokenCountValid(result.inputTokens) &&
    tokenCountValid(result.outputTokens) &&
    previewValid &&
    (result.errorCode === undefined ||
      (typeof result.errorCode === "string" &&
        /^[a-z0-9][a-z0-9-]{0,63}$/.test(result.errorCode)));
  if (!valid) throw new Error("AGENT_PROVIDER_MODEL_TEST_INVALID");
  return structuredClone(result);
}

export class AgentProviderActivationService {
  private readonly activePlatforms = new Set<string>();

  constructor(
    private readonly registry: AgentAdapterRegistry,
    private readonly repository: AgentProviderActivationRepository,
  ) {}

  async testCurrentConnection(
    input: AgentProviderImportInput,
  ): Promise<AgentProviderConnectionTestResult> {
    const boundary = await this.resolveCurrentBoundary(input);
    if (!boundary.adapter.testConnection) {
      throw new Error("AGENT_PROVIDER_CONNECTION_TEST_UNSUPPORTED");
    }
    let result: AgentProviderConnectionTestResult;
    try {
      result = await boundary.adapter.testConnection(input.context, {
        profile: boundary.profile,
        modelMappings: boundary.modelMappings,
      });
    } catch {
      throw new Error("AGENT_PROVIDER_CONNECTION_TEST_FAILED");
    }
    return validateConnectionResult(result, boundary);
  }

  async testCurrentModel(
    input: AgentProviderImportInput,
    signal: AbortSignal,
  ): Promise<AgentProviderModelTestResult> {
    const boundary = await this.resolveCurrentBoundary(input);
    if (!boundary.adapter.testModel) {
      throw new Error("AGENT_PROVIDER_MODEL_TEST_UNSUPPORTED");
    }
    let result: AgentProviderModelTestResult;
    try {
      result = await boundary.adapter.testModel(
        input.context,
        {
          profile: boundary.profile,
          modelMappings: boundary.modelMappings,
        },
        signal,
      );
    } catch {
      throw new Error("AGENT_PROVIDER_MODEL_TEST_FAILED");
    }
    return validateModelTestResult(result, boundary);
  }

  async testConnection(
    input: AgentProviderPreviewInput,
  ): Promise<AgentProviderConnectionTestResult> {
    const boundary = await this.resolveBoundary(input);
    if (!boundary.adapter.testConnection) {
      throw new Error("AGENT_PROVIDER_CONNECTION_TEST_UNSUPPORTED");
    }
    let result: AgentProviderConnectionTestResult;
    try {
      result = await boundary.adapter.testConnection(input.context, {
        profile: boundary.profile,
        modelMappings: boundary.modelMappings,
      });
    } catch {
      throw new Error("AGENT_PROVIDER_CONNECTION_TEST_FAILED");
    }
    return validateConnectionResult(result, boundary);
  }

  async testModel(
    input: AgentProviderPreviewInput,
    signal: AbortSignal,
  ): Promise<AgentProviderModelTestResult> {
    const boundary = await this.resolveBoundary(input);
    if (!boundary.adapter.testModel) {
      throw new Error("AGENT_PROVIDER_MODEL_TEST_UNSUPPORTED");
    }
    let result: AgentProviderModelTestResult;
    try {
      result = await boundary.adapter.testModel(
        input.context,
        {
          profile: boundary.profile,
          modelMappings: boundary.modelMappings,
        },
        signal,
      );
    } catch {
      throw new Error("AGENT_PROVIDER_MODEL_TEST_FAILED");
    }
    return validateModelTestResult(result, boundary);
  }

  async importCurrent(
    input: AgentProviderImportInput,
  ): Promise<AgentProviderImportPreview> {
    const { preview } = await this.readCurrentPreview(input);
    return structuredClone(preview);
  }

  async preview(
    input: AgentProviderPreviewInput,
  ): Promise<AgentProviderActivationPlan> {
    const boundary = await this.resolveBoundary(input);
    let plan: AgentProviderActivationPlan;
    try {
      plan = await boundary.adapter.planActivation({
        context: input.context,
        profile: boundary.profile,
        modelMappings: boundary.modelMappings,
        baseline: boundary.baseline,
      });
    } catch {
      throw new Error("AGENT_PROVIDER_PLAN_FAILED");
    }
    validatePlan(plan, boundary);
    return plan;
  }

  async activate(
    input: AgentProviderActivateInput,
  ): Promise<AgentProviderActivationExecutionResult> {
    validateContext(input.context);
    const platformId = requireText(
      input.context.platformId,
      "AGENT_PROVIDER_CONTEXT_INVALID",
    );
    if (this.activePlatforms.has(platformId)) {
      throw new Error("AGENT_PROVIDER_ACTIVATION_IN_PROGRESS");
    }
    this.activePlatforms.add(platformId);
    try {
      return await this.activateLocked(input);
    } finally {
      this.activePlatforms.delete(platformId);
    }
  }

  private async activateLocked(
    input: AgentProviderActivateInput,
  ): Promise<AgentProviderActivationExecutionResult> {
    const plan = resolvePlan(await this.preview(input), input.resolutions);
    if (plan.currentDigest !== input.expectedCurrentDigest) {
      throw new Error("AGENT_PROVIDER_ACTIVATION_STALE");
    }
    if (plan.canApply && plan.status === "preserve") {
      throw new Error("AGENT_PROVIDER_ACTIVATION_NO_CHANGES");
    }
    if (!plan.canApply || plan.status !== "apply") {
      throw new Error("AGENT_PROVIDER_ACTIVATION_BLOCKED");
    }
    const boundary = await this.resolveBoundary(input);

    let receipt: AgentProviderApplyReceipt;
    try {
      receipt = await boundary.adapter.apply(input.context, plan, {
        profile: boundary.profile,
        modelMappings: boundary.modelMappings,
      });
      validateReceipt(receipt, plan);
    } catch {
      await this.recordFailure(plan, null, "provider-apply-failed");
      return {
        status: "failed",
        plan,
        verification: null,
        rollback: null,
        errorCode: "provider-apply-failed",
      };
    }

    let verification: AgentProviderVerification;
    try {
      verification = await boundary.adapter.verify(
        input.context,
        plan,
        receipt,
      );
      validateVerification(verification, receipt);
    } catch {
      return this.rollbackAfterFailure(
        boundary,
        input.context,
        plan,
        receipt,
        null,
        "provider-verification-failed",
      );
    }

    if (!verification.verified) {
      return this.rollbackAfterFailure(
        boundary,
        input.context,
        plan,
        receipt,
        verification,
        verification.errorCode ?? "provider-verification-failed",
      );
    }

    try {
      await this.repository.recordSnapshot({
        platformId: plan.platformId,
        providerProfileId: plan.profileId,
        nativeDigest: verification.nativeDigest,
        redactedSnapshot: {
          adapterVersion: verification.state.adapterVersion,
          values: verification.state.values,
        },
        backupRef: receipt.backupRef,
        operation: "activate",
        result: "verified",
      });
    } catch {
      return this.rollbackAfterFailure(
        boundary,
        input.context,
        plan,
        receipt,
        verification,
        "provider-audit-write-failed",
      );
    }
    return {
      status: "verified",
      plan,
      verification,
      rollback: null,
    };
  }

  private async resolveBoundary(
    input: AgentProviderPreviewInput,
  ): Promise<ActivationBoundary> {
    validateContext(input.context);
    const profileId = requireText(
      input.profileId,
      "AGENT_PROVIDER_PROFILE_NOT_FOUND",
    );
    const [profile, modelMappings] = await Promise.all([
      this.repository.getProfile(profileId),
      this.repository.listModelMappings(profileId),
    ]);
    if (!profile) throw new Error("AGENT_PROVIDER_PROFILE_NOT_FOUND");
    if (profile.archived) throw new Error("AGENT_PROVIDER_PROFILE_ARCHIVED");
    const mappingsValid =
      Array.isArray(modelMappings) &&
      modelMappings.every(
        (mapping) =>
          mapping.providerProfileId === profile.id &&
          typeof mapping.routeKey === "string" &&
          mapping.routeKey.trim().length > 0 &&
          typeof mapping.modelId === "string" &&
          mapping.modelId.trim().length > 0,
      );
    if (!mappingsValid) {
      throw new Error("AGENT_PROVIDER_MODEL_MAPPINGS_INVALID");
    }
    if (profile.platformId !== input.context.platformId) {
      throw new Error("AGENT_PROVIDER_PROFILE_PLATFORM_MISMATCH");
    }
    const adapter = this.registry.get(profile.platformId)?.provider;
    if (!adapter) throw new Error("AGENT_PROVIDER_ADAPTER_UNSUPPORTED");
    const baseline = await this.repository.getBaseline(profile.platformId);
    if (baseline && baseline.platformId !== profile.platformId) {
      throw new Error("AGENT_PROVIDER_BASELINE_INVALID");
    }
    return { adapter, baseline, modelMappings, profile };
  }

  private async resolveCurrentBoundary(
    input: AgentProviderImportInput,
  ): Promise<ActivationBoundary> {
    const { adapter, preview } = await this.readCurrentPreview(input);
    const profileId = `native:${input.context.platformId}`;
    const profile: AgentProviderProfile = {
      ...preview.profile,
      endpoint: preview.profile.endpoint ?? null,
      secretRef: null,
      id: profileId,
      archived: false,
      createdAt: 0,
      updatedAt: 0,
    };
    const modelMappings: AgentProviderModelMapping[] =
      preview.modelMappings.map((mapping) => ({
        ...mapping,
        id: `${profileId}:${mapping.routeKey}`,
        providerProfileId: profileId,
      }));
    return { adapter, baseline: null, modelMappings, profile };
  }

  private async readCurrentPreview(input: AgentProviderImportInput): Promise<{
    adapter: AgentProviderAdapter;
    preview: AgentProviderImportPreview;
  }> {
    validateContext(input.context);
    const adapter = this.registry.get(input.context.platformId)?.provider;
    if (!adapter) throw new Error("AGENT_PROVIDER_ADAPTER_UNSUPPORTED");
    let preview: AgentProviderImportPreview;
    try {
      preview = await adapter.importCurrent(input.context);
    } catch {
      throw new Error("AGENT_PROVIDER_IMPORT_FAILED");
    }
    validateImportPreview(preview, input.context, adapter);
    return { adapter, preview };
  }

  private async rollbackAfterFailure(
    boundary: ActivationBoundary,
    context: AgentProviderAdapterContext,
    plan: AgentProviderActivationPlan,
    receipt: AgentProviderApplyReceipt,
    verification: AgentProviderVerification | null,
    errorCode: string,
  ): Promise<AgentProviderActivationExecutionResult> {
    let rollback: AgentProviderRollbackResult;
    try {
      rollback = validateRollback(
        await boundary.adapter.rollback(context, receipt),
      );
    } catch {
      rollback = {
        restored: false,
        nativeDigest: null,
        errorCode: "provider-rollback-failed",
      };
    }
    const restored = rollback.restored && Boolean(rollback.nativeDigest);
    const result = restored ? "rolled-back" : "failed";
    try {
      await this.repository.recordSnapshot({
        platformId: plan.platformId,
        providerProfileId: plan.profileId,
        nativeDigest:
          rollback.nativeDigest ??
          verification?.nativeDigest ??
          receipt.nativeDigestAfter,
        redactedSnapshot: structuralSnapshot(plan),
        backupRef: receipt.backupRef,
        operation: "activate",
        result,
      });
    } catch {
      return {
        status: "failed",
        plan,
        verification,
        rollback,
        errorCode: "provider-audit-write-failed",
      };
    }
    return {
      status: result,
      plan,
      verification,
      rollback,
      errorCode: restored ? errorCode : "provider-rollback-failed",
    };
  }

  private async recordFailure(
    plan: AgentProviderActivationPlan,
    backupRef: string | null,
    errorCode: string,
  ): Promise<void> {
    try {
      await this.repository.recordSnapshot({
        platformId: plan.platformId,
        providerProfileId: plan.profileId,
        nativeDigest: plan.currentDigest,
        redactedSnapshot: {
          ...structuralSnapshot(plan),
          errorCode,
        },
        backupRef,
        operation: "activate",
        result: "failed",
      });
    } catch {
      // The caller already reports a generic apply failure; never replace it
      // with database or filesystem error text.
    }
  }
}
