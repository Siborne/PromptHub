import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  readResourceBundle,
  type ResourceBundleManifest,
  type ResourceBundlePayloadSource,
} from "./resource-bundle";
import {
  publishResourceBundle,
  recoverResourceBundlePublication,
  type PublishResourceBundleOptions,
} from "./resource-bundle-publication";
import {
  ResourceSchemaRegistry,
  type ResourceSchemaDocument,
} from "./resource-schema-registry";

const DEFAULT_MAX_DOCUMENT_BYTES = 16 * 1024 * 1024;
const CONVERTED_ROLES = new Set(["current", "version"]);
const RESERVED_MANIFEST_FIELDS = new Set([
  "kind",
  "manifestVersion",
  "resourceType",
  "resourceId",
  "schemaVersion",
  "revision",
  "createdAt",
  "updatedAt",
  "contentHash",
  "provenance",
  "objectHashes",
  "payloadFiles",
]);

export interface ConvertResourceBundleSchemaOptions extends PublishResourceBundleOptions {
  bundlePath: string;
  registry: ResourceSchemaRegistry;
  maxDocumentBytes?: number;
  documentRoles?: readonly string[];
}

export type ConvertResourceBundleSchemaResult = {
  sourceVersion: number;
  targetVersion: number;
  revision: number;
} & (
  | { status: "current"; convertedDocuments: 0 }
  | { status: "read-only-newer"; convertedDocuments: 0 }
  | { status: "converted"; convertedDocuments: number }
);

function extraManifestFields(
  manifest: ResourceBundleManifest,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(manifest).filter(
      ([key]) => !RESERVED_MANIFEST_FIELDS.has(key),
    ),
  );
}

function readJsonDocument(
  filePath: string,
  maxDocumentBytes: number,
): ResourceSchemaDocument {
  const stats = fs.lstatSync(filePath);
  if (
    !stats.isFile() ||
    stats.isSymbolicLink() ||
    stats.size > maxDocumentBytes
  ) {
    throw new Error("Resource schema document exceeds conversion limits");
  }
  let value: unknown;
  try {
    value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error("Resource schema document is invalid JSON", {
      cause: error,
    });
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Resource schema document must be an object");
  }
  return value as ResourceSchemaDocument;
}

function writeConvertedDocument(
  rootPath: string,
  relativePath: string,
  document: ResourceSchemaDocument,
  maxDocumentBytes: number,
): string {
  const content = `${JSON.stringify(document, null, 2)}\n`;
  if (Buffer.byteLength(content, "utf8") > maxDocumentBytes) {
    throw new Error("Converted resource schema document exceeds limits");
  }
  const targetPath = path.join(rootPath, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(targetPath), { recursive: true, mode: 0o700 });
  const descriptor = fs.openSync(targetPath, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  return targetPath;
}

function assertMaxDocumentBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error("Resource schema document byte limit is invalid");
  }
  return value;
}

export function convertResourceBundleSchema(
  options: ConvertResourceBundleSchemaOptions,
): ConvertResourceBundleSchemaResult {
  const bundlePath = path.resolve(options.bundlePath);
  const verified = readResourceBundle(bundlePath);
  const manifest = verified.manifest;
  const registration = options.registry
    .list()
    .find((entry) => entry.resourceType === manifest.resourceType);
  if (!registration) {
    throw new Error(`Unknown resource schema: ${manifest.resourceType}`);
  }
  const baseResult = {
    sourceVersion: manifest.schemaVersion,
    targetVersion: registration.currentVersion,
    revision: manifest.revision,
  };
  if (manifest.schemaVersion > registration.currentVersion) {
    return {
      ...baseResult,
      status: "read-only-newer",
      convertedDocuments: 0,
    };
  }
  if (manifest.schemaVersion === registration.currentVersion) {
    return { ...baseResult, status: "current", convertedDocuments: 0 };
  }

  const maxDocumentBytes = assertMaxDocumentBytes(
    options.maxDocumentBytes ?? DEFAULT_MAX_DOCUMENT_BYTES,
  );
  const convertedRoles = new Set(options.documentRoles ?? CONVERTED_ROLES);
  const temporaryRoot = path.join(
    path.dirname(bundlePath),
    `.${path.basename(bundlePath)}.convert-${process.pid}-${crypto.randomUUID()}`,
  );
  fs.mkdirSync(temporaryRoot, { mode: 0o700 });
  let convertedDocuments = 0;
  try {
    const payloads: ResourceBundlePayloadSource[] = manifest.payloadFiles.map(
      (payload) => {
        const sourcePath = path.join(bundlePath, ...payload.path.split("/"));
        if (!payload.role || !convertedRoles.has(payload.role)) {
          return { path: payload.path, sourcePath, role: payload.role };
        }
        const document = readJsonDocument(sourcePath, maxDocumentBytes);
        if (document.schemaVersion !== manifest.schemaVersion) {
          throw new Error(
            "Resource schema document version does not match its bundle",
          );
        }
        const resolved = options.registry.resolve(
          manifest.resourceType,
          manifest.schemaVersion,
          document,
        );
        convertedDocuments += 1;
        return {
          path: payload.path,
          role: payload.role,
          sourcePath: writeConvertedDocument(
            temporaryRoot,
            payload.path,
            {
              ...resolved.document,
              schemaVersion: resolved.currentVersion,
            },
            maxDocumentBytes,
          ),
        };
      },
    );
    if (convertedDocuments === 0) {
      throw new Error("Resource bundle has no schema-owned documents");
    }
    const published = publishResourceBundle(
      {
        bundlePath,
        resourceType: manifest.resourceType,
        resourceId: manifest.resourceId,
        schemaVersion: registration.currentVersion,
        revision: manifest.revision,
        createdAt: manifest.createdAt,
        updatedAt: manifest.updatedAt,
        provenance: manifest.provenance,
        objectHashes: manifest.objectHashes,
        payloads,
        extraFields: extraManifestFields(manifest),
      },
      { injectFailure: options.injectFailure },
    );
    return {
      ...baseResult,
      status: "converted",
      targetVersion: published.manifest.schemaVersion,
      convertedDocuments,
    };
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

export { recoverResourceBundlePublication };
