import { spawn } from "node:child_process";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { VERIFICATION_CHECKS } from "./checks.mts";
import { executeChecks } from "./execute.mts";
import { createJsonReport, printSummary } from "./report.mts";
import { selectChecks, validateRegistry } from "./select.mts";
import {
  ALL_PRODUCT_SURFACES,
  selectAffectedSurfaces,
} from "./surface-graph.mjs";
import type { RiskLayer, Surface, VerificationProfile } from "./types.mts";

type OutputFormat = "human" | "json";

export type CliOptions = {
  profile: VerificationProfile;
  surfaces: Surface[];
  excludeLayers: RiskLayer[];
  concurrency: number;
  format: OutputFormat;
  reportPath?: string;
  list: boolean;
  quiet: boolean;
  verbose: boolean;
};

type Selection = {
  selectedSurfaces: Set<Surface>;
  fallbackToAll: boolean;
  selectedChecks: typeof VERIFICATION_CHECKS;
};

const PROFILES = new Set<VerificationProfile>([
  "changed",
  "quick",
  "release",
  "package",
]);
const SURFACES = new Set<Surface>(["governance", ...ALL_PRODUCT_SURFACES]);
const LAYERS = new Set<RiskLayer>([
  "governance",
  "static",
  "unit",
  "contract",
  "integration",
  "security",
  "performance",
  "build",
  "e2e",
  "package",
]);
const VALUE_OPTIONS = new Set([
  "--profile",
  "--surface",
  "--exclude-layer",
  "--concurrency",
  "--format",
  "--report",
]);

function optionValue(
  args: string[],
  index: number,
  name: string,
): { value: string; nextIndex: number } {
  const current = args[index]!;
  const inline = current.startsWith(`${name}=`)
    ? current.slice(name.length + 1)
    : "";
  if (inline) {
    return { value: inline, nextIndex: index };
  }
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  return { value, nextIndex: index + 1 };
}

function defaultOptions(): CliOptions {
  return {
    profile: "release",
    surfaces: [],
    excludeLayers: [],
    concurrency: 2,
    format: "human",
    list: false,
    quiet: false,
    verbose: false,
  };
}

function parseFlag(argument: string, options: CliOptions): boolean {
  const handlers: Record<string, () => void> = {
    "--": () => undefined,
    "--quick": () => {
      options.profile = "quick";
    },
    "--list": () => {
      options.list = true;
    },
    "--quiet": () => {
      options.quiet = true;
    },
    "--verbose": () => {
      options.verbose = true;
    },
  };
  const handler = handlers[argument];
  handler?.();
  return Boolean(handler);
}

function parseSelectionOption(
  name: string,
  value: string,
  options: CliOptions,
): boolean {
  if (name === "--profile") {
    if (!PROFILES.has(value as VerificationProfile)) {
      throw new Error(`Unsupported verification profile: ${value}`);
    }
    options.profile = value as VerificationProfile;
    return true;
  }
  if (name === "--surface") {
    if (!SURFACES.has(value as Surface)) {
      throw new Error(`Unsupported verification surface: ${value}`);
    }
    options.surfaces.push(value as Surface);
    return true;
  }
  if (name === "--exclude-layer") {
    if (!LAYERS.has(value as RiskLayer)) {
      throw new Error(`Unsupported verification layer: ${value}`);
    }
    options.excludeLayers.push(value as RiskLayer);
    return true;
  }
  return false;
}

function parseExecutionOption(
  name: string,
  value: string,
  options: CliOptions,
): boolean {
  if (name === "--concurrency") {
    const concurrency = Number(value);
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) {
      throw new Error("Verification concurrency must be from 1 to 16");
    }
    options.concurrency = concurrency;
    return true;
  }
  if (name === "--format") {
    if (value !== "human" && value !== "json") {
      throw new Error(`Unsupported verification format: ${value}`);
    }
    options.format = value;
    return true;
  }
  if (name === "--report") {
    options.reportPath = value;
    return true;
  }
  return false;
}

function validateOptions(options: CliOptions): void {
  if (options.quiet && options.verbose) {
    throw new Error("--quiet and --verbose cannot be used together");
  }
  if (options.profile === "package" && options.surfaces.length !== 1) {
    throw new Error("The package profile requires exactly one --surface");
  }
}

export function parseArguments(args: string[]): CliOptions {
  const options = defaultOptions();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]!;
    if (parseFlag(argument, options)) continue;
    const name = argument.split("=", 1)[0]!;
    if (!VALUE_OPTIONS.has(name)) {
      throw new Error(`Unsupported verification argument: ${argument}`);
    }
    const parsed = optionValue(args, index, name);
    index = parsed.nextIndex;
    if (
      !parseSelectionOption(name, parsed.value, options) &&
      !parseExecutionOption(name, parsed.value, options)
    ) {
      throw new Error(`Unsupported verification argument: ${argument}`);
    }
  }
  validateOptions(options);
  return options;
}

