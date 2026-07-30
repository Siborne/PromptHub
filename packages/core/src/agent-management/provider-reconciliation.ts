import { isDeepStrictEqual } from "node:util";
import type {
  AgentProviderActivationPlan,
  AgentProviderComparableValue,
  AgentProviderFieldDecision,
  AgentProviderFieldDecisionStatus,
  AgentProviderReconciliationInput,
} from "@prompthub/shared";

export type {
  AgentProviderActivationPlan,
  AgentProviderComparableState,
  AgentProviderReconciliationInput,
} from "@prompthub/shared";

const STATUS_PRIORITY: AgentProviderFieldDecisionStatus[] = [
  "blocked",
  "conflict",
  "unsupported",
  "external-modified",
  "backfill",
  "apply",
  "preserve",
];

function hasOwn(
  values: Record<string, AgentProviderComparableValue>,
  field: string,
): boolean {
  return Object.prototype.hasOwnProperty.call(values, field);
}

function decisionForField(
  field: string,
  input: AgentProviderReconciliationInput,
  supportedKeys: Set<string>,
): AgentProviderFieldDecision {
  const baselineValues = input.baseline?.values;
  const hasBaseline = Boolean(baselineValues && hasOwn(baselineValues, field));
  const hasCurrent = hasOwn(input.current.values, field);
  const hasDesired = hasOwn(input.desired.values, field);
  const baseline = hasBaseline ? baselineValues?.[field] : undefined;
  const current = hasCurrent ? input.current.values[field] : undefined;
  const desired = hasDesired ? input.desired.values[field] : undefined;
  const result = (status: AgentProviderFieldDecisionStatus) => ({
    field,
    status,
    ...(hasBaseline ? { baseline } : {}),
    ...(hasCurrent ? { current } : {}),
    ...(hasDesired ? { desired } : {}),
  });

  if (!hasDesired) return result("preserve");
  if (!supportedKeys.has(field)) return result("unsupported");
  if (hasCurrent && isDeepStrictEqual(current, desired)) {
    return result("preserve");
  }
  if (!hasBaseline) {
    return result(hasCurrent ? "backfill" : "apply");
  }

  const currentMatchesBaseline =
    hasCurrent && isDeepStrictEqual(current, baseline);
  const desiredMatchesBaseline = isDeepStrictEqual(desired, baseline);
  if (currentMatchesBaseline) return result("apply");
  if (desiredMatchesBaseline) return result("external-modified");
  return result("conflict");
}

function overallStatus(
  decisions: AgentProviderFieldDecision[],
): AgentProviderFieldDecisionStatus {
  return (
    STATUS_PRIORITY.find((status) =>
      decisions.some((decision) => decision.status === status),
    ) ?? "preserve"
  );
}

export function reconcileAgentProviderState(
  input: AgentProviderReconciliationInput,
): AgentProviderActivationPlan {
  if (
    input.current.platformId !== input.desired.platformId ||
    (input.baseline && input.baseline.platformId !== input.current.platformId)
  ) {
    throw new Error("Provider state platform ids must match");
  }

  const blockedReasons = [...new Set(input.blockedReasons ?? [])];
  if (blockedReasons.length > 0) {
    return {
      platformId: input.current.platformId,
      profileId: input.profileId,
      adapterVersion: input.current.adapterVersion,
      currentDigest: input.current.nativeDigest,
      status: "blocked",
      decisions: [],
      canApply: false,
      requiresReview: true,
      blockedReasons,
    };
  }

  const fields = new Set([
    ...Object.keys(input.baseline?.values ?? {}),
    ...Object.keys(input.current.values),
    ...Object.keys(input.desired.values),
  ]);
  const supportedKeys = new Set(input.supportedKeys);
  const decisions = [...fields]
    .sort()
    .map((field) => decisionForField(field, input, supportedKeys));
  const status = overallStatus(decisions);
  const canApply = decisions.every(
    (decision) => decision.status === "apply" || decision.status === "preserve",
  );

  return {
    platformId: input.current.platformId,
    profileId: input.profileId,
    adapterVersion: input.current.adapterVersion,
    currentDigest: input.current.nativeDigest,
    status,
    decisions,
    canApply,
    requiresReview: !canApply,
    blockedReasons,
  };
}
