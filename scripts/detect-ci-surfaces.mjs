#!/usr/bin/env node

import fs from "node:fs";
import { fileURLToPath } from "node:url";

const ALL_SURFACES = ["shared", "desktop", "cli", "mobile"];
const ROOT_FAN_OUT_PATHS = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  ".github/workflows/quality.yml",
  ".github/actions/setup-workspace/action.yml",
  "scripts/detect-ci-surfaces.mjs",
  "scripts/detect-ci-surfaces.test.mjs",
]);

function enable(result, ...surfaces) {
  for (const surface of surfaces) {
    result[surface] = true;
  }
}

export function detectCiSurfaces(files) {
  const result = Object.fromEntries(
    ALL_SURFACES.map((surface) => [surface, false]),
  );

  for (const rawPath of files) {
    const changedPath = rawPath.trim();
    if (!changedPath) {
      continue;
    }

    if (ROOT_FAN_OUT_PATHS.has(changedPath)) {
      enable(result, ...ALL_SURFACES);
    } else if (changedPath.startsWith("packages/shared/")) {
      enable(result, ...ALL_SURFACES);
    } else if (
      changedPath.startsWith("packages/core/") ||
      changedPath.startsWith("packages/db/")
    ) {
      enable(result, "shared", "desktop", "cli");
    } else if (changedPath.startsWith("apps/desktop/")) {
      enable(result, "desktop");
    } else if (changedPath.startsWith("apps/cli/")) {
      enable(result, "cli");
    } else if (changedPath.startsWith("apps/mobile/")) {
      enable(result, "mobile");
    }
  }

  return result;
}

function printOutputs(result) {
  for (const surface of ALL_SURFACES) {
    process.stdout.write(`${surface}=${String(result[surface])}\n`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = process.argv.includes("--all")
    ? Object.fromEntries(ALL_SURFACES.map((surface) => [surface, true]))
    : detectCiSurfaces(fs.readFileSync(0, "utf8").split(/\r?\n/));
  printOutputs(result);
}