function runGitPathCommand(args: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: process.cwd(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let byteCount = 0;
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGTERM"), 10_000);
    timeout.unref();

    child.stdout.on("data", (chunk: Buffer) => {
      byteCount += chunk.length;
      if (byteCount > 10 * 1024 * 1024) {
        child.kill("SIGTERM");
        return;
      }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-4_096);
    });
    child.once("error", reject);
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (code !== 0 || byteCount > 10 * 1024 * 1024) {
        reject(
          new Error(
            byteCount > 10 * 1024 * 1024
              ? "Git changed-path output exceeded 10 MiB"
              : stderr || `git exited with code ${code}`,
          ),
        );
        return;
      }
      resolve(
        Buffer.concat(chunks).toString("utf8").split("\0").filter(Boolean),
      );
    });
  });
}

async function changedSurfaces(): Promise<{
  surfaces: Set<Surface>;
  fallbackToAll: boolean;
}> {
  try {
    const [tracked, untracked] = await Promise.all([
      runGitPathCommand(["diff", "--name-only", "-z", "HEAD"]),
      runGitPathCommand(["ls-files", "--others", "--exclude-standard", "-z"]),
    ]);
    const selection = selectAffectedSurfaces([...tracked, ...untracked]);
    return {
      surfaces: selection.surfaces as Set<Surface>,
      fallbackToAll: selection.fallbackToAll,
    };
  } catch {
    return {
      surfaces: new Set(ALL_PRODUCT_SURFACES as Surface[]),
      fallbackToAll: true,
    };
  }
}

function commandText(executable: string, args: string[]): string {
  return [executable, ...args].join(" ");
}

async function writeReport(reportPath: string, report: unknown): Promise<void> {
  const absolutePath = path.resolve(reportPath);
  const directory = path.dirname(absolutePath);
  const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, absolutePath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

async function resolveSelection(options: CliOptions): Promise<Selection> {
  let selectedSurfaces = new Set<Surface>(
    options.surfaces.length
      ? options.surfaces
      : (ALL_PRODUCT_SURFACES as Surface[]),
  );
  let fallbackToAll = false;
  if (options.profile === "changed" && options.surfaces.length === 0) {
    const changed = await changedSurfaces();
    selectedSurfaces = changed.surfaces;
    fallbackToAll = changed.fallbackToAll;
  }
  const selectedChecks = selectChecks(VERIFICATION_CHECKS, {
    profile: options.profile,
    surfaces: selectedSurfaces,
    excludeLayers: new Set(options.excludeLayers),
  });
  return { selectedSurfaces, fallbackToAll, selectedChecks };
}

function printCheckList(options: CliOptions, selection: Selection): void {
  const checks = selection.selectedChecks.map((check) => ({
    id: check.id,
    label: check.label,
    surfaces: check.surfaces,
    layers: check.layers,
    dependsOn: check.dependsOn ?? [],
    timeoutMs: check.timeoutMs,
    command: check.command,
  }));
  if (options.format === "json") {
    console.log(
      JSON.stringify({
        profile: options.profile,
        surfaces: [...selection.selectedSurfaces].sort(),
        fallbackToAll: selection.fallbackToAll,
        checks,
      }),
    );
    return;
  }
  for (const check of selection.selectedChecks) {
    console.log(
      `${check.id}: ${commandText(
        check.command.executable,
        check.command.args,
      )}`,
    );
  }
}

function printRunHeader(options: CliOptions, selection: Selection): void {
  if (options.format !== "human" || options.quiet) return;
  console.log(`PromptHub verification profile: ${options.profile}`);
  console.log(
    `Surfaces: ${[...selection.selectedSurfaces].sort().join(", ")}${
      selection.fallbackToAll ? " (safe fallback)" : ""
    }`,
  );
  console.log(
    `Checks: ${selection.selectedChecks.length}; concurrency: ${
      options.concurrency
    }`,
  );
}

async function executeSelection(
  options: CliOptions,
  selection: Selection,
): Promise<number> {
  const controller = new AbortController();
  const interrupt = (): void => controller.abort();
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    const summary = await executeChecks(selection.selectedChecks, {
      concurrency: options.concurrency,
      quiet: options.quiet || options.format === "json",
      verbose: options.verbose,
      signal: controller.signal,
    });
    const report = createJsonReport(
      options.profile,
      [...selection.selectedSurfaces],
      summary,
    );
    if (options.reportPath) await writeReport(options.reportPath, report);
    if (options.format === "json") {
      console.log(JSON.stringify(report));
    } else if (!options.quiet) {
      printSummary(summary);
    }
    return summary.exitCode;
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

export async function runVerificationCli(args: string[]): Promise<number> {
  const options = parseArguments(args);
  validateRegistry(VERIFICATION_CHECKS, { requireCompleteInventory: true });
  const selection = await resolveSelection(options);
  if (options.list) {
    printCheckList(options, selection);
    return 0;
  }
  printRunHeader(options, selection);
  return executeSelection(options, selection);
}
