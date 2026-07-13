import * as fs from "fs/promises";
import * as path from "path";
import type {
  SafetyScanAIConfig,
  Skill,
  SkillSafetyReport,
} from "@prompthub/shared/types";
import { scanSkillSafety, scanSkillSafetyPreflight } from "./skill-safety-scan";

export interface RemoteSkillPackageSafetyScanOptions {
  aiConfig?: SafetyScanAIConfig;
  scan?: typeof scanSkillSafety;
  preflightScan?: typeof scanSkillSafetyPreflight;
}

export interface StagedRemoteSkillPackageSafetyInput {
  skill: Pick<Skill, "name">;
  skillDir: string;
  sourceUrl: string;
  safetyScan?: RemoteSkillPackageSafetyScanOptions;
  packageFingerprint: string;
  approvedPackageFingerprint?: string;
  sourceKey: string;
}

export class SkillSafetyReviewRequiredError extends Error {
  constructor(
    readonly report: SkillSafetyReport,
    readonly packageFingerprint: string,
    readonly sourceKey: string,
  ) {
    super("SAFETY_REVIEW_REQUIRED");
    this.name = "SkillSafetyReviewRequiredError";
  }
}

export class SkillSafetyBlockedError extends Error {
  constructor(readonly report: SkillSafetyReport) {
    super(
      `SAFETY_SCAN_BLOCKED_UPDATE: staged remote Skill package was flagged as ${report.level}: ${report.summary}`,
    );
    this.name = "SkillSafetyBlockedError";
  }
}

function assertSafetyReportAllowed(
  report: SkillSafetyReport,
  input: StagedRemoteSkillPackageSafetyInput,
): void {
  if (report.level === "blocked") {
    throw new SkillSafetyBlockedError(report);
  }
  if (
    report.level === "high-risk" &&
    input.approvedPackageFingerprint !== input.packageFingerprint
  ) {
    throw new SkillSafetyReviewRequiredError(
      report,
      input.packageFingerprint,
      input.sourceKey,
    );
  }
}

function combineSafetyReports(
  preflight: SkillSafetyReport,
  ai: SkillSafetyReport,
): SkillSafetyReport {
  const level = [preflight.level, ai.level].includes("high-risk")
    ? "high-risk"
    : [preflight.level, ai.level].includes("warn")
      ? "warn"
      : "safe";
  return {
    level,
    summary: [preflight.summary, ai.summary]
      .filter((summary, index, all) => all.indexOf(summary) === index)
      .join(" "),
    findings: [...preflight.findings, ...ai.findings],
    recommendedAction: level === "high-risk" ? "review" : ai.recommendedAction,
    scannedAt: Math.max(preflight.scannedAt, ai.scannedAt),
    checkedFileCount: Math.max(preflight.checkedFileCount, ai.checkedFileCount),
    scanMethod: "ai",
  };
}

/** Enforce mandatory local checks and fingerprint-pinned review before apply. */
export async function assertStagedRemoteSkillPackageSafe(
  input: StagedRemoteSkillPackageSafetyInput,
): Promise<SkillSafetyReport> {
  const content = await fs.readFile(
    path.join(input.skillDir, "SKILL.md"),
    "utf-8",
  );
  const preflight = await (
    input.safetyScan?.preflightScan ?? scanSkillSafetyPreflight
  )({
    name: input.skill.name,
    content,
    sourceUrl: input.sourceUrl,
    localRepoPath: input.skillDir,
  });
  const normalizedPreflight: SkillSafetyReport = {
    ...preflight,
    scanMethod: "preflight",
  };
  if (normalizedPreflight.level === "blocked") {
    assertSafetyReportAllowed(normalizedPreflight, input);
  }
  if (!input.safetyScan?.aiConfig) {
    assertSafetyReportAllowed(normalizedPreflight, input);
    return normalizedPreflight;
  }

  const aiReport = await (input.safetyScan.scan ?? scanSkillSafety)({
    name: input.skill.name,
    content,
    sourceUrl: input.sourceUrl,
    localRepoPath: input.skillDir,
    aiConfig: input.safetyScan.aiConfig,
  });
  if (aiReport.level === "blocked") {
    assertSafetyReportAllowed(aiReport, input);
  }
  const combinedReport = combineSafetyReports(normalizedPreflight, aiReport);
  assertSafetyReportAllowed(combinedReport, input);
  return combinedReport;
}
