import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type {
  GenerationBatchManifest,
  GenerationOutputRecord,
  GenerationSlotStatus,
} from "@prompthub/shared/types";

import {
  readContentAddressedObject,
  storeContentAddressedObject,
} from "./content-addressed-object-store";
import {
  readResourceBundle,
  type ResourceBundleManifest,
} from "./resource-bundle";
import {
  resolveResourceBundleWriteRevision,
  writeResourceBundle,
  type ResourceBundleWritePolicy,
} from "./resource-bundle-publication";

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const GENERATION_RESOURCE_TYPE = "generation";
const GENERATION_PAYLOAD_PATH = "batch.json";
const GENERATION_SCHEMA_VERSION = 1;
const MAX_GENERATION_MANIFEST_BYTES = 8 * 1024 * 1024;
const SLOT_STATUSES = new Set<GenerationSlotStatus>([
  "pending",
  "running",
  "succeeded",
  "failed",
  "cancelled",
  "interrupted",
]);

export interface MaterializeGenerationResourceInput {
  bundlePath: string;
  objectsRoot: string;
  manifest: GenerationBatchManifest;
  outputSources: Readonly<Record<string, string>>;
  writePolicy?: ResourceBundleWritePolicy;
}

export interface MaterializedGenerationResource {
  bundleManifest: ResourceBundleManifest;
  objectHashes: string[];
}

export interface ReadGenerationResourceResult {
  manifest: GenerationBatchManifest;
  outputs: GenerationOutputRecord[];
  bundleManifest: ResourceBundleManifest;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`generation resource ${label} is invalid`);
  }
}

function assertTimestamp(
  value: unknown,
  label: string,
): asserts value is string {
  if (
    typeof value !== "string" ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  ) {
    throw new Error(`generation resource ${label} is invalid`);
  }
}

function assertSafeFileName(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !value ||
    path.basename(value) !== value ||
    /[\u0000-\u001f\u007f/\\]/u.test(value)
  ) {
    throw new Error("generation resource output fileName is invalid");
  }
}

function validateOutput(
  value: unknown,
  slotIndex: number,
): GenerationOutputRecord {
  if (!isRecord(value))
    throw new Error("generation resource output is invalid");
  assertString(value.id, "output id");
  if (value.slotIndex !== slotIndex) {
    throw new Error("generation resource output slotIndex is invalid");
  }
  assertSafeFileName(value.fileName);
  assertString(value.mimeType, "output mimeType");
  if (!Number.isSafeInteger(value.byteSize) || Number(value.byteSize) < 1) {
    throw new Error("generation resource output byteSize is invalid");
  }
  if (typeof value.sha256 !== "string" || !SHA256_PATTERN.test(value.sha256)) {
    throw new Error("generation resource output sha256 is invalid");
  }
  if (typeof value.favorite !== "boolean") {
    throw new Error("generation resource output favorite is invalid");
  }
  assertTimestamp(value.createdAt, "output createdAt");
  return value as unknown as GenerationOutputRecord;
}

function countStatuses(statuses: readonly GenerationSlotStatus[]) {
  const count = (status: GenerationSlotStatus) =>
    statuses.filter((value) => value === status).length;
  return {
    total: statuses.length,
    pending: count("pending"),
    running: count("running"),
    succeeded: count("succeeded"),
    failed: count("failed"),
    cancelled: count("cancelled"),
    interrupted: count("interrupted"),
  };
}

function validateSlots(
  value: Record<string, unknown>,
): GenerationOutputRecord[] {
  if (!Array.isArray(value.slots) || value.slots.length !== value.targetCount) {
    throw new Error("generation resource slots do not match targetCount");
  }
  const statuses: GenerationSlotStatus[] = [];
  const outputs: GenerationOutputRecord[] = [];
  value.slots.forEach((slotValue, index) => {
    if (
      !isRecord(slotValue) ||
      slotValue.index !== index ||
      !SLOT_STATUSES.has(slotValue.status as GenerationSlotStatus)
    ) {
      throw new Error("generation resource slot is invalid");
    }
    const status = slotValue.status as GenerationSlotStatus;
    statuses.push(status);
    if (status === "succeeded") {
      outputs.push(validateOutput(slotValue.output, index));
    } else if (slotValue.output !== undefined) {
      throw new Error("generation resource non-succeeded slot has an output");
    }
  });
  if (
    JSON.stringify(value.counts) !== JSON.stringify(countStatuses(statuses))
  ) {
    throw new Error("generation resource counts do not match slots");
  }
  return outputs;
}

function validateGenerationManifest(value: unknown): {
  manifest: GenerationBatchManifest;
  outputs: GenerationOutputRecord[];
} {
  if (!isRecord(value))
    throw new Error("generation resource manifest is invalid");
  if (value.kind !== "prompthub-generation-batch" || value.version !== 1) {
    throw new Error("generation resource manifest header is unsupported");
  }
  assertString(value.id, "id");
  assertString(value.title, "title");
  assertString(value.resolvedPrompt, "resolvedPrompt");
  if (!isRecord(value.model))
    throw new Error("generation resource model is invalid");
  assertString(value.model.id, "model id");
  assertString(value.model.provider, "model provider");
  assertString(value.model.model, "model name");
  if (!isRecord(value.parameters))
    throw new Error("generation resource parameters are invalid");
  if (
    !Number.isSafeInteger(value.targetCount) ||
    Number(value.targetCount) < 1 ||
    Number(value.targetCount) > 1000
  ) {
    throw new Error("generation resource targetCount is invalid");
  }
  assertTimestamp(value.createdAt, "createdAt");
  assertTimestamp(value.updatedAt, "updatedAt");
  if (value.completedAt !== undefined)
    assertTimestamp(value.completedAt, "completedAt");
  const outputs = validateSlots(value);
  return { manifest: value as unknown as GenerationBatchManifest, outputs };
}

