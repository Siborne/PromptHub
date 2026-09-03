import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const expectedVersion = "0.6.0-beta.2";

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"),
  );
}

test("keeps every shipped distribution on the release candidate version", () => {
  for (const relativePath of [
    "package.json",
    "apps/desktop/package.json",
    "apps/cli/package.json",
    "apps/web/package.json",
    "apps/web-cloudflare/package.json",
    "apps/mobile/package.json",
  ]) {
    assert.equal(readJson(relativePath).version, expectedVersion, relativePath);
  }
  assert.equal(readJson("apps/mobile/app.json").expo.version, expectedVersion);
});

test("keeps the standalone CLI runtime version aligned", () => {
  const source = fs.readFileSync(
    path.join(repositoryRoot, "packages/core/src/cli/types.ts"),
    "utf8",
  );
  assert.match(
    source,
    new RegExp(
      `export const CLI_VERSION = ["']${expectedVersion.replaceAll(".", String.raw`\.`)}["']`,
    ),
  );
});
