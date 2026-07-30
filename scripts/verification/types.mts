export type VerificationProfile = "changed" | "quick" | "release" | "package";

export type Surface =
  | "governance"
  | "shared"
  | "database"
  | "core"
  | "cli"
  | "desktop"
  | "web-self-hosted"
  | "web-cloudflare"
  | "mobile";

export type RiskLayer =
  | "governance"
  | "static"
  | "unit"
  | "contract"
  | "integration"
  | "security"
  | "performance"
  | "build"
  | "e2e"
  | "package";

export type VerificationCommand = {
  executable: string;
  args: string[];
  cwd?: string;
};

export type VerificationCheck = {
  id: string;
  label: string;
  surfaces: Surface[];
  layers: RiskLayer[];
  profiles: VerificationProfile[];
  command: VerificationCommand;
  dependsOn?: string[];
  timeoutMs: number;
  resourceGroup?: string;
};

export type CheckStatus =
  | "passed"
  | "failed"
  | "timed_out"
  | "cancelled"
  | "blocked";

export type VerificationResult = {
  id: string;
  label: string;
  command: VerificationCommand;
  status: CheckStatus;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  blockedBy?: string[];
  outputTail?: string;
  outputTruncated?: boolean;
  error?: string;
};

export type ExecutionSummary = {
  exitCode: 0 | 1;
  startedAt: number;
  endedAt: number;
  durationMs: number;
  maxConcurrency: number;
  results: VerificationResult[];
};

export type ExecuteOptions = {
  concurrency?: number;
  quiet?: boolean;
  verbose?: boolean;
  terminationGraceMs?: number;
  maxOutputBytes?: number;
  signal?: AbortSignal;
};
