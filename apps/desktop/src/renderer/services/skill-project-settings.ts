import type { SkillProject } from "@prompthub/shared/types";

export const normalizeProjectRecordPath = (value: string): string =>
  value.trim();

function getDefaultDeployTargets(rootPath: string): string[] {
  const normalizedRoot = normalizeProjectRecordPath(rootPath).replace(
    /[\\/]+$/,
    "",
  );
  return normalizedRoot ? [`${normalizedRoot}/.agents/skills`] : [];
}

export function normalizeProjectDeployTargets(
  deployTargets: string[] | undefined,
  rootPath: string,
): string[] {
  return Array.from(
    new Set(
      (deployTargets ?? getDefaultDeployTargets(rootPath))
        .map(normalizeProjectRecordPath)
        .filter(Boolean),
    ),
  );
}

function isSkillProjectDraft(value: unknown): value is Partial<SkillProject> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const project = value as Partial<SkillProject>;
  return [project.id, project.name, project.rootPath].every(
    (field) => typeof field === "string",
  );
}

function normalizeProject(project: Partial<SkillProject>): SkillProject {
  const rootPath = project.rootPath!.trim();
  const scanPaths = Array.from(
    new Set(
      (Array.isArray(project.scanPaths) ? project.scanPaths : [])
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(
          (entry) =>
            Boolean(entry) && entry.toLowerCase() !== rootPath.toLowerCase(),
        ),
    ),
  );
  const now = Date.now();
  return {
    ...project,
    id: project.id!.trim(),
    name: project.name!.trim(),
    rootPath,
    scanPaths,
    deployTargets: normalizeProjectDeployTargets(
      Array.isArray(project.deployTargets)
        ? project.deployTargets.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : undefined,
      rootPath,
    ),
    createdAt: typeof project.createdAt === "number" ? project.createdAt : now,
    updatedAt: typeof project.updatedAt === "number" ? project.updatedAt : now,
    lastScannedAt:
      typeof project.lastScannedAt === "number"
        ? project.lastScannedAt
        : undefined,
  };
}

export function normalizeSkillProjects(value: unknown): SkillProject[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isSkillProjectDraft)
    .map(normalizeProject)
    .filter(
      (project) =>
        Boolean(project.id) &&
        Boolean(project.name) &&
        Boolean(project.rootPath),
    );
}
