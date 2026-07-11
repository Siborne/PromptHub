import { shouldIgnoreSkillDirectoryEntry } from "./skill-identity";
import type {
  SkillPackageFingerprintAlgorithm,
  SkillSourceMode,
  SkillSourceSnapshot,
  SkillSourceStaleTarget,
  SkillSourceUpdateCheck,
  SkillSourceUpdateStatus,
} from "../types/skill";

export type {
  SkillPackageFingerprintAlgorithm,
  SkillSourceMode,
  SkillSourceSnapshot,
  SkillSourceStaleTarget,
  SkillSourceUpdateCheck,
  SkillSourceUpdateStatus,
} from "../types/skill";

export const SKILL_PACKAGE_FINGERPRINT_ALGORITHM =
  "skill-package-sha256-v1" as const;
export const LEGACY_STABLE_TEXT_FINGERPRINT_ALGORITHM =
  "legacy-stable-text-v1" as const;

export const SKILL_SOURCE_UPDATE_STATUSES = [
  "no-source",
  "source-unavailable",
  "baseline-missing",
  "up-to-date",
  "update-available",
  "local-modified",
  "conflict",
] as const satisfies readonly SkillSourceUpdateStatus[];

export interface SkillSourceReconciliationInput {
  skillId: string;
  sourceIdentity: string | null;
  baseline: SkillSourceSnapshot | null;
  local: SkillSourceSnapshot | null;
  remote: SkillSourceSnapshot | null;
  staleTargets?: SkillSourceStaleTarget[];
}

export type LegacyBaselineUpgradeDecision =
  | "not-needed"
  | "silent-upgrade"
  | "baseline-missing";

export interface LegacyBaselineUpgradeInput {
  installedDirectoryFingerprint?: string | null;
  installedContentHash?: string | null;
  remoteContentHash?: string | null;
}

export interface SkillSourceUpdateActionInput {
  status: SkillSourceUpdateStatus;
  sourceMode: SkillSourceMode;
}

export interface SkillSourceReconciliationSnapshotInput {
  skillId: string;
  sourceIdentity: string | null;
  localContentHash?: string | null;
  installedContentHash?: string | null;
  remoteContentHash?: string | null;
  localDirectoryFingerprint?: string | null;
  installedDirectoryFingerprint?: string | null;
  remoteDirectoryFingerprint?: string | null;
  fingerprintAlgorithm?: SkillPackageFingerprintAlgorithm | null;
  localVersion?: string | null;
  installedVersion?: string | null;
  remoteVersion?: string | null;
  resolvedAt?: number;
  staleTargets?: SkillSourceStaleTarget[];
}

export interface SkillSourceUpdateActionPolicy {
  canApplyRemoteUpdate: boolean;
  recommendedAction:
    | "none"
    | "retry"
    | "initialize-baseline"
    | "update-from-source"
    | "resolve-conflict"
    | "keep-local"
    | "convert-to-managed-copy";
}

export type SkillPackageFingerprintEntry =
  | {
      path: string;
      content: string;
      data?: never;
      isDirectory?: boolean;
      isSymlink?: false;
    }
  | {
      path: string;
      data: Uint8Array;
      content?: never;
      isDirectory?: boolean;
      isSymlink?: false;
    }
  | {
      path: string;
      linkTarget: string;
      content?: never;
      data?: never;
      isDirectory?: false;
      isSymlink: true;
    };

export interface SkillPackageFingerprintResult {
  algorithm: typeof SKILL_PACKAGE_FINGERPRINT_ALGORITHM;
  fingerprint: string;
}

function normalizeSkillText(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .trimEnd();
}

function normalizePackagePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

async function sha256Hex(data: string | Uint8Array): Promise<string> {
  return sha256HexSync(data);
}

interface SkillPackageManifestEntry {
  path: string;
  line: string;
}

const SHA256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
] as const;

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}

function toSha256Bytes(data: string | Uint8Array): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : data;
}

