import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { detectCiSurfaces } from "./detect-ci-surfaces.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("maps direct app changes to their owning surface", () => {
  assert.deepEqual(detectCiSurfaces(["apps/cli/src/run.ts"]), {
    shared: false,
    desktop: false,
    cli: true,
    mobile: false,
  });
});

test("fans shared and core changes out to their consumers", () => {
  assert.deepEqual(detectCiSurfaces(["packages/shared/types/agent.ts"]), {
    shared: true,
    desktop: true,
    cli: true,
    mobile: true,
  });
  assert.deepEqual(detectCiSurfaces(["packages/core/src/database.ts"]), {
    shared: true,
    desktop: true,
    cli: true,
    mobile: false,
  });
});

test("fans root build changes out but leaves documentation to governance", () => {
  assert.deepEqual(detectCiSurfaces(["pnpm-lock.yaml"]), {
    shared: true,
    desktop: true,
    cli: true,
    mobile: true,
  });
  assert.deepEqual(detectCiSurfaces(["docs/README.md"]), {
    shared: false,
    desktop: false,
    cli: false,
    mobile: false,
  });
});

test("quality workflow preserves unconditional governance and surface gates", () => {
  const workflow = fs.readFileSync(
    path.join(rootDir, ".github/workflows/quality.yml"),
    "utf8",
  );

  assert.match(workflow, /scripts\/detect-ci-surfaces\.mjs/);
  assert.match(workflow, /governance:/);
  assert.match(workflow, /pnpm spec:test/);
  assert.match(workflow, /pnpm lint:file-size/);
  assert.match(workflow, /shared-verify:/);
  assert.match(workflow, /pnpm --filter @prompthub\/core test/);
  assert.match(workflow, /cli-verify:/);
  assert.match(workflow, /pnpm --filter @prompthub\/cli test/);
  assert.match(workflow, /mobile-verify:/);
  assert.match(workflow, /pnpm --filter @prompthub\/mobile test/);
  assert.match(workflow, /desktop-verify:/);
  assert.match(workflow, /pnpm test:unit/);
});

test("Cloudflare Worker workflow has an independent bounded gate", () => {
  const workflow = fs.readFileSync(
    path.join(rootDir, ".github/workflows/web-cloudflare.yml"),
    "utf8",
  );

  assert.match(workflow, /apps\/web-cloudflare\/\*\*/);
  assert.doesNotMatch(workflow, /docker/);
  assert.match(workflow, /@prompthub\/web-cloudflare lint/);
  assert.match(workflow, /@prompthub\/web-cloudflare typecheck/);
  assert.match(workflow, /@prompthub\/web-cloudflare test/);
});
