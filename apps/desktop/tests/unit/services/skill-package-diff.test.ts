import { describe, expect, it } from "vitest";
import type { SkillPackageSnapshot } from "@prompthub/shared/types";
import { buildSkillPackageDiff } from "../../../src/renderer/services/skill-package-diff";

function snapshot(
  files: Array<Record<string, unknown>>,
  scope: "package" | "skill-md" = "package",
): SkillPackageSnapshot {
  return {
    content: "# Skill\n",
    directoryFingerprint: `${scope}-fingerprint`,
    scope,
    files,
  } as unknown as SkillPackageSnapshot;
}

describe("Skill package diff", () => {
  it("reports every added, modified, removed, and binary package file", () => {
    const result = buildSkillPackageDiff(
      snapshot([
        {
          path: "SKILL.md",
          kind: "text",
          sizeBytes: 8,
          contentHash: "skill-same",
          content: "# Skill\n",
        },
        {
          path: "references/guide.md",
          kind: "text",
          sizeBytes: 4,
          contentHash: "guide-old",
          content: "old\n",
        },
        {
          path: "templates/removed.txt",
          kind: "text",
          sizeBytes: 8,
          contentHash: "removed",
          content: "removed\n",
        },
        {
          path: "assets/icon.png",
          kind: "binary",
          sizeBytes: 2,
          contentHash: "binary-old",
        },
      ]),
      snapshot([
        {
          path: "SKILL.md",
          kind: "text",
          sizeBytes: 8,
          contentHash: "skill-same",
          content: "# Skill\n",
        },
        {
          path: "references/guide.md",
          kind: "text",
          sizeBytes: 4,
          contentHash: "guide-new",
          content: "new\n",
        },
        {
          path: "scripts/new.sh",
          kind: "text",
          sizeBytes: 8,
          contentHash: "added",
          content: "echo hi\n",
        },
        {
          path: "assets/icon.png",
          kind: "binary",
          sizeBytes: 3,
          contentHash: "binary-new",
        },
      ]),
    );

    expect(
      result.map(({ path, status, previewKind }) => ({
        path,
        status,
        previewKind,
      })),
    ).toEqual([
      { path: "assets/icon.png", status: "modified", previewKind: "binary" },
      {
        path: "references/guide.md",
        status: "modified",
        previewKind: "text",
      },
      { path: "scripts/new.sh", status: "added", previewKind: "text" },
      {
        path: "templates/removed.txt",
        status: "removed",
        previewKind: "text",
      },
    ]);
  });

  it("does not present unrelated local files as removed for SKILL.md-only sources", () => {
    const result = buildSkillPackageDiff(
      snapshot([
        {
          path: "SKILL.md",
          kind: "text",
          sizeBytes: 4,
          contentHash: "old",
          content: "old\n",
        },
        {
          path: "references/local.md",
          kind: "text",
          sizeBytes: 6,
          contentHash: "local",
          content: "local\n",
        },
      ]),
      snapshot(
        [
          {
            path: "SKILL.md",
            kind: "text",
            sizeBytes: 4,
            contentHash: "new",
            content: "new\n",
          },
        ],
        "skill-md",
      ),
    );

    expect(result.map((file) => file.path)).toEqual(["SKILL.md"]);
  });

  it("marks unavailable text payloads without losing the changed file", () => {
    const result = buildSkillPackageDiff(
      snapshot([
        {
          path: "large.txt",
          kind: "text",
          sizeBytes: 3_000_000,
          contentHash: "old",
          contentTruncated: true,
        },
      ]),
      snapshot([
        {
          path: "large.txt",
          kind: "text",
          sizeBytes: 4_000_000,
          contentHash: "new",
          contentTruncated: true,
        },
      ]),
    );

    expect(result[0]).toMatchObject({
      path: "large.txt",
      status: "modified",
      previewKind: "truncated",
    });
  });
});
