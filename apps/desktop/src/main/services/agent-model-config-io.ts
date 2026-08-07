import fs from "node:fs/promises";

/**
 * Shared bounded config-file IO helpers for Agent model/provider adapters.
 * Extracted from agent-model-config.ts so sibling readers (e.g. the Pi model
 * catalog) can reuse the same symlink/size guards without circular imports.
 */

const MAX_CONFIG_BYTES = 2 * 1024 * 1024;

export function sanitizeEndpoint(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function readTextConfig(filePath: string): Promise<string> {
  const stat = await fs.lstat(filePath);
  if (stat.isSymbolicLink()) {
    throw new Error("AGENT_MODEL_CONFIG_SYMLINK_INVALID");
  }
  if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) {
    throw new Error("AGENT_MODEL_CONFIG_SIZE_INVALID");
  }
  return fs.readFile(filePath, "utf8");
}
