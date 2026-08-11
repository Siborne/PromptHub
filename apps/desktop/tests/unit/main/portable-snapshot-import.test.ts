/**
 * @vitest-environment node
 */
import fs from "fs";
import os from "os";
import path from "path";

import { createPortableSnapshot } from "@prompthub/core";
import { afterEach, describe, expect, it } from "vitest";
import { zipSync } from "fflate";

import { extractPortableSnapshotZip } from "../../../src/main/services/portable-snapshot-import";

describe("portable snapshot import", () => {
  const roots: string[] = [];

  afterEach(() => {
    for (const root of roots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  function fixture(): {
    root: string;
    snapshot: string;
    archive: string;
    extracted: string;
  } {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "prompthub-portable-import-"),
    );
    roots.push(root);
    const source = path.join(root, "source", "data", "prompts");
    fs.mkdirSync(source, { recursive: true });
    fs.writeFileSync(path.join(source, "prompt.json"), "prompt");
    const snapshot = path.join(root, "snapshot");
    createPortableSnapshot({
      sourceRoot: path.join(root, "source"),
      destinationPath: snapshot,
      scopes: [
        {
          id: "prompts",
          sourcePath: source,
          archivePath: "data/prompts",
        },
      ],
      operationId: "portable-import-test",
    });
    const files: Record<string, Uint8Array> = {};
    const visit = (directoryPath: string, prefix = ""): void => {
      for (const entry of fs.readdirSync(directoryPath, {
        withFileTypes: true,
      })) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        const absolutePath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) visit(absolutePath, relativePath);
        else files[relativePath] = fs.readFileSync(absolutePath);
      }
    };
    visit(snapshot);
    const archive = path.join(root, "snapshot.zip");
    fs.writeFileSync(archive, zipSync(files));
    return {
      root,
      snapshot,
      archive,
      extracted: path.join(root, "extracted"),
    };
  }

  it("streams and verifies a declared portable snapshot", () => {
    const value = fixture();
    const extracted = extractPortableSnapshotZip({
      sourcePath: value.archive,
      destinationPath: value.extracted,
    });
    expect(extracted.manifest.scopes).toEqual(["prompts"]);
    expect(
      fs.readFileSync(
        path.join(value.extracted, "data", "prompts", "prompt.json"),
        "utf8",
      ),
    ).toBe("prompt");
  });

  it("rejects traversal and removes the extraction stage", () => {
    const value = fixture();
    fs.writeFileSync(
      value.archive,
      zipSync({ "../escape": Buffer.from("unsafe") }),
    );
    expect(() =>
      extractPortableSnapshotZip({
        sourcePath: value.archive,
        destinationPath: value.extracted,
      }),
    ).toThrow(/unsafe path/i);
    expect(fs.existsSync(value.extracted)).toBe(false);
    expect(fs.existsSync(path.join(value.root, "escape"))).toBe(false);
  });

  it("rejects undeclared tampering and extraction limits", () => {
    const value = fixture();
    const manifest = fs.readFileSync(
      path.join(value.snapshot, "portable-manifest.json"),
    );
    fs.writeFileSync(
      value.archive,
      zipSync({
        "data/prompts/prompt.json": Buffer.from("tampered"),
        "portable-manifest.json": manifest,
      }),
    );
    expect(() =>
      extractPortableSnapshotZip({
        sourcePath: value.archive,
        destinationPath: value.extracted,
      }),
    ).toThrow(/verification/i);
    expect(fs.existsSync(value.extracted)).toBe(false);

    fs.writeFileSync(
      value.archive,
      zipSync({ "oversized.bin": Buffer.from("123456789") }),
    );
    expect(() =>
      extractPortableSnapshotZip({
        sourcePath: value.archive,
        destinationPath: value.extracted,
        limits: { maxBytes: 8, maxFileBytes: 8 },
      }),
    ).toThrow(/invalid entry|limits/i);
    expect(fs.existsSync(value.extracted)).toBe(false);
  });
});
