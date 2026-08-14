import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function readPackage(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), "utf8"));
}

test("pins the public-hoisted React type boundary for mixed React workspaces", () => {
  const rootPackage = readPackage("package.json");
  const desktopPackage = readPackage("apps/desktop/package.json");
  const webPackage = readPackage("apps/web/package.json");
  const mobilePackage = readPackage("apps/mobile/package.json");
  const workspace = fs.readFileSync(
    path.join(rootDir, "pnpm-workspace.yaml"),
    "utf8",
  );

  assert.match(workspace, /^shamefullyHoist:\s*true$/m);
  assert.equal(rootPackage.devDependencies["@types/react"], "18.3.27");
  assert.match(desktopPackage.devDependencies["@types/react"], /^\^18\./);
  assert.match(webPackage.devDependencies["@types/react"], /^\^18\./);
  assert.match(mobilePackage.devDependencies["@types/react"], /^~19\./);
});
