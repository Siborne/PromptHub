import type {
  GenerationBatchCounts,
  GenerationBatchStatus,
  GenerationErrorSummary,
  GenerationModelSnapshot,
  GenerationSlotStatus,
  NormalizedGenerationRequest,
} from "@prompthub/shared/types";

const MAX_TARGET_COUNT = 100;
const MAX_ERROR_LENGTH = 1_000;

interface GenerationRequestInput {
  targetCount: number;
  prompt: string;
  model: GenerationModelSnapshot;
  size?: string;
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
  aspectRatio?: string;
}

interface ProviderErrorInput {
  status?: number;
  message?: string;
}

function requireTrimmed(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function assertTargetCount(targetCount: number): void {
  if (
    !Number.isInteger(targetCount) ||
    targetCount < 1 ||
    targetCount > MAX_TARGET_COUNT
  ) {
    throw new Error("Target count must be an integer between 1 and 100");
  }
}

export function normalizeGenerationRequest(
  input: GenerationRequestInput,
): NormalizedGenerationRequest {
  assertTargetCount(input.targetCount);
  return {
    targetCount: input.targetCount,
    prompt: requireTrimmed(input.prompt, "Prompt"),
    model: {
      id: requireTrimmed(input.model.id, "Model id"),
      provider: requireTrimmed(input.model.provider, "Provider"),
      model: requireTrimmed(input.model.model, "Model"),
      ...(input.model.name?.trim() ? { name: input.model.name.trim() } : {}),
    },
    ...(input.size ? { size: input.size } : {}),
    ...(input.quality ? { quality: input.quality } : {}),
    ...(input.style ? { style: input.style } : {}),
    ...(input.aspectRatio ? { aspectRatio: input.aspectRatio } : {}),
  };
}

export function resolveGenerationPrompt(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(
    /\{\{\s*([^{}:\s]+)\s*(?::\s*([^{}]*))?\s*\}\}/gu,
    (placeholder, name: string, defaultValue: string | undefined) => {
      if (
        Object.prototype.hasOwnProperty.call(values, name) &&
        (values[name] !== "" || defaultValue === undefined)
      ) {
        return values[name];
      }
      return defaultValue ?? placeholder;
    },
  );
}

export function planGenerationAttempts(
  targetCount: number,
  maxImagesPerRequest: number,
): number[][] {
  assertTargetCount(targetCount);
  if (
    !Number.isInteger(maxImagesPerRequest) ||
    maxImagesPerRequest < 1 ||
    maxImagesPerRequest > MAX_TARGET_COUNT
  ) {
    throw new Error(
      "Provider request limit must be an integer between 1 and 100",
    );
  }
  const groups: number[][] = [];
  for (let start = 0; start < targetCount; start += maxImagesPerRequest) {
    groups.push(
      Array.from(
        { length: Math.min(maxImagesPerRequest, targetCount - start) },
        (_, offset) => start + offset,
      ),
    );
  }
  return groups;
}

export function reduceGenerationCounts(
  statuses: readonly GenerationSlotStatus[],
): GenerationBatchCounts {
  const counts: GenerationBatchCounts = {
    total: statuses.length,
    pending: 0,
    running: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    interrupted: 0,
  };
  for (const status of statuses) counts[status] += 1;
  return counts;
}

export function deriveGenerationBatchStatus(
  statuses: readonly GenerationSlotStatus[],
): GenerationBatchStatus {
  const counts = reduceGenerationCounts(statuses);
  if (counts.running > 0) return "running";
  if (counts.pending > 0) return "queued";
  if (counts.succeeded === counts.total) return "succeeded";
  if (counts.succeeded > 0) return "partially_succeeded";
  if (counts.failed > 0) return "failed";
  if (counts.interrupted > 0) return "interrupted";
  return "cancelled";
}

function normalizeErrorMessage(message: string | undefined): string {
  return (message?.trim() || "Image generation failed").slice(
    0,
    MAX_ERROR_LENGTH,
  );
}

export function classifyGenerationError(
  error: unknown,
): GenerationErrorSummary {
  const input =
    error instanceof Error
      ? { message: error.message }
      : typeof error === "object" && error !== null
        ? (error as ProviderErrorInput)
        : { message: String(error) };
  const status = typeof input.status === "number" ? input.status : undefined;
  const message = normalizeErrorMessage(input.message);

  if (status === 401 || status === 403) {
    return {
      code: "authentication_failed",
      retryable: false,
      httpStatus: status,
      message: "Provider authentication failed",
    };
  }
  if (status === 429) {
    return {
      code: "rate_limited",
      retryable: true,
      httpStatus: status,
      message,
    };
  }
  if (
    status === 408 ||
    status === 425 ||
    (status !== undefined && status >= 500)
  ) {
    return {
      code: "provider_unavailable",
      retryable: true,
      httpStatus: status,
      message,
    };
  }
  if (/timed?\s*out/i.test(message)) {
    return { code: "provider_timeout", retryable: true, message };
  }
  return {
    code: status === 400 ? "invalid_request" : "provider_failed",
    retryable: false,
    ...(status !== undefined ? { httpStatus: status } : {}),
    message,
  };
}
