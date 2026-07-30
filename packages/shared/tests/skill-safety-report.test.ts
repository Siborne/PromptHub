import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeSnapshotSkillSafetyReport,
  normalizeSnapshotSkills,
} from "@prompthub/shared/utils/skill-safety-report";

const baseReport = {
  level: "safe",
  summary: "Checked",
  findings: [],
  recommendedAction: "allow",
  scannedAt: 1,
  checkedFileCount: 1,
};

test("normalizes current, legacy, missing, and unknown safety reports", () => {
  const current = { ...baseReport, scanMethod: "preflight" };
  assert.equal(normalizeSnapshotSkillSafetyReport(current), current);
  assert.deepEqual(
    normalizeSnapshotSkillSafetyReport({
      ...baseReport,
      scanMethod: "static",
    }),
    { ...baseReport, scanMethod: "preflight" },
  );
  assert.equal(normalizeSnapshotSkillSafetyReport(undefined), undefined);
  assert.equal(
    normalizeSnapshotSkillSafetyReport({
      ...baseReport,
      scanMethod: "future",
    }),
    undefined,
  );
  assert.deepEqual(normalizeSnapshotSkillSafetyReport({ ...baseReport }), {
    ...baseReport,
  });
  assert.deepEqual(
    normalizeSnapshotSkillSafetyReport({
      ...baseReport,
      scanMethod: 1,
    }),
    { ...baseReport, scanMethod: 1 },
  );
  assert.equal(normalizeSnapshotSkillSafetyReport(null), null);
  assert.deepEqual(normalizeSnapshotSkillSafetyReport([]), []);
});

test("shallow-copies only skills whose report changes", () => {
  const unchanged = {
    id: "current",
    safetyReport: { ...baseReport, scanMethod: "ai" },
  };
  const legacy = {
    id: "legacy",
    safetyReport: { ...baseReport, scanMethod: "static" },
  };
  const unknown = {
    id: "unknown",
    safetyReport: { ...baseReport, scanMethod: "future" },
  };

  const noReport = { id: "no-report" };
  const normalized = normalizeSnapshotSkills([
    unchanged,
    legacy,
    unknown,
    noReport,
    null,
  ]);

  assert.equal(normalized[0], unchanged);
  assert.notEqual(normalized[1], legacy);
  assert.equal(
    (
      normalized[1] as unknown as {
        safetyReport: { scanMethod: string };
      }
    ).safetyReport.scanMethod,
    "preflight",
  );
  assert.notEqual(normalized[2], unknown);
  assert.equal("safetyReport" in normalized[2]!, false);
  assert.equal(normalized[3], noReport);
  assert.equal(normalized[4], null);
});

test("normalizes a large inventory with one safety report read per skill", () => {
  let safetyReportReads = 0;
  const skills = Array.from({ length: 10_000 }, (_, index) => {
    const skill = { id: `skill-${index}` } as {
      id: string;
      safetyReport?: typeof baseReport & { scanMethod: string };
    };
    Object.defineProperty(skill, "safetyReport", {
      enumerable: true,
      get() {
        safetyReportReads += 1;
        return { ...baseReport, scanMethod: "preflight" };
      },
    });
    return skill;
  });

  const normalized = normalizeSnapshotSkills(skills);

  assert.equal(normalized.length, skills.length);
  assert.equal(safetyReportReads, skills.length);
});
