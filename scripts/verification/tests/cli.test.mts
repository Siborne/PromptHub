import assert from "node:assert/strict";
import test from "node:test";

import { parseArguments } from "../cli.mts";

test("CLI preserves release defaults and legacy quick spelling", () => {
  assert.deepEqual(parseArguments([]), {
    profile: "release",
    surfaces: [],
    excludeLayers: [],
    concurrency: 2,
    format: "human",
    list: false,
    quiet: false,
    verbose: false,
  });
  assert.equal(parseArguments(["--quick"]).profile, "quick");
  assert.equal(parseArguments(["--profile=changed"]).profile, "changed");
});

test("CLI parses bounded selection and report options without shell input", () => {
  assert.deepEqual(
    parseArguments([
      "--profile",
      "quick",
      "--surface",
      "desktop",
      "--exclude-layer=e2e",
      "--concurrency",
      "3",
      "--format",
      "json",
      "--report",
      "tmp/report.json",
      "--list",
      "--quiet",
    ]),
    {
      profile: "quick",
      surfaces: ["desktop"],
      excludeLayers: ["e2e"],
      concurrency: 3,
      format: "json",
      reportPath: "tmp/report.json",
      list: true,
      quiet: true,
      verbose: false,
    },
  );
});

test("CLI rejects unknown values and unbounded concurrency", () => {
  assert.throws(() => parseArguments(["--profile", "fast"]), /profile/i);
  assert.throws(() => parseArguments(["--surface", "future"]), /surface/i);
  assert.throws(() => parseArguments(["--concurrency", "0"]), /concurrency/i);
  assert.throws(() => parseArguments(["--wat"]), /argument/i);
});
