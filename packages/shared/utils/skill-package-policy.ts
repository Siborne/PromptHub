import ignore from "ignore";

import { shouldIgnoreSkillDirectoryEntry } from "./skill-identity";

export type SkillPackageIgnoreMatcher = (relativePath: string) => boolean;

export type SkillPackageSecretCode =
  | "private-key"
  | "provider-token"
  | "credential-assignment";

export interface SkillPackageSecretFinding {
  code: SkillPackageSecretCode;
  path: string;
  line: number;
  label: string;
}

export interface SkillPackageTextEntry {
  path: string;
  content: string;
}

export const MAX_SKILL_PACKAGE_SECRET_FINDINGS = 100;

function normalizePackagePath(relativePath: string): string {
  return relativePath
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

export function createSkillPackageIgnoreMatcher(
  customRules = "",
): SkillPackageIgnoreMatcher {
  const custom = ignore().add(customRules);
  return (relativePath: string) => {
    const normalized = normalizePackagePath(relativePath);
    if (!normalized || normalized === "SKILL.md") {
      return false;
    }
    if (
      normalized.startsWith("../") ||
      normalized.includes("/../") ||
      shouldIgnoreSkillDirectoryEntry(normalized)
    ) {
      return true;
    }
    return custom.ignores(normalized) || custom.ignores(`${normalized}/`);
  };
}

const PRIVATE_KEY_PATTERN =
  /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/i;
const PROVIDER_TOKEN_PATTERN =
  /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9_-]{20,}|xox[baprs]-[A-Za-z0-9-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{35}|(?:sk|hf|npm)_[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9_-]{24,})\b/;
const CREDENTIAL_ASSIGNMENT_PATTERN =
  /\b(?:node[_-]?password|password|passwd|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\b\s*[:=]\s*["']?([^\s"'#;,]{8,})/i;

function isPlaceholderCredential(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.startsWith("${") ||
    normalized.startsWith("{{") ||
    normalized.startsWith("<") ||
    normalized.startsWith("$") ||
    /(?:example|sample|placeholder|change-?me|replace-?me|your[-_]|dummy|redacted|x{3,})/.test(
      normalized,
    )
  );
}

export function scanSkillPackageSecrets(
  entries: SkillPackageTextEntry[],
): SkillPackageSecretFinding[] {
  const findings: SkillPackageSecretFinding[] = [];
  for (const entry of entries) {
    const normalizedPath = normalizePackagePath(entry.path);
    for (const [index, line] of entry.content.split(/\r?\n/).entries()) {
      if (PRIVATE_KEY_PATTERN.test(line)) {
        findings.push({
          code: "private-key",
          path: normalizedPath,
          line: index + 1,
          label: "Private key material",
        });
        if (findings.length > MAX_SKILL_PACKAGE_SECRET_FINDINGS) {
          return findings;
        }
        continue;
      }
      if (PROVIDER_TOKEN_PATTERN.test(line)) {
        findings.push({
          code: "provider-token",
          path: normalizedPath,
          line: index + 1,
          label: "Provider access token",
        });
        if (findings.length > MAX_SKILL_PACKAGE_SECRET_FINDINGS) {
          return findings;
        }
        continue;
      }
      const assignment = line.match(CREDENTIAL_ASSIGNMENT_PATTERN);
      if (assignment?.[1] && !isPlaceholderCredential(assignment[1])) {
        findings.push({
          code: "credential-assignment",
          path: normalizedPath,
          line: index + 1,
          label: "Credential assignment",
        });
        if (findings.length > MAX_SKILL_PACKAGE_SECRET_FINDINGS) {
          return findings;
        }
      }
    }
  }
  return findings;
}
