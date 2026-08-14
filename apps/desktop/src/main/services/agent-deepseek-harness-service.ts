import { lstat, readFile, readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type {
  AgentHarnessOverview,
  AgentHarnessPluginMutationRequest,
  AgentHarnessPluginMutationResult,
  AgentHarnessPluginSummary,
  AgentHarnessProfileDetail,
  AgentHarnessProfileSummary,
} from "@prompthub/shared/types";
import type { NativeCommandRunner } from "./native-command";

const MAX_PROFILE_COUNT = 64;
const MAX_PLUGIN_COUNT = 128;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const FILE_READ_CONCURRENCY = 8;
const COMMAND_TIMEOUT_MS = 120_000;
const COMMAND_MAX_BUFFER = 128 * 1024;
const LIFECYCLE_SCRIPT_NAMES = [
  "preinstall",
  "install",
  "postinstall",
  "prepare",
  "prepublishOnly",
] as const;
const PROFILE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/i;
const PACKAGE_NAME_PATTERN =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/i;
const REGISTRY_SPEC_PATTERN =
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*(?:@[a-z0-9][a-z0-9*^~<>=|._-]*)?$/i;
const GITHUB_SPEC_PATTERN =
  /^(?:github:[a-z0-9_.-]+\/[a-z0-9_.-]+(?:#[^\s]+)?|https:\/\/github\.com\/[a-z0-9_.-]+\/[a-z0-9_.-]+(?:\.git)?(?:#[^\s]+)?)$/i;

interface JsonRecord {
  [key: string]: unknown;
}

interface ProfileManifest {
  dependencies: Record<string, string>;
  bundles: string[];
}

export interface AgentDeepSeekHarnessServiceOptions {
  rootPath: string;
  commandRunner: NativeCommandRunner;
}

export interface AgentDeepSeekHarnessService {
  listProfiles(): Promise<AgentHarnessOverview>;
  readProfile(profileName: string): Promise<AgentHarnessProfileDetail>;
  mutatePlugin(
    request: AgentHarnessPluginMutationRequest,
  ): Promise<AgentHarnessPluginMutationResult>;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function stringValue(value: unknown, maxLength = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function safeWebUrl(value: unknown): string | null {
  const raw = stringValue(value, 1_000);
  if (!raw) return null;
  const normalized = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

function parseProfileManifest(value: unknown): ProfileManifest | null {
  const manifest = asRecord(value);
  if (!manifest) return null;
  const dependenciesRecord = asRecord(manifest.dependencies) || {};
  const dependencies = Object.fromEntries(
    Object.entries(dependenciesRecord)
      .filter(
        (entry): entry is [string, string] =>
          PACKAGE_NAME_PATTERN.test(entry[0]) && typeof entry[1] === "string",
      )
      .slice(0, MAX_PLUGIN_COUNT),
  );
  const dsh = asRecord(manifest.dsh);
  const profile = asRecord(dsh?.profile);
  const bundles = Array.isArray(profile?.bundles)
    ? profile.bundles
        .filter(
          (item): item is string =>
            typeof item === "string" && PACKAGE_NAME_PATTERN.test(item),
        )
        .slice(0, MAX_PLUGIN_COUNT)
    : [];
  return { dependencies, bundles };
}

function assertProfileName(profileName: string): void {
  if (!PROFILE_NAME_PATTERN.test(profileName)) {
    throw new Error("DSH_PROFILE_NAME_INVALID");
  }
}

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    !relative || (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

async function readBoundedJson(filePath: string): Promise<unknown> {
  const metadata = await stat(filePath);
  if (metadata.size > MAX_MANIFEST_BYTES) {
    throw new Error("DSH_MANIFEST_OVERSIZED");
  }
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  transform: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await transform(items[current]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

function profileSummary(
  name: string,
  status: AgentHarnessProfileSummary["status"],
  metadata: { mtimeMs?: number } = {},
  manifest?: ProfileManifest,
): AgentHarnessProfileSummary {
  return {
    name,
    status,
    bundleCount: manifest?.bundles.length ?? 0,
    dependencyCount: Object.keys(manifest?.dependencies || {}).length,
    updatedAt: metadata.mtimeMs ?? null,
    warnings: status === "valid" ? [] : [`profile-${status}`],
  };
}

function lifecycleScripts(manifest: JsonRecord): string[] {
  const scripts = asRecord(manifest.scripts);
  if (!scripts) return [];
  return LIFECYCLE_SCRIPT_NAMES.filter(
    (name) => typeof scripts[name] === "string",
  );
}

function repositoryUrl(manifest: JsonRecord): string | null {
  const repository = manifest.repository;
  if (typeof repository === "string") return safeWebUrl(repository);
  return safeWebUrl(asRecord(repository)?.url);
}

async function readInstalledPlugin(
  rootRealPath: string,
  profilePath: string,
  name: string,
  enabled: boolean,
  sourceSpec: string | null,
): Promise<AgentHarnessPluginSummary> {
  const fallback: AgentHarnessPluginSummary = {
    name,
    version: null,
    description: null,
    enabled,
    directDependency: sourceSpec !== null,
    sourceSpec,
    status: "missing",
    lifecycleScripts: [],
    warnings: ["package-manifest-unavailable"],
  };
  try {
    const packagePath = path.join(profilePath, "node_modules", name);
    const packageRealPath = await realpath(packagePath);
    if (!isWithinRoot(rootRealPath, packageRealPath)) return fallback;
    const manifest = asRecord(
      await readBoundedJson(path.join(packageRealPath, "package.json")),
    );
    if (!manifest || stringValue(manifest.name) !== name) {
      return { ...fallback, status: "invalid", warnings: ["package-invalid"] };
    }
    const dsh = asRecord(manifest.dsh);
    const bundle = asRecord(dsh?.bundle);
    const client = asRecord(dsh?.client);
    return {
      ...fallback,
      version: stringValue(manifest.version, 100),
      description: stringValue(manifest.description),
      license: stringValue(manifest.license, 100),
      repositoryUrl: repositoryUrl(manifest),
      homepage: safeWebUrl(manifest.homepage),
      status: "installed",
      bundlePatch: stringValue(bundle?.patch, 500),
      clientPlatform: stringValue(client?.platform, 100),
      lifecycleScripts: lifecycleScripts(manifest),
      warnings: [],
    };
  } catch {
    return fallback;
  }
}

function isPackageSpecSafe(value: string): boolean {
  const trimmed = value.trim();
  return (
    trimmed.length <= 500 &&
    !trimmed.startsWith("-") &&
    (REGISTRY_SPEC_PATTERN.test(trimmed) || GITHUB_SPEC_PATTERN.test(trimmed))
  );
}

function commandFailureCode(
  error: unknown,
): "timeout" | "output-limit" | "command-failed" {
  const record = asRecord(error);
  if (record?.killed === true || record?.code === "ABORT_ERR") return "timeout";
  if (record?.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
    return "output-limit";
  }
  return "command-failed";
}

function profileFailureCode(
  error: unknown,
): "profile-not-found" | "profile-invalid" {
  return error instanceof Error &&
    ["DSH_PROFILE_INVALID", "DSH_MANIFEST_OVERSIZED"].includes(error.message)
    ? "profile-invalid"
    : "profile-not-found";
}

export function createAgentDeepSeekHarnessService({
  rootPath,
  commandRunner,
}: AgentDeepSeekHarnessServiceOptions): AgentDeepSeekHarnessService {
  const profilesPath = path.join(rootPath, "profiles");
  const mutationQueues = new Map<string, Promise<unknown>>();

  async function inspectProfile(
    name: string,
  ): Promise<AgentHarnessProfileSummary> {
    const profilePath = path.join(profilesPath, name);
    try {
      const metadata = await stat(path.join(profilePath, "package.json"));
      const manifest = parseProfileManifest(
        await readBoundedJson(path.join(profilePath, "package.json")),
      );
      return manifest
        ? profileSummary(name, "valid", metadata, manifest)
        : profileSummary(name, "invalid", metadata);
    } catch (error) {
      return profileSummary(
        name,
        error instanceof Error && error.message === "DSH_MANIFEST_OVERSIZED"
          ? "oversized"
          : "invalid",
      );
    }
  }

  async function listProfiles(): Promise<AgentHarnessOverview> {
    const rootRealPath = await realpath(rootPath).catch(() => rootPath);
    const entries = await readdir(profilesPath, { withFileTypes: true }).catch(
      () => [],
    );
    const profileNames: string[] = [];
    for (const entry of entries) {
      if (profileNames.length >= MAX_PROFILE_COUNT || !entry.isDirectory())
        continue;
      const candidate = path.join(profilesPath, entry.name);
      const metadata = await lstat(candidate).catch(() => null);
      const resolved = await realpath(candidate).catch(() => "");
      if (
        metadata?.isSymbolicLink() ||
        !PROFILE_NAME_PATTERN.test(entry.name) ||
        !resolved ||
        !isWithinRoot(rootRealPath, resolved)
      ) {
        continue;
      }
      profileNames.push(entry.name);
    }
    const profiles = await mapConcurrent(
      profileNames.sort(),
      FILE_READ_CONCURRENCY,
      inspectProfile,
    );
    return {
      agentId: "deepseek-harness",
      cliAvailable: Boolean(await commandRunner.resolve("dsh")),
      profiles,
    };
  }

  async function readProfile(
    profileName: string,
  ): Promise<AgentHarnessProfileDetail> {
    assertProfileName(profileName);
    const rootRealPath = await realpath(rootPath).catch(() => rootPath);
    const profilePath = path.join(profilesPath, profileName);
    const profileMetadata = await lstat(profilePath).catch(() => null);
    const profileRealPath = await realpath(profilePath).catch(() => "");
    if (
      !profileMetadata?.isDirectory() ||
      profileMetadata.isSymbolicLink() ||
      !profileRealPath ||
      !isWithinRoot(rootRealPath, profileRealPath)
    ) {
      throw new Error("DSH_PROFILE_NOT_FOUND");
    }
    const rawManifest = await readBoundedJson(
      path.join(profilePath, "package.json"),
    );
    const manifest = parseProfileManifest(rawManifest);
    if (!manifest) throw new Error("DSH_PROFILE_INVALID");
    const metadata = await stat(path.join(profilePath, "package.json"));
    const names = [
      ...new Set([...manifest.bundles, ...Object.keys(manifest.dependencies)]),
    ].slice(0, MAX_PLUGIN_COUNT);
    const plugins = await mapConcurrent(names, FILE_READ_CONCURRENCY, (name) =>
      readInstalledPlugin(
        rootRealPath,
        profilePath,
        name,
        manifest.bundles.includes(name),
        manifest.dependencies[name] ?? null,
      ),
    );
    return {
      ...profileSummary(profileName, "valid", metadata, manifest),
      agentId: "deepseek-harness",
      plugins,
    };
  }

  async function executeMutation(
    request: AgentHarnessPluginMutationRequest,
  ): Promise<AgentHarnessPluginMutationResult> {
    if (request.agentId !== "deepseek-harness") {
      return { success: false, errorCode: "agent-unsupported" };
    }
    if (!PROFILE_NAME_PATTERN.test(request.profileName)) {
      return { success: false, errorCode: "profile-name-invalid" };
    }
    if (!request.acknowledgeLifecycleScripts) {
      return { success: false, errorCode: "risk-acknowledgement-required" };
    }
    const command = await commandRunner.resolve("dsh");
    if (!command) return { success: false, errorCode: "cli-not-found" };

    let packageValue: string;
    if (request.operation === "install") {
      packageValue = request.packageSpec?.trim() || "";
      if (!isPackageSpecSafe(packageValue)) {
        return { success: false, errorCode: "package-spec-invalid" };
      }
    } else {
      packageValue = request.packageName?.trim() || "";
      if (!PACKAGE_NAME_PATTERN.test(packageValue)) {
        return { success: false, errorCode: "package-name-invalid" };
      }
      try {
        const profile = await readProfile(request.profileName);
        const plugin = profile.plugins.find(
          (item) => item.name === packageValue,
        );
        if (!plugin?.directDependency) {
          return { success: false, errorCode: "plugin-not-managed" };
        }
      } catch (error) {
        return { success: false, errorCode: profileFailureCode(error) };
      }
    }

    try {
      await commandRunner.run(
        command,
        [
          "plugin",
          "--profile",
          request.profileName,
          request.operation === "install" ? "add" : request.operation,
          packageValue,
        ],
        {
          timeout: COMMAND_TIMEOUT_MS,
          maxBuffer: COMMAND_MAX_BUFFER,
          env: { ...process.env, DSH_HOME: rootPath },
        },
      );
      return { success: true, profile: await readProfile(request.profileName) };
    } catch (error) {
      return { success: false, errorCode: commandFailureCode(error) };
    }
  }

  async function mutatePlugin(
    request: AgentHarnessPluginMutationRequest,
  ): Promise<AgentHarnessPluginMutationResult> {
    const previous =
      mutationQueues.get(request.profileName) || Promise.resolve();
    const current = previous
      .catch(() => undefined)
      .then(() => executeMutation(request));
    mutationQueues.set(request.profileName, current);
    try {
      return await current;
    } finally {
      if (mutationQueues.get(request.profileName) === current) {
        mutationQueues.delete(request.profileName);
      }
    }
  }

  return { listProfiles, readProfile, mutatePlugin };
}
