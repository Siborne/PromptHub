import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validateChangeTraceability } from "./validate-change-traceability.mjs";

function fixture(files) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "prompthub-traceability-"),
  );
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return root;
}

test("accepts a complete requirement to task chain", () => {
  const root = fixture({
    "specs/domain/spec.md": "### `FR-DEMO-001`: behavior\n",
    "design.md": [
      "### `DES-DEMO-001`: design",
      "## Traceability",
      "| Requirement | Design | Verification | Task |",
      "| --- | --- | --- | --- |",
      "| `FR-DEMO-001` | `DES-DEMO-001` | `TEST-DEMO-001` | `T-DEMO-001` |",
    ].join("\n"),
    "tasks.md": "- [ ] `T-DEMO-001` implement (`TEST-DEMO-001`).\n",
  });
  try {
    assert.deepEqual(validateChangeTraceability(root).errors, []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects orphan requirements and references to missing identifiers", () => {
  const root = fixture({
    "specs/domain/spec.md": [
      "### `FR-DEMO-001`: mapped",
      "### `FR-DEMO-002`: orphan",
    ].join("\n"),
    "design.md": [
      "## Traceability",
      "| Requirement | Design | Verification | Task |",
      "| --- | --- | --- | --- |",
      "| `FR-DEMO-001` | `DES-DEMO-404` | `TEST-DEMO-001` | `T-DEMO-001` |",
    ].join("\n"),
    "tasks.md": "- [ ] `T-DEMO-001` implement (`TEST-DEMO-001`).\n",
  });
  try {
    const errors = validateChangeTraceability(root).errors.join("\n");
    assert.match(errors, /FR-DEMO-002.*traceability row/);
    assert.match(errors, /DES-DEMO-404.*does not exist/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects duplicate declarations and incomplete rows", () => {
  const root = fixture({
    "specs/a/spec.md": "### `FR-DEMO-001`: first\n",
    "specs/b/spec.md": "### `FR-DEMO-001`: duplicate\n",
    "design.md": [
      "## Traceability",
      "| Requirement | Design | Verification | Task |",
      "| --- | --- | --- | --- |",
      "| `FR-DEMO-001` | - | `TEST-DEMO-001` | - |",
    ].join("\n"),
    "tasks.md": "`TEST-DEMO-001`\n",
  });
  try {
    const errors = validateChangeTraceability(root).errors.join("\n");
    assert.match(errors, /Duplicate declaration FR-DEMO-001/);
    assert.match(errors, /missing a design/);
    assert.match(errors, /missing a task/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
