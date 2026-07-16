import { z } from "zod";
import type { SelfHostedBackupSnapshot } from "@prompthub/shared";
import { parseSyncSnapshot } from "./sync-snapshot.js";

const selfHostedBackupExtrasSchema = z.object({
  desktopSettings: z
    .object({
      state: z.record(z.unknown()),
    })
    .optional(),
  desktopAiConfig: z.record(z.unknown()).optional(),
});

const BACKUP_CREDENTIAL_KEY_PATTERN =
  /(?:password|secret|token|api[_-]?key|access[_-]?key(?:id)?)/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function findCredentialField(
  value: unknown,
  pathSegments: string[] = [],
): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const match = findCredentialField(value[index], [
        ...pathSegments,
        String(index),
      ]);
      if (match) return match;
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    const currentPath = [...pathSegments, key];
    if (BACKUP_CREDENTIAL_KEY_PATTERN.test(key)) {
      return currentPath.join(".");
    }
    const nestedMatch = findCredentialField(nestedValue, currentPath);
    if (nestedMatch) return nestedMatch;
  }

  return null;
}

export function parseSelfHostedBackupSnapshot(
  rawPayload: unknown,
): SelfHostedBackupSnapshot {
  if (!isRecord(rawPayload)) {
    throw new Error("Sync snapshot is invalid: expected an object");
  }

  const extras = selfHostedBackupExtrasSchema.safeParse(rawPayload);
  if (!extras.success) {
    throw new Error(
      `Sync snapshot is invalid: ${extras.error.issues
        .map(
          (issue) =>
            `${["payload", ...issue.path].join(".")}: ${issue.message}`,
        )
        .join(", ")}`,
    );
  }

  const credentialField = findCredentialField(extras.data);
  if (credentialField) {
    throw new Error(
      `Sync snapshot is invalid: desktop backup contains credential field ${credentialField}`,
    );
  }

  return {
    ...parseSyncSnapshot(rawPayload),
    ...extras.data,
  };
}