function validateOutputSources(
  outputs: readonly GenerationOutputRecord[],
  sources: Readonly<Record<string, string>>,
): void {
  const expected = new Set(outputs.map((output) => output.fileName));
  for (const fileName of expected) {
    if (!Object.prototype.hasOwnProperty.call(sources, fileName)) {
      throw new Error(`generation resource missing output source: ${fileName}`);
    }
  }
  for (const fileName of Object.keys(sources)) {
    if (!expected.has(fileName)) {
      throw new Error(
        `generation resource has an undeclared output source: ${fileName}`,
      );
    }
  }
}

function materializeObjects(
  objectsRoot: string,
  outputs: readonly GenerationOutputRecord[],
  sources: Readonly<Record<string, string>>,
): string[] {
  const hashes = new Set<string>();
  for (const output of outputs) {
    const sourcePath = sources[output.fileName];
    const stat = fs.lstatSync(sourcePath);
    if (
      !stat.isFile() ||
      stat.isSymbolicLink() ||
      stat.size !== output.byteSize
    ) {
      throw new Error(
        `generation resource output source size is invalid: ${output.fileName}`,
      );
    }
    const stored = storeContentAddressedObject(objectsRoot, sourcePath, {
      expectedHash: output.sha256,
      maxBytes: output.byteSize,
    });
    hashes.add(stored.hash);
  }
  return [...hashes].sort();
}

function writeManifestSource(
  parentPath: string,
  manifest: GenerationBatchManifest,
): string {
  const sourcePath = path.join(
    parentPath,
    `.generation-${crypto.randomUUID()}.json`,
  );
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  if (Buffer.byteLength(text, "utf8") > MAX_GENERATION_MANIFEST_BYTES) {
    throw new Error("generation resource manifest byte limit exceeded");
  }
  fs.mkdirSync(parentPath, { recursive: true });
  fs.writeFileSync(sourcePath, text, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  return sourcePath;
}

export function materializeGenerationResourceBundle(
  input: MaterializeGenerationResourceInput,
): MaterializedGenerationResource {
  const parsed = validateGenerationManifest(structuredClone(input.manifest));
  validateOutputSources(parsed.outputs, input.outputSources);
  const objectHashes = materializeObjects(
    input.objectsRoot,
    parsed.outputs,
    input.outputSources,
  );
  const sourcePath = writeManifestSource(
    path.dirname(input.bundlePath),
    parsed.manifest,
  );
  try {
    const revision = resolveResourceBundleWriteRevision(
      input.bundlePath,
      GENERATION_RESOURCE_TYPE,
      parsed.manifest.id,
      parsed.manifest.version,
      input.writePolicy,
    );
    const bundleManifest = writeResourceBundle(
      {
        bundlePath: input.bundlePath,
        resourceType: GENERATION_RESOURCE_TYPE,
        resourceId: parsed.manifest.id,
        schemaVersion: GENERATION_SCHEMA_VERSION,
        revision,
        createdAt: parsed.manifest.createdAt,
        updatedAt: parsed.manifest.updatedAt,
        provenance: { source: "generation-library" },
        objectHashes,
        payloads: [
          { path: GENERATION_PAYLOAD_PATH, sourcePath, role: "manifest" },
        ],
      },
      { mode: input.writePolicy?.mode },
    ).manifest;
    return { bundleManifest, objectHashes };
  } finally {
    fs.rmSync(sourcePath, { force: true });
  }
}

function readManifestPayload(bundlePath: string): unknown {
  const filePath = path.join(bundlePath, GENERATION_PAYLOAD_PATH);
  const stat = fs.lstatSync(filePath);
  if (stat.size > MAX_GENERATION_MANIFEST_BYTES) {
    throw new Error("generation resource manifest byte limit exceeded");
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error("generation resource manifest contains invalid JSON", {
      cause: error,
    });
  }
}

export function readGenerationResourceBundle(
  bundlePath: string,
  objectsRoot: string,
): ReadGenerationResourceResult {
  const bundle = readResourceBundle(bundlePath, {
    expectedResourceType: GENERATION_RESOURCE_TYPE,
  });
  const payload = bundle.manifest.payloadFiles;
  if (
    payload.length !== 1 ||
    payload[0].path !== GENERATION_PAYLOAD_PATH ||
    payload[0].role !== "manifest"
  ) {
    throw new Error("generation resource bundle payload is invalid");
  }
  const parsed = validateGenerationManifest(readManifestPayload(bundlePath));
  if (parsed.manifest.id !== bundle.manifest.resourceId) {
    throw new Error("generation resource id does not match its bundle");
  }
  const hashes = [
    ...new Set(parsed.outputs.map((output) => output.sha256)),
  ].sort();
  if (JSON.stringify(hashes) !== JSON.stringify(bundle.manifest.objectHashes)) {
    throw new Error("generation resource object hashes do not match outputs");
  }
  for (const output of parsed.outputs) {
    const object = readContentAddressedObject(objectsRoot, output.sha256, {
      maxBytes: output.byteSize,
    });
    if (object.size !== output.byteSize) {
      throw new Error("generation resource object size does not match output");
    }
  }
  return {
    manifest: parsed.manifest,
    outputs: parsed.outputs,
    bundleManifest: bundle.manifest,
  };
}
