import {
  MAX_SKILL_PACKAGE_SECRET_FINDINGS,
  scanSkillPackageSecrets,
  type SkillPackageSecretFinding,
  type SkillPackageTextEntry,
} from "@prompthub/shared/utils/skill-package-policy";

export const SKILL_SECRET_SCAN_MAX_FILE_BYTES = 2 * 1_048_576;
export const SKILL_SECRET_SCAN_MAX_TOTAL_BYTES = 16 * 1_048_576;
export const SKILL_PACKAGE_MAX_ENTRIES = 500;

export class SkillPackageSecretsError extends Error {
  readonly findings: SkillPackageSecretFinding[];
  readonly findingsTruncated: boolean;

  constructor(findings: SkillPackageSecretFinding[]) {
    super("Skill package contains high-confidence secret material");
    this.name = "SkillPackageSecretsError";
    this.findingsTruncated =
      findings.length > MAX_SKILL_PACKAGE_SECRET_FINDINGS;
    this.findings = findings.slice(0, MAX_SKILL_PACKAGE_SECRET_FINDINGS);
  }
}

export class SkillPackageScanLimitError extends Error {
  readonly path: string;
  readonly observedBytes: number;
  readonly limitBytes: number;
  readonly limitKind: "file" | "package";

  constructor(options: {
    path: string;
    observedBytes: number;
    limitBytes: number;
    limitKind: "file" | "package";
  }) {
    super(
      `Skill package secret scan exceeded the ${options.limitKind} size limit`,
    );
    this.name = "SkillPackageScanLimitError";
    this.path = options.path;
    this.observedBytes = options.observedBytes;
    this.limitBytes = options.limitBytes;
    this.limitKind = options.limitKind;
  }
}

export class SkillPackageEntryLimitError extends Error {
  readonly path: string;
  readonly observedEntries: number;
  readonly limitEntries: number;

  constructor(options: {
    path: string;
    observedEntries: number;
    limitEntries: number;
  }) {
    super("Skill package exceeds the safe entry limit");
    this.name = "SkillPackageEntryLimitError";
    this.path = options.path;
    this.observedEntries = options.observedEntries;
    this.limitEntries = options.limitEntries;
  }
}

export function assertSkillPackageEntriesSafe(
  entries: SkillPackageTextEntry[],
): void {
  const findings = scanSkillPackageSecrets(entries);
  if (findings.length > 0) {
    throw new SkillPackageSecretsError(findings);
  }
}
