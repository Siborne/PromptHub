import type {
  RegistrySkill,
  ScannedSkill,
} from "@prompthub/shared/types/skill";

export type CreateMode = "select" | "github" | "manual" | "scan" | "ai";

export function sanitizeSkillName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-]/g, "");
}

export function getRegistrySelectionKey(
  skill: Pick<RegistrySkill, "source_id" | "source_url" | "slug">,
): string {
  return skill.source_id || skill.source_url || skill.slug;
}

export function getImportModeButtonStyle(isActive: boolean) {
  return {
    backgroundColor: isActive ? "hsl(var(--primary))" : "transparent",
    color: isActive
      ? "hsl(var(--primary-foreground))"
      : "hsl(var(--muted-foreground))",
  };
}

export function buildStarterSkillContent(
  name: string,
  description: string,
): string {
  const safeDescription =
    description.trim() || `Use when the user asks for the ${name} workflow.`;
  return [
    "---",
    `name: ${name}`,
    `description: ${JSON.stringify(safeDescription)}`,
    "---",
    "",
    `# ${name}`,
    "",
    "## When to use",
    "",
    `Use this skill when ${safeDescription}`,
    "",
    "## Workflow",
    "",
    "1. Confirm the user's goal, inputs, constraints, and expected output.",
    "2. Inspect any relevant files, references, or existing project rules before acting.",
    "3. Execute the smallest reliable workflow that satisfies the request.",
    "4. Verify the result with a concrete command, file check, or observable output.",
    "",
    "## Package notes",
    "",
    "- Keep SKILL.md focused on the core workflow.",
    "- Put detailed reference material in references/ when it grows beyond the immediate workflow.",
    "- Put deterministic helper code in scripts/ when repeated execution matters.",
    "- Put templates or reusable output files in assets/.",
  ].join("\n");
}

export function getImportedScanCount(
  skills: Array<ScannedSkill & { isImported: boolean }>,
): number {
  return skills.filter((skill) => skill.isImported).length;
}

export function isCompleteImport(
  importedCount: number,
  skippedCount: number,
  failedCount: number,
): boolean {
  return importedCount > 0 && skippedCount === 0 && failedCount === 0;
}
