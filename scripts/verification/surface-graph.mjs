import path from "node:path";

export const ALL_PRODUCT_SURFACES = Object.freeze([
  "shared",
  "database",
  "core",
  "cli",
  "desktop",
  "web-self-hosted",
  "web-cloudflare",
  "mobile",
]);

const ALL_SURFACES = new Set(ALL_PRODUCT_SURFACES);
const ROOT_WIDE_FILES = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "AGENTS.md",
]);

const RULES = [
  ["packages/shared/", ALL_PRODUCT_SURFACES],
  ["packages/db/", ["database", "core", "cli", "desktop", "web-self-hosted"]],
  ["packages/core/", ["core", "cli", "desktop", "web-self-hosted"]],
  ["apps/cli/", ["cli"]],
  ["apps/desktop/", ["desktop"]],
  ["apps/web/", ["web-self-hosted"]],
  ["apps/web-cloudflare/", ["web-cloudflare"]],
  ["apps/mobile/", ["mobile"]],
];

function normalizedRepositoryPath(value) {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    return null;
  }

  const posixValue = value.replaceAll("\\", "/");
  if (path.posix.isAbsolute(posixValue)) {
    return null;
  }

  const normalized = path.posix.normalize(posixValue);
  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    return null;
  }

  return normalized.replace(/^\.\//, "");
}

function routePath(changedPath) {
  const normalized = normalizedRepositoryPath(changedPath);
  if (!normalized) {
    return null;
  }

  if (
    normalized.startsWith(".github/") ||
    normalized.startsWith("scripts/verification/") ||
    normalized === "scripts/verify-release.mts" ||
    ROOT_WIDE_FILES.has(normalized)
  ) {
    return ALL_PRODUCT_SURFACES;
  }

  if (
    normalized.startsWith("spec/") ||
    normalized.startsWith("docs/") ||
    /^README(?:\.[^.]+)?\.md$/.test(normalized)
  ) {
    return ["governance"];
  }

  for (const [prefix, surfaces] of RULES) {
    if (normalized.startsWith(prefix)) {
      return surfaces;
    }
  }

  return null;
}

export function selectAffectedSurfaces(changedPaths) {
  const surfaces = new Set();
  const unknownPaths = [];

  if (!Array.isArray(changedPaths) || changedPaths.length === 0) {
    return {
      surfaces: new Set(ALL_SURFACES),
      fallbackToAll: true,
      unknownPaths: [],
    };
  }

  for (const changedPath of changedPaths) {
    const routed = routePath(changedPath);
    if (!routed) {
      unknownPaths.push(String(changedPath));
      continue;
    }
    for (const surface of routed) {
      surfaces.add(surface);
    }
  }

  if (unknownPaths.length > 0) {
    return {
      surfaces: new Set(ALL_SURFACES),
      fallbackToAll: true,
      unknownPaths,
    };
  }

  return { surfaces, fallbackToAll: false, unknownPaths };
}
