import type {
  ExecutionSummary,
  Surface,
  VerificationProfile,
  VerificationResult,
} from "./types.mts";

const SECRET_ASSIGNMENT =
  /\b(TOKEN|PASSWORD|SECRET|API_KEY|ACCESS_KEY|PRIVATE_KEY)=([^\s]+)/gi;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const SECRET_ENVIRONMENT_KEY =
  /(?:TOKEN|PASSWORD|SECRET|API_KEY|ACCESS_KEY|PRIVATE_KEY)/i;

export function redactDiagnostic(
  value: string | undefined,
): string | undefined {
  return value
    ?.replace(SECRET_ASSIGNMENT, "$1=[REDACTED]")
    .replace(BEARER_TOKEN, "Bearer [REDACTED]");
}

function safeResult(result: VerificationResult): VerificationResult {
  return {
    ...result,
    command: {
      ...result.command,
      executable: redactDiagnostic(result.command.executable) ?? "",
      args: result.command.args.map(
        (argument) => redactDiagnostic(argument) ?? "",
      ),
      cwd: redactDiagnostic(result.command.cwd),
      environment: result.command.environment
        ? Object.fromEntries(
            Object.entries(result.command.environment).map(([key, value]) => [
              key,
              SECRET_ENVIRONMENT_KEY.test(key)
                ? "[REDACTED]"
                : (redactDiagnostic(value) ?? ""),
            ]),
          )
        : undefined,
    },
    outputTail: redactDiagnostic(result.outputTail),
    error: redactDiagnostic(result.error),
  };
}

export function createJsonReport(
  profile: VerificationProfile,
  surfaces: Surface[],
  summary: ExecutionSummary,
) {
  return {
    schemaVersion: 1,
    profile,
    surfaces: [...surfaces].sort(),
    status: summary.exitCode === 0 ? "passed" : "failed",
    startedAt: summary.startedAt,
    endedAt: summary.endedAt,
    durationMs: summary.durationMs,
    maxConcurrency: summary.maxConcurrency,
    results: summary.results.map(safeResult),
  };
}

export function printSummary(summary: ExecutionSummary): void {
  console.log("\nVerification summary");
  for (const result of summary.results) {
    const blocked = result.blockedBy?.length
      ? ` (blocked by ${result.blockedBy.join(", ")})`
      : "";
    console.log(
      `${result.status.padEnd(9)} ${result.id.padEnd(32)} ${(
        result.durationMs / 1_000
      ).toFixed(1)}s${blocked}`,
    );
  }
  console.log(
    `Total ${(summary.durationMs / 1_000).toFixed(1)}s; max concurrency ${
      summary.maxConcurrency
    }.`,
  );
}
