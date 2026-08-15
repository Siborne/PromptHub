import fs from "fs";

import type { McpLibraryFile } from "@prompthub/shared/types/mcp";

import {
  readCanonicalMcpLibrary,
  writeCanonicalMcpLibrary,
  type CanonicalMcpLibraryOptions,
} from "./canonical-mcp-library";
import { readCanonicalWithMetadataMigration } from "./canonical-metadata-migration";

export function readCanonicalMcpLibraryWithMigration(options: {
  canonicalOptions: CanonicalMcpLibraryOptions;
  legacyPath: string;
  normalize: (library: Partial<McpLibraryFile>) => McpLibraryFile;
}): McpLibraryFile {
  const { canonicalOptions, legacyPath, normalize } = options;
  return readCanonicalWithMetadataMigration({
    canonical: normalize(readCanonicalMcpLibrary(canonicalOptions)),
    supersededPath: legacyPath,
    isPopulated: (library) =>
      library.servers.length > 0 || library.bindings.length > 0,
    readSuperseded: () =>
      normalize(JSON.parse(fs.readFileSync(legacyPath, "utf8"))),
    publish: (legacy) => writeCanonicalMcpLibrary(legacy, canonicalOptions),
    rereadCanonical: () => normalize(readCanonicalMcpLibrary(canonicalOptions)),
    unsafePathMessage: "Superseded MCP library path is unsafe",
  });
}
