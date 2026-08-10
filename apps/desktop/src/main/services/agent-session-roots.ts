import path from "node:path";

export interface AgentSessionRootOptions {
  homeDir: string;
  qwenRuntimeDir?: string;
}

export function resolveEnvironmentRoot(
  configured: string | undefined,
  homeDir: string,
  fallback: string,
): string {
  if (!configured?.trim() || configured.includes("\0")) {
    return path.join(homeDir, fallback);
  }
  const expanded = configured.trim().replace(/^~(?=$|[\\/])/, homeDir);
  return path.isAbsolute(expanded)
    ? path.normalize(expanded)
    : path.join(homeDir, fallback);
}

export function resolveQwenRuntimeRoot(
  options: AgentSessionRootOptions,
): string {
  const configured =
    options.qwenRuntimeDir ||
    process.env.QWEN_RUNTIME_DIR ||
    process.env.QWEN_HOME ||
    path.join(options.homeDir, ".qwen");
  if (configured.includes("\0")) return path.join(options.homeDir, ".qwen");
  const expanded = configured.replace(/^~(?=$|[\\/])/, options.homeDir);
  return path.resolve(expanded);
}

export function resolveCherryStudioRoot(homeDir: string): string {
  if (process.platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", "CherryStudio");
  }
  if (process.platform === "win32") {
    return resolveEnvironmentRoot(
      process.env.APPDATA,
      homeDir,
      path.join("AppData", "Roaming", "CherryStudio"),
    );
  }
  return resolveEnvironmentRoot(
    process.env.XDG_CONFIG_HOME,
    homeDir,
    path.join(".config", "CherryStudio"),
  );
}

export function resolveKiloStorageRoot(homeDir: string): string {
  const dataRoot = resolveEnvironmentRoot(
    process.env.XDG_DATA_HOME,
    homeDir,
    path.join(".local", "share"),
  );
  return path.join(dataRoot, "kilo", "storage");
}

export function resolveHermesRoot(homeDir: string): string {
  if (process.env.HERMES_HOME?.trim()) {
    return resolveEnvironmentRoot(
      process.env.HERMES_HOME,
      homeDir,
      ".hermes",
    );
  }
  if (process.platform === "win32") {
    const localAppData = resolveEnvironmentRoot(
      process.env.LOCALAPPDATA,
      homeDir,
      path.join("AppData", "Local"),
    );
    return path.join(localAppData, "hermes");
  }
  return path.join(homeDir, ".hermes");
}

export function resolveReasonixStateRoot(homeDir: string): string {
  return resolveEnvironmentRoot(
    process.env.REASONIX_STATE_HOME || process.env.REASONIX_HOME,
    homeDir,
    ".reasonix",
  );
}

export function resolveNanoClawRoots(homeDir: string): string[] {
  return [".nanoclaw", "nanoclaw", "nanoclaw-v2"].map((name) =>
    path.join(homeDir, name),
  );
}

export function resolveCoPawRoots(homeDir: string): string[] {
  const explicit =
    process.env.QWENPAW_WORKING_DIR || process.env.COPAW_WORKING_DIR;
  if (explicit?.trim()) {
    return [resolveEnvironmentRoot(explicit, homeDir, ".qwenpaw")];
  }
  return [path.join(homeDir, ".qwenpaw"), path.join(homeDir, ".copaw")];
}
