import assert from "node:assert/strict";
import test from "node:test";

import { findLatestStableRelease } from "./release-metadata.mjs";

test("keeps a prepared stable version behind the explicitly published stable release", () => {
  const changelog = `## [Unreleased]

## [0.6.0] - 2026-07-30

## [0.5.9] - 2026-07-14
`;
  const releaseIndex = `| Version | Status | Path | Updated |
| --- | --- | --- | --- |
| \`0.6.0\` | preparation | \`spec/releases/0.6.0.md\` | 2026-07-30 |
| \`0.5.9\` | stable record | \`spec/releases/0.5.9.md\` | 2026-07-14 |
`;

  assert.deepEqual(findLatestStableRelease(changelog, releaseIndex), {
    version: "0.5.9",
    date: "2026-07-14",
  });
});

test("selects the highest explicitly published stable semver", () => {
  const changelog = `## [0.6.1] - 2026-07-18

## [0.6.3] - 2026-07-20

## [0.7.0] - 2026-07-22

## [1.0.0] - 2026-07-24

## [0.6.0] - 2026-07-30

## [1.0.0] - 2026-07-25
`;
  const releaseIndex = `| \`0.6.1\` | stable record | path | date |
| \`0.6.3\` | stable record | path | date |
| \`0.7.0\` | stable record | path | date |
| \`1.0.0\` | stable record | path | date |
| \`0.6.0\` | stable record | path | date |
| \`1.0.0\` | stable record | duplicate path | duplicate date |
`;

  assert.deepEqual(findLatestStableRelease(changelog, releaseIndex), {
    version: "1.0.0",
    date: "2026-07-24",
  });
});

test("rejects release indexes without an explicitly published stable release", () => {
  const releaseIndex = `| \`0.6.0\` | preparation | path | date |`;

  assert.throws(
    () => findLatestStableRelease("## [0.6.0] - 2026-07-30", releaseIndex),
    /No published stable release found/,
  );
});

test("rejects published stable releases without a dated changelog entry", () => {
  const changelog = `## [Unreleased]

## [0.6.0-beta.1] - 2026-07-30
`;
  const releaseIndex = `| \`0.5.9\` | stable record | path | date |`;

  assert.throws(
    () => findLatestStableRelease(changelog, releaseIndex),
    /No dated changelog entry found for published stable 0\.5\.9/,
  );
});
