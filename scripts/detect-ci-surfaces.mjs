#!/usr/bin/env node

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { selectAffectedSurfaces } from "./verification/surface-graph.mjs";

const ALL_SURFACES = ["shared", "desktop", "cli", "mobile"];

export function detectCiSurfaces(files) {
  const result = Object.fromEntries(
    ALL_SURFACES.map((surface) => [surface, false]),
  );
  const changedPaths = files.map((file) => file.trim()).filter(Boolean);
  if (changedPaths.length === 0) {
    return result;
  }

  const selection = selectAffectedSurfaces(changedPaths);
  const selected = selection.surfaces;
  result.shared =
    selected.has("shared") || selected.has("database") || selected.has("core");
  result.desktop = selected.has("desktop");
  result.cli = selected.has("cli");
  result.mobile = selected.has("mobile");
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
