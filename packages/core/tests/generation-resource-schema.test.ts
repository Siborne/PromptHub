import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { GenerationBatchManifest } from "@prompthub/shared/types";
import { afterEach, describe, expect, it } from "vitest";

import {
  materializeGenerationResourceBundle,
  readGenerationResourceBundle,
} from "../src/generation-resource-schema";

const roots: string[] = [];

function createRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "prompthub-generation-"));
  roots.push(root);
  return root;
}

function manifest(bytes: Buffer): GenerationBatchManifest {
  const hash = crypto.createHash("sha256").update(bytes).digest("hex");
  return {
    kind: "prompthub-generation-batch",
    version: 1,
    id: "batch-1",
    title: "Release image",
    status: "succeeded",
    resolvedPrompt: "A precise product image",
    model: { id: "model-1", provider: "openai", model: "gpt-image-2" },
    parameters: { quality: "hd" },
    targetCount: 1,
    slots: [
      {
        index: 0,
        status: "succeeded",
        output: {
          id: "output-1",
          slotIndex: 0,
          fileName: "output-1.png",
          mimeType: "image/png",
          byteSize: bytes.length,
          sha256: hash,
          createdAt: "2026-08-11T00:00:00.000Z",
          favorite: true,
        },
      },
    ],
    counts: {
      total: 1,
      pending: 0,
      running: 0,
      succeeded: 1,
      failed: 0,
      cancelled: 0,
      interrupted: 0,
    },
    createdAt: "2026-08-11T00:00:00.000Z",
    updatedAt: "2026-08-11T00:01:00.000Z",
    completedAt: "2026-08-11T00:01:00.000Z",
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("generation resource schema", () => {
  it("replaces generation metadata independently of its schema version", () => {
    const root = createRoot();
    const bytes = Buffer.from("generation-output");
    const source = path.join(root, "output-1.png");
    fs.writeFileSync(source, bytes);
    const bundlePath = path.join(root, "generations", "batch-1");
    const objectsRoot = path.join(root, "assets", "objects");
    materializeGenerationResourceBundle({
      bundlePath,
      objectsRoot,
      manifest: manifest(bytes),
      outputSources: { "output-1.png": source },
    });
    const updated = {
      ...manifest(bytes),
      title: "Updated release image",
      updatedAt: "2026-08-11T00:02:00.000Z",
    };

    const result = materializeGenerationResourceBundle({
      bundlePath,
      objectsRoot,
      manifest: updated,
      outputSources: { "output-1.png": source },
      writePolicy: { mode: "replace" },
    });

    expect(result.bundleManifest.revision).toBe(2);
    expect(
      readGenerationResourceBundle(bundlePath, objectsRoot).manifest.title,
    ).toBe("Updated release image");
  });

  it("publishes a generation bundle backed by immutable objects and reloads it", () => {
    const root = createRoot();
    const bytes = Buffer.from("png-like-test-bytes");
    const source = path.join(root, "output-1.png");
    fs.writeFileSync(source, bytes);
    const bundlePath = path.join(root, "generations", "batch-1");
    const objectsRoot = path.join(root, "assets", "objects");

    const result = materializeGenerationResourceBundle({
      bundlePath,
      objectsRoot,
      manifest: manifest(bytes),
      outputSources: { "output-1.png": source },
    });

    expect(result.objectHashes).toHaveLength(1);
    expect(fs.existsSync(source)).toBe(true);
    const restored = readGenerationResourceBundle(bundlePath, objectsRoot);
    expect(restored.manifest.id).toBe("batch-1");
    expect(restored.outputs[0]).toMatchObject({
      id: "output-1",
      favorite: true,
    });
  });

  it("rejects missing, extra, and hash-mismatched output sources before bundle publication", () => {
    const root = createRoot();
    const bytes = Buffer.from("expected");
    const generation = manifest(bytes);
    const bundlePath = path.join(root, "bundle");
    const objectsRoot = path.join(root, "objects");
    expect(() =>
      materializeGenerationResourceBundle({
        bundlePath,
        objectsRoot,
        manifest: generation,
        outputSources: {},
      }),
    ).toThrow(/missing output source/u);

    const wrong = path.join(root, "wrong.png");
    fs.writeFileSync(wrong, "mismatch", "utf8");
    expect(() =>
      materializeGenerationResourceBundle({
        bundlePath,
        objectsRoot,
        manifest: generation,
        outputSources: { "output-1.png": wrong },
      }),
    ).toThrow(/expected hash/u);
    expect(fs.existsSync(bundlePath)).toBe(false);

    const expected = path.join(root, "expected.png");
    fs.writeFileSync(expected, bytes);
    expect(() =>
      materializeGenerationResourceBundle({
        bundlePath,
        objectsRoot,
        manifest: generation,
        outputSources: { "output-1.png": expected, "extra.png": expected },
      }),
    ).toThrow(/undeclared output source/u);
  });

  it("rejects invalid slot/count/path invariants and missing immutable objects", () => {
    const root = createRoot();
    const bytes = Buffer.from("expected");
    const invalid = manifest(bytes);
    invalid.slots[0].output!.fileName = "../escape.png";
    expect(() =>
      materializeGenerationResourceBundle({
        bundlePath: path.join(root, "bundle"),
        objectsRoot: path.join(root, "objects"),
        manifest: invalid,
        outputSources: {},
      }),
    ).toThrow(/fileName/u);

    const valid = manifest(bytes);
    const source = path.join(root, "output-1.png");
    fs.writeFileSync(source, bytes);
    const bundlePath = path.join(root, "valid-bundle");
    const objectsRoot = path.join(root, "objects");
    const result = materializeGenerationResourceBundle({
      bundlePath,
      objectsRoot,
      manifest: valid,
      outputSources: { "output-1.png": source },
    });
    fs.rmSync(
      path.join(
        objectsRoot,
        "sha256",
        result.objectHashes[0].slice(0, 2),
        result.objectHashes[0],
      ),
    );
    expect(() => readGenerationResourceBundle(bundlePath, objectsRoot)).toThrow(
      /existing object/u,
    );
  });
});
