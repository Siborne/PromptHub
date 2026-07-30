type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSnapshotSkillSafetyReport(
  report: unknown,
): unknown | undefined {
  if (!isRecord(report) || !Object.hasOwn(report, "scanMethod")) {
    return report;
  }

  if (report.scanMethod === "ai" || report.scanMethod === "preflight") {
    return report;
  }

  if (report.scanMethod === "static") {
    return { ...report, scanMethod: "preflight" };
  }

  return typeof report.scanMethod === "string" ? undefined : report;
}

export function normalizeSnapshotSkills<T>(skills: T[]): T[] {
  return skills.map((skill) => {
    if (!isRecord(skill) || !Object.hasOwn(skill, "safetyReport")) {
      return skill;
    }

    const originalReport = skill.safetyReport;
    const normalized = normalizeSnapshotSkillSafetyReport(originalReport);
    if (normalized === originalReport) {
      return skill;
    }

    if (normalized === undefined) {
      const { safetyReport: _safetyReport, ...withoutReport } = skill;
      return withoutReport as T;
    }

    return { ...skill, safetyReport: normalized } as T;
  });
}
