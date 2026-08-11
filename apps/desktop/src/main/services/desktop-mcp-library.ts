import path from "node:path";

import {
  CoreMcpLibraryService,
  getRuntimeStorageContext,
  getSecretsDir,
} from "@prompthub/core";
import { safeStorage } from "electron";

import { createCanonicalMcpResourceSecretStore } from "./mcp-resource-secret-store";

export function createDesktopMcpLibraryService(): CoreMcpLibraryService {
  if (getRuntimeStorageContext().localAuthority !== "canonical-files") {
    return new CoreMcpLibraryService();
  }
  return new CoreMcpLibraryService({
    secretStore: createCanonicalMcpResourceSecretStore({
      filePath: path.join(getSecretsDir(), "mcp-resource-secrets.json"),
      encryption: safeStorage,
    }),
  });
}
