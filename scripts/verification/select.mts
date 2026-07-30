import type {
  RiskLayer,
  Surface,
  VerificationCheck,
  VerificationProfile,
} from "./types.mts";

const VALID_PROFILES = new Set(["changed", "quick", "release", "package"]);
const VALID_SURFACES = new Set([
  "governance",
  "shared",
  "database",
  "core",
  "cli",
  "desktop",
  "web-self-hosted",
  "web-cloudflare",
  "mobile",
]);
const VALID_LAYERS = new Set([
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
const RESOURCE_GROUP = /^[a-z][a-z0-9-]*$/;
const REQUIRED_LAYERS = new Map<string, string[]>([
  ["governance", ["governance"]],
  ["shared", ["static", "unit", "contract"]],
  ["database", ["static", "unit", "contract"]],
  ["core", ["static", "unit", "contract"]],
  ["cli", ["static", "unit", "contract", "security", "build", "package"]],
  [
    "desktop",
    [
      "static",
      "unit",
      "contract",
      "security",
      "integration",
      "performance",
      "build",
      "e2e",
      "package",
    ],
  ],
  [
    "web-self-hosted",
    ["static", "unit", "contract", "security", "integration", "build"],
  ],
  ["web-cloudflare", ["static", "unit", "contract", "security", "build"]],
  ["mobile", ["static", "unit", "contract"]],
]);

export type SelectionOptions = {
  profile: VerificationProfile;
  surfaces?: Set<Surface>;
  excludeLayers?: Set<RiskLayer>;
};

function commandKey(check: VerificationCheck): string {
  return JSON.stringify([
    check.command.cwd ?? "",
    check.command.executable,
    ...check.command.args,
  ]);
}

function validateCheckMetadata(
  check: VerificationCheck,
  ids: Set<string>,
  commands: Set<string>,
): void {
  if (ids.has(check.id)) {
    throw new Error(`Duplicate verification check id: ${check.id}`);
  }
  ids.add(check.id);
  const command = commandKey(check);
  if (commands.has(command)) {
    throw new Error(`Duplicate verification command: ${check.id}`);
  }
  commands.add(command);
  if (
    check.timeoutMs <= 0 ||
    check.profiles.length === 0 ||
    check.surfaces.length === 0 ||
    check.layers.length === 0
  ) {
    throw new Error(`Invalid verification metadata: ${check.id}`);
  }
  if (check.profiles.some((profile) => !VALID_PROFILES.has(profile))) {
    throw new Error(`Invalid verification profile: ${check.id}`);
  }
  if (check.surfaces.some((surface) => !VALID_SURFACES.has(surface))) {
    throw new Error(`Invalid verification surface: ${check.id}`);
  }
  if (check.layers.some((layer) => !VALID_LAYERS.has(layer))) {
    throw new Error(`Invalid verification layer: ${check.id}`);
  }
  if (check.resourceGroup && !RESOURCE_GROUP.test(check.resourceGroup)) {
    throw new Error(`Invalid verification resource group: ${check.id}`);
  }
}

function validateDependencies(
  checks: VerificationCheck[],
  ids: Set<string>,
): void {
  for (const check of checks) {
    for (const dependency of check.dependsOn ?? []) {
      if (!ids.has(dependency)) {
        throw new Error(
          `Unknown verification dependency ${dependency} for ${check.id}`,
        );
      }
    }
  }
}

function validateCycles(checks: VerificationCheck[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(checks.map((check) => [check.id, check]));

  function visit(id: string): void {
    if (visiting.has(id)) {
      throw new Error(`Verification dependency cycle contains ${id}`);
    }
    if (visited.has(id)) {
      return;
    }

    visiting.add(id);
    for (const dependency of byId.get(id)?.dependsOn ?? []) {
      visit(dependency);
    }
    visiting.delete(id);
    visited.add(id);
  }

  for (const check of checks) {
    visit(check.id);
  }
}

function validateCompleteInventory(checks: VerificationCheck[]): void {
  for (const [surface, layers] of REQUIRED_LAYERS) {
    for (const layer of layers) {
      const covered = checks.some(
        (check) =>
          check.surfaces.includes(surface as Surface) &&
          check.layers.includes(layer as RiskLayer),
      );
      if (!covered) {
        throw new Error(
          `Verification surface ${surface} is missing required ${layer} layer`,
        );
      }
    }
  }
}

export function validateRegistry(
  checks: VerificationCheck[],
  options: { requireCompleteInventory?: boolean } = {},
): void {
  const ids = new Set<string>();
  const commands = new Set<string>();
  for (const check of checks) validateCheckMetadata(check, ids, commands);
  validateDependencies(checks, ids);
  validateCycles(checks);
  if (options.requireCompleteInventory) validateCompleteInventory(checks);
}

export function selectChecks(
  checks: VerificationCheck[],
  options: SelectionOptions,
): VerificationCheck[] {
  const byId = new Map(checks.map((check) => [check.id, check]));
  const selected = new Set<string>();

  const isExcluded = (check: VerificationCheck): boolean =>
    check.layers.some((layer) => options.excludeLayers?.has(layer));
  const ownsSelectedSurface = (check: VerificationCheck): boolean =>
    !options.surfaces ||
    check.surfaces.includes("governance") ||
    check.surfaces.some((surface) => options.surfaces?.has(surface));

  function include(id: string): void {
    if (selected.has(id)) {
      return;
    }
    const check = byId.get(id);
    if (!check || isExcluded(check)) {
      return;
    }
    for (const dependency of check.dependsOn ?? []) {
      include(dependency);
    }
    selected.add(id);
  }

  for (const check of checks) {
    if (
      check.profiles.includes(options.profile) &&
      !isExcluded(check) &&
      ownsSelectedSurface(check)
    ) {
      include(check.id);
    }
  }

  return checks.filter((check) => selected.has(check.id));
}