function sha256HexSync(data: string | Uint8Array): string {
  const bytes = toSha256Bytes(data);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 1 + 8) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  padded[paddedLength - 4] = (bitLength >>> 24) & 0xff;
  padded[paddedLength - 3] = (bitLength >>> 16) & 0xff;
  padded[paddedLength - 2] = (bitLength >>> 8) & 0xff;
  padded[paddedLength - 1] = bitLength & 0xff;

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      const base = offset + index * 4;
      words[index] =
        ((padded[base] ?? 0) << 24) |
        ((padded[base + 1] ?? 0) << 16) |
        ((padded[base + 2] ?? 0) << 8) |
        (padded[base + 3] ?? 0);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15] ?? 0, 7) ^
        rotateRight(words[index - 15] ?? 0, 18) ^
        ((words[index - 15] ?? 0) >>> 3);
      const s1 =
        rotateRight(words[index - 2] ?? 0, 17) ^
        rotateRight(words[index - 2] ?? 0, 19) ^
        ((words[index - 2] ?? 0) >>> 10);
      words[index] =
        ((words[index - 16] ?? 0) + s0 + (words[index - 7] ?? 0) + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let index = 0; index < 64; index += 1) {
      const s1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 =
        (h + s1 + ch + (SHA256_K[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const s0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
}

function buildPackageManifestEntrySync(
  entry: SkillPackageFingerprintEntry,
): SkillPackageManifestEntry | null {
  if (entry.isDirectory) {
    return null;
  }
  const normalizedPath = normalizePackagePath(entry.path);
  if (!normalizedPath || shouldIgnoreSkillDirectoryEntry(normalizedPath)) {
    return null;
  }
  if (entry.isSymlink) {
    return {
      path: normalizedPath,
      line: `symlink:${normalizedPath}:${normalizePackagePath(entry.linkTarget)}`,
    };
  }
  const contentHash =
    "data" in entry && entry.data instanceof Uint8Array
      ? sha256HexSync(entry.data)
      : "content" in entry && typeof entry.content === "string"
        ? sha256HexSync(normalizeSkillText(entry.content))
        : null;
  if (!contentHash) {
    return null;
  }
  return {
    path: normalizedPath,
    line: `file:${normalizedPath}:${contentHash}`,
  };
}

async function buildPackageManifestEntry(
  entry: SkillPackageFingerprintEntry,
): Promise<SkillPackageManifestEntry | null> {
  return buildPackageManifestEntrySync(entry);
}

function samePackage(
  left: SkillSourceSnapshot,
  right: SkillSourceSnapshot,
): boolean {
  if (
    left.directoryFingerprint &&
    right.directoryFingerprint &&
    left.fingerprintAlgorithm === right.fingerprintAlgorithm
  ) {
    return left.directoryFingerprint === right.directoryFingerprint;
  }
  return Boolean(
    left.contentHash &&
    right.contentHash &&
    left.contentHash === right.contentHash,
  );
}

function baseUpdateCheck(
  input: SkillSourceReconciliationInput,
  status: SkillSourceUpdateStatus,
  localModified: boolean,
  remoteChanged: boolean,
  shouldInitializeBaseline = false,
): SkillSourceUpdateCheck {
  const staleTargets = input.staleTargets?.length
    ? [...input.staleTargets]
    : undefined;
  return {
    status,
    skillId: input.skillId,
    ...(input.sourceIdentity ? { sourceIdentity: input.sourceIdentity } : {}),
    ...(input.local ? { local: input.local } : {}),
    ...(input.baseline ? { baseline: input.baseline } : {}),
    ...(input.remote ? { remote: input.remote } : {}),
    localModified,
    remoteChanged,
    shouldInitializeBaseline,
    hasStaleTargets: Boolean(staleTargets?.length),
    ...(staleTargets ? { staleTargets } : {}),
  };
}

function normalizeOptionalString(value?: string | null): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function getFingerprintAlgorithm(
  algorithm?: SkillPackageFingerprintAlgorithm | null,
  directoryFingerprint?: string,
): SkillPackageFingerprintAlgorithm {
  if (algorithm) {
    return algorithm;
  }
  return directoryFingerprint
    ? LEGACY_STABLE_TEXT_FINGERPRINT_ALGORITHM
    : SKILL_PACKAGE_FINGERPRINT_ALGORITHM;
}

function buildSnapshot(options: {
  contentHash?: string | null;
  directoryFingerprint?: string | null;
  fingerprintAlgorithm?: SkillPackageFingerprintAlgorithm | null;
  version?: string | null;
  resolvedAt: number;
}): SkillSourceSnapshot | null {
  const contentHash = normalizeOptionalString(options.contentHash);
  const directoryFingerprint = normalizeOptionalString(
    options.directoryFingerprint,
  );
  if (!contentHash && !directoryFingerprint) {
    return null;
  }

  return {
    ...(contentHash ? { contentHash } : {}),
    ...(directoryFingerprint ? { directoryFingerprint } : {}),
    ...(normalizeOptionalString(options.version)
      ? { version: normalizeOptionalString(options.version) }
      : {}),
    fingerprintAlgorithm: getFingerprintAlgorithm(
      options.fingerprintAlgorithm,
      directoryFingerprint,
    ),
    resolvedAt: options.resolvedAt,
  };
}

export function buildSkillSourceUpdateCheck(
  input: SkillSourceReconciliationSnapshotInput,
): SkillSourceUpdateCheck {
  const resolvedAt = input.resolvedAt ?? Date.now();
  const localContentHash = normalizeOptionalString(input.localContentHash);
  const remoteContentHash = normalizeOptionalString(input.remoteContentHash);
  const localDirectoryFingerprint = normalizeOptionalString(
    input.localDirectoryFingerprint,
  );
  const remoteDirectoryFingerprint = normalizeOptionalString(
    input.remoteDirectoryFingerprint,
  );
  const installedDirectoryFingerprint = normalizeOptionalString(
    input.installedDirectoryFingerprint,
  );
  const installedContentHash = normalizeOptionalString(
    input.installedContentHash,
  );
  const inferredLegacyDirectoryBaseline =
    !installedDirectoryFingerprint &&
    Boolean(
      installedContentHash &&
      remoteContentHash &&
      installedContentHash === remoteContentHash &&
      localDirectoryFingerprint,
    )
      ? localDirectoryFingerprint
      : undefined;
  const packageBaselineFingerprint =
    installedDirectoryFingerprint ?? inferredLegacyDirectoryBaseline;
  const hasPackageBaseline = Boolean(
    packageBaselineFingerprint &&
    localDirectoryFingerprint &&
    remoteDirectoryFingerprint,
  );
  const localMatchesRemote = Boolean(
    localContentHash &&
    remoteContentHash &&
    localContentHash === remoteContentHash,
  );
  const baseline =
    hasPackageBaseline || !localMatchesRemote
      ? buildSnapshot({
          contentHash: installedContentHash,
          directoryFingerprint: packageBaselineFingerprint,
          fingerprintAlgorithm: inferredLegacyDirectoryBaseline
            ? SKILL_PACKAGE_FINGERPRINT_ALGORITHM
            : input.fingerprintAlgorithm,
          version: input.installedVersion,
          resolvedAt,
        })
      : null;
  const local = buildSnapshot({
    contentHash: localContentHash,
    directoryFingerprint: localDirectoryFingerprint,
    fingerprintAlgorithm: localDirectoryFingerprint
      ? SKILL_PACKAGE_FINGERPRINT_ALGORITHM
      : input.fingerprintAlgorithm,
    version: input.localVersion,
    resolvedAt,
  });
  const remote = buildSnapshot({
    contentHash: remoteContentHash,
    directoryFingerprint: remoteDirectoryFingerprint,
    fingerprintAlgorithm: remoteDirectoryFingerprint
      ? SKILL_PACKAGE_FINGERPRINT_ALGORITHM
      : input.fingerprintAlgorithm,
    version: input.remoteVersion,
    resolvedAt,
  });

  return classifySkillSourceUpdate({
    skillId: input.skillId,
    sourceIdentity: input.sourceIdentity,
    baseline,
    local,
    remote,
    staleTargets: input.staleTargets,
  });
}

export async function computeSkillContentSha256(
  content: string,
): Promise<string> {
  return sha256Hex(normalizeSkillText(content));
}

export async function computeSkillPackageFingerprintV1(
  entries: SkillPackageFingerprintEntry[],
): Promise<SkillPackageFingerprintResult> {
  const manifestEntries = (
    await Promise.all(entries.map((entry) => buildPackageManifestEntry(entry)))
  )
    .filter((entry): entry is SkillPackageManifestEntry => Boolean(entry))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => entry.line);

  return {
    algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    fingerprint: await sha256Hex(manifestEntries.join("\n")),
  };
}

export function computeSkillPackageFingerprintV1Sync(
  entries: SkillPackageFingerprintEntry[],
): SkillPackageFingerprintResult {
  const manifestEntries = entries
    .map((entry) => buildPackageManifestEntrySync(entry))
    .filter((entry): entry is SkillPackageManifestEntry => Boolean(entry))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((entry) => entry.line);

  return {
    algorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    fingerprint: sha256HexSync(manifestEntries.join("\n")),
  };
}

export async function computeContentUrlPackageSnapshot(
  content: string,
  options: { version?: string; resolvedAt: number },
): Promise<SkillSourceSnapshot> {
  const contentHash = await computeSkillContentSha256(content);
  return {
    contentHash,
    directoryFingerprint: contentHash,
    ...(options.version ? { version: options.version } : {}),
    fingerprintAlgorithm: SKILL_PACKAGE_FINGERPRINT_ALGORITHM,
    resolvedAt: options.resolvedAt,
  };
}

export function classifySkillSourceUpdate(
  input: SkillSourceReconciliationInput,
): SkillSourceUpdateCheck {
  if (!input.sourceIdentity) {
    return baseUpdateCheck(input, "no-source", false, false);
  }
  if (!input.local || !input.remote) {
    return baseUpdateCheck(input, "source-unavailable", false, false);
  }
  if (!input.baseline) {
    if (samePackage(input.local, input.remote)) {
      return baseUpdateCheck(input, "up-to-date", false, false, true);
    }
    return baseUpdateCheck(input, "baseline-missing", false, false);
  }

  const localModified = !samePackage(input.local, input.baseline);
  const remoteChanged = !samePackage(input.remote, input.baseline);
  if (localModified && remoteChanged) {
    return baseUpdateCheck(input, "conflict", true, true);
  }
  if (localModified) {
    return baseUpdateCheck(input, "local-modified", true, false);
  }
  if (remoteChanged) {
    return baseUpdateCheck(input, "update-available", false, true);
  }
  return baseUpdateCheck(input, "up-to-date", false, false);
}

export function classifyLegacyBaselineUpgrade(
  input: LegacyBaselineUpgradeInput,
): LegacyBaselineUpgradeDecision {
  if (input.installedDirectoryFingerprint) {
    return "not-needed";
  }
  if (!input.installedContentHash || !input.remoteContentHash) {
    return "baseline-missing";
  }
  return input.installedContentHash === input.remoteContentHash
    ? "silent-upgrade"
    : "baseline-missing";
}

export function getSkillSourceUpdateActionPolicy(
  input: SkillSourceUpdateActionInput,
): SkillSourceUpdateActionPolicy {
  if (
    input.sourceMode === "local-linked" &&
    (input.status === "update-available" || input.status === "conflict")
  ) {
    return {
      canApplyRemoteUpdate: false,
      recommendedAction: "convert-to-managed-copy",
    };
  }

  switch (input.status) {
    case "update-available":
      return {
        canApplyRemoteUpdate: true,
        recommendedAction: "update-from-source",
      };
    case "conflict":
      return {
        canApplyRemoteUpdate: false,
        recommendedAction: "resolve-conflict",
      };
    case "baseline-missing":
      return {
        canApplyRemoteUpdate: false,
        recommendedAction: "initialize-baseline",
      };
    case "local-modified":
      return {
        canApplyRemoteUpdate: false,
        recommendedAction: "keep-local",
      };
    case "source-unavailable":
      return {
        canApplyRemoteUpdate: false,
        recommendedAction: "retry",
      };
    case "no-source":
    case "up-to-date":
      return {
        canApplyRemoteUpdate: false,
        recommendedAction: "none",
      };
    default: {
      const exhaustiveStatus: never = input.status;
      return exhaustiveStatus;
    }
  }
}
