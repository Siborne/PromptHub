import fs from "fs";

import type { McpLibraryFile } from "@prompthub/shared/types/mcp";

import {
  readCanonicalMcpLibrary,
  writeCanonicalMcpLibrary,
  type CanonicalMcpLibraryReadOptions,
} from "./canonical-mcp-library";
import { readCanonicalWithMetadataMigration } from "./canonical-metadata-migration";

export function readCanonicalMcpLibraryWithMigration(options: {
  canonicalOptions: CanonicalMcpLibraryReadOptions;
  legacyPath: string;
  normalize: (library: Partial<McpLibraryFile>) => McpLibraryFile;
  normalizeCanonical?: (library: McpLibraryFile) => McpLibraryFile;
}): McpLibraryFile {
  const {
    canonicalOptions,
    legacyPath,
    normalize,
    normalizeCanonical = normalize,
  } = options;
  return readCanonicalWithMetadataMigration({
    canonical: normalizeCanonical(readCanonicalMcpLibrary(canonicalOptions)),
    supersededPath: legacyPath,
    isPopulated: (library) =>
      library.servers.length > 0 || library.bindings.length > 0,
    readSuperseded: () =>
      normalize(JSON.parse(fs.readFileSync(legacyPath, "utf8"))),
    publish: (legacy) => writeCanonicalMcpLibrary(legacy, canonicalOptions),
    rereadCanonical: () =>
      normalizeCanonical(readCanonicalMcpLibrary(canonicalOptions)),
    unsafePathMessage: "Superseded MCP library path is unsafe",
  });
}
