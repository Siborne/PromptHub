import type {
  SafetyScanAIConfig,
  SkillProject,
  SkillSafetyReport,
} from "@prompthub/shared/types";
import type { AIModelConfig } from "../settings/settings-types";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function getSafetyScanAIConfig(
  aiModels: AIModelConfig[],
): SafetyScanAIConfig | undefined {
  const chatModels = aiModels.filter(
    (model) => (model.type ?? "chat") === "chat",
  );
  const model =
    chatModels.find((candidate) => candidate.isDefault) ?? chatModels[0];
  if (!model?.apiKey || !model.apiUrl || !model.model) {
    return undefined;
  }
  return {
    provider: model.provider,
    apiProtocol: model.apiProtocol,
    apiKey: model.apiKey,
    apiUrl: model.apiUrl,
    model: model.model,
  };
}

const MAX_SOURCE_UPDATE_ERROR_LENGTH = 300;

function redactSourceErrorUrl(value: string): string {
  try {
    const parsed = new URL(value);
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, parsed.pathname === "/" ? "/" : "");
  } catch {
    return "[redacted-url]";
  }
}

export function sanitizeSourceUpdateError(error: unknown): string {
  const withoutQuerySecrets = getErrorMessage(error).replace(
    /https?:\/\/[^\s"'<>]+/g,
    (url) => redactSourceErrorUrl(url),
  );
  const redacted = withoutQuerySecrets.replace(
    /\b(token|key|secret|password|authorization)=([^\s&]+)/gi,
    "$1=[redacted]",
  );
  const normalized = redacted.replace(/\s+/g, " ").trim();
  return (
    normalized.slice(0, MAX_SOURCE_UPDATE_ERROR_LENGTH) || "Source check failed"
  );
}

const DEFAULT_PROJECT_SCAN_SUBDIRECTORIES = [
  ".claude/skills",
  ".agents/skills",
  "skills",
  ".gemini",
] as const;

function joinProjectPath(rootPath: string, subPath: string): string {
  const normalizedRoot = rootPath.replace(/[\\/]+$/, "");
  return `${normalizedRoot}/${subPath}`;
}

export function getProjectScanPaths(project: SkillProject): string[] {
  const explicitPaths = (project.scanPaths || [])
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const normalizedRootPath = project.rootPath.trim();
  if (!normalizedRootPath) {
    return explicitPaths;
  }

  return Array.from(
    new Set([
      ...DEFAULT_PROJECT_SCAN_SUBDIRECTORIES.map((subPath) =>
        joinProjectPath(normalizedRootPath, subPath),
      ),
      ...explicitPaths,
    ]),
  );
}

function stripSkillFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

/**
 * Compute a numeric safety score (0-100) from a SkillSafetyReport.
 * Higher score = safer.
 *   blocked   → 0–10   (based on finding count)
 *   high-risk → 20–40
 *   warn      → 50–70
 *   safe      → 80–100
 */
export function computeSafetyScore(report: SkillSafetyReport): number {
  const findingCount = (report.findings ?? []).length;
  switch (report.level) {
    case "blocked":
      return Math.max(0, 10 - findingCount * 2);
    case "high-risk":
      return Math.max(20, 40 - findingCount * 3);
    case "warn":
      return Math.max(50, 70 - findingCount * 4);
    case "safe":
      return Math.max(80, 100 - findingCount * 5);
    default:
      return 50;
  }
}

export function hasMeaningfulSkillBody(content?: string): boolean {
  if (typeof content !== "string") {
    return false;
  }

  const trimmed = content.trim();
  if (!trimmed) {
    return false;
  }

  const body = stripSkillFrontmatter(trimmed).trim();
  return body.length > 0;
}
