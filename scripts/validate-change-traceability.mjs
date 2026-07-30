#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID_PATTERN = /\b(?:N?FR|DES|TEST|T)-[A-Z0-9]+-\d+\b/g;
const DECLARATION_PATTERN = /^#{2,6}\s+`((?:N?FR|DES|TEST|T)-[A-Z0-9]+-\d+)`/gm;
const ENFORCEMENT_MARKER = "<!-- traceability: enforced -->";

function markdownFiles(root) {
  const files = [];
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target);
      else if (entry.isFile() && entry.name.endsWith(".md")) files.push(target);
    }
  }
  return files.sort();
}

function identifiers(text) {
  return [...new Set(text.match(ID_PATTERN) ?? [])];
}

function declaredRequirements(files) {
  const locations = new Map();
  for (const file of files.filter((item) =>
    item.includes(`${path.sep}specs${path.sep}`),
  )) {
    const content = fs.readFileSync(file, "utf8");
    for (const match of content.matchAll(DECLARATION_PATTERN)) {
      const id = match[1];
      if (!id?.startsWith("FR-") && !id?.startsWith("NFR-")) continue;
      const existing = locations.get(id) ?? [];
      existing.push(file);
      locations.set(id, existing);
    }
  }
  return locations;
}

function traceabilityRows(files) {
  const rows = [];
  for (const file of files) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (!line.startsWith("|") || !/\bN?FR-[A-Z0-9]+-\d+\b/.test(line)) {
        continue;
      }
      const cells = line.split("|").slice(1, -1);
      if (cells.length < 4) continue;
      rows.push({
        requirement: identifiers(cells[0] ?? ""),
        design: identifiers(cells[1] ?? "").filter((id) =>
          id.startsWith("DES-"),
        ),
        verification: identifiers(cells[2] ?? "").filter((id) =>
          id.startsWith("TEST-"),
        ),
        task: identifiers(cells[3] ?? "").filter((id) => id.startsWith("T-")),
      });
    }
  }
  return rows;
}

function nonMatrixIdentifiers(files) {
  const ids = new Set();
  for (const file of files) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      if (line.startsWith("|") && /\bN?FR-[A-Z0-9]+-\d+\b/.test(line)) {
        continue;
      }
      for (const id of identifiers(line)) ids.add(id);
    }
  }
  return ids;
}

function validateRows(rows, allIds, errors) {
  for (const row of rows) {
    const requirement = row.requirement[0] ?? "unknown requirement";
    if (row.design.length === 0)
      errors.push(`${requirement} is missing a design`);
    if (row.verification.length === 0) {
      errors.push(`${requirement} is missing a verification`);
    }
    if (row.task.length === 0) errors.push(`${requirement} is missing a task`);
    for (const id of [...row.design, ...row.verification, ...row.task]) {
      if (!allIds.has(id)) errors.push(`${id} does not exist in the change`);
    }
  }
}

export function validateChangeTraceability(changeRoot) {
  const files = markdownFiles(changeRoot);
  const allIds = nonMatrixIdentifiers(files);
  const declarations = declaredRequirements(files);
  const rows = traceabilityRows(files);
  const mapped = new Set(rows.flatMap((row) => row.requirement));
  const errors = [];

  for (const [id, locations] of declarations) {
    if (locations.length > 1) errors.push(`Duplicate declaration ${id}`);
    if (!mapped.has(id)) errors.push(`${id} has no traceability row`);
  }
  validateRows(rows, allIds, errors);
  return { errors, hasTraceability: rows.length > 0 };
}

function activeChangeDirectories(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("_"))
    .map((entry) => path.join(root, entry.name))
    .sort();
}

function isEnforcedChange(root) {
  return markdownFiles(root).some((file) =>
    fs.readFileSync(file, "utf8").includes(ENFORCEMENT_MARKER),
  );
}

function main(args) {
  const explicit = args.filter((arg) => !arg.startsWith("--"));
  const roots =
    explicit.length > 0
      ? explicit.map((item) => path.resolve(item))
      : activeChangeDirectories(path.resolve("spec/changes/active")).filter(
          isEnforcedChange,
        );
  const failures = [];

  for (const root of roots) {
    const result = validateChangeTraceability(root);
    for (const error of result.errors) {
      failures.push(`${path.basename(root)}: ${error}`);
    }
  }
  if (failures.length > 0) {
    console.error(
      `Traceability validation failed:\n- ${failures.join("\n- ")}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Traceability validation passed for ${roots.length} change(s).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2));
}
